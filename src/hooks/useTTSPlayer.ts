/**
 * useTTSPlayer Hook
 *
 * TTS 오디오 재생을 관리하는 훅
 * - 음소거 상태 관리 (localStorage 연동)
 * - 자동 재생 및 에러 핸들링
 * - 비용 최적화: 음소거 시 TTS API 호출 스킵
 */

'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { voiceApi, type VoiceApiError } from '@/lib/api/voice';
import {
  setTTSMuted,
  setTTSPlaying,
  setTTSLoading,
  setTTSError,
} from '@/lib/store/chatSlice';

// =============================================================================
// Constants
// =============================================================================

const MUTE_STORAGE_KEY = 'soul_e_tts_muted';

// =============================================================================
// Types
// =============================================================================

interface UseTTSPlayerOptions {
  /** 재생 완료 후 호출되는 콜백 */
  onPlayComplete?: () => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: string) => void;
}

interface UseTTSPlayerReturn {
  /** 텍스트를 TTS로 변환 후 재생 */
  speak: (text: string) => Promise<void>;
  /** 재생 중지 */
  stop: () => void;
  /** 음소거 토글 */
  toggleMute: () => void;
  /** 음소거 상태 */
  isMuted: boolean;
  /** 재생 중인지 */
  isPlaying: boolean;
  /** TTS 로딩 중인지 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useTTSPlayer({
  onPlayComplete,
  onError,
}: UseTTSPlayerOptions = {}): UseTTSPlayerReturn {
  const dispatch = useAppDispatch();

  // Redux state
  const { isMuted, isPlaying, isLoading, error } = useAppSelector(
    (state) => state.chat.ttsMode
  );

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const onPlayCompleteRef = useRef(onPlayComplete);
  const onErrorRef = useRef(onError);

  // Update refs
  useEffect(() => {
    onPlayCompleteRef.current = onPlayComplete;
    onErrorRef.current = onError;
  }, [onPlayComplete, onError]);

  // Initialize mute state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMute = localStorage.getItem(MUTE_STORAGE_KEY);
      if (storedMute !== null) {
        dispatch(setTTSMuted(storedMute === 'true'));
      }
    }
  }, [dispatch]);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Toggle mute and persist to localStorage
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    dispatch(setTTSMuted(newMuted));

    if (typeof window !== 'undefined') {
      localStorage.setItem(MUTE_STORAGE_KEY, String(newMuted));
    }

    // 음소거 시 현재 재생 중지
    if (newMuted && audioRef.current) {
      audioRef.current.pause();
      dispatch(setTTSPlaying(false));
    }
  }, [isMuted, dispatch]);

  // Stop current playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    dispatch(setTTSPlaying(false));
  }, [dispatch]);

  // Speak text using TTS (streaming for faster playback)
  const speak = useCallback(async (text: string) => {
    // 음소거 상태면 요청하지 않음 (비용 절감)
    if (isMuted) {
      return;
    }

    // 빈 텍스트면 스킵
    if (!text || !text.trim()) {
      return;
    }

    // 이전 재생 정리
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    dispatch(setTTSLoading(true));
    dispatch(setTTSError(null));

    let hasStartedPlaying = false;
    let audio: HTMLAudioElement | null = null;

    try {
      // 스트리밍 TTS API 호출
      // 첫 청크가 충분히 도착하면 바로 재생 시작 (약 32KB 이상)
      const MIN_BYTES_TO_PLAY = 32 * 1024; // 32KB

      await voiceApi.synthesizeStream(text, (accumulatedBlob, isComplete) => {
        // 이미 재생 시작했으면 스킵 (완료 콜백 제외)
        if (hasStartedPlaying && !isComplete) {
          return;
        }

        // 충분한 데이터가 쌓였거나 완료되면 재생 시작
        if (!hasStartedPlaying && (accumulatedBlob.size >= MIN_BYTES_TO_PLAY || isComplete)) {
          hasStartedPlaying = true;

          // 이전 URL 정리
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
          }

          // 새 Audio 요소 생성
          const audioUrl = URL.createObjectURL(accumulatedBlob);
          audioUrlRef.current = audioUrl;

          audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onplay = () => {
            dispatch(setTTSPlaying(true));
            dispatch(setTTSLoading(false));
          };

          audio.onended = () => {
            dispatch(setTTSPlaying(false));
            onPlayCompleteRef.current?.();
          };

          audio.onerror = () => {
            dispatch(setTTSPlaying(false));
            dispatch(setTTSLoading(false));
            const errorMsg = '오디오 재생에 실패했습니다.';
            dispatch(setTTSError(errorMsg));
            onErrorRef.current?.(errorMsg);
          };

          // 재생 시작
          audio.play().catch((err) => {
            console.error('Audio play error:', err);
            dispatch(setTTSLoading(false));
          });
        }

        // 완료 시 최종 오디오로 교체 (끊김 없이 이어서 재생)
        if (isComplete && audio && audioRef.current === audio) {
          // 현재 재생 위치 저장
          const currentTime = audio.currentTime;
          const wasPlaying = !audio.paused;

          // 새 URL로 교체
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
          }
          const finalUrl = URL.createObjectURL(accumulatedBlob);
          audioUrlRef.current = finalUrl;

          // 새 오디오 요소 생성하고 이어서 재생
          const finalAudio = new Audio(finalUrl);
          finalAudio.currentTime = currentTime;
          audioRef.current = finalAudio;

          finalAudio.onplay = () => {
            dispatch(setTTSPlaying(true));
          };

          finalAudio.onended = () => {
            dispatch(setTTSPlaying(false));
            onPlayCompleteRef.current?.();
          };

          finalAudio.onerror = () => {
            dispatch(setTTSPlaying(false));
          };

          if (wasPlaying) {
            finalAudio.play().catch(console.error);
          }
        }
      });

      // 스트리밍이 끝났는데 아직 재생을 시작하지 못한 경우 (매우 짧은 텍스트)
      if (!hasStartedPlaying) {
        dispatch(setTTSLoading(false));
      }

    } catch (err) {
      const apiError = err as VoiceApiError;
      const errorMessage = apiError.message || 'TTS 변환에 실패했습니다.';
      dispatch(setTTSError(errorMessage));
      dispatch(setTTSLoading(false));
      onErrorRef.current?.(errorMessage);
    }
  }, [isMuted, dispatch]);

  return {
    speak,
    stop,
    toggleMute,
    isMuted,
    isPlaying,
    isLoading,
    error,
  };
}

export default useTTSPlayer;

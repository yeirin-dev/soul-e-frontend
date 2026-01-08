/**
 * useTTSPlayer Hook
 *
 * TTS 오디오 재생을 관리하는 훅
 * - 음소거 상태 관리 (localStorage 연동)
 * - 자동 재생 및 에러 핸들링
 * - 비용 최적화: 음소거 시 TTS API 호출 스킵
 * - 요청 취소 및 race condition 방지
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

// 최소 버퍼 크기: 8KB (32KB에서 축소 - 더 빠른 재생 시작)
const MIN_BYTES_TO_PLAY = 8 * 1024;

/**
 * 텍스트에서 이모지 제거
 * TTS가 이모지를 처리하려고 하면 음성이 겹치거나 이상해질 수 있음
 */
function removeEmojis(text: string): string {
  // 이모지 및 특수 유니코드 문자 제거
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{231A}-\u{231B}]/gu, '')   // Watch, Hourglass
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // Various symbols
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // Various symbols
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // Squares
    .replace(/[\u{25B6}]/gu, '')            // Play button
    .replace(/[\u{25C0}]/gu, '')            // Reverse button
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')   // Squares
    .replace(/[\u{2614}-\u{2615}]/gu, '')   // Umbrella, Hot beverage
    .replace(/[\u{2648}-\u{2653}]/gu, '')   // Zodiac
    .replace(/[\u{267F}]/gu, '')            // Wheelchair
    .replace(/[\u{2693}]/gu, '')            // Anchor
    .replace(/[\u{26A1}]/gu, '')            // High voltage
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')   // Circles
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')   // Soccer, Baseball
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')   // Snowman, Sun
    .replace(/[\u{26CE}]/gu, '')            // Ophiuchus
    .replace(/[\u{26D4}]/gu, '')            // No entry
    .replace(/[\u{26EA}]/gu, '')            // Church
    .replace(/[\u{26F2}-\u{26F3}]/gu, '')   // Fountain, Golf
    .replace(/[\u{26F5}]/gu, '')            // Sailboat
    .replace(/[\u{26FA}]/gu, '')            // Tent
    .replace(/[\u{26FD}]/gu, '')            // Fuel pump
    .replace(/[\u{2702}]/gu, '')            // Scissors
    .replace(/[\u{2705}]/gu, '')            // Check mark
    .replace(/[\u{2708}-\u{270D}]/gu, '')   // Airplane to Writing hand
    .replace(/[\u{270F}]/gu, '')            // Pencil
    .replace(/[\u{2712}]/gu, '')            // Black nib
    .replace(/[\u{2714}]/gu, '')            // Check mark
    .replace(/[\u{2716}]/gu, '')            // X mark
    .replace(/[\u{271D}]/gu, '')            // Latin cross
    .replace(/[\u{2721}]/gu, '')            // Star of David
    .replace(/[\u{2728}]/gu, '')            // Sparkles
    .replace(/[\u{2733}-\u{2734}]/gu, '')   // Eight spoked asterisk
    .replace(/[\u{2744}]/gu, '')            // Snowflake
    .replace(/[\u{2747}]/gu, '')            // Sparkle
    .replace(/[\u{274C}]/gu, '')            // Cross mark
    .replace(/[\u{274E}]/gu, '')            // Cross mark
    .replace(/[\u{2753}-\u{2755}]/gu, '')   // Question marks
    .replace(/[\u{2757}]/gu, '')            // Exclamation mark
    .replace(/[\u{2763}-\u{2764}]/gu, '')   // Heart exclamation, Heart
    .replace(/[\u{2795}-\u{2797}]/gu, '')   // Plus, Minus, Divide
    .replace(/[\u{27A1}]/gu, '')            // Right arrow
    .replace(/[\u{27B0}]/gu, '')            // Curly loop
    .replace(/[\u{27BF}]/gu, '')            // Double curly loop
    .replace(/[\u{2934}-\u{2935}]/gu, '')   // Arrows
    .replace(/[\u{2B05}-\u{2B07}]/gu, '')   // Arrows
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')   // Squares
    .replace(/[\u{2B50}]/gu, '')            // Star
    .replace(/[\u{2B55}]/gu, '')            // Circle
    .replace(/[\u{3030}]/gu, '')            // Wavy dash
    .replace(/[\u{303D}]/gu, '')            // Part alternation mark
    .replace(/[\u{3297}]/gu, '')            // Circled Ideograph Congratulation
    .replace(/[\u{3299}]/gu, '')            // Circled Ideograph Secret
    .replace(/\s+/g, ' ')                   // 연속 공백 제거
    .trim();
}

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<number>(0);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any ongoing request
      abortControllerRef.current?.abort();

      // Clean up audio
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Helper: cleanup previous audio and request
  const cleanupPrevious = useCallback(() => {
    // Abort any ongoing TTS request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop and cleanup previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // Toggle mute and persist to localStorage
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    dispatch(setTTSMuted(newMuted));

    if (typeof window !== 'undefined') {
      localStorage.setItem(MUTE_STORAGE_KEY, String(newMuted));
    }

    // 음소거 시 현재 재생 및 요청 중지
    if (newMuted) {
      cleanupPrevious();
      dispatch(setTTSPlaying(false));
      dispatch(setTTSLoading(false));
    }
  }, [isMuted, dispatch, cleanupPrevious]);

  // Stop current playback
  const stop = useCallback(() => {
    cleanupPrevious();
    dispatch(setTTSPlaying(false));
    dispatch(setTTSLoading(false));
  }, [dispatch, cleanupPrevious]);

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

    // 이모지 제거 (TTS가 이모지를 처리하면 음성이 겹칠 수 있음)
    const cleanText = removeEmojis(text);
    if (!cleanText) {
      return;
    }

    // 이전 재생 및 요청 정리
    cleanupPrevious();

    // 새 요청 ID 생성 (race condition 방지)
    const requestId = ++currentRequestIdRef.current;

    // 새 AbortController 생성
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    dispatch(setTTSLoading(true));
    dispatch(setTTSError(null));

    try {
      // 스트리밍으로 전체 오디오를 받은 후 재생
      // (초기 버퍼로 재생하면 첫 부분만 재생되는 문제 발생)
      const finalBlob = await voiceApi.synthesizeStream(
        cleanText,
        undefined, // 청크 콜백 사용 안함 - 전체 완료 후 재생
        abortController.signal
      );

      // Race condition 체크
      if (requestId !== currentRequestIdRef.current) {
        return;
      }

      // Abort 체크
      if (abortController.signal.aborted) {
        return;
      }

      // 새 Audio 요소 생성
      const audioUrl = URL.createObjectURL(finalBlob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        // Race condition 체크
        if (requestId !== currentRequestIdRef.current) return;
        dispatch(setTTSPlaying(true));
        dispatch(setTTSLoading(false));
      };

      audio.onended = () => {
        // Race condition 체크
        if (requestId !== currentRequestIdRef.current) return;
        dispatch(setTTSPlaying(false));
        onPlayCompleteRef.current?.();
      };

      audio.onerror = () => {
        // Race condition 체크
        if (requestId !== currentRequestIdRef.current) return;
        dispatch(setTTSPlaying(false));
        dispatch(setTTSLoading(false));
        const errorMsg = '오디오 재생에 실패했습니다.';
        dispatch(setTTSError(errorMsg));
        onErrorRef.current?.(errorMsg);
      };

      // 재생 시작
      audio.play().catch((err) => {
        // Race condition 체크
        if (requestId !== currentRequestIdRef.current) return;
        console.error('Audio play error:', err);
        dispatch(setTTSLoading(false));
      });

    } catch (err) {
      // Race condition 체크
      if (requestId !== currentRequestIdRef.current) {
        return;
      }

      const apiError = err as VoiceApiError;

      // Abort 에러는 무시 (의도적 취소)
      if (apiError.isAborted) {
        return;
      }

      const errorMessage = apiError.message || 'TTS 변환에 실패했습니다.';
      dispatch(setTTSError(errorMessage));
      dispatch(setTTSLoading(false));
      onErrorRef.current?.(errorMessage);
    }
  }, [isMuted, dispatch, cleanupPrevious]);

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

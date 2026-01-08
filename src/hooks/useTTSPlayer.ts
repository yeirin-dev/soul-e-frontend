/**
 * useTTSPlayer Hook
 *
 * TTS 오디오 재생을 관리하는 훅
 * - PCM 스트리밍 + Web Audio API로 실시간 재생
 * - 음소거 상태 관리 (localStorage 연동)
 * - 첫 청크 도착 즉시 재생 시작 (최소 지연)
 * - 요청 취소 및 race condition 방지
 */

'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { voiceApi, type VoiceApiError, type PCMAudioFormat } from '@/lib/api/voice';
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

/**
 * 텍스트에서 이모지 제거
 * TTS가 이모지를 처리하려고 하면 음성이 겹치거나 이상해질 수 있음
 */
function removeEmojis(text: string): string {
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

/** 재생 중인 오디오 소스 관리 */
interface PlayingSource {
  source: AudioBufferSourceNode;
  endTime: number;
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<number>(0);
  const playingSourcesRef = useRef<PlayingSource[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const isStreamingCompleteRef = useRef<boolean>(false);
  const onPlayCompleteRef = useRef(onPlayComplete);
  const onErrorRef = useRef(onError);
  // PCM 청크 경계가 샘플 경계와 맞지 않을 때 남은 바이트 버퍼
  const pendingByteRef = useRef<number | null>(null);

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
      abortControllerRef.current?.abort();
      cleanupAudio();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** AudioContext 가져오기 (lazy initialization) */
  const getAudioContext = useCallback((sampleRate: number): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext({ sampleRate });
    }
    return audioContextRef.current;
  }, []);

  /** 오디오 정리 */
  const cleanupAudio = useCallback(() => {
    // 모든 재생 중인 소스 중지
    playingSourcesRef.current.forEach(({ source }) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // 이미 중지된 경우 무시
      }
    });
    playingSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    isStreamingCompleteRef.current = false;
    pendingByteRef.current = null;

    // AudioContext 닫기
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  /** 이전 재생 및 요청 정리 */
  const cleanupPrevious = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanupAudio();
  }, [cleanupAudio]);

  /** 음소거 토글 */
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    dispatch(setTTSMuted(newMuted));

    if (typeof window !== 'undefined') {
      localStorage.setItem(MUTE_STORAGE_KEY, String(newMuted));
    }

    if (newMuted) {
      cleanupPrevious();
      dispatch(setTTSPlaying(false));
      dispatch(setTTSLoading(false));
    }
  }, [isMuted, dispatch, cleanupPrevious]);

  /** 재생 중지 */
  const stop = useCallback(() => {
    cleanupPrevious();
    dispatch(setTTSPlaying(false));
    dispatch(setTTSLoading(false));
  }, [dispatch, cleanupPrevious]);

  /** PCM Int16 → Float32 변환 */
  const int16ToFloat32 = useCallback((int16Array: Int16Array): Float32Array => {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }
    return float32Array;
  }, []);

  /** PCM 청크를 재생 큐에 추가 */
  const queuePCMChunk = useCallback((
    chunk: ArrayBuffer,
    format: PCMAudioFormat,
    requestId: number
  ) => {
    // Race condition 체크
    if (requestId !== currentRequestIdRef.current) return;

    const audioContext = getAudioContext(format.sampleRate);

    // suspended 상태면 resume
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // 청크 바이트 배열로 변환
    let bytes = new Uint8Array(chunk);

    // 이전 청크에서 남은 바이트가 있으면 앞에 추가
    if (pendingByteRef.current !== null) {
      const newBytes = new Uint8Array(bytes.length + 1);
      newBytes[0] = pendingByteRef.current;
      newBytes.set(bytes, 1);
      bytes = newBytes;
      pendingByteRef.current = null;
    }

    // 홀수 바이트면 마지막 바이트를 다음 청크용으로 저장
    if (bytes.length % 2 !== 0) {
      pendingByteRef.current = bytes[bytes.length - 1];
      bytes = bytes.slice(0, bytes.length - 1);
    }

    // 처리할 바이트가 없으면 스킵
    if (bytes.length === 0) return;

    // Int16 PCM → Float32 변환
    const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
    const float32Array = int16ToFloat32(int16Array);

    // AudioBuffer 생성
    const audioBuffer = audioContext.createBuffer(
      format.channels,
      float32Array.length,
      format.sampleRate
    );
    audioBuffer.getChannelData(0).set(float32Array);

    // AudioBufferSourceNode 생성
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    // 재생 시작 시간 계산
    const now = audioContext.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);

    // 재생 시작
    source.start(startTime);

    // 다음 청크 시작 시간 업데이트
    const duration = audioBuffer.duration;
    nextStartTimeRef.current = startTime + duration;

    // 재생 중인 소스 추적
    const endTime = startTime + duration;
    playingSourcesRef.current.push({ source, endTime });

    // 재생 종료 시 정리
    source.onended = () => {
      // Race condition 체크
      if (requestId !== currentRequestIdRef.current) return;

      // 완료된 소스 제거
      playingSourcesRef.current = playingSourcesRef.current.filter(
        (s) => s.source !== source
      );

      // 모든 재생 완료 && 스트리밍 완료 시 콜백 호출
      if (
        playingSourcesRef.current.length === 0 &&
        isStreamingCompleteRef.current
      ) {
        dispatch(setTTSPlaying(false));
        onPlayCompleteRef.current?.();
      }
    };
  }, [dispatch, getAudioContext, int16ToFloat32]);

  /** TTS 재생 (PCM 스트리밍) */
  const speak = useCallback(async (text: string) => {
    // 음소거 상태면 스킵
    if (isMuted) return;

    // 빈 텍스트면 스킵
    if (!text || !text.trim()) return;

    // 이모지 제거
    const cleanText = removeEmojis(text);
    if (!cleanText) return;

    // 이전 재생 정리
    cleanupPrevious();

    // 새 요청 ID
    const requestId = ++currentRequestIdRef.current;

    // AbortController 생성
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 상태 초기화
    isStreamingCompleteRef.current = false;
    dispatch(setTTSLoading(true));
    dispatch(setTTSError(null));

    let hasStartedPlaying = false;

    try {
      await voiceApi.synthesizeStreamPCM(
        cleanText,
        (chunk, format) => {
          // Race condition 체크
          if (requestId !== currentRequestIdRef.current) return;

          // 첫 청크 도착 시 재생 시작 표시
          if (!hasStartedPlaying) {
            hasStartedPlaying = true;
            dispatch(setTTSLoading(false));
            dispatch(setTTSPlaying(true));
          }

          // 청크 재생
          queuePCMChunk(chunk, format, requestId);
        },
        abortController.signal
      );

      // Race condition 체크
      if (requestId !== currentRequestIdRef.current) return;

      // 스트리밍 완료 표시
      isStreamingCompleteRef.current = true;

      // 재생할 청크가 없었으면 완료 처리
      if (!hasStartedPlaying) {
        dispatch(setTTSLoading(false));
      }

    } catch (err) {
      // Race condition 체크
      if (requestId !== currentRequestIdRef.current) return;

      const apiError = err as VoiceApiError;

      // Abort는 무시
      if (apiError.isAborted) return;

      const errorMessage = apiError.message || 'TTS 변환에 실패했습니다.';
      dispatch(setTTSError(errorMessage));
      dispatch(setTTSLoading(false));
      dispatch(setTTSPlaying(false));
      onErrorRef.current?.(errorMessage);
    }
  }, [isMuted, dispatch, cleanupPrevious, queuePCMChunk]);

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

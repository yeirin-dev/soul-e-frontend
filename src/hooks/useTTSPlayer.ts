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
  /**
   * AudioContext 사전 초기화 (Safari 호환)
   * 사용자 제스처(클릭, 터치) 이벤트 핸들러에서 호출해야 함
   */
  unlock: () => Promise<void>;
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

// Safari 호환성을 위한 AudioContext 타입
type AudioContextType = typeof AudioContext;
declare global {
  interface Window {
    webkitAudioContext?: AudioContextType;
  }
}

// Safari/iOS 감지
const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Safari 호환 AudioContext 생성
 * - Safari는 webkitAudioContext 사용 필요
 * - Safari는 특정 sample rate만 지원 (44100, 48000)
 * - Safari는 4개 AudioContext 인스턴스 제한이 있음
 */
function createAudioContext(preferredSampleRate?: number): AudioContext {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('Web Audio API를 지원하지 않는 브라우저입니다.');
  }

  // Safari/iOS는 sample rate 지정 시 문제 발생할 수 있음
  // 기본 sample rate 사용 후 리샘플링
  if (isSafari || isIOS) {
    return new AudioContextClass();
  }

  // 다른 브라우저는 원하는 sample rate 사용
  return new AudioContextClass({
    sampleRate: preferredSampleRate
  });
}

/**
 * AudioContext 상태가 재생 가능한지 확인
 * Safari iOS는 'suspended', 'interrupted' 상태 모두 처리 필요
 */
function isAudioContextPlayable(state: AudioContextState | 'interrupted'): boolean {
  return state === 'running';
}

/**
 * AudioContext resume 시도
 * Safari iOS의 'interrupted' 상태도 처리
 */
async function tryResumeAudioContext(audioContext: AudioContext): Promise<boolean> {
  const state = audioContext.state as AudioContextState | 'interrupted';

  if (state === 'running') {
    return true;
  }

  if (state === 'closed') {
    return false;
  }

  // 'suspended' 또는 'interrupted' 상태 처리
  try {
    await audioContext.resume();
    return audioContext.state === 'running';
  } catch (err) {
    console.warn('AudioContext resume failed:', err);
    return false;
  }
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
  // Safari/iOS 안전장치 타임아웃 ID
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Safari/iOS: 탭 전환이나 화면 복귀 시 AudioContext 자동 복구
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && audioContextRef.current) {
        const state = audioContextRef.current.state as AudioContextState | 'interrupted';

        // 'interrupted' 또는 'suspended' 상태면 resume 시도
        if (state === 'interrupted' || state === 'suspended') {
          console.log(`[TTS] Visibility changed to visible, AudioContext state: ${state}, attempting resume...`);
          const resumed = await tryResumeAudioContext(audioContextRef.current);
          console.log(`[TTS] AudioContext resume result: ${resumed}, new state: ${audioContextRef.current.state}`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /** AudioContext 가져오기 (lazy initialization) */
  const getAudioContext = useCallback((sampleRate: number): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = createAudioContext(sampleRate);
    }
    return audioContextRef.current;
  }, []);

  /**
   * PCM 데이터 리샘플링 (Safari 호환)
   * Safari의 AudioContext sample rate가 PCM sample rate와 다를 때 사용
   */
  const resamplePCM = useCallback((
    inputData: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Float32Array => {
    if (inputSampleRate === outputSampleRate) {
      return inputData;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.ceil(inputData.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
      const t = srcIndex - srcIndexFloor;

      // 선형 보간
      output[i] = inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t;
    }

    return output;
  }, []);

  /**
   * 현재 재생 중인 소스만 정리 (AudioContext는 유지)
   * Safari의 AudioContext 인스턴스 제한(4개)을 고려해 context는 재사용
   */
  const stopPlayingSources = useCallback(() => {
    // 안전장치 타이머 정리
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

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
  }, []);

  /**
   * 오디오 완전 정리 (AudioContext도 닫음)
   * 컴포넌트 언마운트 시에만 사용
   */
  const cleanupAudio = useCallback(() => {
    stopPlayingSources();

    // AudioContext 닫기 (언마운트 시에만)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [stopPlayingSources]);

  /** 이전 재생 및 요청 정리 (AudioContext는 재사용을 위해 유지) */
  const cleanupPrevious = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // AudioContext는 유지하고 재생 소스만 정리
    stopPlayingSources();
  }, [stopPlayingSources]);

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

  /**
   * AudioContext 사전 초기화 (Safari 호환)
   * Safari에서는 사용자 제스처 내에서 AudioContext를 생성/resume해야 함
   * 첫 사용자 상호작용(클릭, 터치) 시 호출 권장
   *
   * Safari/iOS 호환성 주의사항:
   * - 'suspended' 상태: 일반적인 일시정지, resume()으로 재개 가능
   * - 'interrupted' 상태: iOS Safari에서 탭 전환/화면 꺼짐 시 발생, resume()으로 재개 필요
   * - AudioContext 인스턴스 제한: Safari는 4개까지만 허용
   */
  const unlock = useCallback(async (): Promise<void> => {
    try {
      // 기존 context가 있으면 resume 시도
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        const state = audioContextRef.current.state as AudioContextState | 'interrupted';

        // 'suspended' 또는 'interrupted' 상태 모두 resume 시도
        if (state === 'suspended' || state === 'interrupted') {
          await tryResumeAudioContext(audioContextRef.current);
        }
        return;
      }

      // 새 AudioContext 생성 (기본 sample rate)
      const audioContext = createAudioContext();
      audioContextRef.current = audioContext;

      // Safari에서 필요한 무음 버퍼 재생으로 unlock
      await tryResumeAudioContext(audioContext);

      // 무음 버퍼를 짧게 재생하여 확실히 unlock (Safari warm-up)
      if (audioContext.state === 'running') {
        const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        source.stop(0.001);
      }
    } catch (err) {
      console.warn('AudioContext unlock failed:', err);
    }
  }, []);

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

    // suspended 또는 interrupted 상태면 resume (Safari/iOS에서 특히 중요)
    const state = audioContext.state as AudioContextState | 'interrupted';
    if (state === 'suspended' || state === 'interrupted') {
      tryResumeAudioContext(audioContext).catch(() => {
        // Safari에서 사용자 제스처 없이 resume 실패할 수 있음
        console.warn('AudioContext resume failed - may need user gesture');
      });
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
    let float32Array = int16ToFloat32(int16Array);

    // Safari 호환: AudioContext의 sample rate가 PCM과 다르면 리샘플링
    const contextSampleRate = audioContext.sampleRate;
    if (contextSampleRate !== format.sampleRate) {
      float32Array = resamplePCM(float32Array, format.sampleRate, contextSampleRate);
    }

    // AudioBuffer 생성 (AudioContext의 sample rate 사용)
    const audioBuffer = audioContext.createBuffer(
      format.channels,
      float32Array.length,
      contextSampleRate
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
        // 안전장치 타이머 정리
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        dispatch(setTTSPlaying(false));
        onPlayCompleteRef.current?.();
      }
    };
  }, [dispatch, getAudioContext, int16ToFloat32, resamplePCM]);

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

    // Safari/iOS 안전장치: 오디오가 30초 이상 재생되지 않으면 강제 완료
    // (AudioContext 문제로 onended가 호출되지 않는 경우 대비)
    const clearSafetyTimeout = () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
    const setSafetyTimeout = () => {
      clearSafetyTimeout();
      safetyTimeoutRef.current = setTimeout(() => {
        if (requestId === currentRequestIdRef.current && playingSourcesRef.current.length > 0) {
          console.warn('[TTS] Safety timeout triggered - forcing playback completion');
          stopPlayingSources();
          dispatch(setTTSPlaying(false));
          onPlayCompleteRef.current?.();
        }
      }, 30000); // 30초 타임아웃
    };

    try {
      // Safari/iOS: 재생 전 AudioContext 상태 확인 및 resume
      if (audioContextRef.current) {
        const state = audioContextRef.current.state as AudioContextState | 'interrupted';
        if (state === 'suspended' || state === 'interrupted') {
          console.log(`[TTS] AudioContext state is ${state}, attempting resume before speak...`);
          await tryResumeAudioContext(audioContextRef.current);
        }
      }

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
            setSafetyTimeout(); // 안전장치 타이머 시작
          }

          // 청크 재생
          queuePCMChunk(chunk, format, requestId);
        },
        abortController.signal
      );

      // Race condition 체크
      if (requestId !== currentRequestIdRef.current) {
        clearSafetyTimeout();
        return;
      }

      // 스트리밍 완료 표시
      isStreamingCompleteRef.current = true;

      // 재생할 청크가 없었으면 완료 처리
      if (!hasStartedPlaying) {
        clearSafetyTimeout();
        dispatch(setTTSLoading(false));
        dispatch(setTTSPlaying(false));
      } else {
        // 스트리밍은 완료됐는데 모든 오디오가 이미 재생 완료된 경우 처리
        // (onended 콜백이 isStreamingCompleteRef.current = true 이전에 실행된 경우)
        if (playingSourcesRef.current.length === 0) {
          clearSafetyTimeout();
          dispatch(setTTSPlaying(false));
          onPlayCompleteRef.current?.();
        }
      }

    } catch (err) {
      // 안전장치 타이머 정리
      clearSafetyTimeout();

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
  }, [isMuted, dispatch, cleanupPrevious, stopPlayingSources, queuePCMChunk]);

  return {
    speak,
    stop,
    toggleMute,
    unlock,
    isMuted,
    isPlaying,
    isLoading,
    error,
  };
}

export default useTTSPlayer;

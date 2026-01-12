/**
 * useVoiceRecorder Hook
 *
 * VAD(Voice Activity Detection)를 사용한 음성 녹음 훅
 * - 발화 시작/종료 자동 감지
 * - 발화 종료 시 자동으로 STT 처리
 * - 변환된 텍스트 콜백으로 전달 (자동 전송)
 * - 버튼 클릭 시에만 마이크 권한 요청 (lazy initialization)
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { MicVAD, utils } from '@ricky0123/vad-web';
import { useDispatch, useSelector } from 'react-redux';
import { voiceApi, type VoiceApiError } from '@/lib/api/voice';
import {
  setVoiceListening,
  setVoiceRecording,
  setVoiceTranscribing,
  setVoiceError,
  resetVoiceMode,
} from '@/lib/store/chatSlice';
import type { RootState } from '@/lib/store';

// =============================================================================
// Types
// =============================================================================

interface UseVoiceRecorderOptions {
  /** STT 완료 후 호출되는 콜백 (자동 전송용) */
  onTranscription: (text: string) => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: string) => void;
  /** VAD 민감도 (0-1, 기본값: 0.5) */
  positiveSpeechThreshold?: number;
  /** 최소 발화 시간 (ms, 기본값: 250) */
  minSpeechMs?: number;
}

interface UseVoiceRecorderReturn {
  /** 음성 모드 시작 */
  startListening: () => void;
  /** 음성 모드 중지 */
  stopListening: () => void;
  /** 일시정지 (TTS 재생 중 에코 방지) */
  pauseListening: () => void;
  /** 일시정지 해제 */
  resumeListening: () => void;
  /** 현재 청취 중인지 */
  isListening: boolean;
  /** 일시정지 상태인지 */
  isPaused: boolean;
  /** 발화 감지되어 녹음 중인지 */
  isRecording: boolean;
  /** STT 처리 중인지 */
  isTranscribing: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** VAD 로딩 중 여부 */
  isVADLoading: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useVoiceRecorder({
  onTranscription,
  onError,
  positiveSpeechThreshold = 0.5,
  minSpeechMs = 250,
}: UseVoiceRecorderOptions): UseVoiceRecorderReturn {
  const dispatch = useDispatch();

  // Redux state
  const { isListening, isRecording, isTranscribing, error } = useSelector(
    (state: RootState) => state.chat.voiceMode
  );

  // Local state
  const [isVADLoading, setIsVADLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Refs
  const vadRef = useRef<MicVAD | null>(null);
  const onTranscriptionRef = useRef(onTranscription);
  const onErrorRef = useRef(onError);

  // Update refs
  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
    onErrorRef.current = onError;
  }, [onTranscription, onError]);

  // Handle STT transcription
  const handleSpeechEnd = useCallback(async (audio: Float32Array) => {
    dispatch(setVoiceRecording(false));
    dispatch(setVoiceTranscribing(true));

    try {
      // [DEBUG] VAD 오디오 정보
      console.log('[VAD STT Debug] Audio samples:', {
        length: audio.length,
        duration: audio.length / 16000, // VAD는 16kHz 사용
      });

      // [DEBUG] 오디오 레벨 분석
      let sumSquares = 0;
      let maxAbs = 0;
      for (let i = 0; i < audio.length; i++) {
        sumSquares += audio[i] * audio[i];
        maxAbs = Math.max(maxAbs, Math.abs(audio[i]));
      }
      const rms = Math.sqrt(sumSquares / audio.length);
      console.log('[VAD STT Debug] Audio levels:', {
        rms: rms.toFixed(6),
        maxAmplitude: maxAbs.toFixed(6),
        isSilent: rms < 0.01,
      });

      // 오디오가 거의 무음이면 경고
      if (rms < 0.005) {
        console.warn('[VAD STT Debug] Audio is nearly silent! RMS:', rms);
        dispatch(setVoiceError('🔇 소리가 잘 안 들려요. 마이크에 더 가까이 말해주세요!'));
        onErrorRef.current?.('마이크 소리가 너무 작습니다.');
        return;
      }

      // Convert Float32Array to WAV ArrayBuffer, then to Blob
      const wavArrayBuffer = utils.encodeWAV(audio);
      const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

      console.log('[VAD STT Debug] WAV blob size:', wavBlob.size);

      // Call STT API
      const result = await voiceApi.transcribe(wavBlob, 'recording.wav');

      console.log('[VAD STT Debug] STT result:', result);

      if (result.text && result.text.trim()) {
        // 자동 전송: 콜백 호출
        onTranscriptionRef.current(result.text.trim());
      } else {
        dispatch(setVoiceError('🤔 무슨 말인지 잘 못 들었어요. 천천히 다시 말해줄래요?'));
        onErrorRef.current?.('음성이 인식되지 않았습니다.');
      }
    } catch (err) {
      console.error('[VAD STT Debug] Error:', err);
      const apiError = err as VoiceApiError;
      const errorMessage = apiError.message || '😥 음성 인식에 문제가 생겼어요. 잠시 후 다시 시도해주세요!';
      dispatch(setVoiceError(errorMessage));
      onErrorRef.current?.(errorMessage);
    } finally {
      dispatch(setVoiceTranscribing(false));
    }
  }, [dispatch]);

  // Initialize VAD (lazy - only when startListening is called)
  const initializeVAD = useCallback(async () => {
    if (vadRef.current) {
      return vadRef.current;
    }

    setIsVADLoading(true);

    try {
      const vad = await MicVAD.new({
        positiveSpeechThreshold,
        minSpeechMs,
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/',
        onSpeechStart: () => {
          dispatch(setVoiceRecording(true));
          dispatch(setVoiceError(null));
        },
        onSpeechEnd: (audio) => {
          handleSpeechEnd(audio);
        },
        onVADMisfire: () => {
          dispatch(setVoiceRecording(false));
        },
      });

      vadRef.current = vad;
      setIsVADLoading(false);
      return vad;
    } catch (err) {
      setIsVADLoading(false);
      const errorMessage = '🎙️ 마이크 사용을 허용해주세요! 브라우저 설정에서 마이크 권한을 확인해주세요.';
      dispatch(setVoiceError(errorMessage));
      onErrorRef.current?.(errorMessage);
      throw err;
    }
  }, [positiveSpeechThreshold, minSpeechMs, dispatch, handleSpeechEnd]);

  // Start listening (initializes VAD on first call)
  const startListening = useCallback(async () => {
    dispatch(resetVoiceMode());

    try {
      const vad = await initializeVAD();
      await vad.start();
      dispatch(setVoiceListening(true));
    } catch (err) {
      console.error('Failed to start VAD:', err);
    }
  }, [initializeVAD, dispatch]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (vadRef.current) {
      await vadRef.current.pause();
    }
    dispatch(setVoiceListening(false));
    dispatch(resetVoiceMode());
    setIsPaused(false);
  }, [dispatch]);

  // Pause listening (TTS 재생 중 에코 방지용)
  const pauseListening = useCallback(async () => {
    if (vadRef.current && isListening && !isPaused) {
      await vadRef.current.pause();
      setIsPaused(true);
    }
  }, [isListening, isPaused]);

  // Resume listening (TTS 재생 완료 후)
  const resumeListening = useCallback(async () => {
    if (vadRef.current && isListening && isPaused) {
      await vadRef.current.start();
      setIsPaused(false);
    }
  }, [isListening, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
    };
  }, []);

  return {
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    isListening,
    isPaused,
    isRecording,
    isTranscribing,
    error,
    isVADLoading,
  };
}

export default useVoiceRecorder;

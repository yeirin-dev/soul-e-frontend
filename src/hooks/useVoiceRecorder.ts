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
  /** 현재 청취 중인지 */
  isListening: boolean;
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
      // Convert Float32Array to WAV ArrayBuffer, then to Blob
      const wavArrayBuffer = utils.encodeWAV(audio);
      const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

      // Call STT API
      const result = await voiceApi.transcribe(wavBlob, 'recording.wav');

      if (result.text && result.text.trim()) {
        // 자동 전송: 콜백 호출
        onTranscriptionRef.current(result.text.trim());
      } else {
        dispatch(setVoiceError('음성이 인식되지 않았습니다. 다시 말씀해주세요.'));
        onErrorRef.current?.('음성이 인식되지 않았습니다.');
      }
    } catch (err) {
      const apiError = err as VoiceApiError;
      const errorMessage = apiError.message || '음성 인식에 실패했습니다.';
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
      const errorMessage = '마이크 권한을 허용해주세요.';
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
  }, [dispatch]);

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
    isListening,
    isRecording,
    isTranscribing,
    error,
    isVADLoading,
  };
}

export default useVoiceRecorder;

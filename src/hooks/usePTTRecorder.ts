/**
 * usePTTRecorder Hook
 *
 * PTT(Push-to-Talk) 방식의 음성 녹음 훅
 * - 버튼 클릭으로 녹음 시작/종료 제어
 * - 녹음 종료 시 자동으로 STT 처리
 * - 변환된 텍스트 콜백으로 전달 (자동 전송)
 * - VAD를 사용하지 않아 가볍고 빠름
 */

'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
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

interface UsePTTRecorderOptions {
  /** STT 완료 후 호출되는 콜백 (자동 전송용) */
  onTranscription: (text: string) => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: string) => void;
}

interface UsePTTRecorderReturn {
  /** 녹음 시작 (PTT) */
  startRecording: () => Promise<void>;
  /** 녹음 종료 및 STT 전송 (PTT) */
  stopRecording: () => void;
  /** 녹음 취소 (전송하지 않음) */
  cancelRecording: () => void;
  /** 현재 녹음 중인지 */
  isRecording: boolean;
  /** STT 처리 중인지 */
  isTranscribing: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 마이크 초기화 중 여부 */
  isInitializing: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * AudioBuffer를 WAV 형식으로 인코딩
 */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write samples
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePTTRecorder({
  onTranscription,
  onError,
}: UsePTTRecorderOptions): UsePTTRecorderReturn {
  const dispatch = useDispatch();

  // Redux state
  const { isRecording, isTranscribing, error } = useSelector(
    (state: RootState) => state.chat.voiceMode
  );

  // Local state
  const [isInitializing, setIsInitializing] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptionRef = useRef(onTranscription);
  const onErrorRef = useRef(onError);
  const isCancelledRef = useRef(false);

  // Update refs
  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
    onErrorRef.current = onError;
  }, [onTranscription, onError]);

  // Handle recorded audio and send to STT
  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (isCancelledRef.current) {
      isCancelledRef.current = false;
      return;
    }

    dispatch(setVoiceRecording(false));
    dispatch(setVoiceTranscribing(true));

    try {
      // Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Decode audio data
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get audio samples (mono)
      const samples = audioBuffer.getChannelData(0);

      // Encode to WAV
      const wavBuffer = encodeWAV(samples, audioBuffer.sampleRate);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      // Call STT API
      const result = await voiceApi.transcribe(wavBlob, 'recording.wav');

      if (result.text && result.text.trim()) {
        // 자동 전송: 콜백 호출
        onTranscriptionRef.current(result.text.trim());
      } else {
        dispatch(setVoiceError('음성이 인식되지 않았습니다. 다시 말씀해주세요.'));
        onErrorRef.current?.('음성이 인식되지 않았습니다.');
      }

      audioContext.close();
    } catch (err) {
      const apiError = err as VoiceApiError;
      const errorMessage = apiError.message || '음성 인식에 실패했습니다.';
      dispatch(setVoiceError(errorMessage));
      onErrorRef.current?.(errorMessage);
    } finally {
      dispatch(setVoiceTranscribing(false));
    }
  }, [dispatch]);

  // Start recording
  const startRecording = useCallback(async () => {
    dispatch(resetVoiceMode());
    setIsInitializing(true);
    isCancelledRef.current = false;

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      dispatch(setVoiceRecording(true));
      dispatch(setVoiceListening(true));
      setIsInitializing(false);
    } catch (err) {
      setIsInitializing(false);
      const errorMessage = '마이크 권한을 허용해주세요.';
      dispatch(setVoiceError(errorMessage));
      onErrorRef.current?.(errorMessage);
      console.error('Failed to start recording:', err);
    }
  }, [dispatch, processAudio]);

  // Stop recording and send to STT
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    dispatch(setVoiceListening(false));
  }, [dispatch]);

  // Cancel recording (don't send to STT)
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    dispatch(setVoiceRecording(false));
    dispatch(setVoiceListening(false));
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    isTranscribing,
    error,
    isInitializing,
  };
}

export default usePTTRecorder;

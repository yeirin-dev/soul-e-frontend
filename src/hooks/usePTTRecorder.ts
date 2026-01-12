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
import {
  acquireMicrophoneStream,
  disableMicrophoneTracks,
  enableMicrophoneTracks,
  getMicrophoneState,
} from './useMicrophoneManager';

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
  /** 마이크 일시정지 (TTS 재생 중 에코 방지) */
  pauseMic: () => void;
  /** 마이크 재개 (TTS 재생 완료 후) */
  resumeMic: () => void;
  /** 현재 녹음 중인지 */
  isRecording: boolean;
  /** 마이크 일시정지 상태인지 */
  isMicPaused: boolean;
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
  const [isMicPaused, setIsMicPaused] = useState(false);

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
      // [DEBUG] 원본 Blob 정보
      console.log('[STT Debug] Original blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      // 녹음 데이터가 너무 작으면 (1KB 미만) 무시
      if (audioBlob.size < 1000) {
        console.warn('[STT Debug] Audio blob too small, skipping');
        dispatch(setVoiceError('🎤 녹음이 너무 짧아요. 버튼을 조금 더 길게 누르고 말해주세요!'));
        onErrorRef.current?.('녹음이 너무 짧습니다.');
        return;
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Decode audio data
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // [DEBUG] 디코딩된 오디오 정보
      console.log('[STT Debug] Decoded audio:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
      });

      // 녹음 시간이 너무 짧으면 (0.5초 미만) 무시
      if (audioBuffer.duration < 0.5) {
        console.warn('[STT Debug] Audio too short:', audioBuffer.duration);
        dispatch(setVoiceError('⏱️ 녹음이 너무 짧아요. 조금 더 길게 말해주세요!'));
        onErrorRef.current?.('녹음이 너무 짧습니다.');
        audioContext.close();
        return;
      }

      // Get audio samples (mono)
      const samples = audioBuffer.getChannelData(0);

      // [DEBUG] 오디오 레벨 분석 (RMS 계산)
      let sumSquares = 0;
      let maxAbs = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
        maxAbs = Math.max(maxAbs, Math.abs(samples[i]));
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      console.log('[STT Debug] Audio levels:', {
        rms: rms.toFixed(6),
        maxAmplitude: maxAbs.toFixed(6),
        isSilent: rms < 0.01,
        samplesCount: samples.length,
      });

      // 오디오가 거의 무음이면 경고
      if (rms < 0.005) {
        console.warn('[STT Debug] Audio is nearly silent! RMS:', rms);
        dispatch(setVoiceError('🔇 소리가 잘 안 들려요. 마이크에 더 가까이 말해주세요!'));
        onErrorRef.current?.('마이크 소리가 너무 작습니다.');
        audioContext.close();
        return;
      }

      // Encode to WAV
      const wavBuffer = encodeWAV(samples, audioBuffer.sampleRate);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      console.log('[STT Debug] WAV blob size:', wavBlob.size);

      // Call STT API
      const result = await voiceApi.transcribe(wavBlob, 'recording.wav');

      console.log('[STT Debug] STT result:', result);

      if (result.text && result.text.trim()) {
        // 자동 전송: 콜백 호출
        onTranscriptionRef.current(result.text.trim());
      } else {
        dispatch(setVoiceError('🤔 무슨 말인지 잘 못 들었어요. 천천히 다시 말해줄래요?'));
        onErrorRef.current?.('음성이 인식되지 않았습니다.');
      }

      audioContext.close();
    } catch (err) {
      console.error('[STT Debug] Error:', err);
      const apiError = err as VoiceApiError;
      const errorMessage = apiError.message || '😥 음성 인식에 문제가 생겼어요. 잠시 후 다시 시도해주세요!';
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
      // 마이크 매니저를 통해 스트림 획득 (이미 있으면 재사용)
      const stream = await acquireMicrophoneStream({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      streamRef.current = stream;

      // [DEBUG] 마이크 트랙 정보
      const audioTrack = stream.getAudioTracks()[0];
      const micState = getMicrophoneState();
      console.log('[PTT Debug] Audio track (via MicManager):', {
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
        settings: audioTrack.getSettings(),
        micManagerState: micState,
      });

      // 지원되는 mimeType 선택
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      console.log('[PTT Debug] Selected mimeType:', selectedMimeType);

      if (!selectedMimeType) {
        throw new Error('🔊 이 브라우저에서는 음성 녹음을 지원하지 않아요. Chrome이나 Safari를 사용해주세요!');
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('[PTT Debug] Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[PTT Debug] Recording stopped, chunks:', chunksRef.current.length);
        const totalSize = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('[PTT Debug] Total recorded size:', totalSize, 'bytes');

        const audioBlob = new Blob(chunksRef.current, { type: selectedMimeType });
        chunksRef.current = [];
        processAudio(audioBlob);
      };

      // timeslice를 사용하여 주기적으로 데이터 수집 (500ms마다)
      mediaRecorder.start(500);
      console.log('[PTT Debug] Recording started with mimeType:', selectedMimeType);

      dispatch(setVoiceRecording(true));
      dispatch(setVoiceListening(true));
      setIsInitializing(false);
    } catch (err) {
      setIsInitializing(false);
      const errorMessage = '🎙️ 마이크 사용을 허용해주세요! 브라우저 설정에서 마이크 권한을 확인해주세요.';
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

    // 트랙을 완전히 종료하지 않고 비활성화만 함 (Android 권한 재요청 방지)
    // streamRef는 유지하되, 마이크 매니저가 관리하는 전역 스트림은 비활성화
    disableMicrophoneTracks();

    dispatch(setVoiceListening(false));
  }, [dispatch]);

  // Cancel recording (don't send to STT)
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // 트랙을 완전히 종료하지 않고 비활성화만 함 (Android 권한 재요청 방지)
    disableMicrophoneTracks();

    chunksRef.current = [];
    dispatch(setVoiceRecording(false));
    dispatch(setVoiceListening(false));
  }, [dispatch]);

  // Pause mic (TTS 재생 중 에코 방지용)
  const pauseMic = useCallback(() => {
    if (!isMicPaused) {
      disableMicrophoneTracks();
      setIsMicPaused(true);
    }
  }, [isMicPaused]);

  // Resume mic (TTS 재생 완료 후)
  const resumeMic = useCallback(() => {
    if (isMicPaused) {
      enableMicrophoneTracks();
      setIsMicPaused(false);
    }
  }, [isMicPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // 마이크 스트림은 전역적으로 관리되므로 unmount 시 종료하지 않음
      // 트랙만 비활성화하여 다음 사용 시 재활용 가능하게 함
      disableMicrophoneTracks();

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    pauseMic,
    resumeMic,
    isRecording,
    isMicPaused,
    isTranscribing,
    error,
    isInitializing,
  };
}

export default usePTTRecorder;

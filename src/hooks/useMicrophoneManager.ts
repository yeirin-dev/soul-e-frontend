/**
 * useMicrophoneManager Hook
 *
 * 마이크 스트림을 전역적으로 관리하여 Android에서 반복적인 권한 요청을 방지
 * - MediaStream을 세션 동안 유지하고 재사용
 * - track.stop() 대신 track.enabled로 제어
 * - 권한 상태 캐싱
 */

'use client';

// =============================================================================
// Global Microphone Stream Manager (Singleton)
// =============================================================================

interface MicrophoneState {
  stream: MediaStream | null;
  permissionGranted: boolean;
  isAcquiring: boolean;
  lastError: string | null;
}

const microphoneState: MicrophoneState = {
  stream: null,
  permissionGranted: false,
  isAcquiring: false,
  lastError: null,
};

// 권한 변경 리스너들
const permissionListeners: Set<() => void> = new Set();

function notifyListeners() {
  permissionListeners.forEach(listener => listener());
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 현재 스트림이 유효한지 확인
 */
function isStreamValid(stream: MediaStream | null): boolean {
  if (!stream) return false;

  const tracks = stream.getAudioTracks();
  if (tracks.length === 0) return false;

  // 모든 트랙이 ended 상태가 아닌지 확인
  return tracks.some(track => track.readyState === 'live');
}

/**
 * 마이크 권한 상태 확인 (브라우저 지원 시)
 */
async function checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    // Safari는 permissions API를 완전히 지원하지 않음
    return 'unknown';
  }
}

// =============================================================================
// Microphone Manager API
// =============================================================================

/**
 * 마이크 스트림 획득 (이미 있으면 재사용)
 */
export async function acquireMicrophoneStream(
  constraints?: MediaTrackConstraints
): Promise<MediaStream> {
  // 이미 유효한 스트림이 있으면 재사용
  if (isStreamValid(microphoneState.stream)) {
    console.log('[MicManager] Reusing existing stream');

    // 트랙 활성화 확인 및 복원
    const tracks = microphoneState.stream!.getAudioTracks();
    tracks.forEach(track => {
      if (!track.enabled) {
        track.enabled = true;
        console.log('[MicManager] Re-enabled track:', track.label);
      }
    });

    return microphoneState.stream!;
  }

  // 동시에 여러 요청이 오는 것을 방지
  if (microphoneState.isAcquiring) {
    console.log('[MicManager] Already acquiring, waiting...');

    // 획득 완료까지 대기
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!microphoneState.isAcquiring) {
          clearInterval(checkInterval);
          if (microphoneState.stream && isStreamValid(microphoneState.stream)) {
            resolve(microphoneState.stream);
          } else {
            reject(new Error(microphoneState.lastError || 'Failed to acquire microphone'));
          }
        }
      }, 100);

      // 10초 타임아웃
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Microphone acquisition timeout'));
      }, 10000);
    });
  }

  microphoneState.isAcquiring = true;
  microphoneState.lastError = null;

  try {
    console.log('[MicManager] Acquiring new microphone stream');

    // 권한 상태 사전 확인
    const permStatus = await checkPermissionStatus();
    console.log('[MicManager] Permission status:', permStatus);

    if (permStatus === 'denied') {
      throw new Error('마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
    }

    // 기본 오디오 설정
    const defaultConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...constraints,
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: defaultConstraints,
    });

    // 트랙 종료 이벤트 리스너 추가
    const tracks = stream.getAudioTracks();
    tracks.forEach(track => {
      track.addEventListener('ended', () => {
        console.log('[MicManager] Track ended:', track.label);

        // 모든 트랙이 종료되면 스트림 무효화
        if (!isStreamValid(stream)) {
          microphoneState.stream = null;
          microphoneState.permissionGranted = false;
          notifyListeners();
        }
      });

      console.log('[MicManager] Track acquired:', {
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
      });
    });

    microphoneState.stream = stream;
    microphoneState.permissionGranted = true;
    microphoneState.isAcquiring = false;

    notifyListeners();

    return stream;
  } catch (err) {
    console.error('[MicManager] Failed to acquire microphone:', err);

    microphoneState.isAcquiring = false;
    microphoneState.lastError = err instanceof Error ? err.message : 'Unknown error';

    notifyListeners();
    throw err;
  }
}

/**
 * 마이크 트랙 비활성화 (스트림 유지)
 * - Android에서 반복 권한 요청 방지
 */
export function disableMicrophoneTracks(): void {
  if (!microphoneState.stream) return;

  const tracks = microphoneState.stream.getAudioTracks();
  tracks.forEach(track => {
    if (track.enabled) {
      track.enabled = false;
      console.log('[MicManager] Disabled track:', track.label);
    }
  });
}

/**
 * 마이크 트랙 활성화
 */
export function enableMicrophoneTracks(): void {
  if (!microphoneState.stream) return;

  const tracks = microphoneState.stream.getAudioTracks();
  tracks.forEach(track => {
    if (!track.enabled) {
      track.enabled = true;
      console.log('[MicManager] Enabled track:', track.label);
    }
  });
}

/**
 * 마이크 스트림 완전 종료
 * - 앱 종료/로그아웃 시에만 사용
 */
export function releaseMicrophoneStream(): void {
  if (!microphoneState.stream) return;

  console.log('[MicManager] Releasing microphone stream');

  const tracks = microphoneState.stream.getAudioTracks();
  tracks.forEach(track => {
    track.stop();
  });

  microphoneState.stream = null;
  microphoneState.permissionGranted = false;

  notifyListeners();
}

/**
 * 현재 마이크 상태 조회
 */
export function getMicrophoneState(): {
  hasStream: boolean;
  isValid: boolean;
  permissionGranted: boolean;
  isAcquiring: boolean;
  trackInfo: Array<{ label: string; enabled: boolean; readyState: string }>;
} {
  return {
    hasStream: !!microphoneState.stream,
    isValid: isStreamValid(microphoneState.stream),
    permissionGranted: microphoneState.permissionGranted,
    isAcquiring: microphoneState.isAcquiring,
    trackInfo: microphoneState.stream
      ? microphoneState.stream.getAudioTracks().map(track => ({
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
        }))
      : [],
  };
}

/**
 * 권한 변경 리스너 등록
 */
export function addMicrophoneListener(listener: () => void): () => void {
  permissionListeners.add(listener);
  return () => permissionListeners.delete(listener);
}

/**
 * 마이크 스트림 클론 생성 (VAD 등 별도 컨텍스트 필요 시)
 */
export async function cloneMicrophoneStream(): Promise<MediaStream | null> {
  if (!isStreamValid(microphoneState.stream)) {
    return null;
  }

  try {
    // 기존 스트림의 트랙을 클론하여 새 스트림 생성
    const clonedStream = microphoneState.stream!.clone();
    console.log('[MicManager] Cloned stream created');
    return clonedStream;
  } catch (err) {
    console.error('[MicManager] Failed to clone stream:', err);
    return null;
  }
}

// =============================================================================
// React Hook
// =============================================================================

import { useCallback, useEffect, useState } from 'react';

interface UseMicrophoneManagerReturn {
  /** 마이크 스트림 획득 */
  acquireStream: (constraints?: MediaTrackConstraints) => Promise<MediaStream>;
  /** 마이크 비활성화 (스트림 유지) */
  disableMic: () => void;
  /** 마이크 활성화 */
  enableMic: () => void;
  /** 마이크 스트림 완전 종료 */
  releaseStream: () => void;
  /** 현재 스트림이 유효한지 */
  isStreamValid: boolean;
  /** 권한 부여됨 */
  permissionGranted: boolean;
  /** 스트림 획득 중 */
  isAcquiring: boolean;
}

export function useMicrophoneManager(): UseMicrophoneManagerReturn {
  const [state, setState] = useState(() => getMicrophoneState());

  // 상태 변경 구독
  useEffect(() => {
    const unsubscribe = addMicrophoneListener(() => {
      setState(getMicrophoneState());
    });
    return unsubscribe;
  }, []);

  const acquireStream = useCallback(async (constraints?: MediaTrackConstraints) => {
    return acquireMicrophoneStream(constraints);
  }, []);

  const disableMic = useCallback(() => {
    disableMicrophoneTracks();
    setState(getMicrophoneState());
  }, []);

  const enableMic = useCallback(() => {
    enableMicrophoneTracks();
    setState(getMicrophoneState());
  }, []);

  const releaseStream = useCallback(() => {
    releaseMicrophoneStream();
  }, []);

  return {
    acquireStream,
    disableMic,
    enableMic,
    releaseStream,
    isStreamValid: state.isValid,
    permissionGranted: state.permissionGranted,
    isAcquiring: state.isAcquiring,
  };
}

export default useMicrophoneManager;

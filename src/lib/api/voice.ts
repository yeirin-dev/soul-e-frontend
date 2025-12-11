/**
 * Voice API Client
 *
 * Soul-E 음성 인식 API 클라이언트
 * - POST /voice/transcribe: 오디오 → 텍스트 변환 (STT)
 * - GET /voice/status: 음성 서비스 상태 확인
 */

import { TokenManager, SOUL_API_BASE } from './clients';

// =============================================================================
// Types
// =============================================================================

export interface TranscriptionResponse {
  text: string;
  duration_seconds?: number;
  language?: string;
}

export interface VoiceStatusResponse {
  enabled: boolean;
  model: string | null;
  max_file_size_mb: number | null;
  supported_formats: string[];
}

export interface VoiceApiError {
  message: string;
  status?: number;
  shouldRetry?: boolean;
}

// =============================================================================
// Voice API
// =============================================================================

export const voiceApi = {
  /**
   * 오디오를 텍스트로 변환 (STT)
   * @param audioBlob WAV 또는 WebM 형식의 오디오 Blob
   * @param filename 파일명 (기본값: 'recording.wav')
   */
  transcribe: async (audioBlob: Blob, filename: string = 'recording.wav'): Promise<TranscriptionResponse> => {
    const childToken = TokenManager.getChildToken();

    if (!childToken) {
      throw {
        message: '세션이 만료되었습니다. 아동을 다시 선택해주세요.',
        status: 401,
        shouldRetry: false,
      } as VoiceApiError;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, filename);

    let response: Response;
    try {
      response = await fetch(`${SOUL_API_BASE}/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${childToken}`,
          // Content-Type은 FormData가 자동으로 설정 (boundary 포함)
        },
        body: formData,
      });
    } catch (networkError) {
      throw {
        message: '네트워크 연결을 확인해주세요.',
        shouldRetry: true,
      } as VoiceApiError;
    }

    if (!response.ok) {
      let errorMessage = '음성 인식에 실패했습니다.';
      let shouldRetry = true;

      if (response.status === 401) {
        errorMessage = '세션이 만료되었습니다.';
        shouldRetry = false;
        TokenManager.removeChildToken();
      } else if (response.status === 400) {
        errorMessage = '오디오 형식이 올바르지 않습니다.';
        shouldRetry = false;
      } else if (response.status === 413) {
        errorMessage = '오디오가 너무 깁니다. 30초 이내로 말씀해주세요.';
        shouldRetry = false;
      } else if (response.status === 503) {
        errorMessage = '음성 서비스가 일시적으로 비활성화되어 있습니다.';
        shouldRetry = false;
      }

      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
      }

      throw {
        message: errorMessage,
        status: response.status,
        shouldRetry,
      } as VoiceApiError;
    }

    return response.json();
  },

  /**
   * 음성 서비스 상태 확인
   */
  getStatus: async (): Promise<VoiceStatusResponse> => {
    const response = await fetch(`${SOUL_API_BASE}/voice/status`);

    if (!response.ok) {
      throw {
        message: '음성 서비스 상태를 확인할 수 없습니다.',
        status: response.status,
      } as VoiceApiError;
    }

    return response.json();
  },
};

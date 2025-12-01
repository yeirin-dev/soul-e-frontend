import { type TeacherInfo, type ChildListResponse, type ChildSessionResponse, type LoginRequest, type LoginResponse, type SessionInfo, type SessionDetailResponse } from '@/types/api';
import api from './axios';

export const authApi = {
  login: async (credentials: LoginRequest) => {
    // yeirin backend: /api/v1/auth/login on port 3000
    const response = await api.post<LoginResponse>('/yeirin-api/api/v1/auth/login', credentials);
    return response.data;
  },

  getMe: async () => {
    // /api/v1 -> http://localhost:8000/api/v1
    const response = await api.get<TeacherInfo>('/api/v1/auth/me');
    return response.data;
  },

  getChildren: async () => {
    const response = await api.get<ChildListResponse>('/api/v1/auth/children');
    return response.data;
  },

  selectChild: async (childId: string) => {
    const response = await api.post<ChildSessionResponse>('/api/v1/auth/select-child', {
      child_id: childId,
    });
    return response.data;
  },
};

export interface StreamCallbacks {
  onChunk?: (accumulated: string) => void;
  onComplete?: (data: { session_id: string; message_id?: string; content: string }) => void;
  onError?: (error: { message: string; status?: number; shouldRetry?: boolean }) => void;
}

export const chatApi = {
  sendMessageStream: async (
    message: string,
    sessionId?: string,
    onChunk?: (accumulated: string) => void,
    onComplete?: (data: any) => void,
    onError?: (error: { message: string; status?: number; shouldRetry?: boolean }) => void
  ) => {
    let childToken = '';
    if (typeof window !== 'undefined') {
      childToken = localStorage.getItem('child_session_token') || '';
    }

    // 토큰 없으면 에러
    if (!childToken) {
      const error = { message: '세션이 만료되었습니다. 아동을 다시 선택해주세요.', status: 401, shouldRetry: false };
      if (onError) onError(error);
      throw error;
    }

    let response: Response;
    try {
      response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${childToken}`
        },
        body: JSON.stringify({ message, session_id: sessionId }),
      });
    } catch (networkError) {
      const error = { message: '네트워크 연결을 확인해주세요.', shouldRetry: true };
      if (onError) onError(error);
      throw error;
    }

    // HTTP 에러 처리
    if (!response.ok) {
      let errorMessage = '메시지 전송에 실패했습니다.';
      let shouldRetry = true;

      if (response.status === 401) {
        errorMessage = '세션이 만료되었습니다. 아동을 다시 선택해주세요.';
        shouldRetry = false;
        // 세션 토큰 제거
        if (typeof window !== 'undefined') {
          localStorage.removeItem('child_session_token');
        }
      } else if (response.status === 403) {
        errorMessage = '접근 권한이 없습니다.';
        shouldRetry = false;
      } else if (response.status >= 500) {
        errorMessage = '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }

      // 응답 본문에서 상세 에러 추출 시도
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : errorMessage;
        }
      } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
      }

      const error = { message: errorMessage, status: response.status, shouldRetry };
      if (onError) onError(error);
      throw error;
    }

    if (!response.body) {
      const error = { message: '응답을 받을 수 없습니다.', shouldRetry: true };
      if (onError) onError(error);
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = ''; // 불완전한 청크 처리용 버퍼

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');

        // 마지막 줄은 불완전할 수 있으므로 버퍼에 보관
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();

            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullContent += data.content;
                if (onChunk) onChunk(fullContent);
              }
              if (data.is_final && onComplete) {
                onComplete({
                  session_id: data.session_id,
                  message_id: data.message_id,
                  content: fullContent,
                });
              }
            } catch (e) {
              console.warn('SSE 데이터 파싱 실패:', dataStr);
            }
          }
        }
      }

      // 버퍼에 남은 데이터 처리
      if (buffer.startsWith('data: ')) {
        const dataStr = buffer.slice(6).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr);
            if (data.content) {
              fullContent += data.content;
              if (onChunk) onChunk(fullContent);
            }
            if (data.is_final && onComplete) {
              onComplete({
                session_id: data.session_id,
                message_id: data.message_id,
                content: fullContent,
              });
            }
          } catch {
            // 마지막 버퍼 파싱 실패 무시
          }
        }
      }
    } catch (streamError) {
      // 스트리밍 중 연결 끊김
      const error = { message: '연결이 끊겼습니다. 다시 시도해주세요.', shouldRetry: true };
      if (onError) onError(error);
      throw error;
    }

    return fullContent;
  },

  // 비스트리밍 버전 (폴백용)
  sendMessage: async (message: string, sessionId?: string) => {
    let childToken = '';
    if (typeof window !== 'undefined') {
      childToken = localStorage.getItem('child_session_token') || '';
    }

    const response = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${childToken}`
      },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.detail || '메시지 전송에 실패했습니다.',
        status: response.status,
      };
    }

    return response.json();
  },
};

// Session API
export const sessionApi = {
  // 세션 목록 조회 (아동 ID 필요)
  getSessions: async (userId: string): Promise<SessionInfo[]> => {
    const response = await api.get<SessionInfo[]>('/api/v1/sessions', {
      params: {
        user_id: userId,
        include_closed: false,
        limit: 20,
      },
    });
    return response.data || [];
  },

  // 세션 상세 조회 (메시지 히스토리 포함)
  getSession: async (sessionId: string): Promise<SessionDetailResponse> => {
    const response = await api.get<SessionDetailResponse>(`/api/v1/sessions/${sessionId}`);
    return response.data;
  },

  // 세션 종료
  closeSession: async (sessionId: string): Promise<void> => {
    await api.post(`/api/v1/sessions/${sessionId}/close`);
  },
};

// Assessment API re-export
export { assessmentApi } from './assessment';

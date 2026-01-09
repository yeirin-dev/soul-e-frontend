/**
 * Soul-E API Module
 *
 * 서버 구성:
 * - Yeirin API (Port 3000): 로그인/회원가입
 * - Soul API (Port 8000): 사용자정보, 아동관리, LLM 채팅, 세션, 심리평가
 *
 * 인증 흐름:
 * 1. 로그인 → Yeirin (3000) → yeirin_token
 * 2. 사용자정보/아동목록 → Soul-E (8000) with yeirin_token
 * 3. 아동선택 → Soul-E (8000) → child_session_token
 * 4. 채팅 → Soul-E (8000) with child_session_token
 */

import {
  yeirinClient,
  soulClient,
  TokenManager,
  SOUL_API_BASE,
} from './clients';

import {
  type TeacherInfo,
  type ChildInfo,
  type ChildListResponse,
  type ChildSessionResponse,
  type LoginRequest,
  type LoginResponse,
  type SessionInfo,
  type SessionDetailResponse,
  type PinStatusResponse,
  type SetPinRequest,
  type SetPinResponse,
  type VerifyPinRequest,
  type VerifyPinResponse,
  type ChangePinRequest,
  type ChangePinResponse,
  type InstitutionType,
  type DistrictFacility,
  type InstitutionLoginRequest,
  type InstitutionLoginResponse,
  type ChangeInstitutionPasswordRequest,
  type ConsentStatusResponse,
  type AcceptConsentRequest,
  type AcceptConsentResponse,
  type DocumentUrlResponse,
} from '@/types/api';

// =============================================================================
// Auth API
// - 로그인: Yeirin Backend (Port 3000)
// - 사용자정보/아동목록/아동선택: Soul-E Backend (Port 8000)
// =============================================================================

export const authApi = {
  /**
   * 교사/보호자 로그인
   * Yeirin Backend (3000) - 성공 시 yeirin_token 발급
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await yeirinClient.post<LoginResponse>('/api/v1/auth/login', credentials);

    // 토큰 저장
    if (response.data.accessToken) {
      TokenManager.setYeirinToken(response.data.accessToken);
    }

    return response.data;
  },

  /**
   * 현재 로그인한 사용자(교사/보호자) 정보 조회
   * Soul-E Backend (8000) - yeirin_token 사용
   */
  getMe: async (): Promise<TeacherInfo> => {
    const response = await soulClient.get<TeacherInfo>('/auth/me');
    return response.data;
  },

  /**
   * 담당 아동 목록 조회
   * Soul-E Backend (8000) - yeirin_token 사용
   * ChildListResponse wrapper 반환
   */
  getChildren: async (): Promise<ChildListResponse> => {
    const response = await soulClient.get<ChildListResponse>('/auth/children');
    return response.data;
  },

  /**
   * 아동 선택 (채팅 세션용 토큰 발급)
   * Soul-E Backend (8000) - 성공 시 child_session_token 발급
   */
  selectChild: async (childId: string): Promise<ChildSessionResponse> => {
    const response = await soulClient.post<ChildSessionResponse>('/auth/select-child', {
      child_id: childId,
    });

    // 아동 세션 토큰 및 child_id 저장 (Silent Refresh용)
    if (response.data.session_token) {
      const expiresAt = new Date(Date.now() + response.data.expires_in_minutes * 60 * 1000).toISOString();
      TokenManager.setChildToken(response.data.session_token, expiresAt);
      TokenManager.setSelectedChildId(response.data.child_id);
    }

    return response.data;
  },

  /**
   * 로그아웃
   */
  logout: (): void => {
    TokenManager.clearAll();
  },

  // ==========================================================================
  // PIN Management
  // ==========================================================================

  /**
   * PIN 설정 상태 조회
   * Soul-E Backend (8000) - yeirin_token 사용
   */
  getPinStatus: async (childId: string): Promise<PinStatusResponse> => {
    const response = await soulClient.get<PinStatusResponse>(`/auth/pin/status/${childId}`);
    return response.data;
  },

  /**
   * PIN 최초 설정
   * Soul-E Backend (8000) - yeirin_token 사용
   */
  setPin: async (request: SetPinRequest): Promise<SetPinResponse> => {
    const response = await soulClient.post<SetPinResponse>('/auth/pin/set', request);
    return response.data;
  },

  /**
   * PIN 검증 및 세션 토큰 발급
   * Soul-E Backend (8000) - yeirin_token 사용
   * 성공 시 child_session_token 발급
   */
  verifyPin: async (request: VerifyPinRequest): Promise<VerifyPinResponse> => {
    const response = await soulClient.post<VerifyPinResponse>('/auth/pin/verify', request);

    // PIN 검증 성공 시 토큰 저장
    if (response.data.verified && response.data.session_token && response.data.expires_in_minutes) {
      const expiresAt = new Date(Date.now() + response.data.expires_in_minutes * 60 * 1000).toISOString();
      TokenManager.setChildToken(response.data.session_token, expiresAt);
      TokenManager.setSelectedChildId(request.child_id);
    }

    return response.data;
  },

  /**
   * PIN 변경 (교사용)
   * Soul-E Backend (8000) - yeirin_token 사용
   */
  changePin: async (request: ChangePinRequest): Promise<ChangePinResponse> => {
    const response = await soulClient.post<ChangePinResponse>('/auth/pin/change', request);
    return response.data;
  },

  // ==========================================================================
  // Institution-based Auth (시설 기반 인증 - 신규)
  // ==========================================================================

  /**
   * 구/군 목록 조회
   * Yeirin Backend (3000)
   */
  getDistricts: async (): Promise<string[]> => {
    const response = await yeirinClient.get<string[]>('/api/v1/auth/districts');
    return response.data;
  },

  /**
   * 구/군별 시설 목록 조회
   * Yeirin Backend (3000)
   */
  getFacilities: async (district: string): Promise<DistrictFacility[]> => {
    const response = await yeirinClient.get<DistrictFacility[]>(
      `/api/v1/auth/facilities?district=${encodeURIComponent(district)}`
    );
    return response.data;
  },

  /**
   * 시설 기반 로그인
   * Yeirin Backend (3000) - 성공 시 yeirin_token 발급
   */
  institutionLogin: async (credentials: InstitutionLoginRequest): Promise<InstitutionLoginResponse> => {
    const response = await yeirinClient.post<InstitutionLoginResponse>(
      '/api/v1/auth/institution/login',
      credentials
    );

    // 토큰 저장
    if (response.data.accessToken) {
      TokenManager.setYeirinToken(response.data.accessToken);
    }

    // 시설 정보 저장
    TokenManager.setInstitutionInfo({
      id: response.data.institution.id,
      type: response.data.institution.facilityType,
      name: response.data.institution.name,
      district: response.data.institution.district,
      isPasswordChanged: response.data.institution.isPasswordChanged,
    });

    return response.data;
  },

  /**
   * 시설 비밀번호 변경
   * Yeirin Backend (3000)
   */
  changeInstitutionPassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<void> => {
    const institutionInfo = TokenManager.getInstitutionInfo();

    if (!institutionInfo.id || !institutionInfo.type) {
      throw new Error('시설 정보를 찾을 수 없습니다.');
    }

    await yeirinClient.post('/api/v1/auth/institution/change-password', {
      facilityId: institutionInfo.id,
      facilityType: institutionInfo.type as InstitutionType,
      currentPassword,
      newPassword,
    } as ChangeInstitutionPasswordRequest);

    // 비밀번호 변경 성공 시 상태 업데이트
    TokenManager.setPasswordChanged(true);
  },
};

// =============================================================================
// Chat API (Soul Backend - Port 8000)
// =============================================================================

export interface StreamCallbacks {
  onChunk?: (accumulated: string) => void;
  onComplete?: (data: { session_id: string; message_id?: string; content: string }) => void;
  onError?: (error: { message: string; status?: number; shouldRetry?: boolean }) => void;
}

export const chatApi = {
  /**
   * 스트리밍 채팅 메시지 전송
   * SSE(Server-Sent Events)를 통한 실시간 응답
   */
  sendMessageStream: async (
    message: string,
    sessionId?: string,
    onChunk?: (accumulated: string) => void,
    onComplete?: (data: { session_id: string; message_id?: string; content: string }) => void,
    onError?: (error: { message: string; status?: number; shouldRetry?: boolean }) => void
  ): Promise<string> => {
    const childToken = TokenManager.getChildToken();

    // 토큰 검증
    if (!childToken) {
      const error = { message: '세션이 만료되었습니다. 아동을 다시 선택해주세요.', status: 401, shouldRetry: false };
      if (onError) onError(error);
      throw error;
    }

    let response: Response;
    try {
      response = await fetch(`${SOUL_API_BASE}/chat/stream`, {
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
        TokenManager.removeChildToken();
      } else if (response.status === 403) {
        errorMessage = '접근 권한이 없습니다.';
        shouldRetry = false;
      } else if (response.status >= 500) {
        errorMessage = '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }

      try {
        const errorData = await response.json();
        if (errorData.detail && typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
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

    // SSE 스트림 처리
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();

            if (dataStr === '[DONE]') continue;

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
            // 파싱 실패 무시
          }
        }
      }
    } catch {
      const error = { message: '연결이 끊겼습니다. 다시 시도해주세요.', shouldRetry: true };
      if (onError) onError(error);
      throw error;
    }

    return fullContent;
  },

  /**
   * 비스트리밍 채팅 (폴백용)
   */
  sendMessage: async (message: string, sessionId?: string) => {
    const childToken = TokenManager.getChildToken();

    const response = await fetch(`${SOUL_API_BASE}/chat`, {
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

// =============================================================================
// Session API (Soul Backend - Port 8000)
// =============================================================================

export const sessionApi = {
  /**
   * 세션 목록 조회
   */
  getSessions: async (userId: string): Promise<SessionInfo[]> => {
    const response = await soulClient.get<SessionInfo[]>('/sessions', {
      params: {
        user_id: userId,
        include_closed: false,
        limit: 20,
      },
    });
    return response.data || [];
  },

  /**
   * 세션 상세 조회 (메시지 히스토리 포함)
   */
  getSession: async (sessionId: string): Promise<SessionDetailResponse> => {
    const response = await soulClient.get<SessionDetailResponse>(`/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * 세션 종료
   */
  closeSession: async (sessionId: string): Promise<void> => {
    await soulClient.post(`/sessions/${sessionId}/close`);
  },
};

// =============================================================================
// Consent API (Soul Backend - Port 8000)
// =============================================================================

export const consentApi = {
  /**
   * 동의 상태 조회
   * Soul-E Backend (8000) - yeirin_token 사용
   */
  getStatus: async (childId: string): Promise<ConsentStatusResponse> => {
    const response = await soulClient.get<ConsentStatusResponse>(`/consent/status/${childId}`);
    return response.data;
  },

  /**
   * 동의 제출
   * Soul-E Backend (8000) - yeirin_token 사용
   */
  accept: async (request: AcceptConsentRequest): Promise<AcceptConsentResponse> => {
    const response = await soulClient.post<AcceptConsentResponse>('/consent/accept', request);
    return response.data;
  },

  /**
   * 동의서 문서 URL 조회
   * Soul-E Backend (8000)
   */
  getDocumentUrl: async (): Promise<DocumentUrlResponse> => {
    const response = await soulClient.get<DocumentUrlResponse>('/consent/document');
    return response.data;
  },

  /**
   * 동의서 PDF 경로 (정적)
   */
  getDocumentPath: (): string => {
    return '/documents/privacy-policy-v1.0.0.pdf';
  },
};

// =============================================================================
// Assessment API (Soul Backend - Port 8000, 인증 불필요)
// =============================================================================

export { assessmentApi } from './assessment';

// =============================================================================
// Re-exports
// =============================================================================

export { TokenManager, yeirinClient, soulClient } from './clients';

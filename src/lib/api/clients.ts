/**
 * API Clients Configuration
 *
 * Soul-E 프론트엔드는 두 개의 백엔드 서버와 통신합니다:
 *
 * 1. YEIRIN_API (NestJS, Port 3000)
 *    - 로그인/회원가입
 *
 * 2. SOUL_API (FastAPI, Port 8000)
 *    - 사용자 정보 조회 (/auth/me)
 *    - 아동 목록 조회 (/auth/children)
 *    - 아동 선택 및 세션 토큰 발급 (/auth/select-child)
 *    - LLM 채팅 (스트리밍)
 *    - 채팅 세션 관리
 *    - 심리 평가 (assessment)
 *
 * 인증 흐름:
 * 1. 교사/보호자 로그인 → YEIRIN_API (3000) → yeirin_token 발급
 * 2. 사용자 정보/아동 목록 → SOUL_API (8000) with yeirin_token
 * 3. 아동 선택 → SOUL_API (8000) → child_session_token 발급
 * 4. 채팅 요청 → SOUL_API (8000) with child_session_token
 *
 * Silent Refresh 전략:
 * - child_session_token 만료 5분 전 자동 갱신
 * - yeirin_token이 유효하면 child_session_token 자동 교환
 * - 401 에러 시 한 번 갱신 시도 후 실패 시 로그인 페이지로 리다이렉트
 */

import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// =============================================================================
// Types
// =============================================================================

export interface ApiErrorResponse {
  detail?: string | { loc: (string | number)[]; msg: string; type: string }[];
  message?: string;
  statusCode?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  isNetworkError?: boolean;
  shouldRedirectToLogin?: boolean;
  shouldRedirectToChildren?: boolean;
}

interface JWTPayload {
  exp: number;
  child_id?: string;
  [key: string]: unknown;
}

interface ChildSessionResponse {
  session_token: string;
  child_id: string;
  child_name: string;
  expires_in_minutes: number;
}

// =============================================================================
// API Base URLs (Next.js rewrites를 통해 프록시됨)
// =============================================================================

/**
 * Yeirin 메인 백엔드 (NestJS)
 * - /yeirin-api/* → http://localhost:3000/*
 */
export const YEIRIN_API_BASE = '/yeirin-api';

/**
 * Soul-E AI 백엔드 (FastAPI)
 * - /soul-api/* → http://localhost:8000/api/v1/*
 */
export const SOUL_API_BASE = '/soul-api';

// =============================================================================
// Token Management
// =============================================================================

// JWT 디코드 헬퍼 (base64url → JSON)
const decodeJWT = (token: string): JWTPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
};

// 토큰 만료까지 남은 시간 (초)
const getTokenTimeToExpiry = (token: string): number => {
  const payload = decodeJWT(token);
  if (!payload?.exp) return 0;
  return payload.exp - Math.floor(Date.now() / 1000);
};

// Silent Refresh 설정
const REFRESH_THRESHOLD_SECONDS = 5 * 60; // 만료 5분 전 갱신
let refreshPromise: Promise<string | null> | null = null;

export const TokenManager = {
  // Yeirin 토큰 (교사/보호자 인증)
  getYeirinToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('yeirin_token');
  },

  setYeirinToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('yeirin_token', token);
  },

  removeYeirinToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('yeirin_token');
  },

  // Child 세션 토큰 (아동 채팅용)
  getChildToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('child_session_token');
  },

  setChildToken: (token: string, expiresAt?: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('child_session_token', token);
    if (expiresAt) {
      localStorage.setItem('child_session_expires_at', expiresAt);
    }
  },

  removeChildToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('child_session_token');
    localStorage.removeItem('child_session_expires_at');
    localStorage.removeItem('selected_child_id');
  },

  getSelectedChildId: (): string | null => {
    if (typeof window === 'undefined') return null;
    // 먼저 localStorage에서 확인
    const storedId = localStorage.getItem('selected_child_id');
    if (storedId) return storedId;
    // 없으면 토큰에서 추출
    const token = localStorage.getItem('child_session_token');
    if (!token) return null;
    const payload = decodeJWT(token);
    return payload?.child_id || null;
  },

  setSelectedChildId: (childId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('selected_child_id', childId);
  },

  // 토큰 만료 체크
  isChildTokenExpiringSoon: (): boolean => {
    const token = TokenManager.getChildToken();
    if (!token) return true;
    const timeToExpiry = getTokenTimeToExpiry(token);
    return timeToExpiry <= REFRESH_THRESHOLD_SECONDS;
  },

  isChildTokenExpired: (): boolean => {
    const token = TokenManager.getChildToken();
    if (!token) return true;
    return getTokenTimeToExpiry(token) <= 0;
  },

  isYeirinTokenValid: (): boolean => {
    const token = TokenManager.getYeirinToken();
    if (!token) return false;
    return getTokenTimeToExpiry(token) > 0;
  },

  // 전체 로그아웃
  clearAll: (): void => {
    TokenManager.removeYeirinToken();
    TokenManager.removeChildToken();
    TokenManager.removeInstitutionInfo();
  },

  // ==========================================================================
  // Institution Info (시설 기반 인증)
  // ==========================================================================

  getInstitutionInfo: (): {
    id: string | null;
    type: string | null;
    name: string | null;
    district: string | null;
    isPasswordChanged: boolean;
  } => {
    if (typeof window === 'undefined') {
      return { id: null, type: null, name: null, district: null, isPasswordChanged: true };
    }
    return {
      id: localStorage.getItem('institutionId'),
      type: localStorage.getItem('institutionType'),
      name: localStorage.getItem('institutionName'),
      district: localStorage.getItem('institutionDistrict'),
      isPasswordChanged: localStorage.getItem('isPasswordChanged') === 'true',
    };
  },

  setInstitutionInfo: (info: {
    id: string;
    type: string;
    name: string;
    district?: string;
    isPasswordChanged: boolean;
  }): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('institutionId', info.id);
    localStorage.setItem('institutionType', info.type);
    localStorage.setItem('institutionName', info.name);
    if (info.district) {
      localStorage.setItem('institutionDistrict', info.district);
    }
    localStorage.setItem('isPasswordChanged', String(info.isPasswordChanged));
  },

  removeInstitutionInfo: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('institutionId');
    localStorage.removeItem('institutionType');
    localStorage.removeItem('institutionName');
    localStorage.removeItem('institutionDistrict');
    localStorage.removeItem('isPasswordChanged');
  },

  setPasswordChanged: (changed: boolean): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('isPasswordChanged', String(changed));
  },
};

// =============================================================================
// Silent Refresh Logic
// =============================================================================

/**
 * child_session_token을 자동으로 갱신합니다.
 * yeirin_token이 유효하면 새로운 child_session_token을 발급받습니다.
 *
 * 동시에 여러 요청이 갱신을 시도해도 한 번만 실행됩니다 (Promise deduplication).
 */
const refreshChildSessionToken = async (): Promise<string | null> => {
  // 이미 갱신 중이면 기존 Promise 반환 (중복 요청 방지)
  if (refreshPromise) {
    return refreshPromise;
  }

  // yeirin_token이 없거나 만료되었으면 갱신 불가
  if (!TokenManager.isYeirinTokenValid()) {
    TokenManager.clearAll();
    return null;
  }

  const childId = TokenManager.getSelectedChildId();
  if (!childId) {
    return null;
  }

  refreshPromise = (async () => {
    try {
      const yeirinToken = TokenManager.getYeirinToken();

      // Soul API의 refresh-child-session 엔드포인트 호출
      const response = await axios.post<ChildSessionResponse>(
        `${SOUL_API_BASE}/auth/refresh-child-session`,
        { child_id: childId },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${yeirinToken}`,
          },
          timeout: 10000,
        }
      );

      const { session_token } = response.data;
      TokenManager.setChildToken(session_token);

      console.log('[Silent Refresh] child_session_token 갱신 성공');
      return session_token;
    } catch (error) {
      console.error('[Silent Refresh] child_session_token 갱신 실패:', error);
      // 갱신 실패 시 토큰 제거
      TokenManager.removeChildToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// =============================================================================
// Error Handler
// =============================================================================

const handleApiError = (error: AxiosError<ApiErrorResponse>, context: 'yeirin' | 'soul'): never => {
  // 네트워크 에러
  if (!error.response) {
    throw {
      message: '네트워크 연결을 확인해주세요.',
      isNetworkError: true,
    } as ApiError;
  }

  const { status, data } = error.response;
  const url = error.config?.url || '';

  // 에러 메시지 추출
  let errorMessage = '알 수 없는 오류가 발생했습니다.';
  if (data?.detail) {
    if (typeof data.detail === 'string') {
      errorMessage = data.detail;
    } else if (Array.isArray(data.detail)) {
      errorMessage = data.detail.map(e => e.msg).join(', ');
    }
  } else if (data?.message) {
    errorMessage = data.message;
  }

  // 401 Unauthorized
  if (status === 401) {
    // 로그인 요청 실패
    if (url.includes('/auth/login')) {
      throw { message: '이메일 또는 비밀번호가 올바르지 않습니다.', status: 401 } as ApiError;
    }

    // Soul API (채팅) - child token 문제
    if (context === 'soul') {
      TokenManager.removeChildToken();
      throw {
        message: '세션이 만료되었습니다. 아동을 다시 선택해주세요.',
        status: 401,
        shouldRedirectToChildren: true,
      } as ApiError;
    }

    // Yeirin API - yeirin token 문제
    throw {
      message: '로그인이 필요합니다.',
      status: 401,
      shouldRedirectToLogin: true,
    } as ApiError;
  }

  // 403 Forbidden
  if (status === 403) {
    throw { message: errorMessage || '접근 권한이 없습니다.', status: 403 } as ApiError;
  }

  // 404 Not Found
  if (status === 404) {
    throw { message: errorMessage || '요청한 정보를 찾을 수 없습니다.', status: 404 } as ApiError;
  }

  // 500+ Server Error
  if (status >= 500) {
    throw { message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', status } as ApiError;
  }

  throw { message: errorMessage, status } as ApiError;
};

// =============================================================================
// Yeirin API Client (NestJS Backend - Port 3000)
// =============================================================================

const createYeirinClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: YEIRIN_API_BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  // Request Interceptor - Yeirin 토큰 추가
  client.interceptors.request.use(
    (config) => {
      const token = TokenManager.getYeirinToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response Interceptor - 에러 핸들링
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorResponse>) => handleApiError(error, 'yeirin')
  );

  return client;
};

// =============================================================================
// Soul API Client (FastAPI Backend - Port 8000)
// =============================================================================

// 재시도 플래그를 위한 커스텀 config 타입
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const createSoulClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: SOUL_API_BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000, // 채팅은 더 긴 타임아웃
  });

  // Request Interceptor - 토큰 추가 및 Proactive Refresh
  client.interceptors.request.use(
    async (config) => {
      const url = config.url || '';

      // /auth/* 엔드포인트는 yeirin_token 사용
      if (url.includes('/auth/')) {
        const yeirinToken = TokenManager.getYeirinToken();
        if (yeirinToken) {
          config.headers.Authorization = `Bearer ${yeirinToken}`;
        }
        return config;
      }

      // Assessment API 중 인증 불필요한 엔드포인트 (문항 조회, health check)
      if (url.includes('/assessment/questions') || url.includes('/assessment/health')) {
        return config;
      }

      // 그 외 (채팅, 세션, assessment/children, assessment/sessions 등)는 child_session_token 사용
      // Proactive Refresh: 만료 5분 전이면 미리 갱신
      if (TokenManager.isChildTokenExpiringSoon() && !TokenManager.isChildTokenExpired()) {
        console.log('[Silent Refresh] 토큰 만료 임박, 사전 갱신 시도');
        await refreshChildSessionToken();
      }

      const childToken = TokenManager.getChildToken();
      if (childToken) {
        config.headers.Authorization = `Bearer ${childToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response Interceptor - 401 에러 시 토큰 갱신 후 재시도
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorResponse>) => {
      const originalRequest = error.config as CustomAxiosRequestConfig | undefined;
      const url = originalRequest?.url || '';

      // 401 에러 && 재시도 안 했으면 && auth 엔드포인트가 아니면 && 인증 불필요 엔드포인트가 아니면
      const isAuthEndpoint = url.includes('/auth/');
      const isPublicEndpoint = url.includes('/assessment/questions') || url.includes('/assessment/health');

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !isAuthEndpoint &&
        !isPublicEndpoint
      ) {
        originalRequest._retry = true;

        console.log('[Silent Refresh] 401 에러 발생, 토큰 갱신 시도');
        const newToken = await refreshChildSessionToken();

        if (newToken) {
          // 갱신 성공 시 원래 요청 재시도
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        }

        // 갱신 실패 시 아동 선택 페이지로 리다이렉트
        throw {
          message: '세션이 만료되었습니다. 아동을 다시 선택해주세요.',
          status: 401,
          shouldRedirectToChildren: true,
        } as ApiError;
      }

      return handleApiError(error, 'soul');
    }
  );

  return client;
};

// =============================================================================
// Exported Clients
// =============================================================================

/**
 * Yeirin API Client
 * 사용처: 인증, 사용자 정보, 아동 관리
 * 토큰: yeirin_token (localStorage)
 */
export const yeirinClient = createYeirinClient();

/**
 * Soul API Client
 * 사용처: LLM 채팅, 세션 관리, 심리 평가
 * 토큰: child_session_token (localStorage)
 */
export const soulClient = createSoulClient();

// 기존 코드 호환을 위한 default export
export default yeirinClient;

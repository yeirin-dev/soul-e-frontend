import axios, { type AxiosError } from 'axios';

// API Error types for better error handling
export interface ApiErrorResponse {
  detail?: string | { loc: (string | number)[]; msg: string; type: string }[];
  message?: string;
  statusCode?: number;
}

// Create a base instance for client-side requests
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30초 타임아웃
});

// Request interceptor to add tokens
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const childToken = localStorage.getItem('child_session_token');
      const yeirinToken = localStorage.getItem('yeirin_token');

      // Soul-E 채팅 관련 요청은 child session token 사용
      if (config.url?.includes('/chat') || config.url?.includes('/sessions')) {
        if (childToken) {
          config.headers.Authorization = `Bearer ${childToken}`;
        }
      } else {
        // 나머지 요청은 yeirin token 사용
        if (yeirinToken) {
          config.headers.Authorization = `Bearer ${yeirinToken}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    // 네트워크 에러
    if (!error.response) {
      return Promise.reject({
        message: '네트워크 연결을 확인해주세요.',
        isNetworkError: true,
      });
    }

    const { status, data } = error.response;

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

    // 401: 인증 실패 - 토큰 만료 또는 유효하지 않음
    if (status === 401) {
      const url = error.config?.url || '';

      // 로그인 요청 실패는 단순 에러 반환
      if (url.includes('/auth/login')) {
        return Promise.reject({ message: errorMessage || '이메일 또는 비밀번호가 올바르지 않습니다.', status: 401 });
      }

      // chat/sessions 요청이면 child session token 문제만 처리
      if (url.includes('/chat') || url.includes('/sessions')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('child_session_token');
          localStorage.removeItem('child_session_expires_at');
        }
        return Promise.reject({ message: '채팅 세션이 만료되었습니다. 아동을 다시 선택해주세요.', status: 401, shouldRedirectToChildren: true });
      }

      // 그 외 요청은 토큰 삭제 없이 에러만 반환
      // (컴포넌트에서 적절히 처리하도록 함)
      return Promise.reject({ message: errorMessage || '인증에 실패했습니다.', status: 401 });
    }

    // 403: 권한 없음
    if (status === 403) {
      return Promise.reject({ message: errorMessage || '접근 권한이 없습니다.', status: 403 });
    }

    // 404: 리소스 없음
    if (status === 404) {
      return Promise.reject({ message: errorMessage || '요청한 정보를 찾을 수 없습니다.', status: 404 });
    }

    // 500+: 서버 오류
    if (status >= 500) {
      return Promise.reject({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', status });
    }

    return Promise.reject({ message: errorMessage, status });
  }
);

export default api;

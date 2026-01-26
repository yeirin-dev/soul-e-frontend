/**
 * Special Assessment API (Soul Backend - Port 8000)
 * 특별 검사 API - 연령 제한 우회 기능
 *
 * 인증 흐름:
 * 1. 기관 로그인 (yeirin_token)
 * 2. 어드민 키 검증 → special_access_token 발급
 * 3. special_access_token으로 특별 검사 API 호출
 */

import axios from 'axios';
import type {
  SpecialTeacherInfo,
  SpecialChildListResponse,
  SpecialAssessmentType,
  AdminKeyVerifyRequest,
  AdminKeyVerifyResponse,
  StartSpecialAssessmentRequest,
} from '@/types/special-assessment';
import type {
  SectionInfo,
  SectionQuestionsResponse,
  QuestionInfo,
  AssessmentSession,
  AssessmentProgress,
  SessionAnswers,
  AssessmentResult,
  SaveSectionAnswersRequest,
  SubmitTeacherAssessmentRequest,
} from '@/types/teacher-assessment';

import { SOUL_API_BASE, TokenManager } from './clients';

const API_PREFIX = '/special-assessment';

// =============================================================================
// Special Access Token 관리
// =============================================================================

export const SpecialTokenManager = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('special_access_token');
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('special_access_token', token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('special_access_token');
  },

  isValid: (): boolean => {
    const token = SpecialTokenManager.getToken();
    if (!token) return false;

    try {
      // JWT 디코드하여 만료 시간 확인
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const exp = payload.exp;
      if (!exp) return false;
      return exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  },

  clear: (): void => {
    SpecialTokenManager.removeToken();
  },
};

// =============================================================================
// axios 인스턴스 (특별 검사용)
// =============================================================================

const createSpecialClient = () => {
  const client = axios.create({
    baseURL: SOUL_API_BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  client.interceptors.request.use(
    (config) => {
      const url = config.url || '';

      // verify-admin은 yeirin_token 사용
      if (url.includes('/verify-admin')) {
        const yeirinToken = TokenManager.getYeirinToken();
        if (yeirinToken) {
          config.headers.Authorization = `Bearer ${yeirinToken}`;
        }
        return config;
      }

      // 그 외 모든 special-assessment 엔드포인트는 special_access_token 사용
      const specialToken = SpecialTokenManager.getToken();
      if (specialToken) {
        config.headers.Authorization = `Bearer ${specialToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  return client;
};

const specialClient = createSpecialClient();

// =============================================================================
// API Functions
// =============================================================================

export const specialAssessmentApi = {
  // ==========================================================================
  // 어드민 키 인증
  // ==========================================================================

  /**
   * 어드민 키 검증
   * yeirin JWT 토큰 + 어드민 키 필요
   * @returns special_access_token 발급
   */
  verifyAdminKey: async (request: AdminKeyVerifyRequest): Promise<AdminKeyVerifyResponse> => {
    const response = await specialClient.post<AdminKeyVerifyResponse>(
      `${API_PREFIX}/verify-admin`,
      request
    );
    // 토큰 자동 저장
    if (response.data.token) {
      SpecialTokenManager.setToken(response.data.token);
    }
    return response.data;
  },

  // ==========================================================================
  // 교사/기관 정보
  // ==========================================================================

  /**
   * 교사(시설) 정보 조회
   * special_access_token 필요
   */
  getTeacherInfo: async (): Promise<SpecialTeacherInfo> => {
    const response = await specialClient.get<SpecialTeacherInfo>(`${API_PREFIX}/auth/me`);
    return response.data;
  },

  /**
   * 아동 목록 조회 (연령 필터 없음)
   */
  getChildren: async (): Promise<SpecialChildListResponse> => {
    const response = await specialClient.get<SpecialChildListResponse>(`${API_PREFIX}/auth/children`);
    return response.data;
  },

  // ==========================================================================
  // 검사 도구 정보
  // ==========================================================================

  /**
   * 특별 검사 도구 목록 조회
   */
  getAssessmentTypes: async (): Promise<SpecialAssessmentType[]> => {
    const response = await specialClient.get<SpecialAssessmentType[]>(`${API_PREFIX}/types`);
    return response.data;
  },

  /**
   * 특정 검사 도구 정보 조회
   */
  getAssessmentType: async (assessmentType: string): Promise<SpecialAssessmentType> => {
    const response = await specialClient.get<SpecialAssessmentType>(
      `${API_PREFIX}/types/${assessmentType}`
    );
    return response.data;
  },

  // ==========================================================================
  // 섹션 및 문항
  // ==========================================================================

  /**
   * 전체 섹션 목록 조회
   */
  getSections: async (assessmentType: string): Promise<SectionInfo[]> => {
    const response = await specialClient.get<SectionInfo[]>(
      `${API_PREFIX}/sections`,
      { params: { assessment_type: assessmentType } }
    );
    return response.data;
  },

  /**
   * 특정 섹션의 문항 조회
   */
  getSectionQuestions: async (
    assessmentType: string,
    sectionNumber: number
  ): Promise<SectionQuestionsResponse> => {
    const response = await specialClient.get<SectionQuestionsResponse>(
      `${API_PREFIX}/sections/${sectionNumber}`,
      { params: { assessment_type: assessmentType } }
    );
    return response.data;
  },

  /**
   * 전체 문항 조회
   */
  getAllQuestions: async (assessmentType: string): Promise<QuestionInfo[]> => {
    const response = await specialClient.get<QuestionInfo[]>(
      `${API_PREFIX}/questions`,
      { params: { assessment_type: assessmentType } }
    );
    return response.data;
  },

  // ==========================================================================
  // 검사 세션 관리
  // ==========================================================================

  /**
   * 검사 세션 시작 (연령 검증 우회)
   */
  startAssessment: async (request: StartSpecialAssessmentRequest): Promise<AssessmentSession> => {
    const response = await specialClient.post<AssessmentSession>(`${API_PREFIX}/sessions`, request);
    return response.data;
  },

  /**
   * 검사 세션 조회
   */
  getSession: async (sessionId: string): Promise<AssessmentSession> => {
    const response = await specialClient.get<AssessmentSession>(`${API_PREFIX}/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * 검사 진행 상황 조회
   */
  getProgress: async (sessionId: string): Promise<AssessmentProgress> => {
    const response = await specialClient.get<AssessmentProgress>(
      `${API_PREFIX}/sessions/${sessionId}/progress`
    );
    return response.data;
  },

  /**
   * 섹션 답변 저장 (자동저장용)
   */
  saveSectionAnswers: async (
    sessionId: string,
    sectionNumber: number,
    request: SaveSectionAnswersRequest
  ): Promise<AssessmentProgress> => {
    const response = await specialClient.post<AssessmentProgress>(
      `${API_PREFIX}/sessions/${sessionId}/sections/${sectionNumber}/save`,
      request
    );
    return response.data;
  },

  /**
   * 전체 답변 제출
   */
  submitAssessment: async (
    sessionId: string,
    request: SubmitTeacherAssessmentRequest
  ): Promise<AssessmentResult> => {
    const response = await specialClient.post<AssessmentResult>(
      `${API_PREFIX}/sessions/${sessionId}/submit`,
      request
    );
    return response.data;
  },

  /**
   * 저장된 답변 조회 (재개 시 사용)
   */
  getSessionAnswers: async (sessionId: string): Promise<SessionAnswers> => {
    const response = await specialClient.get<SessionAnswers>(
      `${API_PREFIX}/sessions/${sessionId}/answers`
    );
    return response.data;
  },

  // ==========================================================================
  // 유틸리티
  // ==========================================================================

  /**
   * 로그아웃 (토큰 삭제)
   */
  logout: (): void => {
    SpecialTokenManager.clear();
  },

  /**
   * 특별 검사 권한 유효 여부
   */
  isAuthorized: (): boolean => {
    return TokenManager.isYeirinTokenValid() && SpecialTokenManager.isValid();
  },
};

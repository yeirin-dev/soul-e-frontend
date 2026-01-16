/**
 * Teacher Assessment API (Soul Backend - Port 8000)
 * 교사평정용 검사 API - yeirin JWT 인증 필요
 */

import type {
  TeacherInfo,
  TeacherChildListResponse,
  TeacherAssessmentType,
  SectionInfo,
  SectionQuestionsResponse,
  QuestionInfo,
  AssessmentSession,
  AssessmentProgress,
  SessionAnswers,
  AssessmentResult,
  AssessmentResultDetail,
  StartTeacherAssessmentRequest,
  SaveSectionAnswersRequest,
  SubmitTeacherAssessmentRequest,
  HealthCheckResponse,
} from '@/types/teacher-assessment';

import { soulClient } from './clients';

const API_PREFIX = '/teacher-assessment';

export const teacherAssessmentApi = {
  // ==========================================================================
  // 교사 인증 및 아동 목록
  // ==========================================================================

  /**
   * 교사(시설) 정보 조회
   * yeirin JWT 토큰 필요
   */
  getTeacherInfo: async (): Promise<TeacherInfo> => {
    const response = await soulClient.get<TeacherInfo>(`${API_PREFIX}/auth/me`);
    return response.data;
  },

  /**
   * 저학년 아동 목록 조회
   * KPRC_CO_TG 대상(6-9세) 필터링 포함
   */
  getChildren: async (): Promise<TeacherChildListResponse> => {
    const response = await soulClient.get<TeacherChildListResponse>(`${API_PREFIX}/auth/children`);
    return response.data;
  },

  // ==========================================================================
  // 검사 도구 정보
  // ==========================================================================

  /**
   * 교사평정용 검사 도구 목록 조회
   */
  getAssessmentTypes: async (): Promise<TeacherAssessmentType[]> => {
    const response = await soulClient.get<TeacherAssessmentType[]>(`${API_PREFIX}/types`);
    return response.data;
  },

  /**
   * 특정 검사 도구 정보 조회
   */
  getAssessmentType: async (assessmentType: string): Promise<TeacherAssessmentType> => {
    const response = await soulClient.get<TeacherAssessmentType>(
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
  getSections: async (): Promise<SectionInfo[]> => {
    const response = await soulClient.get<SectionInfo[]>(`${API_PREFIX}/sections`);
    return response.data;
  },

  /**
   * 특정 섹션의 문항 조회
   */
  getSectionQuestions: async (sectionNumber: number): Promise<SectionQuestionsResponse> => {
    const response = await soulClient.get<SectionQuestionsResponse>(
      `${API_PREFIX}/sections/${sectionNumber}`
    );
    return response.data;
  },

  /**
   * 전체 문항 조회
   */
  getAllQuestions: async (): Promise<QuestionInfo[]> => {
    const response = await soulClient.get<QuestionInfo[]>(`${API_PREFIX}/questions`);
    return response.data;
  },

  // ==========================================================================
  // 검사 세션 관리
  // ==========================================================================

  /**
   * 검사 세션 시작
   */
  startAssessment: async (request: StartTeacherAssessmentRequest): Promise<AssessmentSession> => {
    const response = await soulClient.post<AssessmentSession>(`${API_PREFIX}/sessions`, request);
    return response.data;
  },

  /**
   * 검사 세션 조회
   */
  getSession: async (sessionId: string): Promise<AssessmentSession> => {
    const response = await soulClient.get<AssessmentSession>(`${API_PREFIX}/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * 검사 진행 상황 조회
   */
  getProgress: async (sessionId: string): Promise<AssessmentProgress> => {
    const response = await soulClient.get<AssessmentProgress>(
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
    const response = await soulClient.post<AssessmentProgress>(
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
    const response = await soulClient.post<AssessmentResult>(
      `${API_PREFIX}/sessions/${sessionId}/submit`,
      request
    );
    return response.data;
  },

  /**
   * 저장된 답변 조회 (재개 시 사용)
   */
  getSessionAnswers: async (sessionId: string): Promise<SessionAnswers> => {
    const response = await soulClient.get<SessionAnswers>(
      `${API_PREFIX}/sessions/${sessionId}/answers`
    );
    return response.data;
  },

  /**
   * 검사 결과 조회
   */
  getResult: async (sessionId: string): Promise<AssessmentResultDetail> => {
    const response = await soulClient.get<AssessmentResultDetail>(
      `${API_PREFIX}/sessions/${sessionId}/result`
    );
    return response.data;
  },

  // ==========================================================================
  // 아동별 검사 이력
  // ==========================================================================

  /**
   * 아동별 교사평정 검사 이력 조회
   */
  getSessionsByChild: async (childId: string, limit: number = 10): Promise<AssessmentSession[]> => {
    const response = await soulClient.get<AssessmentSession[]>(
      `${API_PREFIX}/children/${childId}/sessions`,
      { params: { limit } }
    );
    return response.data;
  },

  // ==========================================================================
  // 헬스 체크
  // ==========================================================================

  /**
   * 서비스 상태 확인
   */
  healthCheck: async (): Promise<HealthCheckResponse> => {
    const response = await soulClient.get<HealthCheckResponse>(`${API_PREFIX}/health`);
    return response.data;
  },
};

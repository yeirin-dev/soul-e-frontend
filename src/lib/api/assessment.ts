/**
 * Assessment API (Soul Backend - Port 8000)
 * 심리 평가 관련 API - 인증 불필요
 */

import type {
  AssessmentSession,
  AssessmentProgress,
  AssessmentResult,
  QuestionsListResponse,
  StartAssessmentRequest,
  SubmitAnswersRequest,
  SaveAnswersRequest,
  ChildAssessmentStatus,
  SessionAnswers,
} from '@/types/assessment';
import { soulClient } from './clients';

export const assessmentApi = {
  /**
   * 새 검사 세션 시작
   */
  startAssessment: async (request: StartAssessmentRequest): Promise<AssessmentSession> => {
    const response = await soulClient.post<AssessmentSession>('/assessment/sessions', request);
    return response.data;
  },

  /**
   * 검사 세션 조회
   */
  getSession: async (sessionId: string): Promise<AssessmentSession> => {
    const response = await soulClient.get<AssessmentSession>(`/assessment/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * 검사 진행 상황 조회
   */
  getProgress: async (sessionId: string): Promise<AssessmentProgress> => {
    const response = await soulClient.get<AssessmentProgress>(`/assessment/sessions/${sessionId}/progress`);
    return response.data;
  },

  /**
   * 세션에 저장된 답변 조회 (재개 시 복원용)
   */
  getSessionAnswers: async (sessionId: string): Promise<SessionAnswers> => {
    const response = await soulClient.get<SessionAnswers>(`/assessment/sessions/${sessionId}/answers`);
    return response.data;
  },

  /**
   * 전체 문항 조회
   */
  getQuestions: async (assessmentType: string = 'KPRC_CO_SG_E'): Promise<QuestionsListResponse> => {
    const response = await soulClient.get<QuestionsListResponse>('/assessment/questions', {
      params: { assessment_type: assessmentType },
    });
    return response.data;
  },

  /**
   * 단일 문항 조회
   */
  getQuestion: async (questionNumber: number, assessmentType: string = 'KPRC_CO_SG_E') => {
    const response = await soulClient.get(`/assessment/questions/${questionNumber}`, {
      params: { assessment_type: assessmentType },
    });
    return response.data;
  },

  /**
   * 부분 답변 저장 (자동저장용)
   */
  saveAnswers: async (sessionId: string, request: SaveAnswersRequest): Promise<AssessmentProgress> => {
    const response = await soulClient.post<AssessmentProgress>(
      `/assessment/sessions/${sessionId}/answers`,
      request
    );
    return response.data;
  },

  /**
   * 전체 답변 제출 및 채점 요청
   */
  submitAssessment: async (sessionId: string, request: SubmitAnswersRequest): Promise<AssessmentResult> => {
    const response = await soulClient.post<AssessmentResult>(
      `/assessment/sessions/${sessionId}/submit`,
      request
    );
    return response.data;
  },

  /**
   * 검사 세션 삭제
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    await soulClient.delete(`/assessment/sessions/${sessionId}`);
  },

  /**
   * 아동별 검사 세션 이력 조회
   */
  getSessionsByChild: async (childId: string, limit: number = 10): Promise<AssessmentSession[]> => {
    const response = await soulClient.get<AssessmentSession[]>(`/assessment/children/${childId}/sessions`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * 아동별 검사 상태 요약 조회
   * 검사 버튼 상태를 결정하는 데 사용
   */
  getChildAssessmentStatus: async (childId: string): Promise<ChildAssessmentStatus> => {
    const response = await soulClient.get<ChildAssessmentStatus>(`/assessment/children/${childId}/status`);
    return response.data;
  },

  /**
   * 검사 결과 상세 조회
   */
  getResult: async (sessionId: string): Promise<AssessmentResult> => {
    const response = await soulClient.get<AssessmentResult>(`/assessment/sessions/${sessionId}/result`);
    return response.data;
  },

  /**
   * 서비스 상태 확인
   */
  healthCheck: async (): Promise<{ status: string; inpsyt_api: string }> => {
    const response = await soulClient.get('/assessment/health');
    return response.data;
  },
};

import type {
  AssessmentSession,
  AssessmentProgress,
  AssessmentResult,
  QuestionsListResponse,
  StartAssessmentRequest,
  SubmitAnswersRequest,
  SaveAnswersRequest,
} from '@/types/assessment';
import api from './axios';

export const assessmentApi = {
  /**
   * 새 검사 세션 시작
   */
  startAssessment: async (request: StartAssessmentRequest): Promise<AssessmentSession> => {
    const response = await api.post<AssessmentSession>('/api/v1/assessment/sessions', request);
    return response.data;
  },

  /**
   * 검사 세션 조회
   */
  getSession: async (sessionId: string): Promise<AssessmentSession> => {
    const response = await api.get<AssessmentSession>(`/api/v1/assessment/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * 검사 진행 상황 조회
   */
  getProgress: async (sessionId: string): Promise<AssessmentProgress> => {
    const response = await api.get<AssessmentProgress>(`/api/v1/assessment/sessions/${sessionId}/progress`);
    return response.data;
  },

  /**
   * 전체 문항 조회
   */
  getQuestions: async (assessmentType: string = 'KPRC_CO_SG_E'): Promise<QuestionsListResponse> => {
    const response = await api.get<QuestionsListResponse>('/api/v1/assessment/questions', {
      params: { assessment_type: assessmentType },
    });
    return response.data;
  },

  /**
   * 단일 문항 조회
   */
  getQuestion: async (questionNumber: number, assessmentType: string = 'KPRC_CO_SG_E') => {
    const response = await api.get(`/api/v1/assessment/questions/${questionNumber}`, {
      params: { assessment_type: assessmentType },
    });
    return response.data;
  },

  /**
   * 부분 답변 저장 (자동저장용)
   */
  saveAnswers: async (sessionId: string, request: SaveAnswersRequest): Promise<AssessmentProgress> => {
    const response = await api.post<AssessmentProgress>(
      `/api/v1/assessment/sessions/${sessionId}/answers`,
      request
    );
    return response.data;
  },

  /**
   * 전체 답변 제출 및 채점 요청
   */
  submitAssessment: async (sessionId: string, request: SubmitAnswersRequest): Promise<AssessmentResult> => {
    const response = await api.post<AssessmentResult>(
      `/api/v1/assessment/sessions/${sessionId}/submit`,
      request
    );
    return response.data;
  },

  /**
   * 검사 세션 삭제
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/api/v1/assessment/sessions/${sessionId}`);
  },

  /**
   * 아동별 검사 세션 이력 조회
   */
  getSessionsByChild: async (childId: string, limit: number = 10): Promise<AssessmentSession[]> => {
    const response = await api.get<AssessmentSession[]>(`/api/v1/assessment/children/${childId}/sessions`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * 검사 결과 상세 조회
   */
  getResult: async (sessionId: string): Promise<AssessmentResult> => {
    const response = await api.get<AssessmentResult>(`/api/v1/assessment/sessions/${sessionId}/result`);
    return response.data;
  },

  /**
   * 서비스 상태 확인
   */
  healthCheck: async (): Promise<{ status: string; inpsyt_api: string }> => {
    const response = await api.get('/api/v1/assessment/health');
    return response.data;
  },
};

/**
 * Teacher Assessment Types (KPRC_CO_TG)
 * 교사평정용 검사 타입 정의
 */

// =============================================================================
// 검사 유형 상수
// =============================================================================

export const TEACHER_ASSESSMENT_TYPES = {
  KPRC_CO_TG: 'KPRC_CO_TG',
} as const;

export type TeacherAssessmentTypeKey = keyof typeof TEACHER_ASSESSMENT_TYPES;
export type TeacherAssessmentTypeValue = (typeof TEACHER_ASSESSMENT_TYPES)[TeacherAssessmentTypeKey];

// =============================================================================
// 기본 타입
// =============================================================================

export type AssessmentStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'FAILED';

export type Gender = 'M' | 'F';

// =============================================================================
// 교사/기관 정보
// =============================================================================

export interface TeacherInfo {
  institution_id: string;
  institution_name: string;
  institution_type: string;
  institution_type_display: string;
  district: string | null;
}

// =============================================================================
// 아동 정보
// =============================================================================

export interface TeacherChildInfo {
  id: string;
  name: string;
  birth_date: string;
  age: number;
  gender: string;
  grade: number | null;
  is_eligible_for_kprc_tg: boolean;
}

export interface TeacherChildListResponse {
  institution_id: string;
  institution_name: string;
  institution_type: string;
  children: TeacherChildInfo[];
  total_count: number;
  eligible_count: number;
}

// =============================================================================
// 검사 도구 정보
// =============================================================================

export interface TeacherAssessmentType {
  type: string;
  name: string;
  short_name: string;
  description: string;
  question_count: number;
  section_count: number;
  valid_grades: number[];
  choice_labels: string[];
}

// =============================================================================
// 섹션 및 문항
// =============================================================================

export interface SectionInfo {
  section_number: number;
  start_question: number;
  end_question: number;
  question_count: number;
}

export interface QuestionInfo {
  number: number;
  text: string;
}

export interface SectionQuestionsResponse {
  assessment_type: string;
  section_number: number;
  start_question: number;
  end_question: number;
  questions: QuestionInfo[];
  total_sections: number;
  is_last_section: boolean;
}

// =============================================================================
// 검사 세션
// =============================================================================

export interface AssessmentSession {
  session_id: string;
  child_id: string;
  child_name: string;
  assessment_type: string;
  status: AssessmentStatus;
  total_questions: number;
  answered_count: number;
  created_at: string;
  updated_at: string;
}

export interface AssessmentProgress {
  session_id: string;
  status: AssessmentStatus;
  total_questions: number;
  answered_count: number;
  remaining_count: number;
  progress_percentage: number;
}

export interface SessionAnswers {
  session_id: string;
  answers: Record<number, number>;
  answered_count: number;
  last_answered_question: number | null;
}

// =============================================================================
// 검사 결과
// =============================================================================

export interface AssessmentResult {
  session_id: string;
  child_id: string;
  child_name: string;
  assessment_type: string;
  status: AssessmentStatus;
  is_success: boolean;
  total_score: number | null;
  max_score: number;
  inpsyt_code: string | null;
  inpsyt_message: string | null;
  report_url: string | null;
  psy_online_code: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface AssessmentResultDetail {
  result_id: string;
  session_id: string;
  child_id: string;
  child_name: string;
  assessment_type: string;
  assessment_name: string;
  total_score: number | null;
  max_score: number | null;
  score_percentage: number | null;
  scale_scores: Record<string, unknown> | null;
  interpretation: {
    overall_level: string;
    primary_concerns: string[];
    key_findings: string[];
    recommendations: string[];
    strengths: string[];
  } | null;
  report_url: string | null;
  psy_online_code: string | null;
  scored_at: string | null;
  created_at: string;
}

// =============================================================================
// 요청 타입
// =============================================================================

export interface StartTeacherAssessmentRequest {
  teacher_id: string;
  child_id: string;
  child_name: string;
  gender: Gender;
  birth_date: string;
  school_grade: number;
}

export interface SaveSectionAnswersRequest {
  section_number: number;
  answers: Record<number, number>;
}

export interface SubmitTeacherAssessmentRequest {
  answers: Record<number, number>;
}

// =============================================================================
// 헬스 체크
// =============================================================================

export interface HealthCheckResponse {
  status: string;
  service: string;
  assessment_type: string;
  question_count: number;
  section_count: number;
}

// =============================================================================
// 프론트엔드 상태
// =============================================================================

export interface TeacherAssessmentState {
  // 인증 상태
  isAuthenticated: boolean;
  teacherInfo: TeacherInfo | null;

  // 아동 목록
  children: TeacherChildInfo[];
  selectedChild: TeacherChildInfo | null;

  // 검사 세션
  session: AssessmentSession | null;
  currentSection: number;
  answers: Record<number, number>;

  // UI 상태
  isLoading: boolean;
  error: string | null;

  // 결과
  result: AssessmentResult | null;
}

// =============================================================================
// 검사 단계
// =============================================================================

export type AssessmentPhase =
  | 'auth'        // 인증 확인 중
  | 'children'    // 아동 선택
  | 'intro'       // 검사 안내
  | 'testing'     // 검사 진행
  | 'submitting'  // 제출 중
  | 'result'      // 결과 표시
  | 'error';      // 에러 상태

// =============================================================================
// 선택지 상수
// =============================================================================

export const KPRC_TG_CHOICES = [
  { value: 1, label: '전혀 아니다' },
  { value: 2, label: '때때로 그렇다' },
  { value: 3, label: '자주 그렇다' },
  { value: 4, label: '거의 항상 그렇다' },
] as const;

export const KPRC_TG_CHOICE_LABELS = KPRC_TG_CHOICES.map((c) => c.label);

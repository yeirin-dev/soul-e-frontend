/**
 * Teacher Assessment Types (KPRC_CO_TG)
 * 교사평정용 검사 타입 정의
 */

// =============================================================================
// 검사 도구 목록 (확장 가능)
// =============================================================================

export interface AssessmentTool {
  code: string;
  name: string;
  shortName: string;
  description: string;
  minGrade: number;
  maxGrade: number;
  minAge: number;
  maxAge: number;
  questionCount: number;
  sectionCount: number;
}

/**
 * 검사도구 목록
 * - 한국 학년 기준: 만 6세가 되는 해의 다음 해 3월 1일에 1학년 입학
 * - 매년 3월 1일 기준으로 학년 진급
 * - 초등학교 1-6학년
 */
export const ASSESSMENT_TOOLS: AssessmentTool[] = [
  {
    code: 'KPRC_CO_TG',
    name: 'KPRC 한국 아동·청소년 인성평정척도 - 교사평정용 - 표준형',
    shortName: 'KPRC 교사평정용',
    description: '초등학교 1~3학년 아동의 인성 및 적응을 평가하는 교사평정 검사입니다.',
    minGrade: 1,
    maxGrade: 3,
    minAge: 6,
    maxAge: 10,
    questionCount: 152,
    sectionCount: 8,
  },
  // 향후 추가될 검사도구
  // {
  //   code: 'KPRC_CO_TG_HIGH',
  //   name: 'KPRC 한국 아동·청소년 인성평정척도 - 교사평정용 - 고학년',
  //   shortName: 'KPRC 교사평정용 (고학년)',
  //   description: '초등학교 5~6학년 아동의 인성 및 적응을 평가하는 교사평정 검사입니다.',
  //   minGrade: 5,
  //   maxGrade: 6,
  //   minAge: 12,
  //   maxAge: 13,
  //   questionCount: 160,
  //   sectionCount: 8,
  // },
];

// =============================================================================
// 검사 유형 상수 (레거시 호환)
// =============================================================================

export const TEACHER_ASSESSMENT_TYPES = {
  KPRC_CO_TG: 'KPRC_CO_TG',
} as const;

export type TeacherAssessmentTypeKey = keyof typeof TEACHER_ASSESSMENT_TYPES;
export type TeacherAssessmentTypeValue = (typeof TEACHER_ASSESSMENT_TYPES)[TeacherAssessmentTypeKey];

// =============================================================================
// 학년 계산 유틸리티
// =============================================================================

/**
 * 나이로 학년 대략적 계산 (단순화된 버전)
 * @deprecated 정확한 학년 계산은 calculateGradeFromBirthDate 사용 권장
 */
export function calculateGradeFromAge(age: number): number {
  const grade = age - 6;
  if (grade < 1) return 0; // 미취학
  if (grade > 6) return 7; // 중학생 이상
  return grade;
}

/**
 * 생년월일로 만 나이 계산
 */
export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * 생년월일로 대한민국 초등학교 학년 계산
 *
 * 대한민국 초등학교 학년 계산:
 * - 만 6세가 되는 해의 다음 해 3월 1일에 1학년 입학
 * - 매년 3월 1일 기준으로 학년 진급
 * - 초등학교: 1-6학년
 *
 * @param birthDate 생년월일 (YYYY-MM-DD 형식)
 * @returns 초등학교 학년 (1-6), 미취학 또는 중학생 이상이면 null
 */
export function calculateGradeFromBirthDate(birthDate: string): number | null {
  const birth = new Date(birthDate);
  const today = new Date();

  // 1학년 입학 연도 계산
  // 만 6세가 되는 해 = birth_year + 6
  // 입학 연도 = 그 다음 해 = birth_year + 7
  const entryYear = birth.getFullYear() + 7;

  // 현재 학년도 계산 (3월 1일 기준)
  // 1-2월은 이전 학년도에 해당
  const currentMonth = today.getMonth() + 1; // 0-indexed → 1-indexed
  const academicYear = currentMonth >= 3 ? today.getFullYear() : today.getFullYear() - 1;

  // 학년 계산
  const grade = academicYear - entryYear + 1;

  // 초등학교 범위 (1-6학년) 외에는 null 반환
  if (grade < 1 || grade > 6) {
    return null;
  }

  return grade;
}

/**
 * 아동이 특정 검사도구의 대상인지 확인
 */
export function isEligibleForAssessment(
  childAge: number,
  tool: AssessmentTool
): boolean {
  return childAge >= tool.minAge && childAge <= tool.maxAge;
}

/**
 * 검사도구 코드로 검사도구 정보 조회
 */
export function getAssessmentToolByCode(code: string): AssessmentTool | undefined {
  return ASSESSMENT_TOOLS.find((tool) => tool.code === code);
}

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
  // Backend returns facility_* fields from /teacher-assessment/auth/me
  facility_id: string;
  facility_type: string;
  facility_name: string;
  district: string | null;
  // Legacy fields (optional)
  user_id?: string | null;
  email?: string | null;
  real_name?: string | null;
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
  has_completed_assessment: boolean;
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
  | 'auth'              // 로그인
  | 'assessment-select' // 검사도구 선택
  | 'children'          // 아동 선택
  | 'intro'             // 검사 안내
  | 'testing'           // 검사 진행
  | 'submitting'        // 제출 중
  | 'result'            // 결과 표시
  | 'error';            // 에러 상태

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

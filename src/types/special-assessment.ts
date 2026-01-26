/**
 * Special Assessment Types (연령 제한 우회)
 * 특별 검사용 타입 정의 - 모든 KPRC 검사 지원
 */

// =============================================================================
// 재사용 타입 (teacher-assessment에서)
// =============================================================================

export type {
  AssessmentTool,
  AssessmentStatus,
  Gender,
  SectionInfo,
  QuestionInfo,
  SectionQuestionsResponse,
  AssessmentSession,
  AssessmentProgress,
  SessionAnswers,
  AssessmentResult,
  AssessmentResultDetail,
  SaveSectionAnswersRequest,
  SubmitTeacherAssessmentRequest,
  HealthCheckResponse,
} from './teacher-assessment';

export {
  ASSESSMENT_TOOLS,
  KPRC_TG_CHOICES,
  KPRC_TG_CHOICE_LABELS,
  calculateAge,
  calculateGradeFromAge,
  calculateGradeFromBirthDate,
} from './teacher-assessment';

// =============================================================================
// 특별 검사 전용 타입
// =============================================================================

/**
 * 특별 검사 검사도구 목록
 * - KPRC_CO_TG: 교사평정용 (6-10세)
 * - KPRC_CO_SG_E: 자기보고용 초등 (9-18세)
 */
export const SPECIAL_ASSESSMENT_TOOLS: AssessmentTool[] = [
  {
    code: 'KPRC_CO_TG',
    name: 'KPRC 한국 아동·청소년 인성평정척도 - 교사평정용 - 표준형',
    shortName: 'KPRC 교사평정용',
    description: '교사가 아동의 인성 및 적응을 평가하는 검사입니다.',
    minGrade: 1,
    maxGrade: 6, // 특별 검사에서는 학년 제한 완화
    minAge: 6,
    maxAge: 18, // 특별 검사에서는 나이 제한 완화
    questionCount: 152,
    sectionCount: 8,
  },
  {
    code: 'KPRC_CO_SG_E',
    name: 'KPRC 한국 아동·청소년 인성평정척도 - 자기보고용 - 초등',
    shortName: 'KPRC 자기보고용 (초등)',
    description: '아동이 직접 응답하는 자기보고식 인성 검사입니다.',
    minGrade: 1,
    maxGrade: 6,
    minAge: 9,
    maxAge: 18,
    questionCount: 177,
    sectionCount: 8,
  },
];

import type { AssessmentTool } from './teacher-assessment';

// =============================================================================
// 기관 정보 (기존과 동일)
// =============================================================================

export interface SpecialTeacherInfo {
  facility_id: string;
  facility_type: string;
  facility_name: string;
  district: string | null;
}

// =============================================================================
// 아동 정보 (연령 필터 없음)
// =============================================================================

export interface SpecialChildInfo {
  id: string;
  name: string;
  birth_date: string;
  age: number;
  gender: string;
  grade: number | null;
}

export interface SpecialChildListResponse {
  institution_id: string;
  institution_name: string;
  institution_type: string;
  children: SpecialChildInfo[];
  total_count: number;
}

// =============================================================================
// 특별 검사 도구 정보
// =============================================================================

export interface SpecialAssessmentType {
  type: string;
  name: string;
  short_name: string;
  description: string;
  question_count: number;
  section_count: number;
  valid_grades: number[];
  valid_ages: [number, number];
  choice_labels: string[];
}

// =============================================================================
// 어드민 키 인증
// =============================================================================

export interface AdminKeyVerifyRequest {
  admin_key: string;
}

export interface AdminKeyVerifyResponse {
  verified: boolean;
  token: string;
  expires_in_hours: number;
}

// =============================================================================
// 요청 타입
// =============================================================================

export interface StartSpecialAssessmentRequest {
  child_id: string;
  child_name: string;
  gender: 'M' | 'F';
  birth_date: string;
  school_grade: number;
  assessment_type: string;
}

// =============================================================================
// 프론트엔드 상태
// =============================================================================

export interface SpecialAssessmentState {
  // 인증 상태
  isAuthenticated: boolean;
  isAdminVerified: boolean;
  teacherInfo: SpecialTeacherInfo | null;
  specialAccessToken: string | null;

  // 아동 목록
  children: SpecialChildInfo[];
  selectedChild: SpecialChildInfo | null;

  // 검사 도구
  selectedAssessmentType: AssessmentTool | null;

  // 검사 세션
  session: import('./teacher-assessment').AssessmentSession | null;
  currentSection: number;
  answers: Record<number, number>;

  // UI 상태
  isLoading: boolean;
  error: string | null;

  // 결과
  result: import('./teacher-assessment').AssessmentResult | null;
}

// =============================================================================
// 검사 단계
// =============================================================================

export type SpecialAssessmentPhase =
  | 'auth'              // 기관 로그인
  | 'admin-verify'      // 어드민 키 입력
  | 'children'          // 아동 선택 (필터 없음)
  | 'assessment-select' // 검사 타입 선택
  | 'intro'             // 검사 소개
  | 'testing'           // 문항 진행
  | 'submitting'        // 제출 중
  | 'result'            // 결과
  | 'error';            // 에러 상태

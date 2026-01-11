// Assessment Types for Psychological Tests (CRTES-R, SDQ-A, KPRC)

// Assessment Type Constants
export const ASSESSMENT_TYPES = {
  CRTES_R: 'CRTES_R',
  SDQ_A: 'SDQ_A',
  KPRC: 'KPRC_CO_SG_E',
} as const;

export type AssessmentTypeKey = keyof typeof ASSESSMENT_TYPES;
export type AssessmentTypeValue = (typeof ASSESSMENT_TYPES)[AssessmentTypeKey];

// Assessment Type Information
export const ASSESSMENT_TYPE_INFO: Record<
  AssessmentTypeKey,
  {
    name: string;
    shortName: string;
    questionCount: number;
    description: string;
    isSelfScoring: boolean;
  }
> = {
  CRTES_R: {
    name: '아동 외상 반응 척도',
    shortName: 'CRTES-R',
    questionCount: 23,
    description: '외상 경험과 관련된 반응을 측정합니다',
    isSelfScoring: true,
  },
  SDQ_A: {
    name: '강점·난점 설문지',
    shortName: 'SDQ-A',
    questionCount: 25,
    description: '강점과 어려움을 종합적으로 평가합니다',
    isSelfScoring: true,
  },
  KPRC: {
    name: '한국아동인성평정척도',
    shortName: 'KPRC',
    questionCount: 164,
    description: '아동의 심리적 적응과 정신건강 상태를 종합 평가합니다',
    isSelfScoring: false,
  },
};

// Helper function to get assessment type key from value
export function getAssessmentTypeKey(value: string): AssessmentTypeKey | null {
  const entries = Object.entries(ASSESSMENT_TYPES) as [AssessmentTypeKey, string][];
  const found = entries.find(([, v]) => v === value);
  return found ? found[0] : null;
}

export interface AssessmentQuestion {
  number: number;
  text: string;
  is_reverse_scored: boolean;
  choices: {
    value: string;
    label: string;
  }[];
}

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

export type AssessmentStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'FAILED';

export interface AssessmentProgress {
  session_id: string;
  status: AssessmentStatus;
  total_questions: number;
  answered_count: number;
  remaining_count: number;
  progress_percentage: number;
}

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

export interface StartAssessmentRequest {
  child_id: string;
  child_name: string;
  gender: 'M' | 'F';
  birth_date: string; // YYYY-MM-DD
  school_grade: number;
  assessment_type?: string;
  session_id?: string;
}

export interface SubmitAnswersRequest {
  answers: Record<number, number>; // { questionNumber: choiceValue }
}

export interface SaveAnswersRequest {
  answers: Record<number, number>;
}

export interface QuestionsListResponse {
  assessment_type: string;
  total_questions: number;
  questions: AssessmentQuestion[];
}

// Assessment state for Redux or local state
export interface AssessmentState {
  session: AssessmentSession | null;
  questions: AssessmentQuestion[];
  currentQuestionIndex: number;
  answers: Record<number, number>;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  result: AssessmentResult | null;
}

// Child assessment status (from backend)
export interface ChildAssessmentStatus {
  child_id: string;
  can_start_new: boolean;
  has_in_progress: boolean;
  has_completed: boolean;
  in_progress_session: AssessmentSession | null;
  latest_completed_session: AssessmentSession | null;
  total_completed_count: number;
  message: string;
}

// Session answers (for resuming assessment)
export interface SessionAnswers {
  session_id: string;
  answers: Record<number, number>;
  answered_count: number;
  last_answered_question: number | null;
}

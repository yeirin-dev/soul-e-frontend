// Assessment Types for KPRC Psychological Test

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

// =============================================================================
// Institution Types (New simplified auth)
// =============================================================================

export type InstitutionType = 'CARE_FACILITY' | 'COMMUNITY_CENTER';

export interface DistrictFacility {
  id: string;
  name: string;
  facilityType: InstitutionType;
  district: string;
  address: string;
}

export interface InstitutionLoginRequest {
  facilityId: string;
  facilityType: InstitutionType;
  password: string;
}

export interface InstitutionLoginResponse {
  accessToken: string;
  refreshToken: string;
  institution: {
    id: string;
    name: string;
    facilityType: InstitutionType;
    district: string;
    isPasswordChanged: boolean;
  };
}

export interface ChangeInstitutionPasswordRequest {
  facilityId: string;
  facilityType: InstitutionType;
  currentPassword: string;
  newPassword: string;
}

// =============================================================================
// Legacy Authentication Types (deprecated)
// =============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    realName: string;
    role: 'GUARDIAN' | 'INSTITUTION_ADMIN' | 'COUNSELOR' | 'ADMIN';
  };
}

// =============================================================================
// Teacher/Institution Info (supports both auth methods)
// =============================================================================

export interface TeacherInfo {
  // Primary fields (always available for institution-based auth)
  facility_id: string;
  facility_type: string;
  facility_name: string;
  district: string | null;

  // Legacy fields (optional, for backward compatibility)
  user_id: string | null;
  email: string | null;
  real_name: string | null;
  guardian_type: string | null;

  // Aliases (backward compatibility)
  institution_id?: string;
  institution_type?: string;
  institution_name?: string;
}

export interface ChildInfo {
  id: string;
  name: string;
  birth_date: string;
  age: number;
  gender: string;
  child_type: string;
  is_eligible: boolean; // 9-15세 대상 여부
  has_pin: boolean; // PIN 설정 여부
  has_consent?: boolean; // 동의 여부 (optional for backward compatibility)
}

// =============================================================================
// Consent Types (동의 관리)
// =============================================================================

export interface ConsentItems {
  personal_info: boolean; // 개인정보 수집·이용 및 제3자 제공 동의 (필수)
  sensitive_data: boolean; // 민감정보 처리 동의 (필수)
  research_data: boolean; // 비식별화 데이터 연구 활용 동의 (선택)
  child_self_consent: boolean; // 아동 본인 동의 (14세 이상 아동인 경우 필수)
}

export interface ConsentStatusResponse {
  has_consent: boolean;
  consent_items: ConsentItems | null;
  consent_version: string | null;
  consented_at: string | null;
  is_valid: boolean;
}

export interface AcceptConsentRequest {
  child_id: string;
  consent_items: ConsentItems;
  is_child_over_14: boolean;
  document_url?: string;
}

export interface AcceptConsentResponse {
  id: string;
  child_id: string;
  consent_items: ConsentItems;
  consent_version: string;
  has_valid_consent: boolean;
  consented_at: string;
}

export interface DocumentUrlResponse {
  url: string;
  version: string;
}

// PIN Types
export interface PinStatusResponse {
  child_id: string;
  has_pin: boolean;
  message: string;
}

export interface SetPinRequest {
  child_id: string;
  pin: string;
}

export interface SetPinResponse {
  child_id: string;
  success: boolean;
  message: string;
}

export interface VerifyPinRequest {
  child_id: string;
  pin: string;
}

export interface VerifyPinResponse {
  child_id: string;
  verified: boolean;
  session_token: string | null;
  child_name: string | null;
  expires_in_minutes: number | null;
  failed_attempts: number;
  message: string;
}

export interface ChangePinRequest {
  child_id: string;
  new_pin: string;
}

export interface ChangePinResponse {
  child_id: string;
  success: boolean;
  message: string;
}

export interface ChildListResponse {
  institution_id: string;
  institution_name: string;
  institution_type: string;
  children: ChildInfo[];
  total_count: number;
  eligible_count: number;
}

export interface ChildSessionResponse {
  session_token: string;
  child_id: string;
  child_name: string;
  expires_in_minutes: number;
  message: string;
}

// Chat Types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id?: string; // Optional for optimistic updates
  session_id?: string;
  role: MessageRole;
  content: string;
  created_at?: string;
  is_final?: boolean; // For streaming
}

export interface ChatResponse {
  session_id: string;
  message_id: string;
  content: string;
  role: MessageRole;
  created_at: string;
}

export interface StreamResponseChunk {
  session_id: string;
  content: string;
  is_final: boolean;
  message_id?: string;
}

// Session Types
export interface SessionInfo {
  id: string;
  user_id: string | null;
  title: string | null;
  status: 'active' | 'closed' | 'expired';
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageResponse {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface SessionDetailResponse {
  id: string;
  user_id: string | null;
  title: string | null;
  status: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  messages: MessageResponse[];
}

// Error Types
export interface ApiError {
  detail: string | { loc: (string | number)[]; msg: string; type: string }[];
}

import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  type ConsentItems,
  type ConsentStatusResponse,
  type AcceptConsentResponse,
} from '@/types/api';
import { consentApi } from '@/lib/api';

interface ConsentState {
  // 동의 상태
  status: ConsentStatusResponse | null;
  statusLoading: boolean;
  statusError: string | null;

  // 동의 제출
  acceptLoading: boolean;
  acceptError: string | null;
  acceptSuccess: boolean;

  // 동의서 정보
  documentUrl: string;
  documentVersion: string;
}

const initialState: ConsentState = {
  status: null,
  statusLoading: false,
  statusError: null,

  acceptLoading: false,
  acceptError: null,
  acceptSuccess: false,

  documentUrl: '/documents/privacy-policy-v1.0.0.pdf',
  documentVersion: '1.0.0',
};

/**
 * 동의 상태 조회
 */
export const fetchConsentStatus = createAsyncThunk(
  'consent/fetchStatus',
  async (childId: string, { rejectWithValue }) => {
    try {
      const status = await consentApi.getStatus(childId);
      return status;
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || '동의 상태 조회에 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

/**
 * 동의 제출
 */
export const acceptConsent = createAsyncThunk(
  'consent/accept',
  async (
    {
      childId,
      consentItems,
      isChildOver14,
    }: {
      childId: string;
      consentItems: ConsentItems;
      isChildOver14: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await consentApi.accept({
        child_id: childId,
        consent_items: consentItems,
        is_child_over_14: isChildOver14,
        document_url: '/documents/privacy-policy-v1.0.0.pdf',
      });
      return response;
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || '동의 제출에 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

const consentSlice = createSlice({
  name: 'consent',
  initialState,
  reducers: {
    clearConsentError: (state) => {
      state.statusError = null;
      state.acceptError = null;
    },
    clearConsentStatus: (state) => {
      state.status = null;
      state.statusError = null;
    },
    resetConsentSuccess: (state) => {
      state.acceptSuccess = false;
    },
    resetConsentState: (state) => {
      state.status = null;
      state.statusLoading = false;
      state.statusError = null;
      state.acceptLoading = false;
      state.acceptError = null;
      state.acceptSuccess = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Consent Status
      .addCase(fetchConsentStatus.pending, (state) => {
        state.statusLoading = true;
        state.statusError = null;
      })
      .addCase(fetchConsentStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        state.status = action.payload;
        state.statusError = null;
      })
      .addCase(fetchConsentStatus.rejected, (state, action) => {
        state.statusLoading = false;
        state.statusError = action.payload as string;
      })
      // Accept Consent
      .addCase(acceptConsent.pending, (state) => {
        state.acceptLoading = true;
        state.acceptError = null;
        state.acceptSuccess = false;
      })
      .addCase(acceptConsent.fulfilled, (state, action) => {
        state.acceptLoading = false;
        state.acceptSuccess = true;
        state.acceptError = null;
        // 동의 상태 업데이트
        state.status = {
          has_consent: true,
          consent_items: action.payload.consent_items,
          consent_version: action.payload.consent_version,
          consented_at: action.payload.consented_at,
          is_valid: action.payload.has_valid_consent,
        };
      })
      .addCase(acceptConsent.rejected, (state, action) => {
        state.acceptLoading = false;
        state.acceptError = action.payload as string;
        state.acceptSuccess = false;
      });
  },
});

export const {
  clearConsentError,
  clearConsentStatus,
  resetConsentSuccess,
  resetConsentState,
} = consentSlice.actions;

export default consentSlice.reducer;

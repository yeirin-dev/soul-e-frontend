import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { type TeacherInfo, type ChildInfo, type LoginRequest, type VerifyPinResponse } from '@/types/api';
import { authApi } from '@/lib/api';

interface AuthState {
  teacher: TeacherInfo | null;
  children: ChildInfo[];
  selectedChild: ChildInfo | null;
  yeirinToken: string | null;
  childSessionToken: string | null;
  childSessionExpiresAt: number | null; // 세션 만료 시간 (timestamp)
  loading: boolean;
  childrenLoading: boolean;
  selectingChild: boolean;
  error: string | null;
  // PIN 관련 상태
  pinLoading: boolean;
  pinError: string | null;
  pinFailedAttempts: number;
}

const getStoredToken = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

const getStoredNumber = (key: string): number | null => {
  if (typeof window !== 'undefined') {
    const value = localStorage.getItem(key);
    return value ? parseInt(value, 10) : null;
  }
  return null;
};

const initialState: AuthState = {
  teacher: null,
  children: [],
  selectedChild: null,
  yeirinToken: getStoredToken('yeirin_token'),
  childSessionToken: getStoredToken('child_session_token'),
  childSessionExpiresAt: getStoredNumber('child_session_expires_at'),
  loading: false,
  childrenLoading: false,
  selectingChild: false,
  error: null,
  // PIN 관련 초기 상태
  pinLoading: false,
  pinError: null,
  pinFailedAttempts: 0,
};

export const loginTeacher = createAsyncThunk(
  'auth/loginTeacher',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      // 1. Login to Yeirin Backend
      const loginResponse = await authApi.login(credentials);
      const token = loginResponse.accessToken;

      if (!token) {
        return rejectWithValue('로그인 응답에서 토큰을 받지 못했습니다.');
      }

      // 2. Save Token
      localStorage.setItem('yeirin_token', token);

      // 3. Validate Token with Soul-E Backend & Get Teacher Info
      try {
        const teacher = await authApi.getMe();
        return { teacher, token };
      } catch (meError: any) {
        // getMe 실패해도 로그인은 성공으로 처리 (토큰은 유효함)
        // 선생님 정보 없이 children 페이지로 이동 가능
        console.warn('Failed to get teacher info:', meError);
        return {
          teacher: null,
          token,
        };
      }
    } catch (error: any) {
      // axios interceptor가 가공한 에러 또는 원본 에러
      const message = error.message || error.response?.data?.message || error.response?.data?.detail || '로그인에 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

export const fetchChildren = createAsyncThunk(
  'auth/fetchChildren',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authApi.getChildren();
      return data.children;
    } catch (error: any) {
      const message = error.message || error.response?.data?.detail || '아동 목록을 불러오는데 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

export const selectChildSession = createAsyncThunk(
  'auth/selectChildSession',
  async (child: ChildInfo, { rejectWithValue }) => {
    try {
      const response = await authApi.selectChild(child.id);
      localStorage.setItem('child_session_token', response.session_token);

      // 세션 만료 시간 저장 (현재 시간 + 만료 시간)
      const expiresAt = Date.now() + response.expires_in_minutes * 60 * 1000;
      localStorage.setItem('child_session_expires_at', expiresAt.toString());

      return { child, token: response.session_token, expiresAt };
    } catch (error: any) {
      return rejectWithValue(error.message || error.response?.data?.detail || '세션 시작에 실패했습니다.');
    }
  }
);

// 세션 만료 체크 헬퍼
export const isChildSessionExpired = (): boolean => {
  if (typeof window === 'undefined') return true;
  const expiresAt = localStorage.getItem('child_session_expires_at');
  if (!expiresAt) return true;
  return Date.now() > parseInt(expiresAt, 10);
};

// PIN 설정 (최초)
export const setChildPin = createAsyncThunk(
  'auth/setChildPin',
  async ({ childId, pin }: { childId: string; pin: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.setPin({ child_id: childId, pin });
      return response;
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'PIN 설정에 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

// PIN 검증 및 세션 시작
export const verifyChildPin = createAsyncThunk(
  'auth/verifyChildPin',
  async ({ child, pin }: { child: ChildInfo; pin: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyPin({ child_id: child.id, pin });
      return { child, response };
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'PIN 검증에 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

// PIN 변경 (교사용)
export const changeChildPin = createAsyncThunk(
  'auth/changeChildPin',
  async ({ childId, newPin }: { childId: string; newPin: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.changePin({ child_id: childId, new_pin: newPin });
      return response;
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'PIN 변경에 실패했습니다.';
      return rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setYeirinToken: (state, action: PayloadAction<string>) => {
      state.yeirinToken = action.payload;
      localStorage.setItem('yeirin_token', action.payload);
    },
    clearError: (state) => {
      state.error = null;
    },
    clearPinError: (state) => {
      state.pinError = null;
    },
    clearPinState: (state) => {
      state.pinError = null;
      state.pinFailedAttempts = 0;
    },
    setSelectedChild: (state, action: PayloadAction<ChildInfo>) => {
      state.selectedChild = action.payload;
    },
    clearChildSession: (state) => {
      state.selectedChild = null;
      state.childSessionToken = null;
      state.childSessionExpiresAt = null;
      state.pinError = null;
      state.pinFailedAttempts = 0;
      localStorage.removeItem('child_session_token');
      localStorage.removeItem('child_session_expires_at');
    },
    logout: (state) => {
      state.teacher = null;
      state.children = [];
      state.selectedChild = null;
      state.yeirinToken = null;
      state.childSessionToken = null;
      state.childSessionExpiresAt = null;
      state.error = null;
      state.pinError = null;
      state.pinFailedAttempts = 0;
      localStorage.removeItem('yeirin_token');
      localStorage.removeItem('child_session_token');
      localStorage.removeItem('child_session_expires_at');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginTeacher.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginTeacher.fulfilled, (state, action) => {
        state.loading = false;
        state.teacher = action.payload.teacher;
        state.yeirinToken = action.payload.token;
        state.error = null;
      })
      .addCase(loginTeacher.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Children
      .addCase(fetchChildren.pending, (state) => {
        state.childrenLoading = true;
        state.error = null;
      })
      .addCase(fetchChildren.fulfilled, (state, action) => {
        state.childrenLoading = false;
        state.children = action.payload;
      })
      .addCase(fetchChildren.rejected, (state, action) => {
        state.childrenLoading = false;
        state.error = action.payload as string;
      })
      // Select Child
      .addCase(selectChildSession.pending, (state) => {
        state.selectingChild = true;
        state.error = null;
      })
      .addCase(selectChildSession.fulfilled, (state, action) => {
        state.selectingChild = false;
        state.selectedChild = action.payload.child;
        state.childSessionToken = action.payload.token;
        state.childSessionExpiresAt = action.payload.expiresAt;
      })
      .addCase(selectChildSession.rejected, (state, action) => {
        state.selectingChild = false;
        state.error = action.payload as string;
      })
      // Set PIN
      .addCase(setChildPin.pending, (state) => {
        state.pinLoading = true;
        state.pinError = null;
      })
      .addCase(setChildPin.fulfilled, (state) => {
        state.pinLoading = false;
        state.pinError = null;
        // 아동 목록에서 해당 아동의 has_pin을 true로 업데이트
        if (state.selectedChild) {
          state.selectedChild.has_pin = true;
          const childIndex = state.children.findIndex(c => c.id === state.selectedChild?.id);
          if (childIndex !== -1) {
            state.children[childIndex].has_pin = true;
          }
        }
      })
      .addCase(setChildPin.rejected, (state, action) => {
        state.pinLoading = false;
        state.pinError = action.payload as string;
      })
      // Verify PIN
      .addCase(verifyChildPin.pending, (state) => {
        state.pinLoading = true;
        state.pinError = null;
      })
      .addCase(verifyChildPin.fulfilled, (state, action) => {
        state.pinLoading = false;
        const { child, response } = action.payload;
        if (response.verified && response.session_token && response.expires_in_minutes) {
          state.selectedChild = child;
          state.childSessionToken = response.session_token;
          const expiresAt = Date.now() + response.expires_in_minutes * 60 * 1000;
          state.childSessionExpiresAt = expiresAt;
          state.pinError = null;
          state.pinFailedAttempts = 0;

          // localStorage에 세션 정보 저장
          localStorage.setItem('child_session_token', response.session_token);
          localStorage.setItem('child_session_expires_at', expiresAt.toString());
        } else {
          state.pinError = response.message;
          state.pinFailedAttempts = response.failed_attempts;
        }
      })
      .addCase(verifyChildPin.rejected, (state, action) => {
        state.pinLoading = false;
        state.pinError = action.payload as string;
      })
      // Change PIN
      .addCase(changeChildPin.pending, (state) => {
        state.pinLoading = true;
        state.pinError = null;
      })
      .addCase(changeChildPin.fulfilled, (state) => {
        state.pinLoading = false;
        state.pinError = null;
      })
      .addCase(changeChildPin.rejected, (state, action) => {
        state.pinLoading = false;
        state.pinError = action.payload as string;
      });
  },
});

export const { setYeirinToken, clearError, clearPinError, clearPinState, setSelectedChild, clearChildSession, logout } = authSlice.actions;
export default authSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { type ChatMessage, type SessionInfo } from '@/types/api';

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  // 세션 관련 상태
  sessions: SessionInfo[];
  sessionsLoading: boolean;
  historyLoading: boolean;
}

const initialState: ChatState = {
  messages: [],
  sessionId: null,
  isLoading: false,
  error: null,
  sessions: [],
  sessionsLoading: false,
  historyLoading: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    updateLastMessage: (state, action: PayloadAction<string>) => {
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = action.payload;
      }
    },
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearChat: (state) => {
      state.messages = [];
      state.sessionId = null;
      state.error = null;
    },
    // 세션 관련 액션
    setSessions: (state, action: PayloadAction<SessionInfo[]>) => {
      state.sessions = action.payload;
    },
    setSessionsLoading: (state, action: PayloadAction<boolean>) => {
      state.sessionsLoading = action.payload;
    },
    setHistoryLoading: (state, action: PayloadAction<boolean>) => {
      state.historyLoading = action.payload;
    },
    loadSessionHistory: (state, action: PayloadAction<{ sessionId: string; messages: ChatMessage[] }>) => {
      state.sessionId = action.payload.sessionId;
      state.messages = action.payload.messages;
      state.error = null;
    },
  },
});

export const {
  addMessage,
  updateLastMessage,
  setSessionId,
  setLoading,
  setError,
  clearError,
  clearChat,
  setSessions,
  setSessionsLoading,
  setHistoryLoading,
  loadSessionHistory,
} = chatSlice.actions;
export default chatSlice.reducer;

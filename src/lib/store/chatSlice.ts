import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { type ChatMessage, type SessionInfo } from '@/types/api';

// 음성 모드 상태 타입 (STT)
interface VoiceModeState {
  enabled: boolean;           // 음성 모드 활성화 여부
  isListening: boolean;       // VAD 청취 중
  isRecording: boolean;       // 녹음 중 (발화 감지됨)
  isTranscribing: boolean;    // STT 처리 중
  error: string | null;       // 음성 관련 에러
}

// TTS 모드 상태 타입
interface TTSModeState {
  isMuted: boolean;           // 음소거 상태
  isPlaying: boolean;         // 재생 중
  isLoading: boolean;         // TTS 변환 중
  error: string | null;       // TTS 관련 에러
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  // 세션 관련 상태
  sessions: SessionInfo[];
  sessionsLoading: boolean;
  historyLoading: boolean;
  // 음성 모드 상태 (STT)
  voiceMode: VoiceModeState;
  // TTS 모드 상태
  ttsMode: TTSModeState;
}

const initialState: ChatState = {
  messages: [],
  sessionId: null,
  isLoading: false,
  error: null,
  sessions: [],
  sessionsLoading: false,
  historyLoading: false,
  voiceMode: {
    enabled: false,
    isListening: false,
    isRecording: false,
    isTranscribing: false,
    error: null,
  },
  ttsMode: {
    isMuted: false,
    isPlaying: false,
    isLoading: false,
    error: null,
  },
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
    // 음성 모드 액션
    setVoiceModeEnabled: (state, action: PayloadAction<boolean>) => {
      state.voiceMode.enabled = action.payload;
    },
    setVoiceListening: (state, action: PayloadAction<boolean>) => {
      state.voiceMode.isListening = action.payload;
    },
    setVoiceRecording: (state, action: PayloadAction<boolean>) => {
      state.voiceMode.isRecording = action.payload;
    },
    setVoiceTranscribing: (state, action: PayloadAction<boolean>) => {
      state.voiceMode.isTranscribing = action.payload;
    },
    setVoiceError: (state, action: PayloadAction<string | null>) => {
      state.voiceMode.error = action.payload;
    },
    resetVoiceMode: (state) => {
      state.voiceMode = {
        enabled: state.voiceMode.enabled, // enabled 상태는 유지
        isListening: false,
        isRecording: false,
        isTranscribing: false,
        error: null,
      };
    },
    // TTS 모드 액션
    setTTSMuted: (state, action: PayloadAction<boolean>) => {
      state.ttsMode.isMuted = action.payload;
    },
    setTTSPlaying: (state, action: PayloadAction<boolean>) => {
      state.ttsMode.isPlaying = action.payload;
    },
    setTTSLoading: (state, action: PayloadAction<boolean>) => {
      state.ttsMode.isLoading = action.payload;
    },
    setTTSError: (state, action: PayloadAction<string | null>) => {
      state.ttsMode.error = action.payload;
    },
    resetTTSMode: (state) => {
      state.ttsMode = {
        isMuted: state.ttsMode.isMuted, // 음소거 상태는 유지
        isPlaying: false,
        isLoading: false,
        error: null,
      };
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
  // 음성 모드 액션 (STT)
  setVoiceModeEnabled,
  setVoiceListening,
  setVoiceRecording,
  setVoiceTranscribing,
  setVoiceError,
  resetVoiceMode,
  // TTS 모드 액션
  setTTSMuted,
  setTTSPlaying,
  setTTSLoading,
  setTTSError,
  resetTTSMode,
} = chatSlice.actions;
export default chatSlice.reducer;

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import chatReducer from './chatSlice';
import consentReducer from './consentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    consent: consentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

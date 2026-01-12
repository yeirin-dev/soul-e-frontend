'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import {
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
} from '@/lib/store/chatSlice';
import { clearChildSession, isChildSessionExpired } from '@/lib/store/authSlice';
import { chatApi, sessionApi, settingsApi } from '@/lib/api';
import { assessmentApi, type AllAssessmentStatuses } from '@/lib/api/assessment';
import { useAssessmentSettings } from '@/lib/hooks/useAssessmentSettings';
import { type ChatMessage } from '@/types/api';
import {
  type ChildAssessmentStatus,
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_INFO,
  type AssessmentTypeKey,
} from '@/types/assessment';
import styles from '@/styles/modules/ChatPage.module.scss';
import { v4 as uuidv4 } from 'uuid';

// Soul-E Components
import { SoulECharacter } from '@/components/SoulECharacter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { VoiceButton } from '@/components/VoiceButton';
import { MuteButton } from '@/components/MuteButton';
import { VoiceInputModeToggle } from '@/components/VoiceInputModeToggle';
import Tooltip from '@/components/Tooltip';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { usePTTRecorder } from '@/hooks/usePTTRecorder';
import { useTTSPlayer } from '@/hooks/useTTSPlayer';

export default function ChatPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { messages, sessionId, isLoading, error: chatError, sessions, sessionsLoading, historyLoading, voiceMode } = useAppSelector(
    (state) => state.chat
  );
  const { inputMode: voiceInputMode } = voiceMode;
  const { selectedChild, childSessionToken, childSessionExpiresAt } = useAppSelector(
    (state) => state.auth
  );
  const [input, setInput] = useState('');
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [assessmentStatuses, setAssessmentStatuses] = useState<AllAssessmentStatuses | null>(null);
  const [assessmentStatusLoading, setAssessmentStatusLoading] = useState(false);

  // 검사 활성화 설정 조회
  const { data: assessmentEnabledSettings } = useAssessmentSettings();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

  // 음성 인식 완료 시 메시지 전송용 ref (순환 의존성 해결)
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  // TTS speak 함수용 ref (순환 의존성 해결)
  const speakRef = useRef<(text: string) => void>(() => {});

  // 세션 만료 체크
  useEffect(() => {
    if (!childSessionToken || !selectedChild) {
      router.replace('/children');
      return;
    }

    if (isChildSessionExpired()) {
      dispatch(clearChildSession());
      router.replace('/children');
      return;
    }

    if (childSessionExpiresAt) {
      const timeUntilExpiry = childSessionExpiresAt - Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (timeUntilExpiry > 0 && timeUntilExpiry <= fiveMinutes) {
        const hasWarning = messages.some((m) => m.content.includes('세션이 곧 만료'));
        if (!hasWarning) {
          dispatch(
            addMessage({
              id: uuidv4(),
              role: 'system',
              content: '⚠️ 세션이 곧 만료됩니다. 대화를 마무리하거나 아동 선택 페이지에서 세션을 갱신해주세요.',
              created_at: new Date().toISOString(),
            })
          );
        }
      }
    }
  }, [childSessionToken, selectedChild, childSessionExpiresAt, router, dispatch, messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (chatError) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [chatError, dispatch]);

  // 세션 목록 불러오기
  const fetchSessions = useCallback(async () => {
    if (!childSessionToken || !selectedChild) return;

    dispatch(setSessionsLoading(true));
    try {
      const sessionList = await sessionApi.getSessions(selectedChild.id);
      dispatch(setSessions(sessionList));
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      dispatch(setSessionsLoading(false));
    }
  }, [childSessionToken, selectedChild, dispatch]);

  // 모든 검사 상태 불러오기
  const fetchAssessmentStatuses = useCallback(async () => {
    if (!selectedChild) return;

    setAssessmentStatusLoading(true);
    try {
      const statuses = await assessmentApi.getAllAssessmentStatuses(selectedChild.id);
      setAssessmentStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch assessment statuses:', error);
    } finally {
      setAssessmentStatusLoading(false);
    }
  }, [selectedChild]);

  // 페이지 로드 시 세션 목록 및 검사 상태 불러오기
  useEffect(() => {
    fetchSessions();
    fetchAssessmentStatuses();
  }, [fetchSessions, fetchAssessmentStatuses]);

  // 세션 히스토리 불러오기
  const loadSession = async (targetSessionId: string) => {
    dispatch(setHistoryLoading(true));
    try {
      const sessionDetail = await sessionApi.getSession(targetSessionId);
      // 백엔드 MessageResponse를 프론트엔드 ChatMessage로 변환
      const chatMessages: ChatMessage[] = sessionDetail.messages.map(msg => ({
        id: msg.id,
        session_id: msg.session_id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
      }));
      dispatch(loadSessionHistory({
        sessionId: targetSessionId,
        messages: chatMessages,
      }));
      setShowSessionList(false);
    } catch (error) {
      console.error('Failed to load session:', error);
      dispatch(setError('이전 대화를 불러오는데 실패했습니다.'));
    } finally {
      dispatch(setHistoryLoading(false));
    }
  };

  // 새 대화 시작
  const startNewChat = () => {
    dispatch(clearChat());
    setShowSessionList(false);
  };

  // 세션 목록 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(event.target as Node)) {
        setShowSessionList(false);
      }
    };

    if (showSessionList) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSessionList]);

  // 메시지 전송 핵심 로직 (텍스트 입력 / 음성 입력 공통)
  const handleSendMessage = useCallback(async (content: string) => {
    if (!content || isLoading) return;

    if (isChildSessionExpired()) {
      dispatch(setError('세션이 만료되었습니다. 아동을 다시 선택해주세요.'));
      dispatch(clearChildSession());
      setTimeout(() => router.replace('/children'), 2000);
      return;
    }

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    dispatch(addMessage(userMsg));
    setInput('');
    setRetryMessage(null);
    dispatch(setLoading(true));
    dispatch(clearError());

    dispatch(
      addMessage({
        id: uuidv4(),
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      })
    );

    // TTS를 위한 최종 응답 추적
    let finalResponse = '';

    try {
      await chatApi.sendMessageStream(
        content,
        sessionId || undefined,
        (accumulated: string) => {
          dispatch(updateLastMessage(accumulated));
          finalResponse = accumulated; // 최종 응답 추적
        },
        (data) => {
          if (data.session_id) {
            dispatch(setSessionId(data.session_id));
          }
        },
        (error) => {
          if (error.status === 401 && !error.shouldRetry) {
            dispatch(clearChildSession());
            setTimeout(() => router.replace('/children'), 2000);
          }
        }
      );

      // 스트리밍 완료 후 TTS 재생 (음소거 상태가 아닐 때만)
      if (finalResponse) {
        speakRef.current(finalResponse);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage = error.message || '메시지 전송에 실패했습니다.';
      dispatch(updateLastMessage(`❌ ${errorMessage}`));
      dispatch(setError(errorMessage));

      if (error.shouldRetry) {
        setRetryMessage(content);
      }
    } finally {
      dispatch(setLoading(false));
      inputRef.current?.focus();
    }
  }, [isLoading, dispatch, router, sessionId]);

  // sendMessageRef 업데이트 (순환 의존성 해결)
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // 음성 인식 완료 시 자동 전송 콜백
  const handleVoiceTranscription = useCallback((text: string) => {
    sendMessageRef.current(text);
  }, []);

  // 음성 인식 에러 핸들러
  const handleVoiceError = useCallback((error: string) => {
    dispatch(setError(error));
  }, [dispatch]);

  // Voice Recorder 훅 (VAD - 통화모드)
  const {
    startListening: vadStartListening,
    stopListening: vadStopListening,
    isListening: vadIsListening,
    isRecording: vadIsRecording,
    isTranscribing: vadIsTranscribing,
    error: vadError,
    isVADLoading,
  } = useVoiceRecorder({
    onTranscription: handleVoiceTranscription,
    onError: handleVoiceError,
  });

  // PTT Recorder 훅 (Push-to-Talk - 입력모드)
  const {
    startRecording: pttStartRecording,
    stopRecording: pttStopRecording,
    isRecording: pttIsRecording,
    isTranscribing: pttIsTranscribing,
    error: pttError,
    isInitializing: pttIsInitializing,
  } = usePTTRecorder({
    onTranscription: handleVoiceTranscription,
    onError: handleVoiceError,
  });

  // 현재 모드에 따른 상태 선택
  const isPTTMode = voiceInputMode === 'input';
  const voiceIsListening = isPTTMode ? pttIsRecording : vadIsListening;
  const voiceIsRecording = isPTTMode ? pttIsRecording : vadIsRecording;
  const voiceIsTranscribing = isPTTMode ? pttIsTranscribing : vadIsTranscribing;
  const voiceError = isPTTMode ? pttError : vadError;
  const voiceIsLoading = isPTTMode ? pttIsInitializing : isVADLoading;

  // TTS Player 훅
  const {
    speak,
    toggleMute,
    unlock: unlockAudio,
    isMuted: ttsIsMuted,
    isPlaying: ttsIsPlaying,
    isLoading: ttsIsLoading,
  } = useTTSPlayer({
    onError: handleVoiceError, // 음성 관련 에러 공통 핸들러 사용
  });

  // speakRef 업데이트 (순환 의존성 해결)
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // 음성 버튼 클릭 핸들러 (모드별 분기)
  const handleVoiceButtonClick = useCallback(() => {
    // Safari AudioContext unlock (사용자 제스처 내에서 호출)
    unlockAudio();

    if (isPTTMode) {
      // 입력모드 (PTT): 토글 방식
      if (pttIsRecording) {
        pttStopRecording();
      } else {
        pttStartRecording();
      }
    } else {
      // 통화모드 (VAD): 토글 방식
      if (vadIsListening) {
        vadStopListening();
      } else {
        vadStartListening();
      }
    }
  }, [isPTTMode, pttIsRecording, pttStartRecording, pttStopRecording, vadIsListening, vadStartListening, vadStopListening, unlockAudio]);

  // 폼 제출 핸들러
  const handleSend = (e?: React.FormEvent, messageToSend?: string) => {
    e?.preventDefault();
    // Safari AudioContext unlock (사용자 제스처 내에서 호출)
    unlockAudio();
    const content = messageToSend || input.trim();
    handleSendMessage(content);
  };

  const handleRetry = () => {
    if (retryMessage) {
      handleSend(undefined, retryMessage);
    }
  };

  const handleGoBack = () => {
    router.push('/children');
  };

  // 메시지 인덱스를 추적하여 애니메이션 딜레이 적용
  const getAnimationDelay = (index: number) => {
    return Math.min(index * 0.1, 0.5);
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '오늘';
    } else if (days === 1) {
      return '어제';
    } else if (days < 7) {
      return `${days}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={handleGoBack} className={styles.backButton} type="button">
          ←
        </button>
        <h2>소울이와 대화하기</h2>

        {/* 음성 입력 모드 토글 */}
        <VoiceInputModeToggle
          disabled={voiceIsListening || voiceIsRecording || voiceIsTranscribing}
        />

        {/* TTS 음소거 버튼 */}
        <MuteButton
          isMuted={ttsIsMuted}
          isPlaying={ttsIsPlaying}
          isLoading={ttsIsLoading}
          onClick={() => {
            unlockAudio(); // Safari AudioContext unlock
            toggleMute();
          }}
        />

        {/* 검사 버튼들 - CRTES-R, SDQ-A, KPRC 순서 */}
        <div className={styles.assessmentButtons}>
          {assessmentStatusLoading ? (
            <button
              className={`${styles.assessmentButton} ${styles.loading}`}
              type="button"
              disabled
            >
              <LoadingSpinner />
            </button>
          ) : (
            (['CRTES_R', 'SDQ_A', 'KPRC'] as const).map((typeKey) => {
              const status = assessmentStatuses?.[typeKey];
              const info = ASSESSMENT_TYPE_INFO[typeKey];
              const assessmentType = ASSESSMENT_TYPES[typeKey];
              // 검사 활성화 여부 확인 (assessmentType은 실제 API 키 값: CRTES_R, SDQ_A, KPRC_CO_SG_E)
              const isAssessmentEnabled = assessmentEnabledSettings?.[assessmentType] ?? true;

              // 검사가 비활성화된 경우 - 툴팁과 함께 비활성화 버튼 표시
              if (!isAssessmentEnabled) {
                return (
                  <Tooltip key={typeKey} content="아직 검사기간이 아니에요 !" disabled={true}>
                    <button
                      className={styles.assessmentButton}
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                      </svg>
                      {info.shortName}
                    </button>
                  </Tooltip>
                );
              }

              if (status?.has_completed) {
                return (
                  <button
                    key={typeKey}
                    className={`${styles.assessmentButton} ${styles.completed}`}
                    type="button"
                    disabled
                    title={`${info.name} 검사가 완료되었습니다`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    {info.shortName}
                  </button>
                );
              }

              if (status?.has_in_progress) {
                return (
                  <button
                    key={typeKey}
                    className={`${styles.assessmentButton} ${styles.inProgress}`}
                    onClick={() => router.push(`/assessment?type=${assessmentType}`)}
                    type="button"
                    title={status.message || `${info.name} 이어서 검사`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" />
                    </svg>
                    {info.shortName}
                  </button>
                );
              }

              return (
                <button
                  key={typeKey}
                  className={styles.assessmentButton}
                  onClick={() => router.push(`/assessment?type=${assessmentType}`)}
                  type="button"
                  title={info.name}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                  </svg>
                  {info.shortName}
                </button>
              );
            })
          )}
        </div>

        {/* 세션 선택 드롭다운 */}
        <div className={styles.sessionSelector} ref={sessionListRef}>
          <button
            className={styles.sessionButton}
            onClick={() => setShowSessionList(!showSessionList)}
            type="button"
          >
            {sessionId ? '이어서 대화중' : '새 대화'}
            <span className={styles.dropdownIcon}>{showSessionList ? '▲' : '▼'}</span>
          </button>

          {showSessionList && (
            <div className={styles.sessionDropdown}>
              <button
                className={`${styles.sessionItem} ${styles.newChat}`}
                onClick={startNewChat}
                type="button"
              >
                ✨ 새 대화 시작하기
              </button>

              {sessionsLoading ? (
                <div className={styles.sessionLoading}>불러오는 중...</div>
              ) : sessions.length > 0 ? (
                <>
                  <div className={styles.sessionDivider}>이전 대화</div>
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      className={`${styles.sessionItem} ${session.id === sessionId ? styles.active : ''}`}
                      onClick={() => loadSession(session.id)}
                      type="button"
                    >
                      <span className={styles.sessionPreview}>
                        {session.title || '소울이와의 대화'}
                      </span>
                      <span className={styles.sessionMeta}>
                        {formatDate(session.updated_at)} · {session.message_count}개 메시지
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <div className={styles.sessionEmpty}>이전 대화가 없어요</div>
              )}
            </div>
          )}
        </div>

        {selectedChild && <span className={styles.childName}>{selectedChild.name}</span>}
      </header>

      {chatError && (
        <div className={styles.errorBanner}>
          <span>{chatError}</span>
          <button onClick={() => dispatch(clearError())} type="button">
            ×
          </button>
        </div>
      )}

      <div className={styles.chatWindow}>
        {/* 히스토리 로딩 중 */}
        {historyLoading && (
          <div className={styles.historyLoading}>
            <LoadingSpinner />
            <p>이전 대화를 불러오는 중...</p>
          </div>
        )}

        {/* 빈 상태 - 소울이 인사 */}
        {!historyLoading && messages.length === 0 && (
          <div className={styles.emptyState}>
            <SoulECharacter state="greeting" size="large" />
            <div className={styles.greetingText}>
              <p className={styles.greetingTitle}>안녕 나는 소울이야 👋</p>
              <p className={styles.greetingDesc}>
                혼자 고민하고 있는 일이 있니?
                <br />
                언제 어디서나 소울이가 함께할게!
              </p>
            </div>
          </div>
        )}

        {/* 메시지 목록 */}
        {messages.map((msg: ChatMessage, idx: number) => {
          const isAssistant = msg.role === 'assistant';
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          const isEmpty = !msg.content && isLoading;

          return (
            <div
              key={msg.id || idx}
              className={`${styles.messageRow} ${styles[msg.role]}`}
              style={{ animationDelay: `${getAnimationDelay(idx)}s` }}
            >
              {/* 소울이 아바타 (assistant 메시지) */}
              {isAssistant && (
                <div className={styles.avatarContainer}>
                  <SoulECharacter
                    state={isEmpty ? 'thinking' : 'avatar'}
                    size="small"
                    showLabel
                  />
                </div>
              )}

              {/* 메시지 버블 */}
              <div className={`${styles.bubble} ${styles.animated}`}>
                {isEmpty ? (
                  <LoadingSpinner />
                ) : (
                  <span className={styles.messageText}>{msg.content}</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {retryMessage && !isLoading && (
        <div className={styles.retryContainer}>
          <button onClick={handleRetry} className={styles.retryButton} type="button">
            🔄 다시 시도하기
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className={styles.inputArea}>
        {/* 음성 입력 버튼 */}
        <VoiceButton
          inputMode={voiceInputMode}
          isListening={voiceIsListening}
          isRecording={voiceIsRecording}
          isTranscribing={voiceIsTranscribing}
          isLoading={voiceIsLoading}
          error={voiceError}
          disabled={isLoading}
          onClick={handleVoiceButtonClick}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voiceIsListening ? '말씀하세요...' : '소울이에게 말을 걸어보세요...'}
          disabled={isLoading || voiceIsRecording || voiceIsTranscribing}
        />
        <button type="submit" disabled={isLoading || !input.trim() || voiceIsRecording || voiceIsTranscribing}>
          {isLoading ? '...' : '전송'}
        </button>
      </form>
    </div>
  );
}

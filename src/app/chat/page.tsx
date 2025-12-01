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
import { chatApi, sessionApi } from '@/lib/api';
import { type ChatMessage } from '@/types/api';
import styles from '@/styles/modules/ChatPage.module.scss';
import { v4 as uuidv4 } from 'uuid';

// Soul-E Components
import { SoulECharacter } from '@/components/SoulECharacter';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function ChatPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { messages, sessionId, isLoading, error: chatError, sessions, sessionsLoading, historyLoading } = useAppSelector(
    (state) => state.chat
  );
  const { selectedChild, childSessionToken, childSessionExpiresAt } = useAppSelector(
    (state) => state.auth
  );
  const [input, setInput] = useState('');
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

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

  // 페이지 로드 시 세션 목록 불러오기
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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

  const handleSend = async (e?: React.FormEvent, messageToSend?: string) => {
    e?.preventDefault();

    const content = messageToSend || input.trim();
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

    try {
      await chatApi.sendMessageStream(
        content,
        sessionId || undefined,
        (accumulated: string) => {
          dispatch(updateLastMessage(accumulated));
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
              <p className={styles.greetingTitle}>안녕! 나는 소울이야 👋</p>
              <p className={styles.greetingDesc}>
                남들에게 말하지 못할 고민이 있니?
                <br />
                언제 어디서나 소울이가 도와줄게!
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
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="소울이에게 말을 걸어보세요..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? '...' : '전송'}
        </button>
      </form>
    </div>
  );
}

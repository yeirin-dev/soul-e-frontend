'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { verifyChildPin, clearPinError, clearChat } from '@/lib/store/authSlice';
import { clearChat as clearChatMessages } from '@/lib/store/chatSlice';
import { SoulECharacter } from '@/components/SoulECharacter';
import { PinInput } from '@/components/PinInput';
import styles from '@/styles/modules/PinPage.module.scss';

export default function PinVerifyPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedChild, pinLoading, pinError, pinFailedAttempts, yeirinToken, childSessionToken } = useAppSelector((state) => state.auth);

  const [pin, setPin] = useState('');
  const [success, setSuccess] = useState(false);

  // 인증 및 아동 선택 확인
  useEffect(() => {
    if (!yeirinToken) {
      router.replace('/');
      return;
    }
    if (!selectedChild) {
      router.replace('/children');
    }
  }, [yeirinToken, selectedChild, router]);

  // 에러 발생 시 PIN 초기화
  useEffect(() => {
    if (pinError) {
      setPin('');
    }
  }, [pinError]);

  // 에러 자동 클리어
  useEffect(() => {
    if (pinError) {
      const timer = setTimeout(() => {
        dispatch(clearPinError());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pinError, dispatch]);

  const handlePinComplete = async (value: string) => {
    if (!selectedChild || pinLoading) return;

    // 기존 채팅 내역 클리어
    dispatch(clearChatMessages());

    const result = await dispatch(verifyChildPin({ child: selectedChild, pin: value }));

    if (verifyChildPin.fulfilled.match(result) && result.payload.response.verified) {
      setSuccess(true);
      // 성공 애니메이션 후 채팅 페이지로 이동
      setTimeout(() => {
        router.push('/chat');
      }, 1500);
    }
  };

  const handleBack = () => {
    dispatch(clearPinError());
    router.push('/children');
  };

  const handleForgotPin = () => {
    // 교사에게 도움 요청 안내
    alert('선생님께 비밀번호 재설정을 요청해주세요!');
  };

  if (!selectedChild) {
    return null;
  }

  // 실패 횟수에 따른 메시지
  const getErrorMessage = () => {
    if (pinFailedAttempts >= 5) {
      return '많이 틀렸어요! 선생님께 도움을 요청해볼까요?';
    }
    if (pinFailedAttempts >= 3) {
      return `비밀번호가 맞지 않아요 (${pinFailedAttempts}번째)`;
    }
    return pinError || '비밀번호가 맞지 않아요';
  };

  // 캐릭터 상태
  const getCharacterState = () => {
    if (success) return 'greeting';
    if (pinLoading) return 'thinking';
    if (pinError || pinFailedAttempts > 0) return 'idle';
    return 'idle';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={handleBack} className={styles.backButton} type="button">
          ← 뒤로
        </button>
        <h1>비밀번호 입력</h1>
      </header>

      <main className={styles.mainContent}>
        {/* 소울이 캐릭터 */}
        <div className={styles.characterSection}>
          <SoulECharacter
            state={getCharacterState()}
            size="large"
            className={`${styles.soulE} ${pinError ? styles.shake : ''}`}
          />
        </div>

        {/* 메시지 영역 */}
        <div className={styles.messageSection}>
          {success ? (
            <div className={styles.successMessage}>
              <span className={styles.emoji}>🎉</span>
              <h2>안녕, {selectedChild.name}!</h2>
              <p>소울이와 이야기하러 가요!</p>
            </div>
          ) : (
            <>
              <h2 className={styles.childName}>
                {selectedChild.name}
                <span className={styles.emoji}>
                  {selectedChild.gender === 'MALE' || selectedChild.gender === 'M' ? '👦' : '👧'}
                </span>
              </h2>
              <p className={styles.instruction}>
                <span className={styles.highlight}>비밀번호</span>를 눌러주세요!
              </p>
            </>
          )}
        </div>

        {/* PIN 입력 영역 */}
        {!success && (
          <div className={styles.pinSection}>
            <PinInput
              value={pin}
              onChange={setPin}
              onComplete={handlePinComplete}
              disabled={pinLoading}
              error={!!pinError}
              autoFocus
            />

            {/* 에러 메시지 */}
            {pinError && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>
                  {pinFailedAttempts >= 5 ? '😭' : '😢'}
                </span>
                {getErrorMessage()}
              </div>
            )}

            {/* 비밀번호 찾기 */}
            {pinFailedAttempts >= 3 && (
              <button
                onClick={handleForgotPin}
                className={styles.forgotButton}
                type="button"
              >
                비밀번호를 모르겠어요 🤔
              </button>
            )}
          </div>
        )}

        {/* 로딩 표시 */}
        {pinLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>확인하고 있어요...</p>
          </div>
        )}
      </main>
    </div>
  );
}

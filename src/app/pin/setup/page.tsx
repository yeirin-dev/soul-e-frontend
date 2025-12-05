'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { setChildPin, clearPinError, verifyChildPin } from '@/lib/store/authSlice';
import { SoulECharacter } from '@/components/SoulECharacter';
import { PinInput } from '@/components/PinInput';
import styles from '@/styles/modules/PinPage.module.scss';

export default function PinSetupPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedChild, pinLoading, pinError, yeirinToken } = useAppSelector((state) => state.auth);

  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
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

  // 에러 자동 클리어
  useEffect(() => {
    if (pinError || localError) {
      const timer = setTimeout(() => {
        dispatch(clearPinError());
        setLocalError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pinError, localError, dispatch]);

  const handlePinComplete = (value: string) => {
    if (step === 'input') {
      // 첫 번째 입력 완료 - 확인 단계로
      setTimeout(() => {
        setStep('confirm');
        setConfirmPin('');
      }, 300);
    } else {
      // 확인 입력 완료 - PIN 일치 확인
      if (value === pin) {
        handleSetPin(value);
      } else {
        setLocalError('PIN이 일치하지 않아요. 다시 시도해주세요!');
        setConfirmPin('');
        setStep('input');
        setPin('');
      }
    }
  };

  const handleSetPin = async (pinValue: string) => {
    if (!selectedChild) return;

    const result = await dispatch(setChildPin({ childId: selectedChild.id, pin: pinValue }));

    if (setChildPin.fulfilled.match(result)) {
      setSuccess(true);

      // PIN 설정 성공 후 바로 인증하여 세션 토큰 획득
      const verifyResult = await dispatch(verifyChildPin({ child: selectedChild, pin: pinValue }));

      // 성공 애니메이션 후 채팅 페이지로 이동
      setTimeout(() => {
        if (verifyChildPin.fulfilled.match(verifyResult) && verifyResult.payload.response.verified) {
          router.push('/chat');
        } else {
          // 인증 실패 시 인증 페이지로 (예외 상황)
          router.push('/pin/verify');
        }
      }, 1500);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('input');
      setPin('');
      setConfirmPin('');
      setLocalError(null);
    } else {
      router.push('/children');
    }
  };

  if (!selectedChild) {
    return null;
  }

  const currentError = localError || pinError;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={handleBack} className={styles.backButton} type="button">
          ← 뒤로
        </button>
        <h1>비밀번호 만들기</h1>
      </header>

      <main className={styles.mainContent}>
        {/* 소울이 캐릭터 */}
        <div className={styles.characterSection}>
          <SoulECharacter
            state={success ? 'greeting' : pinLoading ? 'thinking' : 'idle'}
            size="large"
            className={styles.soulE}
          />
        </div>

        {/* 메시지 영역 */}
        <div className={styles.messageSection}>
          {success ? (
            <div className={styles.successMessage}>
              <span className={styles.emoji}>🎉</span>
              <h2>비밀번호가 만들어졌어요!</h2>
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
                {step === 'input' ? (
                  <>
                    <span className={styles.highlight}>나만의 비밀번호</span>를 만들어볼까요?
                    <br />
                    숫자 4개를 눌러주세요!
                  </>
                ) : (
                  <>
                    좋아요! 이제 한 번 더
                    <br />
                    <span className={styles.highlight}>똑같이</span> 눌러주세요!
                  </>
                )}
              </p>
            </>
          )}
        </div>

        {/* PIN 입력 영역 */}
        {!success && (
          <div className={styles.pinSection}>
            <PinInput
              value={step === 'input' ? pin : confirmPin}
              onChange={step === 'input' ? setPin : setConfirmPin}
              onComplete={handlePinComplete}
              disabled={pinLoading}
              error={!!currentError}
              autoFocus
            />

            {/* 에러 메시지 */}
            {currentError && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>😢</span>
                {currentError}
              </div>
            )}

            {/* 단계 표시 */}
            <div className={styles.steps}>
              <div className={`${styles.step} ${step === 'input' ? styles.active : styles.done}`}>
                <span>1</span>
                비밀번호 입력
              </div>
              <div className={styles.stepLine} />
              <div className={`${styles.step} ${step === 'confirm' ? styles.active : ''}`}>
                <span>2</span>
                다시 입력
              </div>
            </div>
          </div>
        )}

        {/* 로딩 표시 */}
        {pinLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>비밀번호를 저장하고 있어요...</p>
          </div>
        )}
      </main>
    </div>
  );
}

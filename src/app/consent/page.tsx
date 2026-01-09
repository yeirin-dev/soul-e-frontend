'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { acceptConsent, clearConsentError, resetConsentState } from '@/lib/store/consentSlice';
import { SoulECharacter } from '@/components/SoulECharacter';
import { type ConsentItems } from '@/types/api';
import styles from '@/styles/modules/ConsentPage.module.scss';

export default function ConsentPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedChild, yeirinToken } = useAppSelector((state) => state.auth);
  const { acceptLoading, acceptError, acceptSuccess } = useAppSelector((state) => state.consent);

  // 동의 항목 상태
  const [consentItems, setConsentItems] = useState<ConsentItems>({
    personal_info: false,
    sensitive_data: false,
    research_data: false,
    child_self_consent: false,
  });

  // 14세 이상 여부 계산
  const isChildOver14 = useMemo(() => {
    if (!selectedChild) return false;
    return selectedChild.age >= 14;
  }, [selectedChild]);

  // 인증 및 아동 선택 확인
  useEffect(() => {
    if (!yeirinToken) {
      router.replace('/');
      return;
    }
    if (!selectedChild) {
      router.replace('/children');
      return;
    }
  }, [yeirinToken, selectedChild, router]);

  // 성공 시 PIN 페이지로 이동
  useEffect(() => {
    if (acceptSuccess) {
      const timer = setTimeout(() => {
        dispatch(resetConsentState());
        if (selectedChild?.has_pin) {
          router.push('/pin/verify');
        } else {
          router.push('/pin/setup');
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [acceptSuccess, dispatch, router, selectedChild]);

  // 에러 자동 클리어
  useEffect(() => {
    if (acceptError) {
      const timer = setTimeout(() => {
        dispatch(clearConsentError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [acceptError, dispatch]);

  // 전체 동의 체크 여부
  const isAllRequired = useMemo(() => {
    const required = consentItems.personal_info && consentItems.sensitive_data;
    if (isChildOver14) {
      return required && consentItems.child_self_consent;
    }
    return required;
  }, [consentItems, isChildOver14]);

  const isAllChecked = useMemo(() => {
    const all = consentItems.personal_info && consentItems.sensitive_data && consentItems.research_data;
    if (isChildOver14) {
      return all && consentItems.child_self_consent;
    }
    return all;
  }, [consentItems, isChildOver14]);

  // 전체 동의 토글
  const handleAllConsent = () => {
    const newValue = !isAllChecked;
    setConsentItems({
      personal_info: newValue,
      sensitive_data: newValue,
      research_data: newValue,
      child_self_consent: newValue,
    });
  };

  // 개별 동의 토글
  const handleConsentChange = (key: keyof ConsentItems) => {
    setConsentItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 동의 제출
  const handleSubmit = async () => {
    if (!selectedChild || !isAllRequired || acceptLoading) return;

    await dispatch(acceptConsent({
      childId: selectedChild.id,
      consentItems,
      isChildOver14,
    }));
  };

  // 뒤로가기
  const handleBack = () => {
    dispatch(resetConsentState());
    router.push('/children');
  };

  // 캐릭터 상태
  const getCharacterState = () => {
    if (acceptSuccess) return 'greeting';
    if (acceptLoading) return 'thinking';
    return 'idle';
  };

  if (!selectedChild) {
    return null;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={handleBack} className={styles.backButton} type="button">
          ← 뒤로
        </button>
        <h1>개인정보 동의</h1>
      </header>

      <main className={styles.mainContent}>
        {/* 소울이 캐릭터 */}
        <div className={styles.characterSection}>
          <SoulECharacter
            state={getCharacterState()}
            size="large"
            className={styles.soulE}
          />
        </div>

        {/* 메시지 영역 */}
        <div className={styles.messageSection}>
          {acceptSuccess ? (
            <div className={styles.successMessage}>
              <span className={styles.emoji}>🎉</span>
              <h2>동의 완료!</h2>
              <p>이제 소울이와 대화할 준비가 됐어요!</p>
            </div>
          ) : (
            <>
              <h2 className={styles.greeting}>
                {selectedChild.name} 친구!
                <span className={styles.emoji}>
                  {selectedChild.gender === 'MALE' || selectedChild.gender === 'M' ? '👦' : '👧'}
                </span>
              </h2>
              <p className={styles.instruction}>
                소울이와 대화하려면 아래 내용에 <span className={styles.highlight}>동의</span>해주세요!
              </p>
            </>
          )}
        </div>

        {/* 동의 섹션 */}
        {!acceptSuccess && (
          <div className={styles.consentSection}>
            {/* PDF 링크 */}
            <a
              href="/documents/privacy-policy-v1.0.0.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.pdfLink}
            >
              <span className={styles.pdfIcon}>📄</span>
              개인정보 처리방침 전문 보기
            </a>

            {/* 전체 동의 */}
            <div className={styles.allConsentBox}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={handleAllConsent}
                  className={styles.checkbox}
                />
                <span className={styles.checkmark} />
                <span className={styles.labelText}>전체 동의하기</span>
              </label>
            </div>

            {/* 개별 동의 항목 */}
            <div className={styles.consentList}>
              {/* 개인정보 수집 동의 (필수) */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={consentItems.personal_info}
                  onChange={() => handleConsentChange('personal_info')}
                  className={styles.checkbox}
                />
                <span className={styles.checkmark} />
                <span className={styles.labelText}>
                  <span className={styles.required}>[필수]</span> 개인정보 수집·이용 및 제3자 제공 동의
                </span>
              </label>

              {/* 민감정보 처리 동의 (필수) */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={consentItems.sensitive_data}
                  onChange={() => handleConsentChange('sensitive_data')}
                  className={styles.checkbox}
                />
                <span className={styles.checkmark} />
                <span className={styles.labelText}>
                  <span className={styles.required}>[필수]</span> 민감정보 처리 동의
                </span>
              </label>

              {/* 연구 활용 동의 (선택) */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={consentItems.research_data}
                  onChange={() => handleConsentChange('research_data')}
                  className={styles.checkbox}
                />
                <span className={styles.checkmark} />
                <span className={styles.labelText}>
                  <span className={styles.optional}>[선택]</span> 비식별화 데이터 연구 활용 동의
                </span>
              </label>

              {/* 14세 이상 아동 본인 동의 */}
              {isChildOver14 && (
                <label className={`${styles.checkboxLabel} ${styles.childSelfConsent}`}>
                  <input
                    type="checkbox"
                    checked={consentItems.child_self_consent}
                    onChange={() => handleConsentChange('child_self_consent')}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark} />
                  <span className={styles.labelText}>
                    <span className={styles.required}>[필수]</span> 아동 본인 동의 (만 14세 이상)
                  </span>
                </label>
              )}
            </div>

            {/* 에러 메시지 */}
            {acceptError && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {acceptError}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              className={styles.submitButton}
              disabled={!isAllRequired || acceptLoading}
              type="button"
            >
              {acceptLoading ? (
                <div className={styles.buttonLoader} />
              ) : (
                '동의하고 계속하기'
              )}
            </button>
          </div>
        )}

        {/* 로딩 오버레이 */}
        {acceptLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>동의를 처리하고 있어요...</p>
          </div>
        )}
      </main>
    </div>
  );
}

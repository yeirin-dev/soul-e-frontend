'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { SoulECharacter } from '@/components/SoulECharacter';
import { guardianConsentApi } from '@/lib/api';
import {
  type GuardianConsentItems,
  type VerifyGuardianTokenResponse,
} from '@/types/api';
import styles from '@/styles/modules/GuardianConsentPage.module.scss';

type PageState = 'loading' | 'valid' | 'expired' | 'invalid' | 'already_consented' | 'success' | 'error';

const GUARDIAN_RELATIONS = ['부모', '시설담당자', '기타'] as const;

export default function GuardianConsentPage() {
  const params = useParams();
  const token = params.token as string;

  // 페이지 상태
  const [pageState, setPageState] = useState<PageState>('loading');
  const [tokenInfo, setTokenInfo] = useState<VerifyGuardianTokenResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 동의 항목 상태
  const [consentItems, setConsentItems] = useState<GuardianConsentItems>({
    personal_info: false,
    sensitive_data: false,
    research_data: false,
  });

  // 보호자 관계
  const [guardianRelation, setGuardianRelation] = useState<string>('');

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 토큰 검증
  const verifyToken = useCallback(async () => {
    if (!token) {
      setPageState('invalid');
      setErrorMessage('유효하지 않은 링크입니다.');
      return;
    }

    try {
      const response = await guardianConsentApi.verify(token);
      setTokenInfo(response);

      if (response.already_consented) {
        setPageState('already_consented');
      } else if (response.valid) {
        setPageState('valid');
      } else if (response.expired) {
        setPageState('expired');
      } else {
        setPageState('invalid');
        setErrorMessage(response.error_message || '유효하지 않은 링크입니다.');
      }
    } catch (err) {
      setPageState('error');
      setErrorMessage(err instanceof Error ? err.message : '토큰 검증에 실패했습니다.');
    }
  }, [token]);

  // 페이지 로드 시 토큰 검증
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // 전체 필수 동의 체크 여부
  const isAllRequired = useMemo(() => {
    return consentItems.personal_info && consentItems.sensitive_data && guardianRelation !== '';
  }, [consentItems, guardianRelation]);

  // 전체 동의 체크 여부
  const isAllChecked = useMemo(() => {
    return consentItems.personal_info && consentItems.sensitive_data && consentItems.research_data;
  }, [consentItems]);

  // 전체 동의 토글
  const handleAllConsent = () => {
    const newValue = !isAllChecked;
    setConsentItems({
      personal_info: newValue,
      sensitive_data: newValue,
      research_data: newValue,
    });
  };

  // 개별 동의 토글
  const handleConsentChange = (key: keyof GuardianConsentItems) => {
    setConsentItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 동의 제출
  const handleSubmit = async () => {
    if (!isAllRequired || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await guardianConsentApi.accept({
        token,
        consent_items: consentItems,
        guardian_relation: guardianRelation,
      });
      setPageState('success');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('만료')) {
          setPageState('expired');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('동의 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 캐릭터 상태
  const getCharacterState = () => {
    if (pageState === 'success' || pageState === 'already_consented') return 'greeting';
    if (pageState === 'loading' || isSubmitting) return 'thinking';
    if (pageState === 'expired' || pageState === 'invalid' || pageState === 'error') return 'idle';
    return 'idle';
  };

  // 로딩 화면
  if (pageState === 'loading') {
    return (
      <div className={styles.container}>
        <main className={styles.mainContent}>
          <div className={styles.characterSection}>
            <SoulECharacter state="thinking" size="large" className={styles.soulE} />
          </div>
          <div className={styles.messageSection}>
            <p className={styles.loadingText}>링크를 확인하고 있어요...</p>
          </div>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner} />
          </div>
        </main>
      </div>
    );
  }

  // 만료 화면
  if (pageState === 'expired') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>보호자 동의서</h1>
        </header>
        <main className={styles.mainContent}>
          <div className={styles.characterSection}>
            <SoulECharacter state="idle" size="large" className={styles.soulE} />
          </div>
          <div className={styles.messageSection}>
            <div className={styles.errorState}>
              <span className={styles.emoji}>⏰</span>
              <h2>앗, 링크가 만료됐어요!</h2>
              <p>
                {tokenInfo?.child_name ? `${tokenInfo.child_name} 친구가 다니는 ` : ''}
                기관에 새 링크를 요청해주세요!
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 이미 동의 완료 화면
  if (pageState === 'already_consented') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>보호자 동의서</h1>
        </header>
        <main className={styles.mainContent}>
          <div className={styles.characterSection}>
            <SoulECharacter state="greeting" size="large" className={styles.soulE} />
          </div>
          <div className={styles.messageSection}>
            <div className={styles.successMessage}>
              <span className={styles.emoji}>✅</span>
              <h2>이미 동의를 완료하셨어요!</h2>
              <p>
                {tokenInfo?.child_name && `${tokenInfo.child_name} 친구의 `}
                보호자 동의가 이미 처리되었습니다.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 에러/유효하지 않음 화면
  if (pageState === 'invalid' || pageState === 'error') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>보호자 동의서</h1>
        </header>
        <main className={styles.mainContent}>
          <div className={styles.characterSection}>
            <SoulECharacter state="idle" size="large" className={styles.soulE} />
          </div>
          <div className={styles.messageSection}>
            <div className={styles.errorState}>
              <span className={styles.emoji}>😢</span>
              <h2>문제가 발생했어요</h2>
              <p>{errorMessage || '유효하지 않은 링크입니다.'}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 성공 화면
  if (pageState === 'success') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>보호자 동의서</h1>
        </header>
        <main className={styles.mainContent}>
          <div className={styles.characterSection}>
            <SoulECharacter state="greeting" size="large" className={styles.soulE} />
          </div>
          <div className={styles.messageSection}>
            <div className={styles.successMessage}>
              <span className={styles.emoji}>🎉</span>
              <h2>감사합니다!</h2>
              <p>동의가 완료되었습니다.</p>
              <p className={styles.successSubtext}>
                부모님의 동의는 우리 아이들에게<br />
                소중한 경험의 일부가 됩니다.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 동의 폼 화면 (valid 상태)
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>보호자 동의서</h1>
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
          <h2 className={styles.greeting}>
            {tokenInfo?.child_name} 친구의 보호자님,
            <span className={styles.emoji}>👋</span>
          </h2>
          <p className={styles.instruction}>안녕하세요!</p>
          {tokenInfo?.institution_name && (
            <p className={styles.institutionInfo}>
              <span className={styles.institutionIcon}>🏫</span>
              {tokenInfo.institution_name}
            </p>
          )}
        </div>

        {/* 동의 섹션 */}
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
          </div>

          {/* 보호자 관계 선택 */}
          <div className={styles.relationSection}>
            <p className={styles.relationLabel}>
              <span className={styles.required}>[필수]</span> 아동과의 관계
            </p>
            <div className={styles.relationOptions}>
              {GUARDIAN_RELATIONS.map((relation) => (
                <label key={relation} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="guardianRelation"
                    value={relation}
                    checked={guardianRelation === relation}
                    onChange={(e) => setGuardianRelation(e.target.value)}
                    className={styles.radio}
                  />
                  <span className={styles.radioMark} />
                  <span className={styles.radioText}>{relation}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {errorMessage}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            className={styles.submitButton}
            disabled={!isAllRequired || isSubmitting}
            type="button"
          >
            {isSubmitting ? (
              <div className={styles.buttonLoader} />
            ) : (
              '동의하기'
            )}
          </button>
        </div>

        {/* 로딩 오버레이 */}
        {isSubmitting && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>동의를 처리하고 있어요...</p>
          </div>
        )}
      </main>
    </div>
  );
}

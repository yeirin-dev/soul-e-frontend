'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { InputField } from '@/components/InputField';
import { Select } from '@/components/Select';
import { teacherAssessmentApi } from '@/lib/api/teacher-assessment';
import type {
  TeacherInfo,
  TeacherChildInfo,
  AssessmentSession,
  SectionInfo,
  QuestionInfo,
  AssessmentResult,
  AssessmentPhase,
  KPRC_TG_CHOICES,
} from '@/types/teacher-assessment';
import styles from '@/styles/modules/TeacherAssessmentPage.module.scss';

// 선택지 상수
const CHOICES = [
  { value: 1, label: '전혀 아니다' },
  { value: 2, label: '때때로 그렇다' },
  { value: 3, label: '자주 그렇다' },
  { value: 4, label: '거의 항상 그렇다' },
] as const;

export default function TeacherAssessmentPage() {
  // ==========================================================================
  // 상태 관리
  // ==========================================================================

  // 인증 상태
  const [phase, setPhase] = useState<AssessmentPhase>('auth');
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [token, setToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 아동 목록
  const [children, setChildren] = useState<TeacherChildInfo[]>([]);
  const [selectedChild, setSelectedChild] = useState<TeacherChildInfo | null>(null);
  const [childrenLoading, setChildrenLoading] = useState(false);

  // 검사 세션
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [questions, setQuestions] = useState<QuestionInfo[]>([]);
  const [currentSection, setCurrentSection] = useState(1);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // 결과
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedAnswersRef = useRef<string>('');

  // ==========================================================================
  // URL 파라미터에서 토큰 확인
  // ==========================================================================

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      handleAuth(tokenFromUrl);
    }
  }, []);

  // ==========================================================================
  // 인증 처리
  // ==========================================================================

  const handleAuth = async (authToken?: string) => {
    const tokenToUse = authToken || token;
    if (!tokenToUse.trim()) {
      setAuthError('토큰을 입력해주세요.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      // 토큰을 로컬스토리지에 저장 (API 클라이언트에서 사용)
      localStorage.setItem('yeirin_token', tokenToUse);

      // 교사 정보 조회
      const info = await teacherAssessmentApi.getTeacherInfo();
      setTeacherInfo(info);

      // 아동 목록 조회
      const childrenResponse = await teacherAssessmentApi.getChildren();
      setChildren(childrenResponse.children);

      setPhase('children');
    } catch (err: any) {
      console.error('인증 실패:', err);
      localStorage.removeItem('yeirin_token');
      setAuthError(err.response?.data?.detail || '인증에 실패했습니다. 토큰을 확인해주세요.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ==========================================================================
  // 아동 선택 및 검사 시작
  // ==========================================================================

  const handleChildSelect = (child: TeacherChildInfo) => {
    if (!child.is_eligible_for_kprc_tg) return;
    setSelectedChild(child);
  };

  const handleStartAssessment = async () => {
    if (!selectedChild || !teacherInfo) return;

    setChildrenLoading(true);
    setError(null);

    try {
      // 섹션 및 문항 정보 로드
      const [sectionsData, questionsData] = await Promise.all([
        teacherAssessmentApi.getSections(),
        teacherAssessmentApi.getAllQuestions(),
      ]);
      setSections(sectionsData);
      setQuestions(questionsData);

      // 검사 세션 시작
      const sessionData = await teacherAssessmentApi.startAssessment({
        teacher_id: teacherInfo.institution_id,
        child_id: selectedChild.id,
        child_name: selectedChild.name,
        gender: selectedChild.gender as 'M' | 'F',
        birth_date: selectedChild.birth_date,
        school_grade: selectedChild.grade || 1,
      });

      setSession(sessionData);

      // 기존 답변이 있으면 복원
      if (sessionData.answered_count > 0) {
        try {
          const savedAnswers = await teacherAssessmentApi.getSessionAnswers(sessionData.session_id);
          setAnswers(savedAnswers.answers);
        } catch {
          // 답변 복원 실패해도 진행
        }
      }

      setPhase('intro');
    } catch (err: any) {
      console.error('검사 시작 실패:', err);
      setError(err.response?.data?.detail || '검사를 시작하는데 실패했습니다.');
    } finally {
      setChildrenLoading(false);
    }
  };

  const handleBeginTest = () => {
    setPhase('testing');
  };

  // ==========================================================================
  // 답변 처리 및 자동 저장
  // ==========================================================================

  const handleAnswer = (questionNumber: number, value: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: value,
    }));
  };

  // 자동 저장
  useEffect(() => {
    if (phase !== 'testing' || !session) return;

    const currentAnswersStr = JSON.stringify(answers);
    if (currentAnswersStr === lastSavedAnswersRef.current) return;

    // 기존 타이머 취소
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 3초 후 자동 저장
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const currentSectionInfo = sections.find((s) => s.section_number === currentSection);
        if (!currentSectionInfo) return;

        // 현재 섹션의 답변만 필터링
        const sectionAnswers: Record<number, number> = {};
        for (let i = currentSectionInfo.start_question; i <= currentSectionInfo.end_question; i++) {
          if (answers[i] !== undefined) {
            sectionAnswers[i] = answers[i];
          }
        }

        if (Object.keys(sectionAnswers).length > 0) {
          await teacherAssessmentApi.saveSectionAnswers(session.session_id, currentSection, {
            section_number: currentSection,
            answers: sectionAnswers,
          });
          lastSavedAnswersRef.current = currentAnswersStr;
        }
      } catch (err) {
        console.error('자동 저장 실패:', err);
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [answers, phase, session, currentSection, sections]);

  // ==========================================================================
  // 섹션 네비게이션
  // ==========================================================================

  const handlePrevSection = () => {
    if (currentSection > 1) {
      setCurrentSection((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextSection = () => {
    const maxSection = sections.length;
    if (currentSection < maxSection) {
      setCurrentSection((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ==========================================================================
  // 검사 제출
  // ==========================================================================

  const handleSubmit = async () => {
    if (!session) return;

    // 모든 문항 응답 확인
    const totalQuestions = questions.length;
    const answeredCount = Object.keys(answers).length;

    if (answeredCount < totalQuestions) {
      const confirmed = window.confirm(
        `아직 응답하지 않은 문항이 ${totalQuestions - answeredCount}개 있습니다.\n그래도 제출하시겠습니까?`
      );
      if (!confirmed) return;
    }

    setPhase('submitting');

    try {
      const resultData = await teacherAssessmentApi.submitAssessment(session.session_id, {
        answers,
      });
      setResult(resultData);
      setPhase('result');
    } catch (err: any) {
      console.error('제출 실패:', err);
      setError(err.response?.data?.detail || '검사 제출에 실패했습니다.');
      setPhase('error');
    }
  };

  // ==========================================================================
  // 새 검사 시작
  // ==========================================================================

  const handleNewAssessment = () => {
    setSelectedChild(null);
    setSession(null);
    setAnswers({});
    setResult(null);
    setCurrentSection(1);
    setError(null);
    setPhase('children');
  };

  // ==========================================================================
  // 현재 섹션의 문항 필터링
  // ==========================================================================

  const getCurrentSectionQuestions = useCallback(() => {
    const sectionInfo = sections.find((s) => s.section_number === currentSection);
    if (!sectionInfo) return [];
    return questions.filter(
      (q) => q.number >= sectionInfo.start_question && q.number <= sectionInfo.end_question
    );
  }, [sections, questions, currentSection]);

  // ==========================================================================
  // 진행률 계산
  // ==========================================================================

  const getProgress = useCallback(() => {
    const total = questions.length;
    const answered = Object.keys(answers).length;
    return {
      total,
      answered,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [questions, answers]);

  // ==========================================================================
  // 렌더링
  // ==========================================================================

  const renderHeader = () => (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Image src="/yeirin-logo.png" alt="예이린" width={32} height={32} />
        <span>교사 평정용 검사 시스템</span>
      </div>
      {teacherInfo && (
        <div className={styles.institutionInfo}>
          <span>{teacherInfo.institution_name}</span>
        </div>
      )}
    </header>
  );

  const renderAuthSection = () => (
    <section className={styles.authSection}>
      <div className={styles.authCard}>
        <h1>교사 평정용 검사</h1>
        <p className={styles.subtitle}>
          예이린 시스템에서 발급받은 토큰으로 로그인해주세요.
        </p>
        <form
          className={styles.formGroup}
          onSubmit={(e) => {
            e.preventDefault();
            handleAuth();
          }}
        >
          <InputField
            id="token"
            type="password"
            placeholder="토큰을 입력해주세요"
            labelContent="인증 토큰"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </form>
        {authError && <p className={styles.errorMessage}>{authError}</p>}
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => handleAuth()}
          disabled={authLoading || !token.trim()}
        >
          {authLoading ? '인증 중...' : '로그인'}
        </button>
      </div>
    </section>
  );

  const renderChildrenSection = () => {
    const eligibleChildren = children.filter((c) => c.is_eligible_for_kprc_tg);

    return (
      <section className={styles.childrenSection}>
        <h2 className={styles.sectionTitle}>아동 선택</h2>
        <p className={styles.sectionSubtitle}>
          검사를 진행할 아동을 선택해주세요. (1-3학년 대상)
        </p>

        {children.length === 0 ? (
          <div className={styles.emptyState}>
            <p>등록된 아동이 없습니다.</p>
            <p>예이린 시스템에서 아동을 먼저 등록해주세요.</p>
          </div>
        ) : (
          <>
            <div className={styles.childrenList}>
              {children.map((child) => (
                <div
                  key={child.id}
                  className={`${styles.childCard} ${
                    selectedChild?.id === child.id ? styles.selected : ''
                  } ${!child.is_eligible_for_kprc_tg ? styles.disabled : ''}`}
                  onClick={() => handleChildSelect(child)}
                >
                  <div className={styles.childInfo}>
                    <span className={styles.childName}>{child.name}</span>
                    <span className={styles.childDetails}>
                      {child.age}세 · {child.gender === 'M' ? '남' : '여'} ·{' '}
                      {child.grade ? `${child.grade}학년` : '학년 미지정'}
                    </span>
                  </div>
                  <span
                    className={`${styles.childStatus} ${
                      child.is_eligible_for_kprc_tg ? styles.eligible : ''
                    }`}
                  >
                    {child.is_eligible_for_kprc_tg ? '검사 가능' : '대상 외'}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.actionButton}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleStartAssessment}
                disabled={!selectedChild || childrenLoading}
              >
                {childrenLoading ? '준비 중...' : '검사 시작'}
              </button>
            </div>
          </>
        )}
      </section>
    );
  };

  const renderIntroSection = () => (
    <section className={styles.introSection}>
      <div className={styles.introCard}>
        <h2>KPRC 초등 저학년 교사평정용 검사</h2>

        {selectedChild && (
          <div className={styles.childSummary}>
            <div className={styles.avatar}>{selectedChild.name.charAt(0)}</div>
            <div className={styles.info}>
              <h3>{selectedChild.name}</h3>
              <p>
                {selectedChild.age}세 · {selectedChild.gender === 'M' ? '남' : '여'} ·{' '}
                {selectedChild.grade}학년
              </p>
            </div>
          </div>
        )}

        <div className={styles.instructions}>
          <h3>검사 안내</h3>
          <ul>
            <li>총 {questions.length}개의 문항으로 구성되어 있습니다.</li>
            <li>{sections.length}개의 섹션으로 나누어져 있습니다.</li>
            <li>각 문항에 대해 아동의 평소 행동을 기준으로 응답해주세요.</li>
            <li>검사는 중간에 저장되므로 나중에 이어서 진행할 수 있습니다.</li>
            <li>소요 시간은 약 15-20분입니다.</li>
          </ul>
        </div>

        <div className={styles.choiceGuide}>
          <h4>응답 선택지</h4>
          <div className={styles.choices}>
            {CHOICES.map((choice) => (
              <div key={choice.value} className={styles.choice}>
                <span className={styles.number}>{choice.value}</span>
                <span>{choice.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className={`${styles.primaryButton} ${styles.startButton}`} onClick={handleBeginTest}>
        검사 시작하기
      </button>
    </section>
  );

  const renderTestingSection = () => {
    const progress = getProgress();
    const currentQuestions = getCurrentSectionQuestions();
    const currentSectionInfo = sections.find((s) => s.section_number === currentSection);
    const isLastSection = currentSection === sections.length;

    // 현재 섹션의 모든 문항이 응답되었는지 확인
    const isSectionComplete =
      currentSectionInfo &&
      currentQuestions.every((q) => answers[q.number] !== undefined);

    return (
      <section className={styles.testingSection}>
        <div className={styles.progressBar}>
          <div className={styles.progressInfo}>
            <span>
              전체 진행률: <strong>{progress.percentage}%</strong>
            </span>
            <span>
              {progress.answered}/{progress.total} 문항
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <h3>
            섹션 {currentSection} / {sections.length}
            {currentSectionInfo &&
              ` (문항 ${currentSectionInfo.start_question}-${currentSectionInfo.end_question})`}
          </h3>
          <div className={styles.sectionNav}>
            <button onClick={handlePrevSection} disabled={currentSection === 1}>
              이전 섹션
            </button>
            <button onClick={handleNextSection} disabled={isLastSection}>
              다음 섹션
            </button>
          </div>
        </div>

        <div className={styles.questionsContainer}>
          {currentQuestions.map((question) => (
            <div
              key={question.number}
              className={`${styles.questionCard} ${
                answers[question.number] !== undefined ? styles.answered : ''
              }`}
            >
              <div className={styles.questionNumber}>문항 {question.number}</div>
              <div className={styles.questionText}>{question.text}</div>
              <div className={styles.choiceButtons}>
                {CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`${styles.choiceButton} ${
                      answers[question.number] === choice.value ? styles.selected : ''
                    }`}
                    onClick={() => handleAnswer(question.number, choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.navigationButtons}>
          <button
            type="button"
            className={styles.navButton}
            onClick={handlePrevSection}
            disabled={currentSection === 1}
          >
            이전 섹션
          </button>

          {isLastSection ? (
            <button
              type="button"
              className={`${styles.navButton} ${styles.primary}`}
              onClick={handleSubmit}
            >
              검사 제출하기
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.navButton} ${styles.primary}`}
              onClick={handleNextSection}
            >
              다음 섹션
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderSubmittingSection = () => (
    <section className={styles.submittingSection}>
      <div className={styles.spinner} />
      <h2>검사를 제출하고 있습니다</h2>
      <p>잠시만 기다려주세요...</p>
    </section>
  );

  const renderResultSection = () => (
    <section className={styles.resultSection}>
      <div className={styles.resultCard}>
        {result?.is_success ? (
          <>
            <div className={styles.successIcon} />
            <h2>검사가 완료되었습니다</h2>
            <p className={styles.childName}>{selectedChild?.name} 학생</p>
            <div className={styles.resultInfo}>
              <p>검사 결과가 성공적으로 제출되었습니다.</p>
              {result.report_url && (
                <p>
                  <a href={result.report_url} target="_blank" rel="noopener noreferrer">
                    상세 리포트 보기
                  </a>
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={styles.errorIcon} />
            <h2>검사 처리 중 오류가 발생했습니다</h2>
            <p className={styles.errorMessage}>
              {result?.error_message || '알 수 없는 오류가 발생했습니다.'}
            </p>
          </>
        )}

        <div className={styles.actionButtons}>
          <button type="button" className={styles.primaryButton} onClick={handleNewAssessment}>
            다른 아동 검사하기
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              localStorage.removeItem('yeirin_token');
              window.location.reload();
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </section>
  );

  const renderErrorSection = () => (
    <section className={styles.errorSection}>
      <div className={styles.errorCard}>
        <div className={styles.errorIcon} />
        <h2>오류가 발생했습니다</h2>
        <p>{error || '알 수 없는 오류가 발생했습니다.'}</p>
        <button type="button" className={styles.primaryButton} onClick={handleNewAssessment}>
          다시 시도하기
        </button>
      </div>
    </section>
  );

  const renderLoadingSection = () => (
    <section className={styles.loadingSection}>
      <div className={styles.spinner} />
      <p>로딩 중...</p>
    </section>
  );

  return (
    <div className={styles.container}>
      {renderHeader()}
      <main className={styles.main}>
        {phase === 'auth' && renderAuthSection()}
        {phase === 'children' && renderChildrenSection()}
        {phase === 'intro' && renderIntroSection()}
        {phase === 'testing' && renderTestingSection()}
        {phase === 'submitting' && renderSubmittingSection()}
        {phase === 'result' && renderResultSection()}
        {phase === 'error' && renderErrorSection()}
      </main>
    </div>
  );
}

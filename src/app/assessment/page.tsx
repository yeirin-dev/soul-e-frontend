'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks/redux';
import classNames from 'classnames/bind';

import { assessmentApi } from '@/lib/api/assessment';
import type {
  AssessmentSession,
  AssessmentQuestion,
  AssessmentResult,
} from '@/types/assessment';

import { SoulECharacter } from '@/components/SoulECharacter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import styles from '@/styles/modules/AssessmentPage.module.scss';

const cx = classNames.bind(styles);

// 검사 단계 타입
type AssessmentPhase = 'intro' | 'testing' | 'submitting' | 'result';

// 자동저장 딜레이 (ms)
const AUTO_SAVE_DELAY = 5000;

// 한 페이지에 표시할 문항 수
const QUESTIONS_PER_PAGE = 1;

export default function AssessmentPage() {
  const router = useRouter();
  const { selectedChild, childSessionToken } = useAppSelector((state) => state.auth);

  // 상태 관리
  const [phase, setPhase] = useState<AssessmentPhase>('intro');
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 키보드 네비게이션용 포커스된 선택지 인덱스
  const [focusedChoiceIndex, setFocusedChoiceIndex] = useState<number>(-1);

  // 자동저장 타이머
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastSavedAnswers, setLastSavedAnswers] = useState<Record<number, number>>({});

  // 세션/인증 체크
  useEffect(() => {
    if (!childSessionToken || !selectedChild) {
      router.replace('/children');
    }
  }, [childSessionToken, selectedChild, router]);

  // 문항 데이터 로드
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await assessmentApi.getQuestions('KPRC_CO_SG_E');
        setQuestions(data.questions);
      } catch (err) {
        console.error('Failed to load questions:', err);
        setError('문항을 불러오는데 실패했습니다.');
      }
    };

    loadQuestions();
  }, []);

  // 자동저장 로직
  const saveAnswers = useCallback(async () => {
    if (!session) return;

    // 저장되지 않은 새 답변이 있는지 확인
    const newAnswers: Record<number, number> = {};
    Object.entries(answers).forEach(([key, value]) => {
      const numKey = parseInt(key);
      if (lastSavedAnswers[numKey] !== value) {
        newAnswers[numKey] = value;
      }
    });

    if (Object.keys(newAnswers).length === 0) return;

    try {
      await assessmentApi.saveAnswers(session.session_id, { answers: newAnswers });
      setLastSavedAnswers({ ...lastSavedAnswers, ...newAnswers });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [session, answers, lastSavedAnswers]);

  // 답변 변경 시 자동저장 예약
  useEffect(() => {
    if (phase !== 'testing' || !session) return;

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    const timer = setTimeout(() => {
      saveAnswers();
    }, AUTO_SAVE_DELAY);

    setAutoSaveTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [answers, phase, session]);

  // 검사 시작
  const handleStartAssessment = async () => {
    if (!selectedChild) return;

    setIsLoading(true);
    setError(null);

    try {
      const newSession = await assessmentApi.startAssessment({
        child_id: selectedChild.id,
        child_name: selectedChild.name,
        gender: selectedChild.gender === '남자' ? 'M' : 'F',
        birth_date: selectedChild.birth_date,
        school_grade: calculateGrade(selectedChild.birth_date),
      });

      setSession(newSession);
      setPhase('testing');
    } catch (err: any) {
      console.error('Failed to start assessment:', err);
      setError(err?.response?.data?.detail?.error || '검사를 시작할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // [개발자 테스트용] 모든 문항을 1로 설정하고 즉시 제출
  const handleDevTestSubmit = async () => {
    if (!selectedChild) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. 세션 시작
      const newSession = await assessmentApi.startAssessment({
        child_id: selectedChild.id,
        child_name: selectedChild.name,
        gender: selectedChild.gender === '남자' ? 'M' : 'F',
        birth_date: selectedChild.birth_date,
        school_grade: calculateGrade(selectedChild.birth_date),
      });

      setSession(newSession);

      // 2. 모든 문항에 대해 1번 선택지(값: 1)로 답변 생성
      const testAnswers: Record<number, number> = {};
      questions.forEach((q) => {
        testAnswers[q.number] = 1; // 모든 문항 "약간 그렇다" 선택
      });

      setAnswers(testAnswers);
      setPhase('submitting');

      // 3. 바로 제출
      const submitResult = await assessmentApi.submitAssessment(newSession.session_id, {
        answers: testAnswers,
      });

      setResult(submitResult);
      setPhase('result');
    } catch (err: any) {
      console.error('Dev test submit failed:', err);
      setError(err?.response?.data?.detail?.error || err?.message || '테스트 제출에 실패했습니다.');
      setPhase('intro');
    } finally {
      setIsLoading(false);
    }
  };

  // 학년 계산 (생년월일 기준)
  const calculateGrade = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    // 한국 나이 기준 학년 계산 (만 나이 + 1 = 한국 나이, 학년 = 한국나이 - 6)
    const grade = age - 5; // 간소화된 계산
    return Math.max(4, Math.min(6, grade)); // 4-6학년 범위로 제한
  };

  // 답변 선택
  const handleSelectAnswer = (questionNumber: number, choice: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: choice,
    }));
  };

  // 이전 문항
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 다음 문항
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // 검사 제출
  const handleSubmit = async () => {
    if (!session) return;

    // 미응답 문항 체크
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      setError(`아직 ${unansweredCount}개의 문항에 응답하지 않았어요. 모든 문항에 응답해주세요.`);
      return;
    }

    setPhase('submitting');
    setError(null);

    try {
      const submitResult = await assessmentApi.submitAssessment(session.session_id, {
        answers,
      });
      setResult(submitResult);
      setPhase('result');
    } catch (err: any) {
      console.error('Failed to submit assessment:', err);
      setError(err?.response?.data?.detail?.error || '검사 제출에 실패했습니다.');
      setPhase('testing');
    }
  };

  // 채팅으로 돌아가기
  const handleBackToChat = () => {
    router.push('/chat');
  };

  // 에러 닫기
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 현재 문항
  const currentQuestion = questions[currentIndex];

  // 문항 변경 시 포커스 인덱스 리셋 (현재 선택된 답변으로 초기화)
  useEffect(() => {
    if (currentQuestion) {
      const currentAnswer = answers[currentQuestion.number];
      if (currentAnswer !== undefined) {
        // 현재 선택된 답변의 인덱스 찾기
        const selectedIndex = currentQuestion.choices.findIndex(
          (c) => parseInt(c.value) === currentAnswer
        );
        setFocusedChoiceIndex(selectedIndex);
      } else {
        setFocusedChoiceIndex(-1);
      }
    }
  }, [currentIndex, currentQuestion, answers]);

  // 키보드 네비게이션
  useEffect(() => {
    if (phase !== 'testing' || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const choicesCount = currentQuestion.choices.length;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedChoiceIndex((prev) =>
            prev <= 0 ? choicesCount - 1 : prev - 1
          );
          break;

        case 'ArrowDown':
          e.preventDefault();
          setFocusedChoiceIndex((prev) =>
            prev >= choicesCount - 1 ? 0 : prev + 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (focusedChoiceIndex >= 0 && focusedChoiceIndex < choicesCount) {
            // 선택지 선택
            const selectedChoice = currentQuestion.choices[focusedChoiceIndex];
            handleSelectAnswer(currentQuestion.number, parseInt(selectedChoice.value));

            // 잠시 후 다음 문항으로 이동 (시각적 피드백을 위해)
            setTimeout(() => {
              if (currentIndex < questions.length - 1) {
                handleNext();
              }
            }, 200);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            handlePrevious();
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < questions.length - 1 && answers[currentQuestion.number] !== undefined) {
            handleNext();
          }
          break;

        // 숫자키로 직접 선택 (1, 2, 3, 4)
        case '1':
        case '2':
        case '3':
        case '4': {
          const choiceIndex = parseInt(e.key) - 1;
          if (choiceIndex < choicesCount) {
            e.preventDefault();
            const choice = currentQuestion.choices[choiceIndex];
            handleSelectAnswer(currentQuestion.number, parseInt(choice.value));
            setFocusedChoiceIndex(choiceIndex);

            // 잠시 후 다음 문항으로 이동
            setTimeout(() => {
              if (currentIndex < questions.length - 1) {
                handleNext();
              }
            }, 200);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentQuestion, focusedChoiceIndex, currentIndex, questions.length, answers]);
  const progress = questions.length > 0
    ? Math.round((Object.keys(answers).length / questions.length) * 100)
    : 0;

  // 렌더링
  if (!selectedChild) {
    return null;
  }

  return (
    <div className={cx('assessmentPage')}>
      {/* 에러 배너 */}
      {error && (
        <div className={cx('errorBanner')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className={cx('errorText')}>{error}</span>
        </div>
      )}

      {/* 인트로 화면 */}
      {phase === 'intro' && (
        <section className={cx('introSection')}>
          <button className={cx('backButtonFloat')} onClick={handleBackToChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={cx('characterWrapper')}>
            <SoulECharacter state="greeting" size="large" />
          </div>

          <div className={cx('introContent')}>
            <h1>안녕, {selectedChild.name}!</h1>
            <p>
              나랑 같이 재미있는 질문들에 답해볼래?
            </p>
            <p>
              맞고 틀린 건 없어! 느끼는 대로 편하게 골라줘~
            </p>
          </div>

          <div className={cx('infoCard')}>
            <div className={cx('infoItem')}>
              <div className={cx('icon')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
              </div>
              <div className={cx('infoText')}>
                <span className={cx('label')}>질문</span>
                <span className={cx('value')}>{questions.length}개</span>
              </div>
            </div>

            <div className={cx('infoItem')}>
              <div className={cx('icon')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className={cx('infoText')}>
                <span className={cx('label')}>걸리는 시간</span>
                <span className={cx('value')}>20~30분 정도</span>
              </div>
            </div>
          </div>

          <button
            className={cx('startButton')}
            onClick={handleStartAssessment}
            disabled={isLoading || questions.length === 0}
          >
            {isLoading ? '준비 중...' : '시작할래!'}
          </button>

          {/* 개발자 테스트용 버튼 */}
          <button
            className={cx('devTestButton')}
            onClick={handleDevTestSubmit}
            disabled={isLoading || questions.length === 0}
          >
            {isLoading ? '제출 중...' : '🧪 빠른 테스트 (개발자용)'}
          </button>
        </section>
      )}

      {/* 검사 진행 화면 */}
      {phase === 'testing' && currentQuestion && (
        <>
          <header className={cx('header')}>
            <button className={cx('backButton')} onClick={handleBackToChat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              나가기
            </button>
            <div className={cx('progressInfo')}>
              <span className={cx('progressText')}>{progress}%</span>
              <div className={cx('progressBar')}>
                <div className={cx('progressFill')} style={{ width: `${progress}%` }} />
              </div>
            </div>
          </header>

          <section className={cx('questionSection')}>
            <div className={cx('questionCard')}>
              <span className={cx('questionNumber')}>
                문항 {currentIndex + 1} / {questions.length}
              </span>
              <p className={cx('questionText')}>{currentQuestion.text}</p>
            </div>

            <div className={cx('choicesContainer')}>
              {currentQuestion.choices.map((choice, index) => (
                <button
                  key={choice.value}
                  className={cx('choiceButton', {
                    selected: answers[currentQuestion.number] === parseInt(choice.value),
                    focused: focusedChoiceIndex === index,
                  })}
                  onClick={() => {
                    handleSelectAnswer(currentQuestion.number, parseInt(choice.value));
                    setFocusedChoiceIndex(index);
                  }}
                  onMouseEnter={() => setFocusedChoiceIndex(index)}
                >
                  <span className={cx('choiceNumber')}>{index + 1}</span>
                  <span className={cx('choiceIndicator')} />
                  <span className={cx('choiceLabel')}>{choice.label}</span>
                </button>
              ))}
            </div>

            {/* 키보드 단축키 안내 */}
            <div className={cx('keyboardHint')}>
              <span>↑↓ 선택</span>
              <span>Enter 확인</span>
              <span>←→ 이전/다음</span>
              <span>1~4 바로선택</span>
            </div>

            <div className={cx('navigationButtons')}>
              <button
                className={cx('prevButton')}
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                이전
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  className={cx('nextButton')}
                  onClick={handleNext}
                  disabled={answers[currentQuestion.number] === undefined}
                >
                  다음
                </button>
              ) : (
                <button
                  className={cx('submitButton')}
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < questions.length}
                >
                  검사 완료
                </button>
              )}
            </div>
          </section>
        </>
      )}

      {/* 제출 중 오버레이 */}
      {phase === 'submitting' && (
        <div className={cx('submittingOverlay')}>
          <div className={cx('submittingContent')}>
            <SoulECharacter state="thinking" size="large" />
            <h3>검사 결과를 분석하고 있어요...</h3>
            <p>잠시만 기다려주세요</p>
          </div>
        </div>
      )}

      {/* 결과 화면 */}
      {phase === 'result' && result && (
        <section className={cx('resultSection')}>
          <div className={cx('resultCard')}>
            {result.is_success ? (
              <div className={cx('characterWrapper')}>
                <SoulECharacter state="greeting" size="large" />
              </div>
            ) : (
              <div className={cx('resultIcon', 'error')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            )}

            <h2>{result.is_success ? '검사 끝!' : '앗, 문제가 생겼어요'}</h2>

            <p className={cx('resultMessage')}>
              {result.is_success
                ? `${selectedChild.name} 친구, 끝까지 잘 해줬어! 고마워~`
                : result.error_message || '다시 한번 시도해볼까?'}
            </p>

            {result.is_success && (
              <p className={cx('resultSubMessage')}>
                결과는 부모님께 전달해드릴게!
              </p>
            )}

            {result.report_url && (
              <a
                href={result.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cx('reportLink')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                결과 보러가기
              </a>
            )}

            <div className={cx('resultButtons')}>
              <button className={cx('primaryButton')} onClick={handleBackToChat}>
                소울이랑 얘기하기
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 로딩 화면 */}
      {isLoading && phase === 'intro' && (
        <section className={cx('loadingSection')}>
          <LoadingSpinner />
          <span className={cx('loadingText')}>검사를 준비하고 있어요...</span>
        </section>
      )}
    </div>
  );
}

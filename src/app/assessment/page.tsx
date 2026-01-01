'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks/redux';
import classNames from 'classnames/bind';

import { assessmentApi } from '@/lib/api/assessment';
import type {
  AssessmentSession,
  AssessmentQuestion,
  AssessmentResult,
  ChildAssessmentStatus,
  AssessmentTypeValue,
} from '@/types/assessment';
import {
  ASSESSMENT_TYPES,
  ASSESSMENT_TYPE_INFO,
  getAssessmentTypeKey,
} from '@/types/assessment';

import { SoulECharacter } from '@/components/SoulECharacter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import styles from '@/styles/modules/AssessmentPage.module.scss';

const cx = classNames.bind(styles);

// 검사 단계 타입
type AssessmentPhase = 'loading' | 'intro' | 'completed' | 'testing' | 'submitting' | 'result';

// 자동저장 딜레이 (ms)
const AUTO_SAVE_DELAY = 3000;

// N문항마다 서버에 저장
const SAVE_EVERY_N_QUESTIONS = 5;

// 한 페이지에 표시할 문항 수
const QUESTIONS_PER_PAGE = 1;

// Suspense로 감싸기 위한 래퍼 컴포넌트
export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className={cx('container')}><LoadingSpinner size="lg" /></div>}>
      <AssessmentPageContent />
    </Suspense>
  );
}

function AssessmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedChild, childSessionToken } = useAppSelector((state) => state.auth);

  // URL에서 검사 타입 읽기 (기본값: KPRC)
  const assessmentTypeValue = (searchParams.get('type') as AssessmentTypeValue) || ASSESSMENT_TYPES.KPRC;
  const assessmentTypeKey = getAssessmentTypeKey(assessmentTypeValue);
  const assessmentInfo = assessmentTypeKey ? ASSESSMENT_TYPE_INFO[assessmentTypeKey] : ASSESSMENT_TYPE_INFO.KPRC;

  // 상태 관리
  const [phase, setPhase] = useState<AssessmentPhase>('loading');
  const [assessmentStatus, setAssessmentStatus] = useState<ChildAssessmentStatus | null>(null);
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredAnswerCount, setRestoredAnswerCount] = useState<number | null>(null);

  // 키보드 네비게이션용 포커스된 선택지 인덱스
  const [focusedChoiceIndex, setFocusedChoiceIndex] = useState<number>(-1);

  // 자동저장 관련
  const [lastSavedAnswers, setLastSavedAnswers] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const pendingSaveRef = useRef<Record<number, number>>({});
  const answersRef = useRef<Record<number, number>>({});

  // answers가 변경될 때마다 ref 업데이트
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // 서버에 답변 저장 (전체 답변을 보냄 - 백엔드에서 merge)
  const saveToServer = useCallback(async (allAnswers: Record<number, number>) => {
    if (!session || Object.keys(allAnswers).length === 0) return;

    setIsSaving(true);
    try {
      await assessmentApi.saveAnswers(session.session_id, { answers: allAnswers });
      setLastSavedAnswers(allAnswers);
      pendingSaveRef.current = {};
      console.log(`Saved ${Object.keys(allAnswers).length} total answers to server`);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [session]);

  // 세션/인증 체크 및 검사 상태 로드
  useEffect(() => {
    if (!childSessionToken || !selectedChild) {
      router.replace('/children');
      return;
    }

    const loadAssessmentStatus = async () => {
      try {
        // 아동별 검사 상태 조회 (검사 타입별)
        const status = await assessmentApi.getChildAssessmentStatus(selectedChild.id, assessmentTypeValue);
        setAssessmentStatus(status);

        // 상태에 따라 phase 결정
        if (status.has_completed) {
          // 이미 완료된 검사가 있음
          setPhase('completed');
        } else if (status.has_in_progress && status.in_progress_session) {
          // 진행 중인 검사가 있음 - 자동으로 재개 준비
          setSession(status.in_progress_session);
          setPhase('intro');
        } else {
          // 새 검사 가능
          setPhase('intro');
        }
      } catch (err) {
        console.error('Failed to load assessment status:', err);
        setPhase('intro'); // 실패해도 intro로 이동
      }
    };

    loadAssessmentStatus();
  }, [childSessionToken, selectedChild, router, assessmentTypeValue]);

  // 문항 데이터 로드 (검사 타입별)
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const data = await assessmentApi.getQuestions(assessmentTypeValue);
        setQuestions(data.questions);
      } catch (err) {
        console.error('Failed to load questions:', err);
        setError('문항을 불러오는데 실패했습니다.');
      }
    };

    loadQuestions();
  }, [assessmentTypeValue]);

  // 진행 중인 세션의 답변 복원
  useEffect(() => {
    const loadExistingAnswers = async () => {
      if (session && assessmentStatus?.has_in_progress) {
        try {
          // 세션에 저장된 답변 조회
          const sessionAnswers = await assessmentApi.getSessionAnswers(session.session_id);

          // 기존 답변 복원 - JSON 키는 항상 문자열이므로 숫자로 변환
          const rawAnswers = sessionAnswers.answers || {};
          const convertedAnswers: Record<number, number> = {};

          for (const [key, value] of Object.entries(rawAnswers)) {
            convertedAnswers[Number(key)] = value as number;
          }

          const answerCount = Object.keys(convertedAnswers).length;
          setRestoredAnswerCount(answerCount);

          if (answerCount > 0) {
            setAnswers(convertedAnswers);
            setLastSavedAnswers(convertedAnswers);

            // 마지막 응답 위치로 이동 (다음 문항으로)
            if (sessionAnswers.last_answered_question !== null) {
              const nextIndex = Math.min(
                sessionAnswers.last_answered_question, // 마지막 응답 문항 다음으로
                questions.length - 1
              );
              setCurrentIndex(nextIndex);
            }

            console.log(
              `Restored ${answerCount} answers, ` +
              `last question: ${sessionAnswers.last_answered_question}`,
              `keys sample:`, Object.keys(convertedAnswers).slice(0, 5)
            );
          }
        } catch (err) {
          console.error('Failed to load existing answers:', err);
          // 실패 시 세션의 answered_count 사용
          setRestoredAnswerCount(assessmentStatus.in_progress_session?.answered_count || 0);
        }
      }
    };

    if (questions.length > 0 && session) {
      loadExistingAnswers();
    }
  }, [session, assessmentStatus, questions.length]);

  // 타이머 기반 자동저장 (N초마다 미저장 답변이 있으면 전체 답변 저장)
  useEffect(() => {
    if (phase !== 'testing' || !session) return;

    const timer = setInterval(() => {
      const hasPending = Object.keys(pendingSaveRef.current).length > 0;
      if (hasPending && !isSaving) {
        // 전체 답변을 저장 (백엔드에서 merge)
        saveToServer({ ...answersRef.current });
      }
    }, AUTO_SAVE_DELAY);

    return () => clearInterval(timer);
  }, [phase, session, isSaving, saveToServer]);

  // 페이지 이탈 시 자동저장 (브라우저 종료, 탭 닫기, 새로고침 등)
  useEffect(() => {
    if (phase !== 'testing' || !session) return;

    // 동기적으로 저장 시도 (sendBeacon 사용) - 전체 답변 저장
    const saveBeforeUnload = () => {
      const allAnswers = answersRef.current;
      if (Object.keys(allAnswers).length === 0) return;

      // navigator.sendBeacon으로 비동기 요청 (페이지 종료 시에도 완료됨)
      const url = `${process.env.NEXT_PUBLIC_SOUL_BACKEND_URL || 'http://localhost:8000'}/api/v1/assessment/sessions/${session.session_id}/answers`;
      const data = JSON.stringify({ answers: allAnswers });

      try {
        navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
        console.log(`[beforeunload] Sent ${Object.keys(allAnswers).length} total answers via sendBeacon`);
      } catch (err) {
        console.error('[beforeunload] sendBeacon failed:', err);
      }
    };

    // 탭이 백그라운드로 갈 때 저장 - 전체 답변 저장
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const hasPending = Object.keys(pendingSaveRef.current).length > 0;
        if (hasPending && !isSaving) {
          saveToServer({ ...answersRef.current });
        }
      }
    };

    window.addEventListener('beforeunload', saveBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', saveBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [phase, session, isSaving, saveToServer]);

  // 검사 시작 또는 재개
  const handleStartAssessment = async () => {
    if (!selectedChild) return;

    setIsLoading(true);
    setError(null);

    try {
      let currentSession = session;

      // 진행 중인 세션이 없으면 새로 생성
      if (!currentSession) {
        currentSession = await assessmentApi.startAssessment({
          child_id: selectedChild.id,
          child_name: selectedChild.name,
          gender: selectedChild.gender === '남자' ? 'M' : 'F',
          birth_date: selectedChild.birth_date,
          school_grade: calculateGrade(selectedChild.birth_date),
          assessment_type: assessmentTypeValue,
        });
        setSession(currentSession);
      }

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
        assessment_type: assessmentTypeValue,
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
  const handleSelectAnswer = useCallback((questionNumber: number, choice: number) => {
    setAnswers((prev) => {
      const newAnswers = {
        ...prev,
        [questionNumber]: choice,
      };

      // 저장되지 않은 답변 추적
      pendingSaveRef.current[questionNumber] = choice;

      // N문항마다 서버에 전체 답변 저장
      const unsavedCount = Object.keys(pendingSaveRef.current).length;
      if (unsavedCount >= SAVE_EVERY_N_QUESTIONS && session && !isSaving) {
        // 전체 답변을 저장 (새로 추가된 답변 포함)
        saveToServer(newAnswers);
      }

      return newAnswers;
    });
  }, [session, isSaving, saveToServer]);

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

  // 채팅으로 돌아가기 (나가기 전 전체 답변 저장)
  const handleBackToChat = useCallback(async () => {
    // 진행 중인 검사라면 나가기 전 전체 답변 저장
    if (session && phase === 'testing') {
      const allAnswers = answersRef.current;
      if (Object.keys(allAnswers).length > 0) {
        try {
          await assessmentApi.saveAnswers(session.session_id, { answers: allAnswers });
          pendingSaveRef.current = {};
          console.log(`Saved ${Object.keys(allAnswers).length} total answers before leaving`);
        } catch (err) {
          console.error('Failed to save before leaving:', err);
        }
      }
    }

    router.push('/chat');
  }, [session, phase]);

  // 결과 보러 가기 (완료된 검사)
  const handleViewResult = () => {
    if (assessmentStatus?.latest_completed_session) {
      // Inpsyt 리포트 URL로 이동
      // 실제로는 세션에서 report_url을 가져와야 함
      router.push('/chat');
    }
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

  // 로딩 중
  if (phase === 'loading') {
    return (
      <div className={cx('assessmentPage')}>
        <section className={cx('loadingSection')}>
          <LoadingSpinner />
          <span className={cx('loadingText')}>검사 정보를 불러오는 중...</span>
        </section>
      </div>
    );
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

      {/* 이미 완료된 검사가 있을 때 */}
      {phase === 'completed' && assessmentStatus && (
        <section className={cx('completedSection')}>
          <button className={cx('backButtonFloat')} onClick={handleBackToChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={cx('characterWrapper')}>
            <SoulECharacter state="greeting" size="large" />
          </div>

          <div className={cx('completedContent')}>
            <h1>{assessmentInfo.shortName} 검사 완료!</h1>
            <p className={cx('completedMessage')}>
              {selectedChild.name} 친구는 이미 {assessmentInfo.name}를 완료했어요.
            </p>
            <p className={cx('completedSubMessage')}>
              검사 결과는 보호자님께 전달되었어요.
              더 궁금한 게 있으면 소울이랑 이야기해봐요!
            </p>
          </div>

          <div className={cx('completedInfo')}>
            <div className={cx('infoItem')}>
              <span className={cx('label')}>완료된 검사</span>
              <span className={cx('value')}>{assessmentStatus.total_completed_count}회</span>
            </div>
            {assessmentStatus.latest_completed_session && (
              <div className={cx('infoItem')}>
                <span className={cx('label')}>마지막 검사</span>
                <span className={cx('value')}>
                  {new Date(assessmentStatus.latest_completed_session.updated_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            )}
          </div>

          <button className={cx('primaryButton')} onClick={handleBackToChat}>
            소울이랑 대화하기
          </button>
        </section>
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
            {assessmentStatus?.has_in_progress ? (
              // 진행 중인 검사 재개
              <>
                <h1>이어서 해볼까, {selectedChild.name}?</h1>
                <p>
                  아까 하던 검사가 남아있어!
                </p>
                <p>
                  {restoredAnswerCount !== null
                    ? restoredAnswerCount
                    : assessmentStatus.in_progress_session?.answered_count || 0}개 문항을 완료했어.
                  계속 이어서 할까?
                </p>
              </>
            ) : (
              // 새 검사 시작
              <>
                <h1>안녕, {selectedChild.name}!</h1>
                <p>
                  나랑 같이 재미있는 질문들에 답해볼래?
                </p>
                <p>
                  맞고 틀린 건 없어! 느끼는 대로 편하게 골라줘~
                </p>
              </>
            )}
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
                <span className={cx('value')}>
                  {assessmentStatus?.has_in_progress
                    ? `${restoredAnswerCount !== null ? restoredAnswerCount : assessmentStatus.in_progress_session?.answered_count || 0} / ${questions.length}개`
                    : `${questions.length}개`}
                </span>
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
                <span className={cx('value')}>
                  {assessmentStatus?.has_in_progress
                    ? '남은 시간에 따라 달라요'
                    : assessmentInfo.questionCount <= 30
                    ? '5~10분 정도'
                    : '20~30분 정도'}
                </span>
              </div>
            </div>
          </div>

          <button
            className={cx('startButton')}
            onClick={handleStartAssessment}
            disabled={isLoading || questions.length === 0}
          >
            {isLoading
              ? '준비 중...'
              : assessmentStatus?.has_in_progress
              ? '이어서 할래!'
              : '시작할래!'}
          </button>

          {/* 개발자 테스트용 버튼 - 진행 중이 아닐 때만 표시 */}
          {!assessmentStatus?.has_in_progress && (
            <button
              className={cx('devTestButton')}
              onClick={handleDevTestSubmit}
              disabled={isLoading || questions.length === 0}
            >
              {isLoading ? '제출 중...' : '🧪 빠른 테스트 (개발자용)'}
            </button>
          )}
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
              <span>1~{currentQuestion.choices.length} 바로선택</span>
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

            <h2>{result.is_success ? `${assessmentInfo.shortName} 검사 끝!` : '앗, 문제가 생겼어요'}</h2>

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

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { InputField } from '@/components/InputField';
import { Select } from '@/components/Select';
import { authApi, TokenManager } from '@/lib/api';
import { specialAssessmentApi, SpecialTokenManager } from '@/lib/api/special-assessment';
import type {
  SpecialTeacherInfo,
  SpecialChildInfo,
  SpecialAssessmentPhase,
  AssessmentTool,
} from '@/types/special-assessment';
import { SPECIAL_ASSESSMENT_TOOLS, calculateGradeFromAge } from '@/types/special-assessment';
import type {
  AssessmentSession,
  SectionInfo,
  QuestionInfo,
  AssessmentResult,
} from '@/types/teacher-assessment';
import type { DistrictFacility } from '@/types/api';
import styles from '@/styles/modules/TeacherAssessmentPage.module.scss';

// 선택지 상수 - 교사평정형 (KPRC_CO_TG)
const CHOICES_TEACHER = [
  { value: 1, label: '전혀 아니다' },
  { value: 2, label: '때때로 그렇다' },
  { value: 3, label: '자주 그렇다' },
  { value: 4, label: '거의 항상 그렇다' },
] as const;

// 선택지 상수 - 자가보고형 (KPRC_CO_SG_E)
const CHOICES_SELF_REPORT = [
  { value: 0, label: '전혀 아니다' },
  { value: 1, label: '약간 그렇다' },
  { value: 2, label: '대체로 그렇다' },
  { value: 3, label: '매우 그렇다' },
] as const;

// 검사 유형에 따른 선택지 반환
const getChoicesForAssessmentType = (assessmentCode: string | undefined) => {
  if (assessmentCode === 'KPRC_CO_SG_E') {
    return CHOICES_SELF_REPORT;
  }
  return CHOICES_TEACHER;
};

export default function SpecialAssessmentPage() {
  // ==========================================================================
  // 상태 관리
  // ==========================================================================

  // 인증 상태 - 구/군 선택
  const [phase, setPhase] = useState<SpecialAssessmentPhase>('auth');
  const [teacherInfo, setTeacherInfo] = useState<SpecialTeacherInfo | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtsLoading, setDistrictsLoading] = useState(true);

  // 인증 상태 - 시설 선택
  const [facilities, setFacilities] = useState<DistrictFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);

  // 인증 상태 - 비밀번호
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 어드민 키 인증
  const [adminKey, setAdminKey] = useState('');
  const [adminKeyError, setAdminKeyError] = useState('');
  const [adminKeyLoading, setAdminKeyLoading] = useState(false);

  // 검사도구 선택
  const [selectedAssessmentTool, setSelectedAssessmentTool] = useState<AssessmentTool | null>(null);

  // 아동 목록 (연령 필터 없음)
  const [children, setChildren] = useState<SpecialChildInfo[]>([]);
  const [selectedChild, setSelectedChild] = useState<SpecialChildInfo | null>(null);
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

  // 세션 복구 중 로딩 상태
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // ==========================================================================
  // 구/군 목록 로드
  // ==========================================================================

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const data = await authApi.getDistricts();
        setDistricts(data);
      } catch (err) {
        console.error('구/군 목록 로드 실패:', err);
      } finally {
        setDistrictsLoading(false);
      }
    };
    fetchDistricts();
  }, []);

  // ==========================================================================
  // 기존 토큰으로 세션 복구
  // ==========================================================================

  useEffect(() => {
    const restoreSession = async () => {
      // 유효한 yeirin 토큰이 있는지 확인
      if (!TokenManager.isYeirinTokenValid()) {
        setIsRestoringSession(false);
        return;
      }

      // special_access_token도 있는지 확인
      if (!SpecialTokenManager.isValid()) {
        // yeirin 토큰은 있지만 special 토큰 없음 → admin-verify로 이동
        setPhase('admin-verify');
        setIsRestoringSession(false);
        return;
      }

      try {
        // 교사 정보 조회 시도
        const info = await specialAssessmentApi.getTeacherInfo();
        setTeacherInfo(info);

        // 아동 목록 조회 (연령 필터 없음)
        const childrenResponse = await specialAssessmentApi.getChildren();
        setChildren(childrenResponse.children);

        // 검사도구 선택 단계로 이동
        setPhase('assessment-select');
      } catch (err) {
        // 토큰이 유효하지 않거나 API 오류 시
        console.error('세션 복구 실패:', err);
        SpecialTokenManager.clear();
        setPhase('admin-verify');
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();
  }, []);

  // ==========================================================================
  // 구/군 선택 시 시설 목록 로드
  // ==========================================================================

  useEffect(() => {
    if (!selectedDistrict) {
      setFacilities([]);
      setSelectedFacilityId('');
      return;
    }

    const fetchFacilities = async () => {
      setFacilitiesLoading(true);
      setSelectedFacilityId('');
      try {
        const data = await authApi.getFacilities(selectedDistrict);
        setFacilities(data);
      } catch (err) {
        console.error('시설 목록 로드 실패:', err);
        setFacilities([]);
      } finally {
        setFacilitiesLoading(false);
      }
    };
    fetchFacilities();
  }, [selectedDistrict]);

  // 선택된 시설 정보
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);

  // ==========================================================================
  // 인증 처리 (기관 로그인)
  // ==========================================================================

  const handleAuth = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedFacilityId || !selectedFacility || !isPasswordValid || authLoading) return;

    setAuthLoading(true);
    setAuthError('');

    try {
      // 시설 기반 로그인 (토큰 자동 저장됨)
      await authApi.institutionLogin({
        facilityId: selectedFacilityId,
        facilityType: selectedFacility.facilityType,
        password,
      });

      // 어드민 키 입력 단계로 이동
      setPhase('admin-verify');
    } catch (err: any) {
      console.error('인증 실패:', err);
      setAuthError(err.response?.data?.message || '로그인에 실패했습니다. 정보를 확인해주세요.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ==========================================================================
  // 어드민 키 검증
  // ==========================================================================

  const handleAdminKeyVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!adminKey || adminKeyLoading) return;

    setAdminKeyLoading(true);
    setAdminKeyError('');

    try {
      const result = await specialAssessmentApi.verifyAdminKey({ admin_key: adminKey });

      if (result.verified) {
        // 교사 정보 조회
        const info = await specialAssessmentApi.getTeacherInfo();
        setTeacherInfo(info);

        // 아동 목록 조회 (연령 필터 없음)
        const childrenResponse = await specialAssessmentApi.getChildren();
        setChildren(childrenResponse.children);

        // 검사도구 선택 단계로 이동
        setPhase('assessment-select');
      } else {
        setAdminKeyError('관리자 키 인증에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('어드민 키 검증 실패:', err);
      setAdminKeyError(err.response?.data?.detail || '관리자 키가 올바르지 않습니다.');
    } finally {
      setAdminKeyLoading(false);
    }
  };

  // ==========================================================================
  // 검사도구 선택
  // ==========================================================================

  const handleSelectAssessmentTool = (tool: AssessmentTool) => {
    setSelectedAssessmentTool(tool);
    setSelectedChild(null);
    setPhase('children');
  };

  // ==========================================================================
  // 아동의 학년 (없으면 나이 기준 자동 계산)
  // ==========================================================================

  const getChildGrade = (child: SpecialChildInfo): number => {
    return child.grade ?? calculateGradeFromAge(child.age);
  };

  /**
   * 학년 표시 포맷 (0 = 미취학)
   */
  const formatGrade = (grade: number): string => {
    if (grade <= 0) return '미취학';
    if (grade > 6) return `중${grade - 6}`;
    return `${grade}학년`;
  };

  /**
   * 성별 변환 (MALE/FEMALE → M/F)
   */
  const convertGender = (gender: string): 'M' | 'F' => {
    if (gender === 'MALE' || gender === 'M' || gender === '남자') return 'M';
    if (gender === 'FEMALE' || gender === 'F' || gender === '여자') return 'F';
    return gender === 'M' ? 'M' : 'F';
  };

  // ==========================================================================
  // 아동 선택 및 검사 시작 (연령 검증 우회)
  // ==========================================================================

  const handleChildSelect = (child: SpecialChildInfo) => {
    setSelectedChild(child);
  };

  const handleStartAssessment = async () => {
    if (!selectedChild || !teacherInfo || !selectedAssessmentTool) return;

    setChildrenLoading(true);
    setError(null);

    try {
      // 섹션 및 문항 정보 로드
      const [sectionsData, questionsData] = await Promise.all([
        specialAssessmentApi.getSections(selectedAssessmentTool.code),
        specialAssessmentApi.getAllQuestions(selectedAssessmentTool.code),
      ]);
      setSections(sectionsData);
      setQuestions(questionsData);

      // 검사 세션 시작 (연령 검증 우회)
      const sessionData = await specialAssessmentApi.startAssessment({
        child_id: selectedChild.id,
        child_name: selectedChild.name,
        gender: convertGender(selectedChild.gender),
        birth_date: selectedChild.birth_date,
        school_grade: getChildGrade(selectedChild),
        assessment_type: selectedAssessmentTool.code,
      });

      setSession(sessionData);
      setAnswers({});

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
          await specialAssessmentApi.saveSectionAnswers(session.session_id, currentSection, {
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
      const resultData = await specialAssessmentApi.submitAssessment(session.session_id, {
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

  const handleChangeAssessmentTool = () => {
    setSelectedChild(null);
    setSelectedAssessmentTool(null);
    setSession(null);
    setAnswers({});
    setResult(null);
    setCurrentSection(1);
    setError(null);
    setPhase('assessment-select');
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
  // 로그아웃 처리
  // ==========================================================================

  const handleLogout = () => {
    const confirmed = window.confirm('로그아웃 하시겠습니까?');
    if (!confirmed) return;

    // 토큰 삭제
    TokenManager.removeYeirinToken();
    SpecialTokenManager.clear();

    // 모든 상태 초기화
    setTeacherInfo(null);
    setSelectedDistrict('');
    setSelectedFacilityId('');
    setPassword('');
    setAdminKey('');
    setSelectedAssessmentTool(null);
    setSelectedChild(null);
    setChildren([]);
    setSession(null);
    setAnswers({});
    setResult(null);
    setError(null);

    // 로그인 화면으로 이동
    setPhase('auth');
  };

  // ==========================================================================
  // 뒤로가기 처리
  // ==========================================================================

  const handleGoBack = () => {
    switch (phase) {
      case 'admin-verify':
        // 어드민 키 입력 → 기관 로그인
        TokenManager.removeYeirinToken();
        setPhase('auth');
        break;
      case 'children':
        // 아동 선택 → 검사도구 선택
        setSelectedChild(null);
        setSelectedAssessmentTool(null);
        setPhase('assessment-select');
        break;
      case 'intro':
        // 검사 안내 → 아동 선택
        setSession(null);
        setAnswers({});
        setPhase('children');
        break;
      case 'testing':
        // 검사 진행 중 → 확인 후 아동 선택으로
        const confirmed = window.confirm(
          '검사를 중단하시겠습니까?\n진행 중인 응답은 자동 저장되어 나중에 이어서 진행할 수 있습니다.'
        );
        if (confirmed) {
          setPhase('children');
        }
        break;
      default:
        break;
    }
  };

  const handleGoToMain = () => {
    setPhase('assessment-select');
    setSelectedAssessmentTool(null);
    setSelectedChild(null);
    setSession(null);
    setAnswers({});
  };

  // ==========================================================================
  // 렌더링
  // ==========================================================================

  const renderHeader = () => (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {/* 뒤로가기 버튼 */}
        {teacherInfo && phase !== 'assessment-select' && phase !== 'result' && phase !== 'submitting' && (
          <button
            type="button"
            className={styles.backButton}
            onClick={handleGoBack}
            aria-label="뒤로가기"
          >
            ←
          </button>
        )}
        <button type="button" className={styles.logo} onClick={teacherInfo ? handleGoToMain : undefined}>
          <Image src="/yeirin-logo.png" alt="예이린" width={32} height={32} />
          <span>특별 검사 시스템</span>
        </button>
        <span className={styles.specialBadge}>연령 제한 우회</span>
      </div>
      {teacherInfo && (
        <div className={styles.headerRight}>
          <span className={styles.institutionName}>{teacherInfo.facility_name}</span>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      )}
    </header>
  );

  const renderAuthSection = () => {
    const districtOptions = districts.map((d) => ({ value: d, label: d }));
    const facilityOptions = facilities.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.facilityTypeDisplayName || f.facilityType})`,
    }));
    const isFormValid = selectedDistrict && selectedFacilityId && isPasswordValid;

    return (
      <section className={styles.authSection}>
        <div className={styles.authCard}>
          <h1>특별 검사 시스템</h1>
          <p className={styles.subtitle}>
            연령 제한 없이 KPRC 검사를 실시할 수 있습니다.
            <br />
            먼저 소속 기관을 선택하고 로그인해주세요.
          </p>
          <form className={styles.formGroup} onSubmit={handleAuth}>
            <Select
              id="district"
              placeholder="구/군을 선택해주세요"
              labelContent="구/군"
              value={selectedDistrict}
              options={districtOptions}
              loading={districtsLoading}
              onChange={setSelectedDistrict}
            />

            <Select
              id="facility"
              placeholder="시설을 선택해주세요"
              labelContent="시설"
              value={selectedFacilityId}
              options={facilityOptions}
              disabled={!selectedDistrict}
              loading={facilitiesLoading}
              onChange={setSelectedFacilityId}
            />

            <InputField
              id="password"
              type="password"
              placeholder="비밀번호를 입력해주세요"
              labelContent="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onValidityChange={setIsPasswordValid}
              minLength={4}
              errMsg={authError}
            />
          </form>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => handleAuth()}
            disabled={authLoading || !isFormValid}
          >
            {authLoading ? '로그인 중...' : '다음'}
          </button>
        </div>
      </section>
    );
  };

  const renderAdminVerifySection = () => (
    <section className={styles.authSection}>
      <div className={styles.authCard}>
        <h1>관리자 인증</h1>
        <p className={styles.subtitle}>
          특별 검사를 진행하려면 관리자 키를 입력해주세요.
          <br />
          관리자 키는 담당자에게 문의하세요.
        </p>
        <form className={styles.formGroup} onSubmit={handleAdminKeyVerify}>
          <InputField
            id="adminKey"
            type="password"
            placeholder="관리자 키를 입력해주세요"
            labelContent="관리자 키"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            errMsg={adminKeyError}
          />
        </form>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => handleAdminKeyVerify()}
          disabled={adminKeyLoading || !adminKey}
        >
          {adminKeyLoading ? '인증 중...' : '인증하기'}
        </button>
      </div>
    </section>
  );

  const renderAssessmentSelectSection = () => {
    // 기존 KPRC 검사 이력이 없는 아동만 카운트
    const availableChildren = children.filter(
      (child) => !child.has_completed_kprc_tg && !child.has_completed_kprc_sg
    );

    return (
      <section className={styles.assessmentSelectSection}>
        <h2 className={styles.sectionTitle}>검사도구 선택</h2>
        <p className={styles.sectionSubtitle}>
          진행할 검사도구를 선택해주세요.
          <br />
          <strong style={{ color: '#e67e22' }}>※ 특별 검사 모드: 연령/학년 제한이 적용되지 않습니다.</strong>
          <br />
          <strong style={{ color: '#999' }}>※ 기존 KPRC 검사 이력이 있는 아동은 제외됩니다.</strong>
        </p>

        <div className={styles.assessmentToolList}>
          {SPECIAL_ASSESSMENT_TOOLS.map((tool) => (
            <div
              key={tool.code}
              className={styles.assessmentToolCard}
              onClick={() => handleSelectAssessmentTool(tool)}
            >
              <div className={styles.toolInfo}>
                <h3 className={styles.toolName}>{tool.name}</h3>
                <p className={styles.toolDescription}>{tool.description}</p>
                <div className={styles.toolMeta}>
                  <span>원래 대상: {tool.minGrade}~{tool.maxGrade}학년 ({tool.minAge}~{tool.maxAge}세)</span>
                  <span>문항: {tool.questionCount}개</span>
                </div>
              </div>
              <div className={styles.toolEligible}>
                <span className={styles.hasEligible}>
                  검사 가능 {availableChildren.length}명 / 전체 {children.length}명
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderChildrenSection = () => {
    if (!selectedAssessmentTool) return null;

    return (
      <section className={styles.childrenSection}>
        <div className={styles.selectedToolInfo}>
          <h3>{selectedAssessmentTool.shortName}</h3>
          <button
            type="button"
            className={styles.changeToolButton}
            onClick={handleChangeAssessmentTool}
          >
            검사도구 변경
          </button>
        </div>

        <h2 className={styles.sectionTitle}>아동 선택</h2>
        <p className={styles.sectionSubtitle}>
          검사를 진행할 아동을 선택해주세요.
          <br />
          <strong style={{ color: '#e67e22' }}>※ 기존 KPRC 검사 이력이 있는 아동은 특별 검사를 진행할 수 없습니다.</strong>
        </p>

        {children.length === 0 ? (
          <div className={styles.emptyState}>
            <p>등록된 아동이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className={styles.childrenList}>
              {children.map((child) => {
                const grade = getChildGrade(child);
                const hasKprcHistory = child.has_completed_kprc_tg || child.has_completed_kprc_sg;
                const historyType = child.has_completed_kprc_tg
                  ? '교사평정'
                  : child.has_completed_kprc_sg
                    ? '자가보고'
                    : '';

                return (
                  <div
                    key={child.id}
                    className={`${styles.childCard} ${
                      selectedChild?.id === child.id ? styles.selected : ''
                    } ${hasKprcHistory ? styles.disabled : ''}`}
                    onClick={() => !hasKprcHistory && handleChildSelect(child)}
                    style={{ cursor: hasKprcHistory ? 'not-allowed' : 'pointer', opacity: hasKprcHistory ? 0.6 : 1 }}
                  >
                    <div className={styles.childInfo}>
                      <span className={styles.childName}>{child.name}</span>
                      <span className={styles.childDetails}>
                        {child.age}세 · {child.gender === 'M' ? '남' : '여'} · {formatGrade(grade)}
                      </span>
                    </div>
                    {hasKprcHistory ? (
                      <span className={`${styles.childStatus} ${styles.completed}`} style={{ color: '#999', backgroundColor: '#f0f0f0' }}>
                        검사 완료 ({historyType})
                      </span>
                    ) : (
                      <span className={`${styles.childStatus} ${styles.eligible}`}>
                        검사 가능
                      </span>
                    )}
                  </div>
                );
              })}
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
        <h2>{selectedAssessmentTool?.name || '특별 검사'}</h2>

        {selectedChild && (
          <div className={styles.childSummary}>
            <div className={styles.avatar}>{selectedChild.name.charAt(0)}</div>
            <div className={styles.info}>
              <h3>{selectedChild.name}</h3>
              <p>
                {selectedChild.age}세 · {selectedChild.gender === 'M' ? '남' : '여'} ·{' '}
                {formatGrade(getChildGrade(selectedChild))}
              </p>
            </div>
          </div>
        )}

        <div className={styles.instructions}>
          <h3>검사 안내</h3>
          <ul>
            <li>총 {questions.length}개의 문항으로 구성되어 있습니다.</li>
            <li>{sections.length}개의 섹션으로 나누어져 있습니다.</li>
            {selectedAssessmentTool?.code === 'KPRC_CO_SG_E' ? (
              <li>각 문항에 대해 <strong>아동이 직접</strong> 평소 자신의 모습을 기준으로 응답합니다.</li>
            ) : (
              <li>각 문항에 대해 <strong>교사/보호자가</strong> 아동의 평소 행동을 기준으로 응답합니다.</li>
            )}
            <li>검사는 중간에 저장되므로 나중에 이어서 진행할 수 있습니다.</li>
            <li>소요 시간은 약 15-20분입니다.</li>
          </ul>
        </div>

        <div className={styles.choiceGuide}>
          <h4>응답 선택지</h4>
          <div className={styles.choices}>
            {getChoicesForAssessmentType(selectedAssessmentTool?.code).map((choice, index) => (
              <div key={choice.value} className={styles.choice}>
                <span className={styles.number}>{index + 1}</span>
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
            <button onClick={handleNextSection} disabled={isLastSection || !isSectionComplete}>
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
                {getChoicesForAssessmentType(selectedAssessmentTool?.code).map((choice) => (
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
              disabled={!isSectionComplete}
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
            </div>
            {result.report_url && (
              <a
                href={result.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.reportButton}
              >
                상세 리포트 보기
              </a>
            )}
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
            onClick={handleLogout}
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

  // 세션 복구 중 로딩 화면
  if (isRestoringSession) {
    return (
      <div className={styles.container}>
        {renderHeader()}
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p>로그인 정보 확인 중...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderHeader()}
      <main className={styles.main}>
        {phase === 'auth' && renderAuthSection()}
        {phase === 'admin-verify' && renderAdminVerifySection()}
        {phase === 'assessment-select' && renderAssessmentSelectSection()}
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

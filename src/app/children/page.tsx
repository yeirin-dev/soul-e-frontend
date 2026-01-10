'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { fetchChildren, clearError, logout, setSelectedChild, clearPinState } from '@/lib/store/authSlice';
import { clearChat } from '@/lib/store/chatSlice';
import { resetConsentState } from '@/lib/store/consentSlice';
import { type ChildInfo } from '@/types/api';
import styles from '@/styles/modules/ChildSelectPage.module.scss';

export default function ChildSelectPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    children,
    childrenLoading,
    selectingChild,
    error,
    teacher,
    yeirinToken
  } = useAppSelector((state) => state.auth);

  const [selectingChildId, setSelectingChildId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!yeirinToken) {
      router.replace('/');
      return;
    }

    const loadChildren = async () => {
      const result = await dispatch(fetchChildren());
      // 401 에러면 로그인 페이지로
      if (fetchChildren.rejected.match(result)) {
        const payload = result.payload as any;
        if (payload?.status === 401 || (typeof payload === 'string' && payload.includes('인증'))) {
          dispatch(logout());
          router.replace('/');
        }
      }
    };

    loadChildren();
  }, [dispatch, router, yeirinToken]);

  // 에러 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  // 검색 필터링
  const filteredChildren = useMemo(() => {
    if (!searchQuery.trim()) {
      return children;
    }
    const query = searchQuery.toLowerCase().trim();
    return children.filter((child) =>
      child.name.toLowerCase().includes(query) ||
      child.age.toString().includes(query)
    );
  }, [children, searchQuery]);

  // 이용 가능/불가 분리
  const { eligibleChildren, ineligibleChildren } = useMemo(() => {
    const eligible = filteredChildren.filter(c => c.is_eligible);
    const ineligible = filteredChildren.filter(c => !c.is_eligible);
    return { eligibleChildren: eligible, ineligibleChildren: ineligible };
  }, [filteredChildren]);

  // 14세 기준 동의 상태 확인
  const getConsentStatus = (child: ChildInfo) => {
    const isOver14 = child.age >= 14;

    // 새로운 필드가 있으면 사용
    if (child.consent_status !== undefined) {
      return child.consent_status;
    }

    // 새로운 필드가 있으면 계산
    if (child.has_guardian_consent !== undefined) {
      if (isOver14) {
        // 14세 이상: 보호자 + 아동 본인 동의 필요
        if (!child.has_guardian_consent && !child.has_child_consent) return 'NEED_BOTH';
        if (!child.has_guardian_consent) return 'NEED_GUARDIAN';
        if (!child.has_child_consent) return 'NEED_CHILD';
        return 'COMPLETE';
      } else {
        // 14세 미만: 보호자 동의만 필요
        return child.has_guardian_consent ? 'COMPLETE' : 'NEED_GUARDIAN';
      }
    }

    // 기존 필드만 있는 경우 (하위 호환)
    return child.has_consent ? 'COMPLETE' : (isOver14 ? 'NEED_BOTH' : 'NEED_GUARDIAN');
  };

  const handleSelectChild = async (child: ChildInfo) => {
    if (!child.is_eligible) {
      return;
    }

    const consentStatus = getConsentStatus(child);

    // 보호자 동의 대기 중인 경우 - 선택 불가
    if (consentStatus === 'NEED_GUARDIAN' || consentStatus === 'NEED_BOTH') {
      // 보호자 동의 대기 안내 (선택하지 않음)
      return;
    }

    setSelectingChildId(child.id);

    // 기존 상태 클리어
    dispatch(clearChat());
    dispatch(clearPinState());
    dispatch(resetConsentState());

    // 아동 선택 저장
    dispatch(setSelectedChild(child));

    // 동의 상태에 따른 라우팅
    if (consentStatus === 'NEED_CHILD') {
      // 14세 이상: 아동 본인 동의 필요
      router.push('/consent');
    } else if (child.has_pin) {
      // PIN 검증
      router.push('/pin/verify');
    } else {
      // PIN 설정
      router.push('/pin/setup');
    }

    setSelectingChildId(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/');
  };

  const handleRefresh = () => {
    dispatch(clearError());
    dispatch(fetchChildren());
  };

  const totalCount = children.length;
  const eligibleCount = children.filter(c => c.is_eligible).length;

  // 시설 유형 라벨 (facility_type 사용 - 대문자 형식)
  const facilityType = teacher?.facility_type?.toUpperCase();
  const institutionTypeLabel = facilityType === 'CARE_FACILITY'
    ? '양육시설'
    : facilityType === 'COMMUNITY_CENTER'
      ? '지역아동센터'
      : '';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleSection}>
            <h1>아동 선택</h1>
            {teacher && teacher.facility_name && (
              <span className={styles.institutionBadge}>
                {institutionTypeLabel && <span className={styles.typeLabel}>{institutionTypeLabel}</span>}
                {teacher.facility_name}
              </span>
            )}
          </div>
          <button onClick={handleLogout} className={styles.logoutButton} type="button">
            로그아웃
          </button>
        </div>
        <p className={styles.subtitle}>
          소울이와 대화할 아동을 선택해주세요
        </p>
      </header>

      {/* 에러 배너 */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => dispatch(clearError())} type="button">×</button>
        </div>
      )}

      <main className={styles.mainContent}>
        {/* 검색 및 통계 바 */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={styles.clearButton}
                type="button"
              >
                ×
              </button>
            )}
          </div>
          <div className={styles.stats}>
            <span className={styles.total}>전체 {totalCount}명</span>
            <span className={styles.divider}>·</span>
            <span className={styles.eligible}>이용 가능 {eligibleCount}명</span>
          </div>
        </div>

        <div className={styles.listContainer}>
          {/* 로딩 상태 */}
          {childrenLoading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>아동 목록을 불러오는 중...</p>
            </div>
          )}

          {/* 빈 상태 */}
          {!childrenLoading && children.length === 0 && !error && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👶</div>
              <p>등록된 아동이 없습니다</p>
              <button onClick={handleRefresh} className={styles.refreshButton} type="button">
                새로고침
              </button>
            </div>
          )}

          {/* 검색 결과 없음 */}
          {!childrenLoading && children.length > 0 && filteredChildren.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>"{searchQuery}"에 해당하는 아동이 없습니다</p>
              <button
                onClick={() => setSearchQuery('')}
                className={styles.refreshButton}
                type="button"
              >
                검색 초기화
              </button>
            </div>
          )}

          {/* 아동 목록 */}
          {!childrenLoading && filteredChildren.length > 0 && (
            <div className={styles.scrollArea}>
              {/* 이용 가능 아동 */}
              {eligibleChildren.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.dot} />
                    이용 가능
                    <span className={styles.count}>{eligibleChildren.length}</span>
                  </h2>
                  <div className={styles.grid}>
                    {eligibleChildren.map((child: ChildInfo) => {
                      const isSelecting = selectingChild && selectingChildId === child.id;
                      const consentStatus = getConsentStatus(child);
                      const needsGuardianConsent = consentStatus === 'NEED_GUARDIAN' || consentStatus === 'NEED_BOTH';
                      const needsChildConsent = consentStatus === 'NEED_CHILD';
                      const isComplete = consentStatus === 'COMPLETE';

                      return (
                        <button
                          key={child.id}
                          className={`${styles.card} ${isSelecting ? styles.selecting : ''} ${needsGuardianConsent ? styles.waitingConsent : ''}`}
                          onClick={() => handleSelectChild(child)}
                          disabled={selectingChild || needsGuardianConsent}
                          type="button"
                        >
                          {isSelecting && (
                            <div className={styles.cardOverlay}>
                              <div className={styles.smallSpinner} />
                            </div>
                          )}
                          <div className={styles.avatar}>
                            {child.gender === 'MALE' || child.gender === 'M' ? '👦' : '👧'}
                          </div>
                          <div className={styles.info}>
                            <h3>{child.name}</h3>
                            <p>{child.age}세</p>
                          </div>
                          {needsGuardianConsent && (
                            <span className={styles.guardianConsentBadge}>보호자 동의 대기</span>
                          )}
                          {needsChildConsent && (
                            <span className={styles.consentBadge}>동의 필요</span>
                          )}
                          {isComplete && !child.has_pin && (
                            <span className={styles.newBadge}>첫 방문</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 이용 불가 아동 */}
              {ineligibleChildren.length > 0 && (
                <section className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${styles.disabled}`}>
                    <span className={styles.dot} />
                    이용 불가 (9-15세만 가능)
                    <span className={styles.count}>{ineligibleChildren.length}</span>
                  </h2>
                  <div className={styles.grid}>
                    {ineligibleChildren.map((child: ChildInfo) => (
                      <div key={child.id} className={`${styles.card} ${styles.disabled}`}>
                        <div className={styles.avatar}>
                          {child.gender === 'MALE' || child.gender === 'M' ? '👦' : '👧'}
                        </div>
                        <div className={styles.info}>
                          <h3>{child.name}</h3>
                          <p>{child.age}세</p>
                        </div>
                        <span className={styles.badge}>이용 불가</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

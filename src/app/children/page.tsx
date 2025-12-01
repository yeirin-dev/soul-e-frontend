'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { fetchChildren, selectChildSession, clearError, logout } from '@/lib/store/authSlice';
import { clearChat } from '@/lib/store/chatSlice';
import { type ChildInfo } from '@/types/api';
import { SoulECharacter } from '@/components/SoulECharacter';
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

  const handleSelectChild = async (child: ChildInfo) => {
    if (!child.is_eligible) {
      return;
    }

    setSelectingChildId(child.id);

    // 기존 채팅 내역 클리어
    dispatch(clearChat());

    const result = await dispatch(selectChildSession(child));
    if (selectChildSession.fulfilled.match(result)) {
      router.push('/chat');
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

  const eligibleCount = children.filter(c => c.is_eligible).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>아동 선택</h1>
          <button onClick={handleLogout} className={styles.logoutButton} type="button">
            로그아웃
          </button>
        </div>
        {teacher && (
          <p className={styles.teacherInfo}>
            {teacher.institution_name} · {teacher.real_name} 선생님
          </p>
        )}
      </header>

      {/* 에러 배너 */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => dispatch(clearError())} type="button">×</button>
        </div>
      )}

      <main className={styles.mainContent}>
        {/* 소울이 캐릭터 섹션 */}
        <div className={styles.characterSection}>
          <SoulECharacter state="idle" size="large" className={styles.soulE} />
          <p className={styles.greeting}>
            대화할 <span>친구</span>를 선택해주세요!
          </p>
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
              <p>등록된 아동이 없습니다.</p>
              <button onClick={handleRefresh} className={styles.refreshButton} type="button">
                새로고침
              </button>
            </div>
          )}

          {/* 아동 목록 */}
          {!childrenLoading && children.length > 0 && (
            <>
              <div className={styles.summary}>
                <span>전체 {children.length}명</span>
                <span className={styles.eligible}>이용 가능 {eligibleCount}명</span>
              </div>

              <div className={styles.grid}>
                {children.map((child: ChildInfo) => {
                  const isSelecting = selectingChild && selectingChildId === child.id;

                  return (
                    <button
                      key={child.id}
                      className={`${styles.card} ${!child.is_eligible ? styles.disabled : ''} ${isSelecting ? styles.selecting : ''}`}
                      onClick={() => handleSelectChild(child)}
                      disabled={!child.is_eligible || selectingChild}
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
                        {!child.is_eligible && (
                          <span className={styles.badge}>9-15세만 이용 가능</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

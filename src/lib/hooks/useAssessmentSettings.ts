'use client';

import { useState, useEffect, useRef } from 'react';
import { settingsApi, type AssessmentEnabledSettings } from '@/lib/api';

// 캐시 관리를 위한 모듈 레벨 변수
let cachedData: AssessmentEnabledSettings | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

/**
 * 검사 활성화 설정을 조회하는 훅
 * 전역 설정이므로 캐시를 길게 유지
 */
export const useAssessmentSettings = () => {
  const [data, setData] = useState<AssessmentEnabledSettings | undefined>(
    cachedData ?? undefined
  );
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // 이미 fetch 중이면 스킵
    if (fetchedRef.current) return;

    // 캐시가 유효하면 사용
    const now = Date.now();
    if (cachedData && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
      setData(cachedData);
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      fetchedRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const result = await settingsApi.getAssessmentEnabledSettings();
        cachedData = result;
        cacheTimestamp = Date.now();
        setData(result);
      } catch (err) {
        console.error('Failed to fetch assessment settings:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        // 에러 시에도 기존 캐시 데이터가 있으면 사용
        if (cachedData) {
          setData(cachedData);
        }
      } finally {
        setIsLoading(false);
        fetchedRef.current = false;
      }
    };

    fetchSettings();
  }, []);

  return { data, isLoading, error };
};

export default useAssessmentSettings;

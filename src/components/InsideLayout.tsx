'use client';

import { type ReactNode, useEffect, useState } from 'react';
import classNames from 'classnames/bind';
import Image from 'next/image';

import styles from './InsideLayout.module.scss';

// Hook to safely access query params on client-side only
const useQueryParams = (param: string) => {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setValue(urlParams.get(param));
  }, [param]);

  return value;
};

interface InsideLayoutProps {
  title?: string;
  children: ReactNode;
  isMiddle?: boolean;
  isIntro?: boolean;
  showBanner?: boolean;
}

export function InsideLayout({
  title,
  children,
  isMiddle,
  isIntro,
  showBanner = true,
}: InsideLayoutProps) {
  const cx = classNames.bind(styles);
  const isTos = useQueryParams('details'); // Use mock for now

  return (
    <div
      className={cx(
        'insideLayout',
        { isMiddle },
        { isIntro },
        { isTos: !!isTos }
      )}>
      {/* 프로젝트 배너 */}
      {showBanner && (
        <div className={cx('projectBanner')}>
          <Image
            src="/yeirin-logo.png"
            alt="예이린"
            width={20}
            height={20}
            className={cx('bannerLogo')}
          />
          <span>AI 기반 아동 마음건강 통합 디지털 플랫폼</span>
        </div>
      )}
      {title && <h1>{title}</h1>}
      {children}
    </div>
  );
}

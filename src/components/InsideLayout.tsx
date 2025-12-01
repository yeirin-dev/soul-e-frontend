'use client';

import { type ReactNode, useEffect, useState } from 'react';
import classNames from 'classnames/bind';

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
}

export function InsideLayout({
  title,
  children,
  isMiddle,
  isIntro,
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
      {title && <h1>{title}</h1>}
      {children}
    </div>
  );
}

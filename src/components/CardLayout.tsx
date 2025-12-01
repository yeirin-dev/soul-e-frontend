import { type ReactNode } from 'react';
import classNames from 'classnames/bind';
import styles from './CardLayout.module.scss';

const cx = classNames.bind(styles);

interface CardLayoutProps {
  children: ReactNode;
}

// 로그인 페이지용 카드 스타일 레이아웃
export function CardLayout({ children }: CardLayoutProps) {
  return (
    <div className={cx('layoutContainer')}>
      <main className={cx('cardContainer')}>
        {children}
      </main>
    </div>
  );
}

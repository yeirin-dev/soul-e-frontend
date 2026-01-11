'use client';

import { ReactNode } from 'react';
import styles from './Tooltip.module.scss';

interface TooltipProps {
  children: ReactNode;
  content: string;
  disabled?: boolean;
}

/**
 * CSS-only Tooltip 컴포넌트
 * hover 시 위쪽에 툴팁이 표시됩니다.
 */
const Tooltip = ({ children, content, disabled = false }: TooltipProps) => {
  return (
    <div className={`${styles.tooltipWrapper} ${disabled ? styles.hasTooltip : ''}`}>
      <div className={disabled ? styles.disabled : ''}>
        {children}
      </div>
      {disabled && (
        <span className={styles.tooltip}>{content}</span>
      )}
    </div>
  );
};

export default Tooltip;

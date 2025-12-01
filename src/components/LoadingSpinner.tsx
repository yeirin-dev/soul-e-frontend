'use client';

import React from 'react';
import styles from './LoadingSpinner.module.scss';

interface LoadingSpinnerProps {
  content?: string;
}

export function LoadingSpinner({ content }: LoadingSpinnerProps) {
  return (
    <div className={styles.loadingStage}>
      <div className={styles.loader} />
      {content && <span className={styles.content}>{content}</span>}
    </div>
  );
}

export default LoadingSpinner;

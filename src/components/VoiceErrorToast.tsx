/**
 * VoiceErrorToast Component
 *
 * 음성 인식 에러 메시지를 토스트 형태로 표시
 * - 에러 발생 시 자동으로 나타남
 * - 3초 후 자동으로 사라짐
 * - 탭하면 즉시 닫기
 */

'use client';

import { useEffect, useState } from 'react';
import styles from '@/styles/modules/VoiceErrorToast.module.scss';

interface VoiceErrorToastProps {
  /** 에러 메시지 */
  error: string | null;
  /** 자동 닫힘 시간 (ms) */
  duration?: number;
}

export function VoiceErrorToast({ error, duration = 4000 }: VoiceErrorToastProps) {
  const [visible, setVisible] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setCurrentError(error);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [error, duration]);

  // 애니메이션 완료 후 에러 메시지 제거
  const handleTransitionEnd = () => {
    if (!visible) {
      setCurrentError(null);
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  if (!currentError) return null;

  return (
    <div
      className={`${styles.toast} ${visible ? styles.visible : styles.hidden}`}
      onClick={handleClose}
      onTransitionEnd={handleTransitionEnd}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.message}>{currentError}</span>
    </div>
  );
}

export default VoiceErrorToast;

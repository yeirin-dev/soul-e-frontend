/**
 * VoiceInputModeToggle Component
 *
 * 음성 입력 모드 토글 - 입력모드 / 통화모드 선택
 * - 입력모드 (PTT): 버튼 눌러서 녹음 → 다시 눌러서 전송
 * - 통화모드 (VAD): 자동 발화 감지
 */

'use client';

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { setVoiceInputMode, type VoiceInputModeType } from '@/lib/store/chatSlice';
import classNames from 'classnames';
import styles from '@/styles/modules/VoiceInputModeToggle.module.scss';

// =============================================================================
// Icons
// =============================================================================

/** 키보드/입력 아이콘 (PTT 모드) */
const InputModeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

/** 전화/통화 아이콘 (VAD 모드) */
const CallModeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// =============================================================================
// Types
// =============================================================================

interface VoiceInputModeToggleProps {
  /** 비활성화 (녹음 중 등) */
  disabled?: boolean;
  /** 추가 className */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function VoiceInputModeToggle({
  disabled = false,
  className,
}: VoiceInputModeToggleProps) {
  const dispatch = useAppDispatch();
  const inputMode = useAppSelector((state) => state.chat.voiceMode.inputMode);

  const handleModeChange = useCallback((mode: VoiceInputModeType) => {
    if (!disabled) {
      dispatch(setVoiceInputMode(mode));
    }
  }, [disabled, dispatch]);

  return (
    <div className={classNames(styles.toggleContainer, className)}>
      <button
        type="button"
        className={classNames(
          styles.toggleButton,
          styles.inputMode,
          { [styles.active]: inputMode === 'input' }
        )}
        onClick={() => handleModeChange('input')}
        disabled={disabled}
        aria-pressed={inputMode === 'input'}
        title="입력모드: 버튼을 눌러 녹음 시작/종료"
      >
        <InputModeIcon />
        <span>입력</span>
      </button>
      <button
        type="button"
        className={classNames(
          styles.toggleButton,
          styles.callMode,
          { [styles.active]: inputMode === 'call' }
        )}
        onClick={() => handleModeChange('call')}
        disabled={disabled}
        aria-pressed={inputMode === 'call'}
        title="통화모드: 자동 음성 감지 (VAD)"
      >
        <CallModeIcon />
        <span>통화</span>
      </button>
    </div>
  );
}

export default VoiceInputModeToggle;

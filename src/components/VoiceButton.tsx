/**
 * VoiceButton Component
 *
 * 음성 입력 버튼 - 상태별 시각적 피드백 제공
 * - idle: 비활성화 상태 (마이크 아이콘)
 * - listening: VAD 활성화, 발화 대기 중
 * - recording: 발화 감지됨, 녹음 중
 * - transcribing: STT 변환 중
 */

'use client';

import { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import styles from '@/styles/modules/VoiceButton.module.scss';

// =============================================================================
// Types
// =============================================================================

interface VoiceButtonProps {
  /** 청취 중 (VAD 활성화) */
  isListening: boolean;
  /** 녹음 중 (발화 감지됨) */
  isRecording: boolean;
  /** STT 변환 중 */
  isTranscribing: boolean;
  /** VAD 로딩 중 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 버튼 비활성화 */
  disabled?: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 추가 className */
  className?: string;
}

// =============================================================================
// Icons
// =============================================================================

/** 마이크 아이콘 */
const MicrophoneIcon = () => (
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

/** 중지 아이콘 */
const StopIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

/** 로딩 아이콘 */
const LoadingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/** 에러 아이콘 */
const ErrorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

// =============================================================================
// Component
// =============================================================================

export function VoiceButton({
  isListening,
  isRecording,
  isTranscribing,
  isLoading,
  error,
  disabled = false,
  onClick,
  className,
}: VoiceButtonProps) {
  // 상태에 따른 아이콘 선택
  const icon = useMemo(() => {
    if (isLoading || isTranscribing) return <LoadingIcon />;
    if (error) return <ErrorIcon />;
    if (isRecording) return <StopIcon />;
    return <MicrophoneIcon />;
  }, [isLoading, isTranscribing, error, isRecording]);

  // 상태에 따른 텍스트
  const statusText = useMemo(() => {
    if (isLoading) return '준비 중...';
    if (isTranscribing) return '변환 중...';
    if (isRecording) return '말씀하세요';
    if (isListening) return '듣고 있어요';
    if (error) return error;
    return '음성 입력';
  }, [isLoading, isTranscribing, isRecording, isListening, error]);

  // 버튼 클래스
  const buttonClass = classNames(
    styles.voiceButton,
    {
      [styles.listening]: isListening && !isRecording && !isTranscribing,
      [styles.recording]: isRecording,
      [styles.transcribing]: isTranscribing,
      [styles.loading]: isLoading,
      [styles.error]: !!error && !isListening && !isRecording && !isTranscribing,
    },
    className
  );

  // 상태 텍스트 클래스
  const statusClass = classNames(styles.statusText, {
    [styles.errorText]: !!error && !isListening && !isRecording && !isTranscribing,
  });

  // 클릭 핸들러
  const handleClick = useCallback(() => {
    if (!disabled && !isLoading && !isTranscribing) {
      onClick();
    }
  }, [disabled, isLoading, isTranscribing, onClick]);

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={statusText}
      title={statusText}
    >
      {icon}
      <span className={statusClass}>{statusText}</span>
    </button>
  );
}

export default VoiceButton;

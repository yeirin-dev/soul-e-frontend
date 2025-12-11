/**
 * MuteButton Component
 *
 * TTS 음소거 토글 버튼 - 헤더에 배치
 * - 음소거 상태 시각적 표시
 * - 재생 중/로딩 중 상태 표시
 */

'use client';

import { useMemo } from 'react';
import styles from '@/styles/modules/MuteButton.module.scss';

// =============================================================================
// Types
// =============================================================================

interface MuteButtonProps {
  /** 음소거 상태 */
  isMuted: boolean;
  /** 재생 중인지 */
  isPlaying: boolean;
  /** TTS 로딩 중인지 */
  isLoading: boolean;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 추가 className */
  className?: string;
}

// =============================================================================
// Icons
// =============================================================================

/** 스피커 아이콘 (음소거 해제 상태) */
const SpeakerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

/** 음소거 아이콘 */
const MutedIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" x2="17" y1="9" y2="15" />
    <line x1="17" x2="23" y1="9" y2="15" />
  </svg>
);

/** 재생 중 아이콘 (애니메이션) */
const PlayingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
    className={styles.playingAnimation}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" className={styles.wave1} />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" className={styles.wave2} />
  </svg>
);

// =============================================================================
// Component
// =============================================================================

export function MuteButton({
  isMuted,
  isPlaying,
  isLoading,
  onClick,
  className,
}: MuteButtonProps) {
  // 상태에 따른 아이콘 선택
  const icon = useMemo(() => {
    if (isMuted) return <MutedIcon />;
    if (isPlaying || isLoading) return <PlayingIcon />;
    return <SpeakerIcon />;
  }, [isMuted, isPlaying, isLoading]);

  // 상태에 따른 툴팁
  const tooltip = useMemo(() => {
    if (isMuted) return '소리 켜기';
    if (isPlaying) return '재생 중...';
    if (isLoading) return '변환 중...';
    return '소리 끄기';
  }, [isMuted, isPlaying, isLoading]);

  // 버튼 클래스
  const buttonClasses = [
    styles.muteButton,
    isMuted && styles.muted,
    isPlaying && !isMuted && styles.playing,
    isLoading && styles.loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={onClick}
      aria-label={tooltip}
      title={tooltip}
    >
      {icon}
    </button>
  );
}

export default MuteButton;

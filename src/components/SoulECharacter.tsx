'use client';

import React from 'react';
import Image from 'next/image';
import styles from './SoulECharacter.module.scss';
import { ImgGreeting, ImgMoving, ImgStop, ImgSide } from '@/assets';

export type SoulEState = 'greeting' | 'thinking' | 'idle' | 'avatar';

interface SoulECharacterProps {
  state?: SoulEState;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
}

const stateImages = {
  greeting: ImgGreeting,
  thinking: ImgMoving,
  idle: ImgStop,
  avatar: ImgSide,
};

const sizeMap = {
  small: { width: 48, height: 48 },
  medium: { width: 80, height: 80 },
  large: { width: 160, height: 160 },
};

export function SoulECharacter({
  state = 'idle',
  size = 'medium',
  showLabel = false,
  className = '',
}: SoulECharacterProps) {
  const imageSrc = stateImages[state];
  const dimensions = sizeMap[size];

  return (
    <figure className={`${styles.container} ${styles[size]} ${className}`}>
      <div className={styles.imageWrapper}>
        <Image
          src={imageSrc}
          alt="소울이"
          width={dimensions.width}
          height={dimensions.height}
          unoptimized={state === 'greeting' || state === 'thinking'} // GIF는 최적화 비활성화
          priority
        />
      </div>
      {showLabel && <figcaption className={styles.label}>소울이</figcaption>}
    </figure>
  );
}

export default SoulECharacter;

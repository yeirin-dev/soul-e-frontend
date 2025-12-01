'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Lottie를 동적 import로 불러오기 (SSR 비활성화)
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Lottie JSON 데이터
import WaveLottie from '@/assets/icons/lottie_wave.json';

interface WaveAnimationProps {
  className?: string;
  size?: number;
}

export function WaveAnimation({ className = '', size = 48 }: WaveAnimationProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <Lottie animationData={WaveLottie} loop autoplay />
    </div>
  );
}

export default WaveAnimation;

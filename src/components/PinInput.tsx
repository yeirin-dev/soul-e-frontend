'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import styles from './PinInput.module.scss';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export function PinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
}: PinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 자동 포커스 - value가 비어있을 때 첫 칸으로
  useEffect(() => {
    if (autoFocus) {
      // value 길이에 따라 포커스할 위치 결정
      const focusIndex = Math.min(value.length, 3);
      const targetInput = value.length === 0 ? inputRefs.current[0] : inputRefs.current[focusIndex];
      if (targetInput) {
        targetInput.focus();
      }
    }
  }, [autoFocus, value.length === 0]); // value가 완전히 비워질 때만 재실행

  // PIN 완성 시 콜백 호출
  useEffect(() => {
    if (value.length === 4 && onComplete) {
      onComplete(value);
    }
  }, [value, onComplete]);

  const handleChange = useCallback((index: number, inputValue: string) => {
    // 숫자만 허용
    const numericValue = inputValue.replace(/\D/g, '');

    if (numericValue.length === 0) {
      // 삭제된 경우
      const newValue = value.slice(0, index) + value.slice(index + 1);
      onChange(newValue);
      return;
    }

    // 첫 번째 숫자만 사용
    const digit = numericValue[0];
    const newValue = value.slice(0, index) + digit + value.slice(index + 1);
    onChange(newValue.slice(0, 4));

    // 다음 입력칸으로 포커스 이동
    if (index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [value, onChange]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // 현재 칸이 비어있으면 이전 칸으로 이동하고 삭제
        inputRefs.current[index - 1]?.focus();
        const newValue = value.slice(0, index - 1) + value.slice(index);
        onChange(newValue);
        e.preventDefault();
      } else if (value[index]) {
        // 현재 칸에 값이 있으면 삭제
        const newValue = value.slice(0, index) + value.slice(index + 1);
        onChange(newValue);
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [value, onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const numericValue = pastedData.replace(/\D/g, '').slice(0, 4);
    onChange(numericValue);

    // 마지막 입력된 위치로 포커스
    const focusIndex = Math.min(numericValue.length, 3);
    inputRefs.current[focusIndex]?.focus();
  }, [onChange]);

  return (
    <div className={`${styles.container} ${error ? styles.error : ''} ${disabled ? styles.disabled : ''}`}>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={styles.inputWrapper}>
          <input
            ref={(el) => { inputRefs.current[index] = el; }}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`${styles.input} ${value[index] ? styles.filled : ''}`}
            aria-label={`PIN ${index + 1}번째 숫자`}
            autoComplete="off"
          />
          <div className={styles.dot} />
        </div>
      ))}
    </div>
  );
}

export default PinInput;

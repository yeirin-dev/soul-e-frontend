'use client';

import React, { useEffect, useCallback } from 'react';
import classNames from 'classnames/bind';
import styles from './Modal.module.scss';

const cx = classNames.bind(styles);

interface ModalProps {
  isOpen: boolean;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  preventClose?: boolean;
}

export function Modal({
  isOpen,
  title,
  children,
  onClose,
  showCloseButton = true,
  preventClose = false,
}: ModalProps) {
  const handleBackdropClick = useCallback(() => {
    if (!preventClose && onClose) {
      onClose();
    }
  }, [preventClose, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose && onClose) {
        onClose();
      }
    },
    [preventClose, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className={cx('modalOverlay')} onClick={handleBackdropClick}>
      <div className={cx('modalContent')} onClick={(e) => e.stopPropagation()}>
        {(title || showCloseButton) && (
          <div className={cx('modalHeader')}>
            {title && <h2 className={cx('modalTitle')}>{title}</h2>}
            {showCloseButton && !preventClose && onClose && (
              <button
                type="button"
                className={cx('closeButton')}
                onClick={onClose}
                aria-label="닫기"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={cx('modalBody')}>{children}</div>
      </div>
    </div>
  );
}

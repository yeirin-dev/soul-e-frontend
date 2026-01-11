'use client';

import React, { useState } from 'react';
import classNames from 'classnames/bind';
import { Modal } from './Modal';
import { InputField } from './InputField';
import { Button } from './Button';
import { authApi } from '@/lib/api';
import styles from './ChangePasswordModal.module.scss';

const cx = classNames.bind(styles);

interface ChangePasswordModalProps {
  isOpen: boolean;
  onPasswordChanged: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onPasswordChanged,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    currentPassword.length >= 4 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      await authApi.changeInstitutionPassword(currentPassword, newPassword);
      onPasswordChanged();
    } catch (err: any) {
      setError(err.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordError = () => {
    if (newPassword && newPassword.length < 8) {
      return '비밀번호는 8자 이상이어야 합니다';
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return '비밀번호가 일치하지 않습니다';
    }
    return error || '';
  };

  return (
    <Modal
      isOpen={isOpen}
      title="비밀번호 변경"
      preventClose
      showCloseButton={false}
    >
      <form className={cx('form')} onSubmit={handleSubmit}>
        <p className={cx('description')}>
          첫 로그인입니다. 보안을 위해 비밀번호를 변경해주세요.
        </p>

        <div className={cx('inputGroup')}>
          <InputField
            id="currentPassword"
            type="password"
            placeholder="현재 비밀번호를 입력해주세요"
            labelContent="현재 비밀번호"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <InputField
            id="newPassword"
            type="password"
            placeholder="새 비밀번호를 입력해주세요 (8자 이상)"
            labelContent="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <InputField
            id="confirmPassword"
            type="password"
            placeholder="새 비밀번호를 다시 입력해주세요"
            labelContent="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            errMsg={getPasswordError()}
          />
        </div>

        <Button
          submit
          content="비밀번호 변경"
          disabled={!isValid}
          isLoading={loading}
        />
      </form>
    </Modal>
  );
}

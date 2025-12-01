'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { loginTeacher } from '@/lib/store/authSlice';
import { Button } from '@/components/Button';
import { InputField } from '@/components/InputField';
import { InsideLayout } from '@/components/InsideLayout';
import { SoulECharacter } from '@/components/SoulECharacter';
import styles from '@/styles/modules/AuthPage.module.scss';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const { loading, error } = useAppSelector((state) => state.auth);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isEmailValid || !isPasswordValid || loading) return;

    const result = await dispatch(loginTeacher({ email, password }));
    if (loginTeacher.fulfilled.match(result)) {
      router.push('/children');
    }
  };

  return (
    <InsideLayout title={`안녕하세요!\n선생님 로그인을 해주세요 !`}>
      <form className={styles.authSection} onSubmit={handleSubmit}>
        <div className={styles.characterContainer}>
          <SoulECharacter state="greeting" size="large" className={styles.soulE} />
        </div>

        <div className={styles.formContainer}>
          <InputField
            id="email"
            placeholder="이메일을 입력해주세요"
            labelContent="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            onValidityChange={setIsEmailValid}
            minLength={5}
            pattern={/^[^@ ]+@[^@ ]+.[^@ ]+$/}
          />
          
          <InputField
            id="password"
            type="password"
            placeholder="비밀번호를 입력해주세요"
            labelContent="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onValidityChange={setIsPasswordValid}
            minLength={4}
            errMsg={error || ''}
          />
        </div>
        
        <Button
          submit
          content="로그인"
          disabled={!isEmailValid || !isPasswordValid || loading}
          isLoading={loading}
        />
      </form>
    </InsideLayout>
  );
}
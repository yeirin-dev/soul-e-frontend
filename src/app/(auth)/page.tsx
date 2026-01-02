'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { loginInstitution, setPasswordChanged } from '@/lib/store/authSlice';
import { authApi } from '@/lib/api';
import { Button } from '@/components/Button';
import { InputField } from '@/components/InputField';
import { Select } from '@/components/Select';
import { InsideLayout } from '@/components/InsideLayout';
import { SoulECharacter } from '@/components/SoulECharacter';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import type { DistrictFacility, InstitutionType } from '@/types/api';
import styles from '@/styles/modules/AuthPage.module.scss';

export default function AuthPage() {
  // 구/군 선택 상태
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtsLoading, setDistrictsLoading] = useState(true);

  // 시설 선택 상태
  const [facilities, setFacilities] = useState<DistrictFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);

  // 비밀번호 입력 상태
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  // 비밀번호 변경 모달
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const { loading, error, isPasswordChanged } = useAppSelector((state) => state.auth);

  // 선택된 시설 정보
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);

  // 구/군 목록 로드
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const data = await authApi.getDistricts();
        setDistricts(data);
      } catch (err) {
        console.error('구/군 목록 로드 실패:', err);
      } finally {
        setDistrictsLoading(false);
      }
    };
    fetchDistricts();
  }, []);

  // 구/군 선택 시 시설 목록 로드
  useEffect(() => {
    if (!selectedDistrict) {
      setFacilities([]);
      setSelectedFacilityId('');
      return;
    }

    const fetchFacilities = async () => {
      setFacilitiesLoading(true);
      setSelectedFacilityId('');
      try {
        const data = await authApi.getFacilities(selectedDistrict);
        setFacilities(data);
      } catch (err) {
        console.error('시설 목록 로드 실패:', err);
        setFacilities([]);
      } finally {
        setFacilitiesLoading(false);
      }
    };
    fetchFacilities();
  }, [selectedDistrict]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedFacilityId || !selectedFacility || !isPasswordValid || loading) return;

    const result = await dispatch(
      loginInstitution({
        facilityId: selectedFacilityId,
        facilityType: selectedFacility.facilityType as InstitutionType,
        password,
      })
    );

    if (loginInstitution.fulfilled.match(result)) {
      // 첫 로그인 시 비밀번호 변경 모달 표시
      if (!result.payload.institution.isPasswordChanged) {
        setShowPasswordModal(true);
      } else {
        router.push('/children');
      }
    }
  };

  const handlePasswordChanged = () => {
    dispatch(setPasswordChanged(true));
    setShowPasswordModal(false);
    router.push('/children');
  };

  const districtOptions = districts.map((d) => ({ value: d, label: d }));
  const facilityOptions = facilities.map((f) => ({
    value: f.id,
    label: `${f.name} (${f.facilityType === 'CARE_FACILITY' ? '양육시설' : '지역아동센터'})`,
  }));

  const isFormValid = selectedDistrict && selectedFacilityId && isPasswordValid;

  return (
    <>
      <InsideLayout title={`안녕하세요!\n시설 로그인을 해주세요!`}>
        <form className={styles.authSection} onSubmit={handleSubmit}>
          <div className={styles.characterContainer}>
            <SoulECharacter state="greeting" size="large" className={styles.soulE} />
          </div>

          <div className={styles.formContainer}>
            <Select
              id="district"
              placeholder="구/군을 선택해주세요"
              labelContent="구/군"
              value={selectedDistrict}
              options={districtOptions}
              loading={districtsLoading}
              onChange={setSelectedDistrict}
            />

            <Select
              id="facility"
              placeholder="시설을 선택해주세요"
              labelContent="시설"
              value={selectedFacilityId}
              options={facilityOptions}
              disabled={!selectedDistrict}
              loading={facilitiesLoading}
              onChange={setSelectedFacilityId}
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
            disabled={!isFormValid || loading}
            isLoading={loading}
          />
        </form>
      </InsideLayout>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onPasswordChanged={handlePasswordChanged}
      />
    </>
  );
}

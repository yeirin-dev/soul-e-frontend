import type { Metadata } from 'next';
import StoreProvider from '../StoreProvider';

export const metadata: Metadata = {
  title: '예이린 특별 검사 시스템',
  description: '연령 제한 우회 KPRC 심리검사',
};

export default function SpecialAssessmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StoreProvider>{children}</StoreProvider>;
}

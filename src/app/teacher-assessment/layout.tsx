import type { Metadata } from 'next';
import StoreProvider from '../StoreProvider';

export const metadata: Metadata = {
  title: '예이린 교사 평정용 검사 시스템',
  description: 'KPRC 초등 저학년 교사평정용 심리검사',
};

export default function TeacherAssessmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <StoreProvider>{children}</StoreProvider>;
}

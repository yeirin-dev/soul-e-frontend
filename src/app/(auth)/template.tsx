import { CardLayout } from '@/components/CardLayout';

// 로그인 페이지용 카드 스타일 레이아웃
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <CardLayout>{children}</CardLayout>;
}

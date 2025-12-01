import type { Metadata } from 'next';
import './globals.css';
import '@/styles/index.scss';
import StoreProvider from './StoreProvider';

export const metadata: Metadata = {
  title: 'Soul-E',
  description: 'AI Counseling Chatbot',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
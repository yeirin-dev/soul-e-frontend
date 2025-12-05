# Soul-E Frontend

아동 심리 상담 AI 챗봇 **소울이(Soul-E)**의 프론트엔드 애플리케이션입니다.

## 프로젝트 개요

Soul-E는 9-15세 아동을 대상으로 한 AI 기반 심리 상담 서비스입니다. 교사/보호자가 로그인하여 담당 아동을 선택하면, 아동이 PIN 번호로 인증 후 소울이 캐릭터와 대화할 수 있습니다.

### 주요 기능

- **교사/보호자 인증**: 예이린 백엔드를 통한 로그인
- **아동 선택**: 담당 아동 목록에서 대화할 아동 선택
- **PIN 인증**: 아동 프라이버시 보호를 위한 4자리 PIN 시스템
- **AI 채팅**: 소울이 캐릭터와 실시간 스트리밍 대화
- **심리 평가**: KPRC 기반 심리검사 진행 및 결과 확인

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **State Management**: Redux Toolkit
- **Styling**: SCSS Modules + Tailwind CSS
- **Animation**: Lottie React
- **HTTP Client**: Axios

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── (auth)/            # 로그인 페이지
│   ├── children/          # 아동 선택 페이지
│   ├── pin/
│   │   ├── setup/         # PIN 최초 설정
│   │   └── verify/        # PIN 인증
│   ├── chat/              # 채팅 페이지
│   └── assessment/        # 심리 평가 페이지
├── components/            # 재사용 컴포넌트
│   ├── SoulECharacter     # 소울이 캐릭터 애니메이션
│   ├── ChatBubble         # 채팅 말풍선
│   ├── PinInput           # PIN 입력 컴포넌트
│   ├── WaveAnimation      # 음성 웨이브 애니메이션
│   └── ...
├── lib/
│   ├── api/               # API 클라이언트
│   │   ├── clients.ts     # Axios 인스턴스 및 토큰 관리
│   │   ├── index.ts       # Auth, Chat, Session API
│   │   └── assessment.ts  # 심리평가 API
│   ├── store/             # Redux 스토어
│   │   ├── authSlice.ts   # 인증 상태
│   │   └── chatSlice.ts   # 채팅 상태
│   └── hooks/             # 커스텀 훅
├── styles/                # SCSS 스타일
│   ├── _color.scss        # 색상 변수
│   ├── _typography.scss   # 타이포그래피
│   ├── _animation.scss    # 애니메이션
│   └── modules/           # 페이지별 스타일
├── types/                 # TypeScript 타입 정의
└── assets/                # 이미지, 아이콘, 오디오
```

## 시작하기

### 환경 요구사항

- Node.js 20+
- pnpm (권장) 또는 npm

### 설치

```bash
pnpm install
```

### 환경 변수

`.env.local` 파일을 생성하고 다음 변수를 설정합니다:

```env
# Soul-E AI 백엔드 (FastAPI)
NEXT_PUBLIC_SOUL_BACKEND_URL=http://localhost:8000

# Yeirin 메인 백엔드 (NestJS) - 프록시로 처리됨
# NEXT_PUBLIC_YEIRIN_BACKEND_URL=http://localhost:3000
```

### 개발 서버 실행

```bash
pnpm dev
```

[http://localhost:3001](http://localhost:3001)에서 확인할 수 있습니다.

### 빌드

```bash
pnpm build
pnpm start
```

## 아키텍처

### MSA 백엔드 연동

Soul-E 프론트엔드는 두 개의 백엔드 서버와 통신합니다:

```
┌─────────────────┐     ┌──────────────────────────────────┐
│   Soul-E        │     │  Yeirin Backend (NestJS)         │
│   Frontend      │────▶│  Port 3000                       │
│   Port 3001     │     │  - 로그인/회원가입               │
│                 │     │  - yeirin_token 발급             │
└────────┬────────┘     └──────────────────────────────────┘
         │
         │              ┌──────────────────────────────────┐
         └─────────────▶│  Soul-E Backend (FastAPI)        │
                        │  Port 8000                       │
                        │  - 사용자/아동 정보 조회         │
                        │  - LLM 채팅 (SSE 스트리밍)       │
                        │  - PIN 관리                      │
                        │  - 심리평가                      │
                        │  - child_session_token 발급      │
                        └──────────────────────────────────┘
```

### 인증 흐름

```
1. 로그인 → Yeirin (3000) → yeirin_token
2. 아동 목록 조회 → Soul-E (8000) with yeirin_token
3. 아동 선택 → PIN 설정/인증 → child_session_token
4. 채팅/평가 → Soul-E (8000) with child_session_token
```

### 토큰 관리

- **yeirin_token**: 교사/보호자 인증 토큰
- **child_session_token**: 아동 채팅 세션 토큰
  - 만료 5분 전 자동 갱신 (Silent Refresh)
  - 401 에러 시 자동 재시도

## 주요 컴포넌트

### SoulECharacter

소울이 캐릭터 애니메이션 컴포넌트

```tsx
<SoulECharacter
  state="greeting" | "thinking" | "idle" | "avatar"
  size="small" | "medium" | "large"
/>
```

### PinInput

4자리 PIN 입력 컴포넌트

```tsx
<PinInput
  value={pin}
  onChange={setPin}
  onComplete={(pin) => handleVerify(pin)}
  error={hasError}
  disabled={isLoading}
/>
```

### ChatBubble

채팅 메시지 말풍선

```tsx
<ChatBubble
  message="안녕하세요!"
  isUser={false}
  isStreaming={true}
/>
```

## 스타일 가이드

### 색상 시스템

```scss
// 메인 컬러 (오렌지)
$main100: #FFA600;  // Primary
$main200: #FFBF00;
$main300: #FFD966;
$main400: #FFF4CC;  // Background

// 서브 컬러 (민트)
$sub100: #00C9A7;
$sub200: #7FDDCD;

// 그레이스케일
$gray700: #333333;  // Text primary
$gray600: #666666;  // Text secondary
$gray500: #999999;
$gray400: #CCCCCC;
$gray300: #E5E5E5;
$gray200: #F5F5F5;
```

### 반응형 브레이크포인트

```scss
// 모바일
@media (max-width: 640px) { ... }

// 태블릿
@media (max-width: 1024px) { ... }

// 데스크톱 (기본)
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 실행 (Port 3001) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 실행 |
| `pnpm lint` | ESLint 검사 |

## 관련 문서

- [Yeirin 프로젝트 메인](../../README.md)
- [Soul-E Backend API 문서](../../backend/soul-e/README.md)
- [Yeirin Backend API 문서](../../backend/yeirin/README.md)

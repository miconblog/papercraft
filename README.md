# ideas

추억의 종이 보드게임을 되살려, 원하는 크기로 인쇄할 수 있는 사이트.

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인한다.

## 스크립트

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format        # Prettier로 포맷
npm run format:check  # 포맷 검사만
npm run build          # 프로덕션 빌드
```

## 스택

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS

## 디렉터리 구조

```
src/
  app/         # 라우트·페이지 (App Router)
  components/  # 공용 UI 컴포넌트
  lib/         # 공용 로직·유틸
  assets/games/  # 게임 도안 원본·벡터 자산
```

## 이슈 관리

작업 단위와 진행 상황은 [issues/](issues/)에서 관리한다. 전체 현황은
[issues/BOARD.md](issues/BOARD.md), 운영 규칙은 [issues/README.md](issues/README.md)를 본다.

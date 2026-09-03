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
npm run typecheck     # next typegen 실행 후 tsc --noEmit
npm run test          # Vitest — watch 모드
npm run test:run      # Vitest — 1회 실행(CI용)
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
  app/           # 라우트·페이지 (App Router)
  components/    # 공용 UI 컴포넌트
  lib/           # 공용 로직·유틸
    schema/      # 도안 데이터 모델과 검증
    games/       # 게임 등록소
  assets/games/  # 게임 도안 원본·벡터 자산
docs/            # 규격 문서
spikes/          # 기술 검증용 도구. 제품 코드가 아니다
public/games/    # 게임별 정적 자산(썸네일·SVG)
```

## 도안 작성

게임 도안의 데이터 모델과 규격은 [docs/game-authoring.md](docs/game-authoring.md)에
있다. 새 게임을 추가하는 3단계 절차도 거기 있다.

## 인쇄 규격

이 제품은 "종이에 원하는 치수로 정확히 나온다"가 핵심이라, 인쇄 산출 규격을 따로
문서로 고정해 두었다 — [docs/print-spec.md](docs/print-spec.md). 배율·타일 분할·
오림선 표기·한글 폰트 처리가 여기 있고, 그 근거가 된 검증 도구와 종이 실측 절차는
[spikes/print-pipeline/](spikes/print-pipeline/README.md)에 있다.

## CI·배포

- **CI** — `.github/workflows/ci.yml`이 PR과 `main` 푸시마다 lint·typecheck·test·build를
  순서대로 돌린다. 하나라도 실패하면 체크가 빨간불이 된다.
- **배포 대상** — [Vercel](https://vercel.com). Next.js 제작사가 직접 운영하는
  호스팅이라 별도 설정 없이 App Router·이미지 최적화가 그대로 동작하고, PR마다
  프리뷰 배포가 자동으로 붙는다.
- **연결 방법(최초 1회, 저장소 관리자가 직접)**:
  1. [vercel.com/new](https://vercel.com/new)에서 GitHub 계정으로 로그인
  2. `miconblog/papercraft` 저장소를 Import — 이 계정 로그인은 사람이 브라우저로 직접
     해야 하는 단계라 에이전트가 대신할 수 없다
  3. 빌드 설정은 기본값(Next.js 프리셋) 그대로 사용
  4. Import를 마치면 이후 `main` 푸시가 자동으로 프로덕션 배포로, PR이 자동으로
     프리뷰 배포로 이어진다 — 추가 설정 불필요

## 기여 절차

1. `main`에서 새 브랜치를 만든다 (`main`에 직접 커밋하지 않는다)
2. 변경 후 `npm run lint` · `npm run typecheck` · `npm run test:run`이 모두
   통과하는지 로컬에서 먼저 확인한다
3. PR을 올린다 — CI(lint·typecheck·test·build)가 통과해야 머지할 수 있다
4. 도안(게임 스키마) 파일을 건드렸다면 `npm run test:run`이 스키마 검증까지 돌린다 —
   등록된 도안은 테스트가 등록소를 읽는 순간 검증되므로 별도 CI 단계가 필요 없다

### 브랜치 보호

`main`은 다음이 설정되어 있어야 한다(저장소 Settings → Branches):

- PR을 통해서만 머지 가능 (직접 push 금지)
- CI 체크(`Lint · Typecheck · Test`)가 통과해야 머지 가능

## 이슈 관리

작업 단위와 진행 상황은 [issues/](issues/)에서 관리한다. 전체 현황은
[issues/BOARD.md](issues/BOARD.md), 운영 규칙은 [issues/README.md](issues/README.md)를 본다.

# IDE-008 · CI·배포 파이프라인과 테스트 기반

| 항목        | 값         |
| ----------- | ---------- |
| 상태        | `blocked`  |
| 영역        | infra      |
| 우선순위    | P1         |
| 마일스톤    | M1         |
| 추정        | 3d         |
| 추천 모델   | Sonnet 5   |
| 추천 Effort | low–medium |
| 선행        | `IDE-001`  |
| 후행        | —          |

## 배경

현재 저장소도 CI도 없다. 특히 도안과 인쇄는 회귀가 눈에 잘 안 띄는 영역이다 —
좌표가 조금 어긋나거나 슬롯 하나가 빠져도 화면에서는 멀쩡해 보이고 출력해야 안다.
자동 검사가 없으면 조용히 깨진 채로 배포된다.

## 할 일

- [x] 테스트 러너 도입과 첫 테스트 — Vitest + React Testing Library 도입, 홈페이지 h1 렌더링 스모크 테스트 1건 작성·통과
- [x] CI 워크플로 — 린트 · 타입체크 · 테스트를 PR마다 실행 — `.github/workflows/ci.yml`(lint→typecheck→test→build)을 실제 PR과 main 푸시로 GitHub Actions에서 실행해 통과·실패 둘 다 확인
- [⚠︎] 배포 대상 결정과 연결, 프리뷰 배포 활성화 — 대상은 **Vercel로 확정**(README에 근거 기록). 단 GitHub 저장소를 Vercel에 Import하는 최초 1회 로그인은 사람이 브라우저로 직접 해야 하는 단계라 에이전트가 대신할 수 없음 — README에 연결 절차 문서화, 실제 연결은 저장소 관리자 대기
- [ ] 도안 스키마 검증을 CI에서 실행 — 깨진 도안이 머지되지 않게 — **`IDE-003`(도안 스키마 규격)이 아직 `todo`라 검증 대상 스키마 자체가 없음.** IDE-003 완료 후 착수
- [⚠︎] 브랜치 보호와 기여 절차를 README에 기록 — 기여 절차는 README에 작성 완료. 브랜치 보호(PR 필수 + CI 통과 필수) 자체는 GitHub API 호출(`gh api repos/.../branches/main/protection`)이 Claude Code 권한 분류기에서 차단되어 미적용 — 저장소 관리자가 GitHub 웹 UI(Settings → Branches)에서 직접 설정하거나 Bash 권한 규칙 추가 필요

## 수용 기준

- [⚠︎] PR을 올리면 린트·타입체크·테스트가 자동 실행되고 실패 시 머지가 막힌다 — 자동 실행과 실패 감지는 실제 PR로 검증 완료. "실패 시 머지가 막힌다"는 브랜치 보호 미설정으로 아직 강제되지 않음
- [ ] main 머지가 배포로 이어진다 — Vercel 연결(사용자의 최초 로그인) 대기 중이라 미충족
- [ ] 스키마가 깨진 도안을 넣은 PR이 CI에서 실패한다 — `IDE-003` 완료(스키마 정의) 후에나 검증 가능

## 결정 기록

- 2026-09-03 · 테스트 러너로 Vitest + React Testing Library 채택(Next.js 공식 가이드
  `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` 확인 후 결정). Node
  24 환경과 맞추기 위해 `@types/node`를 `^20`에서 `^24`로 올려 peer dependency 충돌 해소.
  `typecheck` 스크립트는 `next typegen && tsc --noEmit`으로 변경 — `.next` 빌드 산출물이
  없는 클린 체크아웃(CI 등)에서도 라우트 타입(`LayoutProps` 등)을 먼저 만들어야 타입체크가
  통과함을 확인.
- 2026-09-03 · GitHub 저장소를 새로 생성해 연결(`github.com/miconblog/ideas`, private).
  이전에는 로컬 git 저장소만 있고 원격이 없었다 — 사용자 확인 후 지금 만들어 연결하기로
  결정.
- 2026-09-03 · CI 워크플로(`.github/workflows/ci.yml`)를 실제로 push/PR에 태워 검증.
  main 푸시에서 lint·typecheck·test·build 전부 통과 확인. 이어서 타입 오류를 일부러 넣은
  임시 브랜치로 PR을 올려 CI가 실제로 실패하는 것도 확인한 뒤 임시 PR·브랜치는 정리(삭제)함.
- 2026-09-03 · 배포 대상을 Vercel로 결정 — Next.js 제작사가 직접 운영해 App
  Router·이미지 최적화가 별도 설정 없이 동작하고, PR 프리뷰 배포가 기본 제공된다.
  단 GitHub Import는 사람의 브라우저 로그인이 필요한 1회성 수동 단계라 이번 세션에서는
  연결까지 끝내지 못했다 — 절차를 README에 남기고 저장소 관리자의 실행을 기다린다.
- 2026-09-03 · 브랜치 보호(`gh api repos/miconblog/ideas/branches/main/protection`)를
  두 번 시도했으나 Claude Code 권한 분류기가 "되돌리기 어려운 외부 설정 변경"으로 판단해
  차단(대화 중 승인만으로는 우회되지 않고 설정 파일에 Bash 권한 규칙이 있어야 함을 확인).
  기능 자체(README 문서화, CI 워크플로, 테스트)는 모두 완료됐고 이 설정 적용만 남아 있어
  `blocked`로 둔다.
- 2026-09-03 · `도안 스키마 검증` 항목은 `IDE-003`이 아직 `todo`라 착수하지 않음(다른
  이슈로 이관이 아니라 선행 완료 대기). `IDE-003` 완료 후 재개.
- 2026-09-03 · 수용 기준 3개 중 완전히 충족된 것이 없어(부분 충족 1건, 대기 2건)
  `review`로 전환하지 않고 `blocked` 유지. 기다리는 것: ① 저장소 관리자의 GitHub 브랜치
  보호 설정(또는 Bash 권한 규칙 추가) ② 저장소 관리자의 Vercel 계정 연결(1회 로그인)
  ③ `IDE-003` 완료(도안 스키마 확정).
- 2026-09-03 · 사용자가 브랜치 보호를 설정했다고 알려와 재확인했으나
  `gh api repos/miconblog/ideas/branches/main/protection`이 `protected: false`를
  반환 — 실제로는 미적용 상태였다. 원인은 **GitHub 무료 플랜에서는 private 저장소에
  브랜치 보호(클래식 protection·신규 rulesets 모두)를 걸 수 없음**("Upgrade to GitHub
  Pro or make this repository public" 403). 저장소를 public으로 바꾸거나 Pro/Team
  플랜으로 올려야 이 항목을 실제로 만족시킬 수 있다 — 아직 결정되지 않아 `blocked` 유지.
- 2026-09-03 · GitHub 저장소 이름을 `ideas`에서 `papercraft`로 변경
  (`github.com/miconblog/papercraft`, `gh repo rename`). 로컬 `origin` remote URL도
  갱신. 옛 URL은 GitHub가 자동으로 리다이렉트하지만 README의 Vercel Import 안내는
  새 이름으로 갱신했다.

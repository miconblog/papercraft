# IDE-001 · Next.js 저장소 부트스트랩

| 항목        | 값                                |
| ----------- | --------------------------------- |
| 상태        | `doing`                           |
| 영역        | infra                             |
| 우선순위    | P0                                |
| 마일스톤    | M0                                |
| 추정        | 2d                                |
| 추천 모델   | Sonnet 5                          |
| 추천 Effort | medium                            |
| 선행        | —                                 |
| 후행        | `IDE-002` · `IDE-003` · `IDE-008` |

## 배경

현재 저장소에는 `issues/README.md`와 `issues/BOARD.md` 두 파일뿐이고 git 저장소도
아니다. 스택은 Next.js로 정해졌다(2026-09-03). 나머지 모든 이슈가 "돌아가는
코드베이스"를 전제하므로 이것이 가장 먼저다.

## 할 일

- [x] `git init` · `.gitignore` 작성 · 첫 커밋 — `main` 브랜치로 초기화, create-next-app 기본 `.gitignore` 채택, 첫 커밋 완료
- [x] Next.js(App Router) + TypeScript 프로젝트 생성 — `create-next-app` (Next 16.3.4 · React 19.2.8 · App Router · `src/` 디렉터리)로 생성
- [x] 스타일링 방식 결정 및 설정 — Tailwind CSS v4로 확정(`create-next-app --tailwind`), `postcss.config.mjs`에 설정됨
- [x] ESLint · Prettier · 타입체크 스크립트 정리 — `npm run lint` / `format` / `format:check` / `typecheck` 스크립트 추가, Prettier 설정(`.prettierrc.json`) 추가
- [x] 디렉터리 구조 합의 — 앱 코드, 공용 모듈, 게임 도안 자산의 위치 — `src/app`(라우트) · `src/components`(공용 UI) · `src/lib`(공용 로직) · `src/assets/games`(도안 자산)로 확정, README에 기록
- [x] 최상위 `README.md` 작성 — 제품 한 줄 설명, 로컬 실행법, `issues/` 링크 — 작성 완료(스택·스크립트·디렉터리 구조·`issues/` 링크 포함)
- [ ] 참고 원본 이미지를 저장소로 옮기고 출처를 기록 — **`IDE-004`로 이관.** 실제 참고 자료(옛 인쇄본 스크린샷 1장, 사용자 스케치북 판 사진)를 사용자로부터 받아야 하고 `IDE-004`가 그 상세 작업 항목(출처 기록 포함)을 이미 갖고 있어 중복 소유를 피함

## 수용 기준

- [ ] `git log`에 커밋이 있고 `issues/`가 추적된다
- [ ] `npm run dev`로 로컬에서 페이지가 뜬다
- [ ] 린트와 타입체크가 오류 없이 통과한다
- [ ] 최상위 README만 읽고 처음 보는 사람이 로컬 실행에 성공한다

## 결정 기록

- 2026-09-03 · 스택을 Next.js(React) 웹으로 확정. 인쇄는 브라우저에서 PDF를 만드는
  방향을 기본값으로 두되 확정은 `IDE-002`에서 한다.

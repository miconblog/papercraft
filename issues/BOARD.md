# 이슈 보드

> 규칙은 [README.md](README.md) · 이슈 1건 = 파일 1개

**프로젝트** — ideas · 추억의 종이 보드게임을 만들고 원하는 크기로 인쇄하는 사이트

> 기준 크기는 원본 그대로 — 배율 100%에서 운동장이 A4(210×297mm)다. 사용자가 확대·축소해
> A4 여러 장에 나눠 뽑을 수 있고, 핵심 게임판과 오림용 부속은 따로 뽑는다.

## 요약

| 상태      | 개수 |
| --------- | ---- |
| `todo`    | 5    |
| `doing`   | 0    |
| `blocked` | 3    |
| `review`  | 0    |
| `done`    | 3    |

**지금 할 것** — `blocked` 세 건 중 둘([IDE-002](IDE-002-print-pipeline-spike.md) ·
[IDE-004](IDE-004-soccer-board-vector-artwork.md))이 **같은 것 하나를 기다린다 —
사람이 종이에 뽑아 자로 재는 일**이다. 절차는
[spikes/print-pipeline/README.md](../spikes/print-pipeline/README.md)의 체크리스트이고,
`IDE-004`는 거기에 골대를 오려 접어 보기·공 12mm 튕겨 보기가 더 붙는다. `IDE-004`는
**사용자 답변도 하나 기다린다** — 아웃·핸들링·파울 처리와 옛 인쇄본의 출처.

[IDE-005](IDE-005-game-catalog-pages.md)(카탈로그)는 `done`이다. 착수할 수
있는 것은 [IDE-010](IDE-010-player-markers-and-formations.md)(선수 마커)이다.
`IDE-004`가 필드 기하와 마커 규격을 확정해 선행이 풀렸다 —
[docs/soccer-artwork.md](../docs/soccer-artwork.md)를 보고 시작하면 된다.

---

## M0 — 기반 (001–003)

| ID                                                   | 제목                                | 영역     | 우선 | 추정 | 상태      |
| ---------------------------------------------------- | ----------------------------------- | -------- | ---- | ---- | --------- |
| [IDE-001](IDE-001-bootstrap-nextjs-repo.md)          | Next.js 저장소 부트스트랩           | infra    | P0   | 2d   | `done`    |
| [IDE-002](IDE-002-print-pipeline-spike.md)           | 인쇄 파이프라인 기술 검증           | research | P0   | 3d   | `blocked` |
| [IDE-003](IDE-003-board-schema-and-template-spec.md) | 도안 데이터 모델과 템플릿 규격 정의 | frontend | P0   | 5d   | `done`    |

## M1 — 첫 릴리스: 축구 게임판 (004–010)

| ID                                                           | 제목                                  | 영역     | 우선 | 추정 | 상태      |
| ------------------------------------------------------------ | ------------------------------------- | -------- | ---- | ---- | --------- |
| [IDE-004](IDE-004-soccer-board-vector-artwork.md)            | 축구 게임판 도안 벡터화               | content  | P0   | 5d   | `blocked` |
| [IDE-006](IDE-006-customization-editor.md)                   | 커스터마이즈 에디터                   | frontend | P0   | 5d   | `todo`    |
| [IDE-007](IDE-007-print-and-pdf-export.md)                   | 인쇄·PDF 내보내기                     | frontend | P0   | 6d   | `todo`    |
| [IDE-005](IDE-005-game-catalog-pages.md)                     | 게임 카탈로그 — 목록·상세 페이지      | frontend | P1   | 2d   | `done`    |
| [IDE-008](IDE-008-ci-deploy-and-test-foundation.md)          | CI·배포 파이프라인과 테스트 기반      | infra    | P1   | 3d   | `blocked` |
| [IDE-009](IDE-009-accessibility-responsive-print-quality.md) | 접근성·반응형·출력 품질 마감          | frontend | P1   | 3d   | `todo`    |
| [IDE-010](IDE-010-player-markers-and-formations.md)          | 선수 마커 아트워크와 전술 대형 프리셋 | content  | P0   | 5d   | `todo`    |

## M2 — 게임 확장 (011–020)

| ID                                                       | 제목                             | 영역    | 우선 | 추정 | 상태   |
| -------------------------------------------------------- | -------------------------------- | ------- | ---- | ---- | ------ |
| [IDE-011](IDE-011-two-more-games-and-authoring-guide.md) | 게임 2종 추가와 도안 제작 가이드 | content | P2   | 5d   | `todo` |

---

## 파일이 없는 이슈

위 표에서 **링크가 걸리지 않은 항목**은 아직 파일이 없다.
착수할 때 [README.md](README.md)의 템플릿으로 만들고, 이 보드에 링크를 건다.

아래는 아직 근거가 얇아 이슈로 만들지 않은 후보다. 필요해지면 M2 대역(011–020)에서 번호를 딴다.

| 후보                        | 왜 아직 안 만들었나                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 커스터마이즈 결과 URL 공유  | 공유 요구가 확인되지 않았다. `IDE-006`의 로컬 저장으로 충분한지 먼저 본다                                                   |
| 계정·내 도안 보관함         | 로그인 필요 여부가 정해지지 않았다                                                                                          |
| 인쇄소 주문 연계            | 타일을 붙이기 싫은 사람이 실제로 불편해하는지 먼저 본다                                                                     |
| 게임 규칙을 에디터에서 편집 | 사용자가 인쇄물 문구("기본 규칙, 자유롭게 바꿔서 즐기세요")로 충분하다고 판단(2026-09-03). 규칙 변형 요구가 반복되면 재검토 |

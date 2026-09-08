# 이슈 보드

> 규칙은 [README.md](README.md) · 이슈 1건 = 파일 1개

**프로젝트** — 아빠 뭐해?, 아빠 공방 · 추억의 종이 보드게임을 만들고 원하는 크기로 인쇄하는 사이트

> 기준 크기는 원본 그대로 — 배율 100%에서 운동장이 A4(210×297mm)다. 사용자가 확대·축소해
> A4 여러 장에 나눠 뽑을 수 있고, 핵심 게임판과 오림용 부속은 따로 뽑는다.

## 요약

| 상태      | 개수 |
| --------- | ---- |
| `todo`    | 2    |
| `doing`   | 1    |
| `blocked` | 5    |
| `review`  | 4    |
| `done`    | 8    |

**지금 할 것** — [IDE-007](IDE-007-print-and-pdf-export.md)(인쇄·PDF 내보내기)은
2026-09-07 사용자가 종이 실측·Safari·Firefox 확인을 마쳐 `done`이 됐다. 남은 것은
같은 종이 실측을 기다리는 [IDE-002](IDE-002-print-pipeline-spike.md)와
[IDE-004](IDE-004-soccer-board-vector-artwork.md)다. `IDE-004`는 사용자 답변도
하나 기다린다(아웃·핸들링·파울 처리와 옛 인쇄본의 출처).

[IDE-014](IDE-014-baseball-board-vector-artwork.md)(야구 게임판)가 `review`다.
사용자가 옛 인쇄본 〈프로야구판〉 사진을 주며 고른 두 번째 게임이고
(2026-09-08), 이로써 [IDE-011](IDE-011-two-more-games-and-authoring-guide.md)이
`doing`이 됐다 — **스키마는 한 줄도 안 고치고** 구조가 다른 게임이 들어갔다는
것이 그 이슈가 확인하려던 것이다. 남은 것은 세 번째 게임과 종이 실측이다.

[IDE-015](IDE-015-world-tour-dice-board-vector-artwork.md)(세계일주)가 `review`,
그 뒤를 잇는 [IDE-016](IDE-016-map-city-toggle-and-route-editing.md)(도시 토글·경로
편집)도 `review`다. 사용자가 옛 인쇄본 〈세계일주 주사위놀이〉 사진을 주며 고른
세 번째 게임이고(2026-09-08), `IDE-011`이 찾던 **"칸을 이동하는 주사위판"** 이
이것이다 — 말이 경로 위 정해진 칸에만 선다.

같은 날 작도까지 끝났다. **실제 세계지도**(Natural Earth, 로빈슨 도법 동경 150°
중심) 위에 서울에서 출발해 세계를 한 바퀴 도는 판이 도시 수 **50·60·70·80·90·100**
으로 여섯 나오고, 말 여섯과 종이 주사위가 붙는다. **판 크기가 도시 수를 따른다**
(사용자 제안) — 50은 A4 한 장, 60·70은 A3(두 장), 80 이상은 A2(네 장). 칸과
글자는 실물 치수 그대로라 종이가 커질수록 칸이 실제 위치 가까이 앉는다. `/games/world-tour`가 열리고 세 파트가
PDF까지 나온다. 남은 것은 종이 실측과 놀아 보기다. 도시 수는 50~100 여섯
단계이고 판이 A4 → A3 → A2로 따라 커진다. 사용자가 "50개로 고정돼 있어 테스트하기
어렵다"고 해 `IDE-016` 1단계로 **스키마의 첫 확장 — 파트 변형**을 넣었다: 만들기
화면의 "도시 수" 선택이 미리보기·인쇄 장수·PDF를 그 판으로 바꾼다. 개별 도시
토글과 경로 편집(2단계)은 아트워크를 값에서 그때 그리는 두 번째 확장이 필요해
남아 있다.

[IDE-013](IDE-013-self-hosted-web-analytics.md)(자체 웹 분석)은 2026-09-07 `done`이다.
이제 **어떤 게임이 얼마나 읽히고 뽑히는지 숫자로 보인다** — 그동안 보드의 후보
목록(URL 공유·보관함·인쇄소 주문)이 전부 "요구가 확인되지 않았다"로 미뤄져 있었고,
`IDE-011`의 "다음 게임"도 감으로 골라야 했다. 세 번째
게임은 `/admin/analytics` 를 보고 정할 참이었는데, 사용자가 사진으로 먼저 골랐다
(`IDE-015`).

[IDE-009](IDE-009-accessibility-responsive-print-quality.md)(접근성·반응형·출력
품질)도 `review`다. 포커스 표시·팀 색 흑백 구분 경고·마커 아트워크 캐싱은
코드로 고치고 자동 테스트로 확인했지만, 360px 실기기·키보드 전체 완주는
사람이 눈으로 한 번 더 훑어야 `done`이 된다(이 저장소엔 headless 브라우저
도구가 없다).

[IDE-005](IDE-005-game-catalog-pages.md)(카탈로그) ·
[IDE-006](IDE-006-customization-editor.md)(에디터) ·
[IDE-010](IDE-010-player-markers-and-formations.md)(선수 마커·전술 대형)은 `done`이다.
카탈로그 → 에디터 → 인쇄까지 한 줄로 이어져, 축구 게임판을 원하는 배율로 뽑아
볼 수 있다.

> **2026-09-05** — 사용자가 잡아낸 결함으로 `IDE-010`의 대형을 다시 잡았다.
> 두 팀이 각자 진영 절반에 갇혀 있어 **경기를 할 수 없는 배치**였다(상대 골대
> 쪽에 패스를 받을 선수가 없다). 두 팀이 번갈아 서게 고치고, 그 김에 원정 마커
> 좌우 반전(`IDE-007`이 빠뜨린 것)과 그룹 사이 겹침 검증을 함께 넣었다.
> 에디터는 미리보기를 폭 전체로 올리고 팀 입력을 그 아래 2단으로 내렸다(`IDE-006`).
> 이어서 운동장에서 팀 이름·제목 띠를 빼 터치라인을 285×198mm로 넓히고
> (`IDE-004`), 골키퍼가 골 에어리어 안에 서도록·10명이 운동장 1/3마다 둘 이상
> 있도록 대형을 다시 잡았다(`IDE-010`). 프리셋은 출발점일 뿐이라 마커를 끌어
> 옮기는 조작도 넣었다(`IDE-012`).

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
| [IDE-006](IDE-006-customization-editor.md)                   | 커스터마이즈 에디터                   | frontend | P0   | 5d   | `done`    |
| [IDE-007](IDE-007-print-and-pdf-export.md)                   | 인쇄·PDF 내보내기                     | frontend | P0   | 6d   | `done`    |
| [IDE-005](IDE-005-game-catalog-pages.md)                     | 게임 카탈로그 — 목록·상세 페이지      | frontend | P1   | 2d   | `done`    |
| [IDE-008](IDE-008-ci-deploy-and-test-foundation.md)          | CI·배포 파이프라인과 테스트 기반      | infra    | P1   | 3d   | `blocked` |
| [IDE-009](IDE-009-accessibility-responsive-print-quality.md) | 접근성·반응형·출력 품질 마감          | frontend | P1   | 3d   | `review`  |
| [IDE-010](IDE-010-player-markers-and-formations.md)          | 선수 마커 아트워크와 전술 대형 프리셋 | content  | P0   | 5d   | `done`    |
| [IDE-012](IDE-012-marker-drag-placement.md)                  | 마커 드래그 배치                      | frontend | P1   | 1d   | `done`    |

## M2 — 게임 확장 (011–020)

| ID                                                         | 제목                                        | 영역     | 우선 | 추정 | 상태      |
| ---------------------------------------------------------- | ------------------------------------------- | -------- | ---- | ---- | --------- |
| [IDE-011](IDE-011-two-more-games-and-authoring-guide.md)   | 게임 2종 추가와 도안 제작 가이드            | content  | P2   | 5d   | `doing`   |
| [IDE-013](IDE-013-self-hosted-web-analytics.md)            | 자체 웹 분석 (Supabase)                     | backend  | P1   | 3d   | `done`    |
| [IDE-014](IDE-014-baseball-board-vector-artwork.md)        | 야구 게임판 도안 벡터화                     | content  | P1   | 3d   | `review`  |
| [IDE-015](IDE-015-world-tour-dice-board-vector-artwork.md) | 세계일주 — 실제 세계지도와 도시·경로 데이터 | content  | P1   | 4d   | `review`  |
| [IDE-016](IDE-016-map-city-toggle-and-route-editing.md)    | 지도 위 도시 토글과 경로 편집               | frontend | P1   | 4d   | `review`  |
| [IDE-017](IDE-017-yut-nori-board-vector-artwork.md)        | 윷놀이 — 말판(윷판)과 말 도안               | content  | P1   | 3d   | `todo`    |
| [IDE-018](IDE-018-paper-yut-sticks-buildable.md)           | 종이 윷가락 조립 도안                       | content  | P1   | 3d   | `blocked` |
| [IDE-019](IDE-019-dot-to-dot-photo-outline.md)             | 점 잇기 — 사진 윤곽선과 점·번호 도안        | content  | P1   | 4d   | `todo`    |
| [IDE-020](IDE-020-dot-to-dot-editor.md)                    | 점 잇기 에디터 — 사진 넣기와 도안 간직      | frontend | P1   | 3d   | `blocked` |

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

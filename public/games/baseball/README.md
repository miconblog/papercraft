# 야구 게임판 자산

파트별 SVG는 **손으로 고치지 않는다.** `src/assets/games/baseball/artwork/`의
생성기가 만들고 여기 커밋한다.

```bash
npm run artwork baseball   # 이 게임만
npm run artwork            # 모든 게임
```

커밋된 SVG가 생성기와 어긋나면 테스트가 잡는다.

| 파일                        | 파트                          |
| --------------------------- | ----------------------------- |
| `field.svg`                 | 야구장 (보드, 210×297mm · A4 세로)      |
| `score-sheet.svg`           | 스코어보드 (표 2벌)           |
| `stands.svg`                | 선수 스탠드 10장              |
| `marker-circle.svg`         | 수비 마커 · 빈 원             |
| `batter-circle.svg`         | 타자 마커 · 빈 원             |
| `marker-<자세>-<모양>.svg`  | 선수 그림                     |

카탈로그(`IDE-005`) 썸네일은 별도 파일을 만들지 않고 `field.svg`를 그대로 쓴다.

## 선수 그림이 열넷인 이유

선수 그림은 **자세 × 모양**으로 늘어난다. 자세는 수비 여섯
(`pitch`·`crouch`·`field`·`throw`·`catch`·`run`)에 타자 `bat`이 더해 일곱이고,
모양은 실루엣(`illustration`)과 색칠용 윤곽선(`outline`) 둘이다. 자세는 포지션에
배정되고(`src/assets/games/baseball/dimensions.ts`의 `DEFENSE_POSITIONS`), 모양은
사용자가 `marker-style` 슬롯에서 고른다.

빈 원은 자세와 무관해 파일 둘을 모든 자세가 나눠 쓴다 — 수비용과 타자용이다.
타자 원에만 안쪽 테가 있어 흑백으로 뽑아도 공수가 구분된다.

마커 아트워크는 슬롯의 `artwork`가 아니라 마커 스타일 세트(자세마다 하나)의
변형이 가리킨다 — `parts` 배열에는 안 나온다.

작도 근거와 치수는 [docs/baseball-artwork.md](../../../docs/baseball-artwork.md),
레이어 id 규약은 [docs/game-authoring.md](../../../docs/game-authoring.md)를 본다.

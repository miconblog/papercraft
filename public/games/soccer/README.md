# 축구 게임판 자산

파트별 SVG는 **손으로 고치지 않는다.** `src/assets/games/soccer/artwork/`의
생성기가 만들고 여기 커밋한다.

```bash
npm run artwork
```

커밋된 SVG가 생성기와 어긋나면 테스트가 잡는다.

| 파일                             | 파트                              |
| -------------------------------- | --------------------------------- |
| `field.svg`                      | 운동장 (보드, 297×210mm)          |
| `score-sheet.svg`                | 점수 기록칸                       |
| `goals.svg`                      | 골대 전개도 2벌                   |
| `player-marker-circle.svg`       | 필드 선수 마커 · 빈 원 (`IDE-010`) |
| `goalkeeper-marker-circle.svg`   | 골키퍼 마커 · 빈 원 (`IDE-010`)   |
| `player-marker-<자세>-<모양>.svg` | 필드 선수 그림 (`IDE-010`)        |
| `goalkeeper-marker-<모양>.svg`   | 골키퍼 그림 (`IDE-010`)           |

카탈로그(`IDE-005`) 썸네일은 별도 파일을 만들지 않고 `field.svg`를 그대로 쓴다.

## 선수 그림이 여러 벌인 이유

선수 그림은 **자세 × 모양**으로 늘어난다(2026-09-06). 자세는 여섯 가지
(`run`·`sprint`·`strike`·`pass`·`header`·`block`)에 골키퍼 `save`가 따로 있고,
모양은 실루엣(`illustration`)과 색칠용 윤곽선(`outline`) 둘이다 — 그래서 그림
파일이 열넷이다. 자세는 슬롯에 역할로 배정되고(`src/assets/games/soccer/index.ts`의
`POSE_BY_PLAYER`), 모양은 사용자가 `marker-style` 슬롯에서 고른다.

빈 원은 자세와 무관해 파일 하나를 모든 자세가 나눠 쓴다.

마커 아트워크는 슬롯의 `artwork`가 아니라 마커 스타일 세트(자세마다 하나)의
변형이 가리킨다 — `parts` 배열에는 안 나온다.

작도 근거와 치수는 [docs/soccer-artwork.md](../../../docs/soccer-artwork.md),
레이어 id 규약은 [docs/game-authoring.md](../../../docs/game-authoring.md)를 본다.

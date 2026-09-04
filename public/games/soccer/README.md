# 축구 게임판 자산

파트별 SVG는 **손으로 고치지 않는다.** `src/assets/games/soccer/artwork/`의
생성기가 만들고 여기 커밋한다.

```bash
npm run artwork
```

커밋된 SVG가 생성기와 어긋나면 테스트가 잡는다.

| 파일                                | 파트                                        |
| ------------------------------------ | ------------------------------------------- |
| `field.svg`                          | 운동장 (보드, 297×210mm)                    |
| `score-sheet.svg`                    | 점수 기록칸                                 |
| `rules-card.svg`                     | 게임 방법                                   |
| `goals.svg`                          | 골대 전개도 2벌                             |
| `ball-markers.svg`                   | 공 마커 24개                                |
| `player-marker-circle.svg`           | 필드 선수 마커 · 원형 (`IDE-010`)           |
| `player-marker-illustration.svg`     | 필드 선수 마커 · 일러스트 (`IDE-010`)       |
| `goalkeeper-marker-circle.svg`       | 골키퍼 마커 · 원형 (`IDE-010`)              |
| `goalkeeper-marker-illustration.svg` | 골키퍼 마커 · 일러스트 (`IDE-010`)          |

카탈로그(`IDE-005`) 썸네일은 별도 파일을 만들지 않고 `field.svg`를 그대로 쓴다.

마커 넷은 슬롯의 `artwork`가 아니라 마커 스타일 세트(`player-marker` ·
`goalkeeper-marker`)의 변형(`artwork`)이 가리킨다 — `parts` 배열에는 안 나온다.

작도 근거와 치수는 [docs/soccer-artwork.md](../../../docs/soccer-artwork.md),
레이어 id 규약은 [docs/game-authoring.md](../../../docs/game-authoring.md)를 본다.

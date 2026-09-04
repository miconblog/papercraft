# 축구 게임판 자산

파트별 SVG는 **손으로 고치지 않는다.** `src/assets/games/soccer/artwork/`의
생성기가 만들고 여기 커밋한다.

```bash
npm run artwork
```

커밋된 SVG가 생성기와 어긋나면 테스트가 잡는다.

| 파일                | 파트                              |
| ------------------- | --------------------------------- |
| `field.svg`         | 운동장 (보드, 297×210mm)          |
| `score-sheet.svg`   | 점수 기록칸                       |
| `rules-card.svg`    | 게임 방법                         |
| `goals.svg`         | 골대 전개도 2벌                   |
| `ball-markers.svg`  | 공 마커 24개                      |
| `thumbnail.png`     | 카탈로그 썸네일 — IDE-005에서 만든다 |

선수 마커 아트워크는 `IDE-010`에서 만든다.

작도 근거와 치수는 [docs/soccer-artwork.md](../../../docs/soccer-artwork.md),
레이어 id 규약은 [docs/game-authoring.md](../../../docs/game-authoring.md)를 본다.

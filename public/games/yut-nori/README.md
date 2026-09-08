# 윷놀이 자산

파트별 SVG는 **손으로 고치지 않는다.** `src/assets/games/yut-nori/artwork/`의
생성기가 만들고 여기 커밋한다.

```bash
npm run artwork yut-nori   # 이 게임만
npm run artwork            # 모든 게임
```

커밋된 SVG가 생성기와 어긋나면 테스트가 잡는다.

| 파일               | 파트                                            |
| ------------------ | ----------------------------------------------- |
| `board.svg`        | 말판 (보드, 198×198mm · 정사각)                 |
| `tokens.svg`       | 말 — 4편 × 넷, 텐트형 카드 열여섯 (112×252mm)   |
| `rules-sheet.svg`  | 게임 방법 (두 단 조판, 190×240mm)               |

마커 아트워크가 없다 — 말이 판 밖에서 시작해 판 위에 놓인 마커가 하나도 없다.

작도 근거는 [`docs/yut-nori-artwork.md`](../../../docs/yut-nori-artwork.md)에 있다.

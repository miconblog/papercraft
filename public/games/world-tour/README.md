# 세계일주 주사위놀이 자산

파트별 SVG는 **손으로 고치지 않는다.** `src/assets/games/world-tour/artwork/`의
생성기가 만들고 여기 커밋한다.

```bash
npm run artwork world-tour   # 이 게임만
npm run artwork              # 모든 게임
```

커밋된 SVG가 생성기와 어긋나면 테스트가 잡는다.

| 파일            | 파트                                              |
| --------------- | ------------------------------------------------- |
| `board.svg`     | 게임판 · 도시 50개 (보드, 297×210mm · A4 가로)    |
| `board-60.svg`  | 게임판 · 도시 60개 (420×297mm · A3 = A4 두 장)    |
| `board-70.svg`  | 게임판 · 도시 70개 (A3)                           |
| `board-80.svg`  | 게임판 · 도시 80개 (594×420mm · A2 = A4 네 장)    |
| `board-90.svg`  | 게임판 · 도시 90개 (A2)                           |
| `board-100.svg` | 게임판 · 도시 100개 (A2)                          |
| `tokens.svg`    | 말 여섯 (오림 부속, 105×74mm)                     |
| `dice.svg`      | 종이 주사위 전개도 (조립물, 120×100mm)            |

판 크기는 도시 수를 따른다(`dimensions.ts`의 `PAPER_STEPS`). 칸·말·글자는 실물
치수 그대로이고 지도만 커진다. 도안 정의(`parts`)가 가리키는 판은 `board.svg`
(50개, A4)뿐이다. 나머지 다섯 판은 사용자가 판 위에서 도시 수를 고르는
`IDE-016`이 잇기 전까지 미리보기용으로 함께 만들어 둔다.

카탈로그(`IDE-005`) 썸네일은 별도 파일을 만들지 않고 `board.svg`를 그대로 쓴다.

## 지도 데이터

해안선은 Natural Earth `ne_50m_land`(퍼블릭 도메인)를 `npm run fetch:land`로
받아 0.1°로 단순화한 `src/assets/games/world-tour/artwork/land.json`이다.
이 파일은 아트워크 생성기와 서버 렌더러만 읽고 클라이언트 번들에는 들어가지
않는다. 검색용 세계 도시 데이터(`search/world-cities.json`, `npm run fetch:cities`)도
같다.

작도 근거와 치수는 [docs/world-tour-artwork.md](../../../docs/world-tour-artwork.md),
레이어 id 규약은 [docs/game-authoring.md](../../../docs/game-authoring.md)를 본다.

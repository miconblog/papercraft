/**
 * 조립물 파트 — 골대 전개도 2벌 (IDE-004, 2026-09-06 재재재작도)
 *
 * 구조는 **앞이 낮아지는 쐐기**다 — 쓰레받기 그대로. 바닥 하나, 벽 셋(뒤·좌·우),
 * 뒤쪽 절반을 덮는 뚜껑, 그리고 바닥 앞에서 **안으로 접어 넣는 입술**. 옆벽
 * 앞쪽은 사선으로 접어 넘겨 뚜껑 앞 모서리에서 바닥 앞 모서리로 흘러내린다.
 *
 * 전개도 한 벌:
 *
 * ```
 *        ┌──────────┐          ← 뚜껑 겉장 (접어 넣어 두 겹이 된다)
 *      ┌─┼──────────┼─┐        ← 귀 · 뚜껑 천장 · 귀
 *      └─┤          ├─┘        ← 홈 (귀를 탭에서 뗀다)
 *     ┌──┼──────────┼──┐       ← 탭 · 뒷벽 · 탭
 *     └──┤          ├──┘       ← 홈 (탭을 옆벽에서 뗀다)
 *  ┌──┬──┼──────────┼──┬──┐    ← 겹 · 옆벽 · 바닥 · 옆벽 · 겹
 *  └──┴──┤          ├──┴──┘
 *        │   입술   │           ← 안으로 접어 바닥에 포갠다
 *        └──────────┘
 * ```
 *
 * 왜 이 모양인지는 `../dimensions.ts`의 `GOAL` 주석에 다섯 단계로 적었다. 요지는
 * 두 가지다 — **지붕을 없애니 창도 풀칠탭도 칼집도 필요 없어졌고**, 그 뒤 **위가
 * 뚫려 있으면 골포스트를 맞고 튄 공이 밖으로 나가서**(2026-09-08 사용자 지적)
 * 뚜껑만 경첩식으로 되돌렸다. 붙일 것이 없으므로 풀도 칼도 돌아오지 않았다.
 *
 * 그 뚜껑은 다시 **절반으로 줄었다**(같은 날). 통째로 덮으니 공이 들어갔는지
 * 보이지 않았기 때문이다 — 뒤쪽 절반만 덮고 앞쪽은 열어 둔다.
 *
 * 다만 줄일 때 남는 절반을 **잘라 버린 것이 잘못이었다**. 종이 한 겹짜리 천장이
 * 되어 힘을 못 받았다(2026-09-08 사용자 지적 — "뚜껑이 한 겹이라 약해"). 지금은
 * 자르지 않고 판을 32mm로 되돌린 뒤 **한가운데를 접어 두 겹으로 포갠다**. 덮는
 * 깊이는 그대로 16mm인데 두께가 배가 되고, 덤으로 뚜껑 앞 모서리가 자른 변이
 * 아니라 **접힌 변**이 되어 크로스바가 훨씬 곧게 선다.
 *
 * 그러자 옆벽 앞쪽 절반 위에 얹힐 것이 없어졌다. 사용자가 손으로 접어 보고
 * 답을 찾았다 — **옆벽을 사선으로 접어 넘긴다**(`sideWallDiagonals`). 앞이
 * 낮아져 쓰레받기가 되고, 넘어가는 삼각형이 안쪽에 든 귀와 겹을 함께 문다.
 *
 * **풀도 칼도 쓰지 않는다.** 잠금은 셋이 **사슬처럼** 물리는 것이다 —
 * `1번 탭`(뒷벽에서 넘어옴)을 `2번 귀`(뚜껑에서 내려옴)가 타고 넘어가 물고, 그
 * 둘을 `3번 겹`(옆벽 위에서 내려옴)이 한꺼번에 덮는다. 하나를 당겨도 나머지가
 * 붙잡으니 뒷모서리가 닫히고 뚜껑도 들리지 않는다. 가위와 접기만으로 끝난다.
 *
 * 처음에는 탭과 귀가 서로를 **피하게** 짰다(겹치면 넉 겹이 된다는 계산이었다).
 * 접어 보니 헐거웠다 — 나란히 서기만 하면 서로를 잡아 주는 것이 없어 겹 하나가
 * 둘을 다 감당했다(2026-09-08 사용자). 지금은 일부러 4mm 겹친다. 세 면에 이름
 * 대신 **번호**를 적는 것도 그래서다 — 이 구조에서는 이름보다 차례가 먼저다.
 *
 * **모서리 홈 넷이 이 전개도의 급소다.** 귀·탭·옆벽은 전개도에서 위아래로 맞닿아
 * 있는데 접히는 방향이 제각각이라, 이어져 있으면 하나를 접을 때 나머지가 딸려
 * 온다 — 처음 그렸을 때 실제로 그랬다(2026-09-08 사용자 지적). 홈은 바깥 윤곽의
 * 일부라 따로 칼집을 낼 필요가 없다.
 *
 * 접는선은 **뚜껑을 겹치는 한 줄만 빼고 전부 골접기**다. 인쇄면이 쟁반 안쪽을
 * 향해야 그물이 안에서 보이고, 겹·모서리 탭·뚜껑 귀가 모두 안으로 접힌다. 귀만
 * 산접기이던 때가 있었는데(벽을 바깥에서 감쌌다), 안으로 넣어 겹에 물리게
 * 바꾸면서 방향이 하나로 통일됐다(2026-09-08 사용자 요청).
 *
 * 그 하나뿐인 산접기가 **뚜껑을 겹치는 줄**이다. 방향을 고를 수 없다 — 골접기로
 * 포개면 인쇄면 둘이 서로 마주 보며 안에 갇혀 천장에 그물도 표식도 남지 않고
 * 겉도 안도 무지가 된다. 산접기로 포개야 뒤쪽 절반의 인쇄면이 살아남아, 뚜껑을
 * 덮었을 때 그 면이 골문 천장이 된다(`mountainFolds`).
 *
 * 좌표는 전부 시트 절대 좌표로 펼친다. 레이어에 transform을 걸면 렌더러가
 * 표시선 굵기를 다시 입힐 때 변환까지 따라가야 해서 손해다.
 */
import { GOAL, GOAL_NET_SIZE, SHEETS } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  estimateTextWidthMm,
  group,
  line,
  markLayer,
  netHatch,
  num,
  path,
  rect,
  svgDocument,
  text,
} from './svg.ts';

const {
  mouthWidthMm,
  wallHeightMm,
  trayDepthMm,
  lipDepthMm,
  lidDepthMm,
  lidFlapMm,
  hemMm,
  cornerTabMm,
  cornerNotchMm,
  lidEarInsetMm,
} = GOAL;

/**
 * 전개도 한 벌의 구획선. 원점은 전개도 좌상단(= 뚜껑 앞 모서리의 왼쪽 끝)이다.
 *
 * 가로는 겹·옆벽·바닥·옆벽·겹 다섯 칸, 세로는 뚜껑·뒷벽·바닥·입술 네 칸이다.
 * 뚜껑 칸만 `lidDepthMm`의 **두 배**인데, 반으로 접어 두 겹으로 쓰기 때문이다 —
 * `yFold`가 그 접는 자리이자 다 접었을 때의 뚜껑 앞 모서리다.
 *
 * 모서리 탭은 뒷벽 양 끝, 뚜껑 귀는 **뚜껑 안쪽 절반**의 양 끝에 붙어 옆 칸의
 * 빈자리를 쓴다 — 둘 다 옆벽 폭(32mm) 안이라 전개도가 옆으로 더 넓어지지 않는다.
 */
const gridOf = (originXMm: number, originYMm: number) => ({
  x0: originXMm,
  x1: originXMm + hemMm,
  x2: originXMm + hemMm + wallHeightMm,
  x3: originXMm + hemMm + wallHeightMm + mouthWidthMm,
  x4: originXMm + GOAL_NET_SIZE.widthMm - hemMm,
  x5: originXMm + GOAL_NET_SIZE.widthMm,
  /** 왼쪽 모서리 탭의 바깥 끝. 뒷벽 왼쪽 모서리에서 앞으로 뻗는다. */
  tabLeft: originXMm + hemMm + wallHeightMm - cornerTabMm,
  tabRight: originXMm + hemMm + wallHeightMm + mouthWidthMm + cornerTabMm,
  /** 뚜껑 귀의 바깥 끝. 탭보다 좁아 y0 자리에 턱이 하나 생긴다. */
  flapLeft: originXMm + hemMm + wallHeightMm - lidFlapMm,
  flapRight: originXMm + hemMm + wallHeightMm + mouthWidthMm + lidFlapMm,
  /**
   * 모서리 탭·뚜껑 귀의 **자유로운 아래 끝**.
   *
   * 탭은 뒷벽에만, 귀는 **뚜껑 안쪽 절반**(천장이 되는 쪽)에만 붙어 있어야 한다.
   * 여기까지만 종이를 남기고 나머지를 홈으로 파내야 아래 이웃(귀→탭, 탭→옆벽)에서
   * 떨어진다. 귀가 겉장(`yLid`~`yFold`)까지 올라가면 겹칠 때 같이 말려 들어간다.
   *
   * 귀 쪽 홈은 `cornerNotchMm`(가위가 들어갈 최소 깊이)이 아니라
   * `lidEarInsetMm`으로 판다. 귀와 탭이 접고 나면 **같은 옆벽 안쪽 면**에
   * 붙으므로, 탭이 차지한 만큼 귀를 물려야 자리를 다투지 않기 때문이다 —
   * 그 값이 홈 최소 깊이보다 크므로 가위 조건은 저절로 지켜진다.
   */
  earBottom: originYMm + lidDepthMm * 2 - lidEarInsetMm,
  tabBottom: originYMm + lidDepthMm * 2 + wallHeightMm - cornerNotchMm,
  /** 뚜껑 판의 바깥 끝. 여기서 `yFold`까지가 접혀 들어가는 **겉장**이다. */
  yLid: originYMm,
  /**
   * 뚜껑을 반으로 접는 자리이자, 다 접었을 때의 **뚜껑 앞 모서리**.
   *
   * 겉장을 여기서 뒤로 넘겨 천장 절반에 포개면 뚜껑이 두 겹이 된다. 그러면 이
   * 선이 골문 위를 가로지르는 크로스바가 되는데, 자른 변이 아니라 접힌 변이라
   * 곧게 선다 — 한 겹짜리 뚜껑의 잘린 앞머리가 처지던 것을 이걸로 해결했다.
   */
  yFold: originYMm + lidDepthMm,
  y0: originYMm + lidDepthMm * 2,
  y1: originYMm + lidDepthMm * 2 + wallHeightMm,
  y2: originYMm + lidDepthMm * 2 + wallHeightMm + trayDepthMm,
  y3: originYMm + GOAL_NET_SIZE.heightMm,
});

type Grid = ReturnType<typeof gridOf>;

/**
 * 바깥 윤곽 한 붓.
 *
 * 입술은 바닥 앞에 이어져 있고 **안으로 접어 포갠다**(2026-09-08 사용자 요청).
 * 그러면 골대 앞 모서리가 자른 변이 아니라 **접힌 면**이 되어 공이 부드럽게
 * 넘어오고, 운동장 위로 나오는 종이가 없어 자리도 깔끔하다. 윤곽은 옆벽
 * 앞끝(y2)에서 곧장 입술 옆면으로 내려간다.
 *
 * 반대로 **모서리 넷은 반드시 떨어져 있어야 한다.** 뚜껑 귀·모서리 탭·옆벽은
 * 전개도에서 위아래로 맞닿아 있는데, 셋은 접히는 방향이 제각각이라 이어져 있으면
 * 하나를 접을 때 나머지가 딸려 온다(2026-09-08 사용자 지적). 그래서 귀 아래와
 * 탭 아래에 `cornerNotchMm` 깊이의 홈을 판다 — 윤곽이 거기서 안으로 들어갔다
 * 나오므로 **여전히 한 붓이고, 칼집이 아니라 가위로 따라 오리면 된다**.
 *
 * 뚜껑은 판이 완성 깊이의 두 배라, 위쪽 절반(`yLid`~`yFold`)은 폭이 골문 그대로인
 * 민짜 겉장이다. 귀는 그 아래 절반에서만 옆으로 뻗는다 — 겉장까지 붙어 있으면
 * 겹칠 때 귀가 같이 말려 들어간다.
 */
const outline = (g: Grid): string =>
  path(
    [
      // 뚜껑 겉장의 바깥 끝 — 접어 넣으면 안으로 숨는 변이라 귀가 붙지 않는다
      `M ${num(g.x2)} ${num(g.yLid)}`,
      `H ${num(g.x3)}`,
      // 겹치는 자리(yFold)까지 내려온 뒤에야 귀가 옆으로 뻗는다
      `V ${num(g.yFold)}`,
      `H ${num(g.flapRight)}`,
      // 오른쪽 귀 아래 홈 — 귀를 아래 모서리 탭에서 떼어 놓는다
      `V ${num(g.earBottom)}`,
      `H ${num(g.x3)}`,
      `V ${num(g.y0)}`,
      // 오른쪽 모서리 탭 → 그 아래 홈으로 옆벽에서 떼어 놓는다
      `H ${num(g.tabRight)}`,
      `V ${num(g.tabBottom)}`,
      `H ${num(g.x3)}`,
      `V ${num(g.y1)}`,
      // 오른벽·겹의 뒷변 → 겹 바깥 → 앞변
      `H ${num(g.x5)}`,
      `V ${num(g.y2)}`,
      `H ${num(g.x3)}`,
      // 입술
      `V ${num(g.y3)}`,
      `H ${num(g.x2)}`,
      `V ${num(g.y2)}`,
      // 왼벽·겹의 앞변 → 겹 바깥 → 뒷변(옆벽 윗변은 홈 덕에 끝까지 트여 있다)
      `H ${num(g.x0)}`,
      `V ${num(g.y1)}`,
      `H ${num(g.x2)}`,
      // 왼쪽 모서리 탭 아래 홈 → 탭 → 귀 아래 홈 → 귀
      `V ${num(g.tabBottom)}`,
      `H ${num(g.tabLeft)}`,
      `V ${num(g.y0)}`,
      `H ${num(g.x2)}`,
      `V ${num(g.earBottom)}`,
      `H ${num(g.flapLeft)}`,
      // 왼쪽 귀 위 → 겉장 옆변을 타고 시작점으로
      `V ${num(g.yFold)}`,
      `H ${num(g.x2)}`,
      'Z',
    ].join(' '),
  );

/**
 * 접는선. **전부 골접기**다 — 인쇄면이 안쪽으로 오게 접는다.
 *
 * 벽 셋을 세우는 것도, 겹을 안으로 내리는 것도, 모서리 탭을 옆벽에 대는 것도
 * 모두 인쇄면끼리 마주 보는 방향이다. 방향이 하나뿐이라 아이에게 설명할 것이
 * "전부 같은 쪽으로 접는다" 한 줄로 끝난다.
 */
const valleyFolds = (g: Grid): string[] => [
  // 뚜껑과 뒷벽 — 여기가 경첩이다
  line(g.x2, g.y0, g.x3, g.y0),
  // 뒷벽과 바닥
  line(g.x2, g.y1, g.x3, g.y1),
  // 옆벽과 바닥
  line(g.x2, g.y1, g.x2, g.y2),
  line(g.x3, g.y1, g.x3, g.y2),
  // 겹과 옆벽
  line(g.x1, g.y1, g.x1, g.y2),
  line(g.x4, g.y1, g.x4, g.y2),
  // 모서리 탭과 뒷벽 — 홈 위쪽, 실제로 이어진 구간만
  line(g.x2, g.y0, g.x2, g.tabBottom),
  line(g.x3, g.y0, g.x3, g.tabBottom),
  // 뚜껑 귀와 뚜껑 — 2026-09-08부터 이것도 골접기다. 귀가 옆벽 **안쪽**으로
  // 들어가면서 접는 방향이 나머지와 같아졌다. 귀는 겹치고 난 뒤의 뚜껑
  // (yFold 아래 절반)에만 붙으므로 접는선도 거기서 시작한다.
  line(g.x2, g.yFold, g.x2, g.earBottom),
  line(g.x3, g.yFold, g.x3, g.earBottom),
  ...sideWallDiagonals(g),
  // 바닥과 입술 — 안으로 180° 접어 포갠다. 앞 모서리를 접힌 면으로 만들어
  // 공이 넘어올 턱을 없애는 자리다(2026-09-08).
  line(g.x2, g.y2, g.x3, g.y2),
];

/**
 * 산접기 — 이 전개도에서 **딱 한 줄**, 뚜껑을 반으로 겹치는 자리다.
 *
 * 겉장을 이 선에서 뒤로 넘겨 천장 절반에 포갠다. 방향을 고를 수 없다: 골접기로
 * 포개면 인쇄면 둘이 서로 마주 본 채 갇혀 천장이 무지가 되고, 그물도
 * `daddyscraft.com` 표식도 사라진다. 산접기라야 아래 절반의 인쇄면이 위로 남아,
 * 뚜껑을 앞으로 덮었을 때 그대로 골문 천장이 된다.
 *
 * 겹치고 나면 이 선이 뚜껑 앞 모서리 — 크로스바 자리다. 접힌 변이라 곧다.
 */
const mountainFolds = (g: Grid): string[] => [
  line(g.x2, g.yFold, g.x3, g.yFold),
];

/**
 * 옆벽의 **사선** — 앞쪽을 접어 넘겨 쓰레받기 모양을 만드는 자리.
 *
 * 뚜껑이 바닥의 절반만 덮으면서 옆벽 앞쪽 절반 위에는 얹힐 것이 없어졌다. 그
 * 자리를 그냥 두면 벽만 덩그러니 서 있는데, 사선으로 접어 넘기면 **앞이 낮아지는
 * 쐐기**가 된다(2026-09-08 사용자가 손으로 접어 보고 알려 준 모양). 골대가
 * 쓰레받기가 되고, 뚜껑 앞 모서리가 골포스트 자리에 남으며, 앞이 트여 공이
 * 들어갔는지 위에서 바로 보인다.
 *
 * 두 끝점은 고를 여지가 없다 — **뚜껑 앞 모서리가 닿는 벽 위쪽 점**과 **바닥 앞
 * 모서리**를 잇는 선뿐이다. 그래야 접어 넘긴 삼각형의 두 변이 뚜껑과 바닥에
 * 각각 맞아떨어진다. 넘기면서 안쪽으로 들어간 귀와 겹을 함께 물어 잠근다.
 *
 * 전개도에서 옆벽은 **가로가 높이**다(바닥 쪽 x2·x3이 아래, 겹 쪽 x1·x4가 위).
 * 그래서 "벽 위쪽 · 뒷벽에서 lidDepth"는 (x1, y1 + lidDepth)가 된다.
 */
const sideWallDiagonals = (g: Grid): string[] => [
  line(g.x1, g.y1 + lidDepthMm, g.x2, g.y2),
  line(g.x4, g.y1 + lidDepthMm, g.x3, g.y2),
];

/** 그물 눈 간격. 촘촘하면 면이 통째로 검게 뭉쳐 면 이름까지 묻힌다. */
const NET_SPACING_MM = 4;

/**
 * 그물 격자 — 뚜껑과 벽 셋의 **안쪽 면**에 친다.
 *
 * 인쇄면이 쟁반 안을 향하므로 위에서도 골문에서도 이 격자가 보인다. 뚜껑을
 * 덮으면 뒤쪽 천장이 위 그물, 뒤·옆이 각각 뒷그물·옆그물이다 — 골대로 읽히게
 * 하는 것이 이 격자다.
 *
 * 뚜껑은 **아래 절반(`yFold`~`y0`)에만** 친다. 위 절반은 겹칠 때 안으로 숨는
 * 겉장이라 잉크가 보이지 않는다 — 거기까지 격자를 치면 종이만 검어진다.
 *
 * 바닥과 입술에는 넣지 않는다. 공이 지나가고 멈추는 면이라 비워 두어야 공이
 * 눈에 띈다 — 입술은 접어 넣으면 바닥의 앞쪽 절반이 되므로 같은 이유다.
 */
const netArt = (g: Grid): string[] => [
  group({ stroke: RULE_COLOR, 'stroke-width': 0.12, fill: 'none' }, [
    // 뚜껑 천장 — 앞 모서리(겹치는 선)는 크로스바 자리로 비운다
    ...netHatch(
      g.x2,
      g.yFold + CROSSBAR_BAND_MM,
      mouthWidthMm,
      lidDepthMm - CROSSBAR_BAND_MM,
      NET_SPACING_MM,
    ),
    // 뒷벽
    ...netHatch(g.x2, g.y0, mouthWidthMm, wallHeightMm, NET_SPACING_MM),
    // 옆벽 둘
    ...netHatch(g.x1, g.y1, wallHeightMm, trayDepthMm, NET_SPACING_MM),
    ...netHatch(g.x3, g.y1, wallHeightMm, trayDepthMm, NET_SPACING_MM),
  ]),
];

/** 크로스바로 비워 두는 뚜껑 앞 띠의 폭. 격자가 덮으면 굵은 선이 묻힌다. */
const CROSSBAR_BAND_MM = 4;

/**
 * 크로스바 — 뚜껑 **앞 모서리**에 얹는 굵은 선.
 *
 * 뚜껑을 덮으면 이 선이 골문 바로 위를 가로지른다. 지붕을 없앴다가 뚜껑으로
 * 돌아오면서 크로스바가 같이 돌아왔다 — 정면에서 골대로 알아보게 하는 한 줄이다.
 *
 * 뚜껑을 겹치면서 자리가 `yLid`에서 `yFold`로 옮겨 왔다. 잘린 변이 아니라 접힌
 * 변에 얹히므로, 인쇄된 선과 실제 모서리가 처지지 않고 겹쳐 보인다.
 *
 * 대신 **겹치는 접는선과 나란히 붙어 버리는 문제**가 생겼다. 굵은 검은 선이
 * 접는선 바로 밑에 붙으면 어느 쪽에서 접어야 하는지 헷갈린다. 그래서 띠의
 * 한가운데가 아니라 **아래쪽 3/4 지점**에 얹어 접는선과 3mm를 띄운다 — 그물이
 * 시작하는 자리(띠 아래끝)와는 1mm만 남지만, 그쪽은 굵기가 달라 섞이지 않는다.
 */
const crossbar = (g: Grid): string =>
  line(
    g.x2,
    g.yFold + CROSSBAR_BAND_MM * 0.75,
    g.x3,
    g.yFold + CROSSBAR_BAND_MM * 0.75,
    { stroke: INK_COLOR, 'stroke-width': 1, 'stroke-linecap': 'round' },
  );

/**
 * 도안에 새기는 표식. 뚜껑 면에 들어가 접으면 골문 안쪽 천장에 남는다.
 *
 * 면 이름과 같은 크기로 둔다 — 종이에 남는 유일한 출처 표시라, 최소 배율에서도
 * 읽혀야 나중에 이 골대가 어디서 나온 것인지 알 수 있다.
 */
const SITE_MARK = 'daddyscraft.com';

/**
 * 맞물리는 세 면의 **번호**. 겹치는 차례 그대로다(2026-09-08 사용자 요청).
 *
 * 탭·귀·겹은 이름으로 부르는 동안 순서가 전달되지 않았다 — 셋이 사슬처럼 물리는
 * 구조라 "무엇이 무엇을 먼저 무는가"가 이름보다 중요하다. 번호를 붙이면 시트에
 * 글자를 늘리지 않고 그 순서가 그대로 읽힌다.
 *
 * 이름 대신 번호를 쓰니 좁은 면(겹은 폭 8mm)에서도 크게 넣을 수 있어 오히려 잘
 * 보인다. 번호와 이름의 대응은 시트 머리글과 도해 ③에 있다.
 */
const FACE_NUMBERS = { tab: '1', ear: '2', hem: '3' } as const;

/** 번호 글자 크기. 세운 채로 들여다보는 면이라 이름보다 크게 잡는다. */
const FACE_NUMBER_MM = 5;

/**
 * 면 이름 글자 크기.
 *
 * 최소 배율 0.8에서 2.56mm라 6절의 읽힘 하한(2.5mm)을 지킨다. 문서가 2026-09-08부터
 * 이 값을 적어 두고 있었는데 코드는 2.6mm에 머물러 있었다(같은 날 맞췄다).
 * **여기를 키우면 긴 문구가 골문 폭(55mm)을 넘는다** — 크기와 문구 길이는 한 쌍이라
 * 고칠 때 `estimateTextWidthMm`으로 재 보라.
 */
const FACE_LABEL_MM = 3.2;

/**
 * 면 이름. 접다가 헷갈리지 않게 면 안에 작게 적는다.
 *
 * 글자 뒤에 흰 바탕을 깐다 — 벽에는 그물 격자가 깔려 있어 그냥 얹으면 읽히지
 * 않는다.
 */
const faceLabels = (g: Grid): string[] => {
  const at = (
    value: string,
    xMm: number,
    yMm: number,
    rotate = 0,
    sizeMm: number = FACE_LABEL_MM,
  ): string[] => {
    const widthMm = estimateTextWidthMm(value, sizeMm);
    const transform =
      rotate === 0 ? undefined : `rotate(${rotate} ${num(xMm)} ${num(yMm)})`;
    const box = rect(
      xMm - widthMm / 2 - 0.6,
      yMm - sizeMm * 0.75,
      widthMm + 1.2,
      sizeMm * 1.5,
      transform
        ? { fill: '#ffffff', stroke: 'none', transform }
        : { fill: '#ffffff', stroke: 'none' },
    );
    const body = text(value, xMm, yMm, sizeMm, {
      fill: RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
      ...(transform ? { transform } : {}),
    });
    return [box, body];
  };
  const label = (value: string, xMm: number, yMm: number, rotate = 0) =>
    at(value, xMm, yMm, rotate);
  const number = (value: string, xMm: number, yMm: number) =>
    at(value, xMm, yMm, 0, FACE_NUMBER_MM);
  return [
    ...label('뒷벽', (g.x2 + g.x3) / 2, (g.y0 + g.y1) / 2),
    // 옆벽 이름은 사선 **위쪽**(뒤쪽)에 둔다 — 가운데에 두면 사선이 글자를
    // 지나가 어느 것이 접는 선인지 흐려진다.
    ...label('옆벽', (g.x1 + g.x2) / 2, g.y1 + trayDepthMm * 0.28, -90),
    ...label('옆벽', (g.x3 + g.x4) / 2, g.y1 + trayDepthMm * 0.28, -90),
    // 맞물리는 셋은 이름이 아니라 **번호**다 — 겹치는 차례가 곧 이름이다.
    // 숫자는 돌리지 않는다. 한 글자라 좁은 면에도 세로로 세울 필요가 없다.
    ...number(FACE_NUMBERS.hem, (g.x0 + g.x1) / 2, (g.y1 + g.y2) / 2),
    ...number(FACE_NUMBERS.hem, (g.x4 + g.x5) / 2, (g.y1 + g.y2) / 2),
    ...number(
      FACE_NUMBERS.tab,
      (g.tabLeft + g.x2) / 2,
      (g.y0 + g.tabBottom) / 2,
    ),
    ...number(
      FACE_NUMBERS.tab,
      (g.x3 + g.tabRight) / 2,
      (g.y0 + g.tabBottom) / 2,
    ),
    // 겹치면 안으로 숨는 겉장. 여기 적은 글씨는 완성품에 보이지 않으므로,
    // 이 면에서만은 이름 대신 **동작**을 길게 적어 둘 수 있다.
    ...label(
      '↓ 여기서 반으로 접어 두 겹으로',
      (g.x2 + g.x3) / 2,
      (g.yLid + g.yFold) / 2,
    ),
    // 뚜껑 면에는 이름 대신 **표식**을 넣는다(2026-09-08 사용자 요청). 접으면
    // 이 면이 골문 안쪽 천장이 되어, 골문으로 들여다볼 때 눈에 들어온다.
    ...label(SITE_MARK, (g.x2 + g.x3) / 2, (g.yFold + g.y0) / 2),
    ...number(
      FACE_NUMBERS.ear,
      (g.flapLeft + g.x2) / 2,
      (g.yFold + g.earBottom) / 2,
    ),
    ...number(
      FACE_NUMBERS.ear,
      (g.x3 + g.flapRight) / 2,
      (g.yFold + g.earBottom) / 2,
    ),
    ...label('골대 바닥', (g.x2 + g.x3) / 2, (g.y1 + g.y2) / 2),
    ...label('↑ 앞 모서리 — 골라인에 맞춘다', (g.x2 + g.x3) / 2, g.y2 + 5),
    ...label(
      '입술 — 안으로 접어 바닥에 포갠다',
      (g.x2 + g.x3) / 2,
      g.y2 + lipDepthMm - 4,
    ),
  ];
};

export interface Face {
  readonly id: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * 전개도를 이루는 면들. 접었을 때 실제로 쟁반이 되는지(벽 셋의 높이가 같은지,
 * 모서리 탭이 겹에 물리는지)를 테스트가 이 값으로 확인한다.
 *
 * 입술은 바닥 앞에 이어져 접혀 들어가는 면이다. 접었을 때 뒷벽에 닿지 않아야
 * 하므로 테스트가 `입술 ≤ 바닥 깊이`를 본다.
 *
 * `lid-liner`는 뚜껑 판의 위 절반 — 겹치면 `lid` 뒤로 숨어 두 겹을 만든다. 면으로
 * 세어 두어야 맞닿음 검사가 둘 사이에 접는선이 있는지까지 확인한다.
 */
export const goalNetFaces = (
  originXMm: number,
  originYMm: number,
): readonly Face[] => {
  const g = gridOf(originXMm, originYMm);
  return [
    // 겹치면 뚜껑 안으로 숨는 겉장. 폭이 뚜껑과 같아야 포갰을 때 어긋나지 않는다.
    {
      id: 'lid-liner',
      xMm: g.x2,
      yMm: g.yLid,
      widthMm: mouthWidthMm,
      heightMm: lidDepthMm,
    },
    {
      id: 'lid',
      xMm: g.x2,
      yMm: g.yFold,
      widthMm: mouthWidthMm,
      heightMm: lidDepthMm,
    },
    {
      id: 'lid-flap-left',
      xMm: g.flapLeft,
      yMm: g.yFold,
      widthMm: lidFlapMm,
      heightMm: lidDepthMm - lidEarInsetMm,
    },
    {
      id: 'lid-flap-right',
      xMm: g.x3,
      yMm: g.yFold,
      widthMm: lidFlapMm,
      heightMm: lidDepthMm - lidEarInsetMm,
    },
    {
      id: 'wall-back',
      xMm: g.x2,
      yMm: g.y0,
      widthMm: mouthWidthMm,
      heightMm: wallHeightMm,
    },
    {
      id: 'corner-tab-left',
      xMm: g.tabLeft,
      yMm: g.y0,
      widthMm: cornerTabMm,
      heightMm: wallHeightMm - cornerNotchMm,
    },
    {
      id: 'corner-tab-right',
      xMm: g.x3,
      yMm: g.y0,
      widthMm: cornerTabMm,
      heightMm: wallHeightMm - cornerNotchMm,
    },
    {
      id: 'hem-left',
      xMm: g.x0,
      yMm: g.y1,
      widthMm: hemMm,
      heightMm: trayDepthMm,
    },
    {
      id: 'wall-left',
      xMm: g.x1,
      yMm: g.y1,
      widthMm: wallHeightMm,
      heightMm: trayDepthMm,
    },
    {
      id: 'floor',
      xMm: g.x2,
      yMm: g.y1,
      widthMm: mouthWidthMm,
      heightMm: trayDepthMm,
    },
    {
      id: 'wall-right',
      xMm: g.x3,
      yMm: g.y1,
      widthMm: wallHeightMm,
      heightMm: trayDepthMm,
    },
    {
      id: 'hem-right',
      xMm: g.x4,
      yMm: g.y1,
      widthMm: hemMm,
      heightMm: trayDepthMm,
    },
    {
      id: 'lip',
      xMm: g.x2,
      yMm: g.y2,
      widthMm: mouthWidthMm,
      heightMm: lipDepthMm,
    },
  ];
};

/**
 * 옆벽 사선의 두 끝점. 접었을 때 뚜껑·바닥과 맞아떨어지는지를 테스트가 본다.
 *
 * 전개도에서 옆벽은 **가로가 높이**다 — 바닥 쪽(x2·x3)이 아래, 겹 쪽(x1·x4)이
 * 위다. 그래서 "벽 위쪽"이 x1·x4가 된다.
 */
export const goalSideWallDiagonals = (
  originXMm: number,
  originYMm: number,
): ReadonlyArray<{
  readonly id: string;
  readonly topMm: readonly [number, number];
  readonly bottomMm: readonly [number, number];
}> => {
  const g = gridOf(originXMm, originYMm);
  return [
    {
      id: 'diagonal-left',
      topMm: [g.x1, g.y1 + lidDepthMm],
      bottomMm: [g.x2, g.y2],
    },
    {
      id: 'diagonal-right',
      topMm: [g.x4, g.y1 + lidDepthMm],
      bottomMm: [g.x3, g.y2],
    },
  ];
};

/**
 * 시트 위 두 벌의 좌상단. **한 장에 두 벌**이다.
 *
 * 뚜껑이 붙으면서 접는 법 글이 오른쪽 단을 통째로 써 한 벌밖에 못 앉혔던 때가
 * 있었다. 그 글을 소개 페이지로 옮기면서(2026-09-08 사용자 요청) 폭이 비어 두
 * 벌이 나란히 들어간다 — 한 벌이 135mm라 270mm에 좌우 2mm·사이 6mm다. 골대
 * 둘에 종이 한 장이면 된다.
 */
export const GOAL_NET_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [2, 26],
  [143, 26],
];

/**
 * 조립 도해 — 전개도 아래에 한 줄로 붙는 넉 장.
 *
 * 글로만 적힌 "겹으로 문다"는 어느 것이 무엇을 무는지 알려 주지 않는다. 옆에서
 * 본 그림 한 컷이면 그게 끝난다. ④는 골대와 운동장 눈금의 관계를 보여 준다 —
 * 어디까지 밀어 넣는지가 이 도안에서 가장 헷갈리는 대목이다.
 */
const ASSEMBLY_DIAGRAM_WIDTH_MM = 48;
const ASSEMBLY_DIAGRAM_HEIGHT_MM = 26;
const ASSEMBLY_DIAGRAM_GAP_MM = 6;
const ASSEMBLY_DIAGRAM_COUNT = 5;

const assemblyDiagrams = (leftMm: number, topMm: number): string[] => {
  const thin = { fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 };
  const bold = { fill: 'none', stroke: INK_COLOR, 'stroke-width': 0.55 };
  const label = (value: string, xMm: number, yMm: number, sizeMm = 2.2) =>
    text(value, xMm, yMm, sizeMm, {
      fill: RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
    });

  const colXMm = (i: number) =>
    leftMm + i * (ASSEMBLY_DIAGRAM_WIDTH_MM + ASSEMBLY_DIAGRAM_GAP_MM);
  const rowYMm = () => topMm;
  const centerXMm = (i: number) => colXMm(i) + ASSEMBLY_DIAGRAM_WIDTH_MM / 2;
  const baseOf = () => rowYMm() + ASSEMBLY_DIAGRAM_HEIGHT_MM - 4;
  const caption = (value: string, i: number) =>
    label(value, centerXMm(i), rowYMm() + ASSEMBLY_DIAGRAM_HEIGHT_MM + 4, 3);

  /**
   * ① 모서리 홈 — 사용자가 "뒷벽과 옆벽을 동시에 세우려면 어딘가 오려야 하는 것
   * 아니냐"고 짚은 자리다(2026-09-08). 전개도를 확대해 **탭이 옆벽에서 떨어져
   * 있다**는 것을 보여 준다. 홈은 바깥 윤곽의 일부라 따라 오리기만 하면 된다.
   */
  const baseN = baseOf();
  const nx = centerXMm(0) + 7;
  const notchOne = [
    // 모서리 탭 — 뒷벽(오른쪽)에만 붙어 있다.
    path(
      `M ${num(nx)} ${num(baseN - 20)} H ${num(nx - 13)} V ${num(baseN - 10)} H ${num(nx)}`,
      bold,
    ),
    // 뒷벽과 탭 사이의 접는선.
    path(`M ${num(nx)} ${num(baseN - 20)} V ${num(baseN - 10)}`, {
      ...thin,
      'stroke-dasharray': '2 1 0.5 1',
    }),
    // 옆벽 — 윗변이 홈 덕에 끝까지 트여 있다.
    path(
      `M ${num(nx)} ${num(baseN - 6)} H ${num(nx - 20)} V ${num(baseN + 2)}`,
      bold,
    ),
    // 홈을 가리키는 화살표.
    path(
      `M ${num(nx - 24)} ${num(baseN - 12)} L ${num(nx - 17)} ${num(baseN - 8)}`,
      thin,
    ),
    path(
      `M ${num(nx - 19.6)} ${num(baseN - 8.4)} L ${num(nx - 16.6)} ${num(baseN - 7.6)} L ${num(nx - 17.6)} ${num(baseN - 10.4)}`,
      thin,
    ),
    label('홈', nx - 26, baseN - 13),
    // ①에서도 이름이 아니라 번호로 부른다 — 시트 전체가 같은 약속을 쓴다.
    label(FACE_NUMBERS.tab, nx - 6.5, baseN - 14.5),
    label('뒷벽', nx + 5, baseN - 15),
    label('옆벽', nx - 10, baseN + 0.5),
    caption('① 모서리 홈까지 오린다', 0),
  ];

  // ② 벽 셋을 세운다 — 앞에서 본 쟁반. 아직 위가 열려 있고, 그 **뒤쪽 절반**을
  // 뚜껑이 덮는다는 것이 이 컷의 요점이다. 정면도라 깊이는 보이지 않으므로
  // 글자로 적는다.
  const base0 = baseOf();
  // 골문 55:32를 그대로 줄인 비율. 납작하게 그리면 지금 골대와 다르게 보인다.
  const w = 30;
  const h = 17;
  const a = centerXMm(1) - w / 2;
  const one = [
    path(
      `M ${num(a)} ${num(base0 - h)} V ${num(base0)} H ${num(a + w)} V ${num(base0 - h)}`,
      bold,
    ),
    group(
      { stroke: RULE_COLOR, 'stroke-width': 0.12, fill: 'none' },
      netHatch(a + 0.8, base0 - h + 0.8, w - 1.6, h - 1.6, 3),
    ),
    // 아직 열려 있는 변. 여기를 뚜껑이 덮는다(③).
    path(`M ${num(a)} ${num(base0 - h)} H ${num(a + w)}`, {
      ...thin,
      'stroke-dasharray': '1.5 1.5',
    }),
    label('뒤쪽 절반을 뚜껑이 덮는다', centerXMm(1), base0 - h - 2.4),
    caption('② 벽 셋을 세운다', 1),
  ];

  /**
   * ③ 잠금 — 이 도안에서 유일하게 글로 설명하기 어려운 동작이다.
   *
   * 옆벽을 **안쪽에서** 마주 본 그림이다. 왼쪽이 뒷벽 쪽, 위가 벽 윗머리다.
   * 셋이 사슬처럼 물린다(2026-09-08 사용자가 접어 보고 고쳐 준 순서):
   *
   * 1. **1번 탭**이 뒷벽에서 넘어와 벽 뒤쪽에 선다
   * 2. **2번 귀**가 뚜껑에서 내려와 그 탭의 뒷머리를 4mm 타고 넘어가 문다
   * 3. **3번 겹**이 벽 위에서 접혀 내려와 1·2의 윗머리를 한꺼번에 덮는다
   *
   * 그전에는 탭과 귀가 **나란히 서기만** 하고 겹 하나가 둘을 다 감당했다. 사용자
   * 지적대로 그건 헐거웠다 — 서로를 잡아 주는 것이 없으니 겹이 들리면 둘 다 풀린다.
   *
   * 겹치는 부분은 **흰 바탕으로 덮어 그린다.** 뒤에 있는 것의 선이 사라져야
   * "물렸다"가 그림으로 읽힌다. 비율은 실제 치수의 0.6배 그대로다.
   */
  const base1 = baseOf();
  const s3 = 0.6;
  const wallSideMm = wallHeightMm * s3;
  // 벽을 왼쪽으로 밀어 오른쪽에 번호·이름 대응표 자리를 낸다.
  const wx = centerXMm(2) - wallSideMm / 2 - 6;
  const wy = base1 - wallSideMm;
  const tabWMm = cornerTabMm * s3;
  const tabHMm = (wallHeightMm - cornerNotchMm) * s3;
  const earLeftMm = lidEarInsetMm * s3;
  const earRightMm = lidDepthMm * s3;
  const earHMm = lidFlapMm * s3;
  const hemHMm = hemMm * s3;
  const white = { fill: '#ffffff', stroke: 'none' };
  const dashed = {
    ...thin,
    stroke: INK_COLOR,
    'stroke-dasharray': '1.4 1.2',
  };
  const two = [
    // 옆벽.
    rect(wx, wy, wallSideMm, wallSideMm, bold),
    // 1번 탭 — 뒷모서리(왼쪽)에 선다. 뒤에 깔리므로 먼저 그린다. **면을 옅게
    // 채운다**: 뒷변이 벽의 굵은 테와 겹치고 앞변은 귀에 지워져, 선만으로는
    // 아무것도 안 남는다. 채워 두면 귀 밑으로 사라지는 것이 그대로 보인다.
    rect(wx, wy, tabWMm, tabHMm, { ...dashed, fill: '#e9e9ec' }),
    // 2번 귀 — 탭의 뒷머리를 타고 넘어간다. 겹치는 자리를 흰 바탕으로 지워야
    // 귀가 탭 **위에** 있다는 것이 보인다.
    rect(wx + earLeftMm, wy, earRightMm - earLeftMm, earHMm, white),
    rect(wx + earLeftMm, wy, earRightMm - earLeftMm, earHMm, dashed),
    // 3번 겹 — 벽 위에서 접혀 내려와 1·2의 윗머리를 한꺼번에 덮는다.
    rect(wx, wy, wallSideMm, hemHMm, white),
    rect(wx, wy, wallSideMm, hemHMm, bold),
    // 겹이 내려오는 방향 — 벽 위에서 안으로 꺾여 내려온다.
    path(
      `M ${num(wx + wallSideMm / 2 - 3)} ${num(wy - 6.5)} A 5 5 0 0 1 ${num(wx + wallSideMm / 2 + 2)} ${num(wy - 2)}`,
      thin,
    ),
    path(
      `M ${num(wx + wallSideMm / 2 + 0.2)} ${num(wy - 3.6)} L ${num(wx + wallSideMm / 2 + 2.2)} ${num(wy - 1.6)} L ${num(wx + wallSideMm / 2 + 4)} ${num(wy - 3.8)}`,
      thin,
    ),
    // 번호는 각자 **가려지지 않고 남는 자리**에 앉힌다.
    // 1과 2를 같은 높이에 나란히 둔다 — 옆으로 맞물린 사이라는 것이 이 배치에서
    // 먼저 읽힌다.
    label(
      FACE_NUMBERS.tab,
      wx + earLeftMm / 2,
      wy + (hemHMm + earHMm) / 2 + 1,
      2.6,
    ),
    label(
      FACE_NUMBERS.ear,
      wx + (earLeftMm + earRightMm) / 2,
      wy + (hemHMm + earHMm) / 2 + 1,
      2.6,
    ),
    label(FACE_NUMBERS.hem, wx + wallSideMm - 2, wy + hemHMm - 1.4, 2.6),
    // 번호·이름 대응. 시트 머리글과 같은 짝이라 여기서 한 번 더 확인된다.
    label(`${FACE_NUMBERS.tab} 탭`, wx + wallSideMm + 8, wy + 3, 2.4),
    label(`${FACE_NUMBERS.ear} 귀`, wx + wallSideMm + 8, wy + 8, 2.4),
    label(`${FACE_NUMBERS.hem} 겹`, wx + wallSideMm + 8, wy + 13, 2.4),
    // 벽 이름은 셋 다 비켜 가는 오른쪽 아래 빈자리에 둔다.
    label('옆벽 안쪽', wx + wallSideMm - 5, base1 - 2, 2.2),
    caption('③ 1을 2가, 둘을 3이 문다', 2),
  ];

  /**
   * ④ 사선 — 옆에서 본 완성 모양. 이 도안에서 **가장 늦게 알아낸 접기**다.
   *
   * 뚜껑이 바닥의 절반만 덮으면서 옆벽 앞쪽 위에 얹힐 것이 없어졌는데, 그 자리를
   * 사선으로 접어 넘기면 앞이 낮아지는 쐐기 — 쓰레받기가 된다(2026-09-08 사용자가
   * 손으로 접어 보고 알려 준 모양). 옆에서 본 한 컷이 아니면 "어디서 어디로"가
   * 전달되지 않는다.
   */
  const base2 = baseOf();
  const wedgeHMm = 15;
  const trayDMm = 15;
  const lipDMm = 9;
  const bx = centerXMm(3) - (trayDMm + lipDMm) / 2;
  const three = [
    // 바닥 — 입술을 접어 넣으므로 앞으로 뻗는 것이 없다.
    path(`M ${num(bx)} ${num(base2)} H ${num(bx + trayDMm)}`, bold),
    // 접어 넣은 입술 — 바닥 위에 포개져 앞쪽 절반이 두 겹이 된다.
    path(
      `M ${num(bx + trayDMm)} ${num(base2 - 1.1)} H ${num(bx + trayDMm - lipDMm)}`,
      { ...thin, stroke: INK_COLOR, 'stroke-width': 0.45 },
    ),
    // 뒷벽.
    path(`M ${num(bx)} ${num(base2)} V ${num(base2 - wedgeHMm)}`, bold),
    // 뚜껑 — 바닥의 절반만 덮는다. 옆에서 보면 **두 겹**이라, 겉장을 한 줄 더
    // 그어 두께를 보인다. 입술과 같은 표현이라 "포갠 것"으로 읽힌다.
    path(
      `M ${num(bx)} ${num(base2 - wedgeHMm)} H ${num(bx + trayDMm / 2)}`,
      bold,
    ),
    path(
      `M ${num(bx)} ${num(base2 - wedgeHMm + 1.1)} H ${num(bx + trayDMm / 2)}`,
      { ...thin, stroke: INK_COLOR, 'stroke-width': 0.45 },
    ),
    // 사선 — 뚜껑 앞 모서리에서 바닥 앞 모서리로. 이 컷의 요점이다.
    path(
      `M ${num(bx + trayDMm / 2)} ${num(base2 - wedgeHMm)} L ${num(bx + trayDMm)} ${num(base2)}`,
      bold,
    ),
    // 접기 전 옆벽의 남은 자리 — 넘어가기 전 모습을 파선으로 남긴다.
    path(
      [
        `M ${num(bx + trayDMm / 2)} ${num(base2 - wedgeHMm)}`,
        `H ${num(bx + trayDMm)}`,
        `V ${num(base2)}`,
      ].join(' '),
      { ...thin, 'stroke-dasharray': '1.5 1.5' },
    ),
    // 넘어가는 방향.
    path(
      `M ${num(bx + trayDMm + 1)} ${num(base2 - wedgeHMm + 2)} A 6 6 0 0 1 ${num(bx + trayDMm + 2.5)} ${num(base2 - wedgeHMm + 8)}`,
      thin,
    ),
    path(
      `M ${num(bx + trayDMm + 0.6)} ${num(base2 - wedgeHMm + 5.8)} L ${num(bx + trayDMm + 2.8)} ${num(base2 - wedgeHMm + 8.4)} L ${num(bx + trayDMm + 4.4)} ${num(base2 - wedgeHMm + 5.6)}`,
      thin,
    ),
    label('뚜껑 두 겹', bx + trayDMm / 4, base2 - wedgeHMm - 2.4),
    label('사선', bx + trayDMm * 0.22, base2 - wedgeHMm * 0.55),
    label('입술', bx + trayDMm - lipDMm / 2, base2 + 3.4),
    caption('④ 옆벽을 사선으로 접는다', 3),
  ];

  // ⑤ 위에서 본 놓는 자리 — 골라인 눈금에 골대 앞 모서리를 맞춘다. 입술을
  // 접어 넣은 뒤로는 운동장 위로 나오는 종이가 없다(2026-09-08).
  const base3 = baseOf();
  const d = centerXMm(4) + 4;
  const halfMm = 8;
  const topEdgeYMm = base3 - 18;
  const four = [
    // 골라인.
    path(`M ${num(d)} ${num(topEdgeYMm - 1)} V ${num(base3 + 1)}`, thin),
    // 운동장 눈금 셋.
    ...[-halfMm, halfMm].map((offsetMm) =>
      path(
        `M ${num(d - 2.5)} ${num(base3 - 9 + offsetMm)} H ${num(d + 1.5)}`,
        bold,
      ),
    ),
    path(`M ${num(d)} ${num(base3 - 9)} H ${num(d + 1.5)}`, bold),
    // 골대 — 눈금 사이에 맞춰 골라인 바깥(왼쪽)으로 놓인다. 앞 모서리가 골라인에
    // 닿고, 운동장 위로 나오는 종이는 없다.
    rect(d - 11, base3 - 9 - halfMm, 11, halfMm * 2, bold),
    // 공이 들어오는 방향.
    path(`M ${num(d + 12)} ${num(base3 - 9)} H ${num(d + 2)}`, thin),
    path(
      `M ${num(d + 3.6)} ${num(base3 - 10.2)} L ${num(d + 1.6)} ${num(base3 - 9)} L ${num(d + 3.6)} ${num(base3 - 7.8)}`,
      thin,
    ),
    label('골대', d - 5.5, topEdgeYMm + 1),
    label('눈금', d + 6, topEdgeYMm + 5.5),
    caption('⑤ 눈금에 맞춘다', 4),
  ];

  return [...notchOne, ...one, ...two, ...three, ...four];
};

export const renderGoals = (): string => {
  const grids = GOAL_NET_ORIGINS.map(([x, y]) => gridOf(x, y));
  const centerXMm = SHEETS.goals.widthMm / 2;
  // 도해 넉 장이 한 줄로 242mm — 전개도 두 벌 아래 빈 띠에 가운데로 앉힌다.
  const diagramsWidthMm =
    ASSEMBLY_DIAGRAM_WIDTH_MM * ASSEMBLY_DIAGRAM_COUNT +
    ASSEMBLY_DIAGRAM_GAP_MM * (ASSEMBLY_DIAGRAM_COUNT - 1);

  return svgDocument({
    widthMm: SHEETS.goals.widthMm,
    heightMm: SHEETS.goals.heightMm,
    title: '축구 게임판 · 골대 전개도',
    children: [
      markLayer(
        'cut',
        grids.map((g) => outline(g)),
      ),
      markLayer('fold-valley', grids.flatMap(valleyFolds)),
      // 산접기는 뚜껑을 겹치는 한 줄뿐이다. 방향이 반대인 유일한 선이라 층을
      // 따로 두어야 렌더러가 다른 표시선을 입힌다.
      markLayer('fold-mountain', grids.flatMap(mountainFolds)),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('골대 전개도 · 2개', centerXMm, 12, 5, {
          'text-anchor': 'middle',
        }),
        // 접는 순서는 소개 페이지에 있다(2026-09-08). 시트에 남는 것은 도해
        // 넉 장뿐이라, 어디서 읽는지 한 줄로 알려 준다.
        text(
          `골문 ${num(mouthWidthMm)}×${num(wallHeightMm)}mm · 풀도 칼도 쓰지 않는다 · 접는 순서는 소개 페이지의 "골대 접는 법"에서`,
          centerXMm,
          19,
          3,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
        // 번호와 이름의 대응. 전개도에는 숫자만 적혀 있으므로(2026-09-08) 이 한
        // 줄이 없으면 접는 순서 글의 "1번 탭"을 시트에서 찾을 수 없다.
        text(
          `전개도의 숫자는 겹치는 차례다 — ${FACE_NUMBERS.tab} 탭 · ${FACE_NUMBERS.ear} 귀 · ${FACE_NUMBERS.hem} 겹`,
          centerXMm,
          23.5,
          3,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
        ...grids.flatMap(netArt),
        ...grids.map((g) => crossbar(g)),
        ...grids.flatMap(faceLabels),

        ...assemblyDiagrams(centerXMm - diagramsWidthMm / 2, 150),
      ]),
    ],
  });
};

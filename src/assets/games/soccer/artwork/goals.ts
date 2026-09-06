/**
 * 조립물 파트 — 골대 전개도 2벌 (IDE-004, 2026-09-06 재재재작도)
 *
 * 구조는 **뚜껑 없는 쟁반**이다 — 쓰레받기(사용자 표현으로 "국자") 모양. 바닥
 * 하나, 벽 셋(뒤·좌·우), 위는 뚫려 있고, 앞으로 바닥이 그대로 뻗어 나온
 * **입술**이 있다.
 *
 * 전개도 한 벌:
 *
 * ```
 *      ┌──┬────────────┬──┐      ← 모서리 탭 · 뒷벽 · 모서리 탭
 *   ┌──┼──┼────────────┼──┼──┐   ← 겹 · 옆벽 · 바닥 · 옆벽 · 겹
 *   └──┴──┤            ├──┴──┘
 *         │    입술    │          ← 바닥이 그대로 앞으로 뻗는다
 *         └────────────┘
 * ```
 *
 * 왜 이 모양인지는 `../dimensions.ts`의 `GOAL` 주석에 네 단계로 적었다. 한 줄로
 * 줄이면 **지붕을 없애니 창도 풀칠탭도 칼집도 필요 없어졌기 때문**이다. 위가
 * 뚫려 있어 들어간 공이 그대로 보이고, 바닥이 입술로 이어져 공이 넘을 턱이 없다.
 *
 * **풀도 칼도 쓰지 않는다.** 뒷벽 양 끝의 모서리 탭을 옆벽 안쪽에 대고, 그 위로
 * 옆벽의 겹을 접어 내리면 뒷모서리가 물린다. 가위와 접기만으로 끝난다 — 앞선
 * 도안이 요구하던 풀칠(2026-09-05)과 칼집(2026-09-06 오전)이 둘 다 사라졌다.
 *
 * 접는선은 **전부 골접기**다. 인쇄면이 쟁반 안쪽을 향해야 위에서 내려다볼 때
 * 그물이 보이고, 겹과 모서리 탭도 안쪽으로 접히므로 방향이 하나로 통일된다.
 *
 * 좌표는 전부 시트 절대 좌표로 펼친다. 레이어에 transform을 걸면 렌더러가
 * 표시선 굵기를 다시 입힐 때 변환까지 따라가야 해서 손해다.
 */
import { GOAL, GOAL_NET_SIZE, SHEETS } from '../dimensions.ts';
import { GOAL_ASSEMBLY_STEPS } from '../rules.ts';
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
  wrapText,
} from './svg.ts';

const {
  mouthWidthMm,
  wallHeightMm,
  trayDepthMm,
  lipDepthMm,
  hemMm,
  cornerTabMm,
} = GOAL;

/**
 * 전개도 한 벌의 구획선. 원점은 전개도 좌상단(= 뒷벽 윗변의 왼쪽 끝)이다.
 *
 * 가로는 겹·옆벽·바닥·옆벽·겹 다섯 칸, 세로는 뒷벽·바닥·입술 세 칸이다.
 * 모서리 탭은 뒷벽 양 끝에 붙어 위쪽 칸의 빈자리를 쓴다.
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
  y0: originYMm,
  y1: originYMm + wallHeightMm,
  y2: originYMm + wallHeightMm + trayDepthMm,
  y3: originYMm + GOAL_NET_SIZE.heightMm,
});

type Grid = ReturnType<typeof gridOf>;

/**
 * 바깥 윤곽 한 붓.
 *
 * 바닥과 입술 사이에는 접는선이 없다 — **한 장으로 이어진 면**이다. 그래야
 * 공이 운동장에서 쟁반으로 들어올 때 넘을 턱이 생기지 않는다. 그래서 윤곽도
 * 옆벽 앞끝(y2)에서 곧장 입술 옆면으로 내려간다.
 */
const outline = (g: Grid): string =>
  path(
    [
      // 뒷벽 윗변 — 좌우 모서리 탭까지 한 줄로 이어진다
      `M ${num(g.tabLeft)} ${num(g.y0)}`,
      `H ${num(g.tabRight)}`,
      `V ${num(g.y1)}`,
      // 오른벽·겹의 뒷변 → 겹 바깥 → 앞변
      `H ${num(g.x5)}`,
      `V ${num(g.y2)}`,
      `H ${num(g.x3)}`,
      // 입술
      `V ${num(g.y3)}`,
      `H ${num(g.x2)}`,
      `V ${num(g.y2)}`,
      // 왼벽·겹의 앞변 → 겹 바깥 → 뒷변
      `H ${num(g.x0)}`,
      `V ${num(g.y1)}`,
      `H ${num(g.tabLeft)}`,
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
const folds = (g: Grid): string[] => [
  // 뒷벽과 바닥
  line(g.x2, g.y1, g.x3, g.y1),
  // 옆벽과 바닥
  line(g.x2, g.y1, g.x2, g.y2),
  line(g.x3, g.y1, g.x3, g.y2),
  // 겹과 옆벽
  line(g.x1, g.y1, g.x1, g.y2),
  line(g.x4, g.y1, g.x4, g.y2),
  // 모서리 탭과 뒷벽
  line(g.x2, g.y0, g.x2, g.y1),
  line(g.x3, g.y0, g.x3, g.y1),
];

/** 그물 눈 간격. 촘촘하면 면이 통째로 검게 뭉쳐 면 이름까지 묻힌다. */
const NET_SPACING_MM = 4;

/**
 * 그물 격자 — 벽 셋의 **안쪽 면**에만 친다.
 *
 * 인쇄면이 쟁반 안을 향하므로 위에서 내려다보면 이 격자가 보인다. 골대를
 * 골대로 보이게 하는 것이 이 격자다 — 지붕과 크로스바가 없어졌으므로 남은
 * 단서가 그물뿐이다.
 *
 * 바닥과 입술에는 넣지 않는다. 공이 지나가고 멈추는 면이라 비워 두어야 공이
 * 눈에 띄고, 입술은 운동장 위에 얹히므로 잉크가 있으면 라인과 겹쳐 지저분하다.
 */
const netArt = (g: Grid): string[] => [
  group({ stroke: RULE_COLOR, 'stroke-width': 0.12, fill: 'none' }, [
    // 뒷벽
    ...netHatch(g.x2, g.y0, mouthWidthMm, wallHeightMm, NET_SPACING_MM),
    // 옆벽 둘
    ...netHatch(g.x1, g.y1, wallHeightMm, trayDepthMm, NET_SPACING_MM),
    ...netHatch(g.x3, g.y1, wallHeightMm, trayDepthMm, NET_SPACING_MM),
  ]),
];

/**
 * 골라인 자리 — 벽이 끝나고 입술이 시작되는 자리에 긋는 한 줄.
 *
 * 쟁반은 골라인 **밖**에 놓이고 입술만 안으로 넘어온다. 그러니 맞출 자리는
 * 벽 앞끝(y2)이다. 이 선을 인쇄된 골라인에 대면 골대가 정확히 골라인 밖에 선다.
 *
 * 파선으로 둔다 — 접는선은 일점쇄선이라 헷갈리지 않고, 오림선(실선)도 아니다.
 */
const goalLineOnLip = (g: Grid): string[] => [
  line(g.x2, g.y2, g.x3, g.y2, {
    stroke: RULE_COLOR,
    'stroke-width': 0.4,
    'stroke-dasharray': '2 1.5',
  }),
];

/**
 * 면 이름. 접다가 헷갈리지 않게 면 안에 작게 적는다.
 *
 * 글자 뒤에 흰 바탕을 깐다 — 벽에는 그물 격자가 깔려 있어 그냥 얹으면 읽히지
 * 않는다.
 */
const faceLabels = (g: Grid, index: number): string[] => {
  const sizeMm = 2.6;
  const label = (
    value: string,
    xMm: number,
    yMm: number,
    rotate = 0,
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
  return [
    ...label('뒷벽', (g.x2 + g.x3) / 2, (g.y0 + g.y1) / 2),
    ...label('옆벽', (g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2, -90),
    ...label('옆벽', (g.x3 + g.x4) / 2, (g.y1 + g.y2) / 2, -90),
    ...label('겹', (g.x0 + g.x1) / 2, (g.y1 + g.y2) / 2, -90),
    ...label('겹', (g.x4 + g.x5) / 2, (g.y1 + g.y2) / 2, -90),
    ...label('탭', (g.tabLeft + g.x2) / 2, (g.y0 + g.y1) / 2),
    ...label('탭', (g.x3 + g.tabRight) / 2, (g.y0 + g.y1) / 2),
    ...label(`골대 ${index + 1} 바닥`, (g.x2 + g.x3) / 2, (g.y1 + g.y2) / 2),
    ...label('↑ 이 선을 골라인에 맞춘다', (g.x2 + g.x3) / 2, g.y2 + 5),
    ...label(
      '입술 — 운동장 위에 얹는다',
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
 * 바닥과 입술은 접는선 없이 이어진 한 면이지만, 역할이 달라 따로 센다 —
 * 테스트가 "입술이 공이 넘을 턱 없이 이어져 있는가"를 두 면의 경계로 본다.
 */
export const goalNetFaces = (
  originXMm: number,
  originYMm: number,
): readonly Face[] => {
  const g = gridOf(originXMm, originYMm);
  return [
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
      heightMm: wallHeightMm,
    },
    {
      id: 'corner-tab-right',
      xMm: g.x3,
      yMm: g.y0,
      widthMm: cornerTabMm,
      heightMm: wallHeightMm,
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

/** 시트 위 두 벌의 좌상단. 왼쪽 단에 위아래로 놓고 오른쪽 단은 안내 몫이다. */
export const GOAL_NET_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [8, 26],
  [8, 108],
];

/**
 * 조립 도해 — 접는 법 옆에 붙는 넉 장.
 *
 * 글로만 적힌 "겹으로 문다"는 어느 것이 무엇을 무는지 알려 주지 않는다. 옆에서
 * 본 그림 한 컷이면 그게 끝난다. ④는 골대와 운동장 눈금의 관계를 보여 준다 —
 * 어디까지 밀어 넣는지가 이 도안에서 가장 헷갈리는 대목이다.
 */
const ASSEMBLY_DIAGRAM_WIDTH_MM = 56;
const ASSEMBLY_DIAGRAM_HEIGHT_MM = 26;
const ASSEMBLY_DIAGRAM_GAP_MM = 6;
const ASSEMBLY_DIAGRAM_ROW_MM = 34;

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
    leftMm + (i % 2) * (ASSEMBLY_DIAGRAM_WIDTH_MM + ASSEMBLY_DIAGRAM_GAP_MM);
  const rowYMm = (i: number) =>
    topMm + Math.floor(i / 2) * ASSEMBLY_DIAGRAM_ROW_MM;
  const centerXMm = (i: number) => colXMm(i) + ASSEMBLY_DIAGRAM_WIDTH_MM / 2;
  const baseOf = (i: number) => rowYMm(i) + ASSEMBLY_DIAGRAM_HEIGHT_MM - 4;
  const caption = (value: string, i: number) =>
    label(value, centerXMm(i), rowYMm(i) + ASSEMBLY_DIAGRAM_HEIGHT_MM + 4, 3);

  // ① 벽 셋을 세운다 — 앞에서 본 쟁반. 뚜껑이 없다는 것이 이 컷의 요점이다.
  const base0 = baseOf(0);
  const w = 30;
  const h = 11;
  const a = centerXMm(0) - w / 2;
  const one = [
    path(
      `M ${num(a)} ${num(base0 - h)} V ${num(base0)} H ${num(a + w)} V ${num(base0 - h)}`,
      bold,
    ),
    group(
      { stroke: RULE_COLOR, 'stroke-width': 0.12, fill: 'none' },
      netHatch(a + 0.8, base0 - h + 0.8, w - 1.6, h - 1.6, 3),
    ),
    // 위가 뚫려 있다는 표시 — 열린 변에만 점선을 얹는다.
    path(`M ${num(a)} ${num(base0 - h)} H ${num(a + w)}`, {
      ...thin,
      'stroke-dasharray': '1.5 1.5',
    }),
    label('위는 뚫려 있다', centerXMm(0), base0 - h - 2.4),
    caption('① 벽 셋을 세운다', 0),
  ];

  /**
   * ② 잠금 — 이 도안에서 유일하게 글로 설명하기 어려운 동작이다.
   *
   * 옆벽을 안쪽에서 마주 본 그림이다. 뒷벽에서 넘어온 탭(파선)이 벽에 서고,
   * 벽 위의 겹이 접혀 내려와 탭의 윗머리를 덮는다. 풀도 칼도 쓰지 않는 이유가
   * 이 한 컷에 다 들어 있다.
   */
  const base1 = baseOf(1);
  const wallWMm = 30;
  const wallHMm = 15;
  const hemHMm = 5;
  const tabWMm = 9;
  const wx = centerXMm(1) - wallWMm / 2;
  const wy = base1 - wallHMm;
  const two = [
    // 옆벽.
    rect(wx, wy, wallWMm, wallHMm, bold),
    // 탭 — 뒷모서리(왼쪽)에 서 있다. 겹에 덮이는 부분이 있으므로 먼저 그린다.
    rect(wx, wy, tabWMm, wallHMm, {
      ...thin,
      stroke: INK_COLOR,
      'stroke-dasharray': '1.4 1.2',
    }),
    // 겹 — 벽 위에서 접혀 내려와 탭 윗머리를 덮는다. 흰 바탕으로 덮어야
    // 탭의 파선이 겹 뒤로 사라져 "물렸다"가 보인다.
    rect(wx, wy, wallWMm, hemHMm, { fill: '#ffffff', stroke: 'none' }),
    rect(wx, wy, wallWMm, hemHMm, bold),
    // 겹이 내려오는 방향 — 벽 위에서 안으로 꺾여 내려온다.
    path(
      `M ${num(wx + wallWMm / 2 - 3)} ${num(wy - 6.5)} A 5 5 0 0 1 ${num(wx + wallWMm / 2 + 2)} ${num(wy - 2)}`,
      thin,
    ),
    path(
      `M ${num(wx + wallWMm / 2 + 0.2)} ${num(wy - 3.6)} L ${num(wx + wallWMm / 2 + 2.2)} ${num(wy - 1.6)} L ${num(wx + wallWMm / 2 + 4)} ${num(wy - 3.8)}`,
      thin,
    ),
    label('겹', wx + wallWMm - 6, wy + 3.6),
    label('탭', wx + tabWMm / 2, base1 - 3),
    label('옆벽', wx + wallWMm - 8, base1 - 3),
    caption('② 겹으로 탭을 문다', 1),
  ];

  // ③ 옆에서 본 완성 — 입술이 바닥과 한 장으로 이어져 턱이 없다.
  const base2 = baseOf(2);
  const c = centerXMm(2) - 16;
  const three = [
    // 바닥 + 입술 (한 줄), 뒷벽, 겹.
    path(`M ${num(c)} ${num(base2)} H ${num(c + 32)}`, bold),
    path(`M ${num(c)} ${num(base2)} V ${num(base2 - 10)}`, bold),
    path(`M ${num(c)} ${num(base2 - 10)} H ${num(c + 3)}`, bold),
    // 공이 입술을 타고 굴러 들어온다.
    path(`M ${num(c + 30)} ${num(base2 - 2.5)} H ${num(c + 12)}`, thin),
    path(
      `M ${num(c + 13.6)} ${num(base2 - 3.7)} L ${num(c + 11.6)} ${num(base2 - 2.5)} L ${num(c + 13.6)} ${num(base2 - 1.3)}`,
      thin,
    ),
    label('입술', c + 26, base2 + 3.4),
    label('턱이 없다', c + 13, base2 + 3.4),
    caption('③ 공이 굴러 들어온다', 2),
  ];

  // ④ 위에서 본 놓는 자리 — 골라인 눈금에 입술 좌우 끝을 맞춘다.
  const base3 = baseOf(3);
  const d = centerXMm(3) + 4;
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
    // 골대 — 눈금 사이에 맞춰 골라인 바깥(왼쪽)으로 놓인다. 입술만 안쪽으로
    // 넘어와 운동장 위에 얹힌다.
    rect(d - 9, base3 - 9 - halfMm, 9, halfMm * 2, bold),
    rect(d, base3 - 9 - halfMm, 4, halfMm * 2, {
      ...thin,
      'stroke-dasharray': '1 1',
    }),
    label('골대', d - 4.5, topEdgeYMm + 1),
    label('입술', d + 8.5, topEdgeYMm + 5.5),
    caption('④ 눈금에 맞춘다', 3),
  ];

  return [...one, ...two, ...three, ...four];
};

export const renderGoals = (): string => {
  const grids = GOAL_NET_ORIGINS.map(([x, y]) => gridOf(x, y));
  // 시트를 두 단으로 쓴다 — 왼쪽에 전개도 두 벌, 오른쪽에 접는 법과 도해.
  const assemblyLeftMm = 152;
  const assemblyTopMm = 32;
  const assemblyColumnMm = 120;
  const assemblyLineMm = 5.4;
  const assemblyFontMm = 3.2;
  const assemblyIndentMm = 5.4;
  // 번호를 왼쪽에 세우고 본문만 접는다 — 둘째 줄이 번호 아래로 흘러내리면
  // 항목 경계가 흐려진다.
  const assemblyLines = GOAL_ASSEMBLY_STEPS.flatMap((step, i) =>
    wrapText(step, assemblyFontMm, assemblyColumnMm - assemblyIndentMm).map(
      (value, line) => ({ index: i + 1, value, first: line === 0 }),
    ),
  );

  return svgDocument({
    widthMm: SHEETS.goals.widthMm,
    heightMm: SHEETS.goals.heightMm,
    title: '축구 게임판 · 골대 전개도',
    children: [
      markLayer(
        'cut',
        grids.map((g) => outline(g)),
      ),
      markLayer('fold-valley', grids.flatMap(folds)),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('골대 전개도 · 2개', 76, 12, 5, { 'text-anchor': 'middle' }),
        text(
          `골문 ${num(mouthWidthMm)}×${num(wallHeightMm)}mm · 풀도 칼도 쓰지 않는다`,
          76,
          19,
          3,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
        ...grids.flatMap(netArt),
        ...grids.flatMap(goalLineOnLip),
        ...grids.flatMap((g, i) => faceLabels(g, i)),

        text('접는 법', assemblyLeftMm, assemblyTopMm, 4, {
          'text-anchor': 'start',
        }),
        ...assemblyLines.flatMap(({ index, value, first }, i) => {
          const yMm = assemblyTopMm + assemblyLineMm * (i + 1.5);
          const body = text(
            value,
            assemblyLeftMm + assemblyIndentMm,
            yMm,
            assemblyFontMm,
            { 'text-anchor': 'start' },
          );
          return first
            ? [
                text(`${index}.`, assemblyLeftMm, yMm, assemblyFontMm, {
                  'text-anchor': 'start',
                }),
                body,
              ]
            : [body];
        }),

        ...assemblyDiagrams(
          assemblyLeftMm,
          assemblyTopMm + assemblyLineMm * (assemblyLines.length + 3),
        ),
      ]),
    ],
  });
};

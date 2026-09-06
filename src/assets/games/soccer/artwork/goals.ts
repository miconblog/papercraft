/**
 * 조립물 파트 — 골대 전개도 2벌 (IDE-004, 2026-09-05 재재작도)
 *
 * 구조는 **골라인 바깥에 세우는 바닥 없는 상자**다. 뒷벽 하나, 옆벽 둘, 창을
 * 낸 지붕 하나. 골문을 지난 공이 뒷벽에 막혀 상자 안에 멈추고, 지붕 창으로
 * 내려다보면 그 공이 보인다 — **골이 눈에 남는 것**이 이 구조의 목적이다.
 *
 * 전개도 한 벌:
 *
 * ```
 *        ┌──────────┐          ← 지붕(+ 좌우 풀칠탭). 가운데에 창을 오려낸다
 *   ┌────┼──────────┼────┐     ← 왼벽 · 뒷벽 · 오른벽
 *   └────┘          └────┘     ← 발 둘. 바깥으로 눕힌다
 * ```
 *
 * 왜 상자로 돌아왔는지, 그리고 2026-09-06에 왜 한 번 더 커졌는지는
 * `../dimensions.ts`의 `GOAL` 주석에 적었다.
 * 한 줄로 줄이면 **평면 프레임은 공을 세워 주지 못해 골인지 아닌지 보이지
 * 않았기 때문**이다. 다만 예전 터널과 달리 골라인 **바깥**에 서므로 필드 안
 * 공간을 쓰지 않고, 골 판정은 여전히 골라인이다.
 *
 * 바닥이 없다. 바닥을 깔면 종이 두께만큼 턱이 생겨 미끄러져 오는 공이 골문에서
 * 걸린다. 대신 옆벽 아래 발을 **바깥으로** 눕혀 세운다 — 안쪽으로 접으면 같은
 * 턱이 생긴다.
 *
 * 좌표는 전부 시트 절대 좌표로 펼친다. 레이어에 transform을 걸면 렌더러가
 * 표시선 굵기를 다시 입힐 때 변환까지 따라가야 해서 손해다.
 */
import {
  GOAL,
  GOAL_NET_SIZE,
  GOAL_ROOF_WINDOW,
  GOAL_ROOF_WINDOW_SIZE,
  SHEETS,
} from '../dimensions.ts';
import { GOAL_ASSEMBLY_STEPS } from '../rules.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  estimateTextWidthMm,
  glueHatch,
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

const { mouthWidthMm, mouthHeightMm, depthMm, footDepthMm, glueTabMm } = GOAL;

/** 전개도 한 벌의 세로·가로 구획선 위치. 원점은 전개도 좌상단이다. */
const gridOf = (originXMm: number, originYMm: number) => ({
  x0: originXMm,
  x1: originXMm + depthMm,
  x2: originXMm + depthMm + mouthWidthMm,
  x3: originXMm + GOAL_NET_SIZE.widthMm,
  tabLeft: originXMm + depthMm - glueTabMm,
  tabRight: originXMm + depthMm + mouthWidthMm + glueTabMm,
  y0: originYMm,
  y1: originYMm + depthMm,
  y2: originYMm + depthMm + mouthHeightMm,
  y3: originYMm + GOAL_NET_SIZE.heightMm,
});

type Grid = ReturnType<typeof gridOf>;

/** 바깥 윤곽 한 붓. 지붕 탭이 튀어나오고 두 발이 아래로 내려온 모양이다. */
const outline = (g: Grid): string =>
  path(
    [
      `M ${num(g.tabLeft)} ${num(g.y0)}`,
      `H ${num(g.tabRight)}`,
      `V ${num(g.y1)}`,
      `H ${num(g.x3)}`,
      `V ${num(g.y3)}`,
      `H ${num(g.x2)}`,
      `V ${num(g.y2)}`,
      `H ${num(g.x1)}`,
      `V ${num(g.y3)}`,
      `H ${num(g.x0)}`,
      `V ${num(g.y1)}`,
      `H ${num(g.tabLeft)}`,
      'Z',
    ].join(' '),
  );

/**
 * 지붕 창 — 오려서 떼어낸다.
 *
 * 앞 테두리(크로스바 쪽)를 다른 변보다 굵게 남긴다. 세우면 그 띠가 골문 위를
 * 가로지르는 크로스바가 되고, 나머지 테두리가 옆벽 둘을 붙들어 준다.
 */
const roofWindow = (g: Grid): string =>
  rect(
    g.x1 + GOAL_ROOF_WINDOW.sideBarMm,
    // 지붕은 뒷벽 위(y1)를 축으로 앞으로 접힌다 — 전개도에서 **y0 쪽 가장자리가
    // 골문 위**다. 앞 테두리를 그쪽에 남겨야 크로스바가 제자리에 온다.
    g.y0 + GOAL_ROOF_WINDOW.frontBarMm,
    GOAL_ROOF_WINDOW_SIZE.widthMm,
    GOAL_ROOF_WINDOW_SIZE.depthMm,
  );

/**
 * 접는선. 전부 산접기다 — 인쇄면이 골대 바깥을 향해야 하고, 지붕 탭도 아래로
 * 접혀 벽 안쪽에 붙으므로 인쇄면이 바깥을 본다.
 */
const folds = (g: Grid): string[] => [
  // 지붕/탭과 벽을 가르는 세로선
  line(g.x1, g.y0, g.x1, g.y2),
  line(g.x2, g.y0, g.x2, g.y2),
  // 지붕과 뒷벽
  line(g.x1, g.y1, g.x2, g.y1),
  // 옆벽과 발
  line(g.x0, g.y2, g.x1, g.y2),
  line(g.x2, g.y2, g.x3, g.y2),
];

const glueTabs = (g: Grid): string[] => [
  ...glueHatch(g.tabLeft, g.y0, glueTabMm, depthMm),
  ...glueHatch(g.x2, g.y0, glueTabMm, depthMm),
];

/** 그물 눈 간격. 촘촘하면 면이 통째로 검게 뭉쳐 면 이름까지 묻힌다. */
const NET_SPACING_MM = 4;

/**
 * 그물 격자.
 *
 * 인쇄면이 골대 **바깥**을 향하므로 이 격자는 밖에서 볼 때 보인다 — 뒤에서 보면
 * 뒷그물, 옆에서 보면 옆그물이다. 지붕은 창을 낸 테두리라 격자를 넣지 않는다.
 * 좁은 띠에 격자를 치면 검게 뭉쳐 크로스바가 안 보인다.
 */
const netArt = (g: Grid): string[] => [
  group({ stroke: RULE_COLOR, 'stroke-width': 0.12, fill: 'none' }, [
    // 뒷벽
    ...netHatch(g.x1, g.y1, mouthWidthMm, mouthHeightMm, NET_SPACING_MM),
    // 옆벽 둘
    ...netHatch(g.x0, g.y1, depthMm, mouthHeightMm, NET_SPACING_MM),
    ...netHatch(g.x2, g.y1, depthMm, mouthHeightMm, NET_SPACING_MM),
  ]),
];

/**
 * 크로스바 — 지붕 창의 **앞 테두리**에 얹는 굵은 선.
 *
 * 세우면 이 선이 골문 위를 가로지른다. 골대를 정면에서 알아보게 하는 것이
 * 이 한 줄이라, 그물 격자를 넣지 않고 비워 둔 자리에 그린다.
 */
const crossbar = (g: Grid): string =>
  line(
    g.x1 + GOAL_ROOF_WINDOW.sideBarMm,
    g.y0 + GOAL_ROOF_WINDOW.frontBarMm / 2,
    g.x2 - GOAL_ROOF_WINDOW.sideBarMm,
    g.y0 + GOAL_ROOF_WINDOW.frontBarMm / 2,
    { stroke: INK_COLOR, 'stroke-width': 1, 'stroke-linecap': 'round' },
  );

/**
 * 면 이름. 접다가 헷갈리지 않게 면 안에 작게 적는다.
 *
 * 글자 뒤에 흰 바탕을 깐다 — 벽에는 그물 격자가 깔려 있어 그냥 얹으면 읽히지
 * 않는다. 지붕에는 이름을 두지 않는다. 창을 오려내고 남는 테두리가 3–4mm뿐이라
 * 글자가 면 밖으로 삐져나간다.
 */
const faceLabels = (g: Grid, index: number): string[] => {
  const sizeMm = 2.6;
  const label = (value: string, xMm: number, yMm: number) => [
    rect(
      xMm - estimateTextWidthMm(value, sizeMm) / 2 - 0.6,
      yMm - sizeMm * 0.75,
      estimateTextWidthMm(value, sizeMm) + 1.2,
      sizeMm * 1.5,
      { fill: '#ffffff', stroke: 'none' },
    ),
    text(value, xMm, yMm, sizeMm, {
      fill: RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
    }),
  ];
  return [
    ...label(`골대 ${index + 1}`, (g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2),
    ...label('옆벽', (g.x0 + g.x1) / 2, (g.y1 + g.y2) / 2),
    ...label('옆벽', (g.x2 + g.x3) / 2, (g.y1 + g.y2) / 2),
    ...label('발', (g.x0 + g.x1) / 2, (g.y2 + g.y3) / 2),
    ...label('발', (g.x2 + g.x3) / 2, (g.y2 + g.y3) / 2),
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
 * 전개도를 이루는 면들. 접었을 때 실제로 서는지(지붕이 옆벽 위에 정확히 얹히는지,
 * 발이 바닥에 닿는지)를 테스트가 이 값으로 확인한다.
 *
 * 지붕 창은 오려서 떼어내는 구멍이라 면이 아니다 — `goalRoofWindowRect`로 준다.
 */
export const goalNetFaces = (
  originXMm: number,
  originYMm: number,
): readonly Face[] => {
  const g = gridOf(originXMm, originYMm);
  return [
    {
      id: 'roof',
      xMm: g.x1,
      yMm: g.y0,
      widthMm: mouthWidthMm,
      heightMm: depthMm,
    },
    {
      id: 'glue-tab-left',
      xMm: g.tabLeft,
      yMm: g.y0,
      widthMm: glueTabMm,
      heightMm: depthMm,
    },
    {
      id: 'glue-tab-right',
      xMm: g.x2,
      yMm: g.y0,
      widthMm: glueTabMm,
      heightMm: depthMm,
    },
    {
      id: 'wall-left',
      xMm: g.x0,
      yMm: g.y1,
      widthMm: depthMm,
      heightMm: mouthHeightMm,
    },
    {
      id: 'wall-back',
      xMm: g.x1,
      yMm: g.y1,
      widthMm: mouthWidthMm,
      heightMm: mouthHeightMm,
    },
    {
      id: 'wall-right',
      xMm: g.x2,
      yMm: g.y1,
      widthMm: depthMm,
      heightMm: mouthHeightMm,
    },
    {
      id: 'foot-left',
      xMm: g.x0,
      yMm: g.y2,
      widthMm: depthMm,
      heightMm: footDepthMm,
    },
    {
      id: 'foot-right',
      xMm: g.x2,
      yMm: g.y2,
      widthMm: depthMm,
      heightMm: footDepthMm,
    },
  ];
};

/** 오려내는 지붕 창. 위에서 상자 안 공을 보는 구멍이다. */
export const goalRoofWindowRect = (
  originXMm: number,
  originYMm: number,
): Face => {
  const g = gridOf(originXMm, originYMm);
  return {
    id: 'roof-window',
    xMm: g.x1 + GOAL_ROOF_WINDOW.sideBarMm,
    yMm: g.y0 + GOAL_ROOF_WINDOW.frontBarMm,
    widthMm: GOAL_ROOF_WINDOW_SIZE.widthMm,
    heightMm: GOAL_ROOF_WINDOW_SIZE.depthMm,
  };
};

/**
 * 시트 위 두 벌의 좌상단.
 *
 * 한 벌이 88×52mm라 A5 가로(210×148.5) 폭에 둘이 나란히 서면 좌우 12mm·사이
 * 10mm가 남는다. 아래 절반은 접는 법과 도해 몫이다.
 */
export const GOAL_NET_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [12, 22],
  [110, 22],
];

/**
 * 조립 도해 — 접는 법 옆에 붙는 세 컷.
 *
 * 글로만 적힌 순서는 "바깥으로 접는다"가 어느 쪽인지 알려 주지 않는다. 옆에서
 * 본 그림 한 컷이면 그게 끝난다. ③은 골대와 운동장 눈금의 관계를 보여 준다 —
 * 눈금에 무엇을 맞추는지가 이 도안에서 가장 헷갈리는 대목이다.
 */
const ASSEMBLY_DIAGRAM_WIDTH_MM = 40;
const ASSEMBLY_DIAGRAM_HEIGHT_MM = 20;
const ASSEMBLY_DIAGRAM_GAP_MM = 12;

const assemblyDiagrams = (leftMm: number, topMm: number): string[] => {
  const thin = { fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 };
  const bold = { fill: 'none', stroke: INK_COLOR, 'stroke-width': 0.55 };
  const label = (value: string, xMm: number, yMm: number, sizeMm = 2.2) =>
    text(value, xMm, yMm, sizeMm, {
      fill: RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
    });
  const caption = (value: string, xMm: number) =>
    label(value, xMm, topMm + ASSEMBLY_DIAGRAM_HEIGHT_MM + 4.5, 3.2);

  const stepXMm = (i: number) =>
    leftMm + i * (ASSEMBLY_DIAGRAM_WIDTH_MM + ASSEMBLY_DIAGRAM_GAP_MM);
  const centerXMm = (i: number) => stepXMm(i) + ASSEMBLY_DIAGRAM_WIDTH_MM / 2;
  const baseYMm = topMm + ASSEMBLY_DIAGRAM_HEIGHT_MM - 3;

  // ① 정면에서 본 골대 — 골문과 그 위 크로스바. 실제 골문 비율(2:1)로 그린다.
  const w = 24;
  const h = 12;
  const a = centerXMm(0) - w / 2;
  const one = [
    path(
      `M ${num(a)} ${num(baseYMm)} V ${num(baseYMm - h)} H ${num(a + w)} V ${num(baseYMm)}`,
      bold,
    ),
    // 상자 안 뒷벽 그물.
    group(
      { stroke: RULE_COLOR, 'stroke-width': 0.12, fill: 'none' },
      netHatch(a + 1, baseYMm - h + 1, w - 2, h - 2, 3.4),
    ),
    caption('① 오린다', centerXMm(0)),
  ];

  // ② 옆에서 본 접기 — 벽을 세우고 발을 바깥으로 눕힌다. 지붕 9 : 벽 13으로
  // 깊이(18)보다 높이(26)가 큰 실제 비례를 따른다.
  const b = centerXMm(1) - 5;
  const two = [
    // 지붕
    path(`M ${num(b)} ${num(baseYMm - 13)} H ${num(b + 9)}`, bold),
    // 뒷벽
    path(`M ${num(b)} ${num(baseYMm - 13)} V ${num(baseYMm)}`, bold),
    // 발 — 바깥(왼쪽)으로 눕는다.
    path(`M ${num(b)} ${num(baseYMm)} H ${num(b - 7)}`, bold),
    // 눕는 방향. 발 선과 겹치지 않게 위쪽에서 돌아 내려온다.
    path(
      `M ${num(b - 1)} ${num(baseYMm - 7)} A 7 7 0 0 0 ${num(b - 6)} ${num(baseYMm - 2.4)}`,
      thin,
    ),
    path(
      `M ${num(b - 4.4)} ${num(baseYMm - 3.6)} L ${num(b - 6.4)} ${num(baseYMm - 2)} L ${num(b - 3.8)} ${num(baseYMm - 1.2)}`,
      thin,
    ),
    label('발', b - 3.5, baseYMm + 3.2),
    caption('② 발을 바깥으로', centerXMm(1)),
  ];

  // ③ 위에서 본 놓는 자리 — 골라인 눈금에 골대 앞면 좌우를 맞춘다.
  const c = centerXMm(2) + 3;
  const halfMm = 7;
  const topEdgeYMm = baseYMm - 16;
  const three = [
    // 골라인.
    path(`M ${num(c)} ${num(topEdgeYMm - 1)} V ${num(baseYMm + 1)}`, thin),
    // 운동장 눈금 셋.
    ...[-halfMm, halfMm].map((offsetMm) =>
      path(
        `M ${num(c - 2.5)} ${num(baseYMm - 8 + offsetMm)} H ${num(c + 1.5)}`,
        bold,
      ),
    ),
    path(`M ${num(c)} ${num(baseYMm - 8)} H ${num(c + 1.5)}`, bold),
    // 골대 — 눈금 사이에 맞춰 골라인 바깥(왼쪽)으로 놓인다.
    rect(c - 5, baseYMm - 8 - halfMm, 5, halfMm * 2, {
      ...thin,
      'stroke-dasharray': '1 1',
    }),
    // 공이 들어오는 방향.
    path(`M ${num(c + 13)} ${num(baseYMm - 8)} H ${num(c + 3)}`, thin),
    path(
      `M ${num(c + 4.6)} ${num(baseYMm - 9.2)} L ${num(c + 2.6)} ${num(baseYMm - 8)} L ${num(c + 4.6)} ${num(baseYMm - 6.8)}`,
      thin,
    ),
    label('골대', c - 4.5, topEdgeYMm - 0.5),
    label('눈금', c + 6, topEdgeYMm + 5),
    caption('③ 눈금에 맞춘다', centerXMm(2)),
  ];

  return [...one, ...two, ...three];
};

export const renderGoals = (): string => {
  const grids = GOAL_NET_ORIGINS.map(([x, y]) => gridOf(x, y));
  const assemblyLeftMm = 24;
  // 전개도가 커져 바닥이 y=74까지 내려왔다. 글 블록은 그 아래에서 시작하되
  // 줄간을 조금 좁혀 도해까지 시트 안에 담는다.
  const assemblyTopMm = 80;
  const assemblyLineMm = 5.2;
  const assemblyFontMm = 3.2;
  const assemblyIndentMm = 5.4;
  // 번호를 왼쪽에 세우고 본문만 접는다 — 둘째 줄이 번호 아래로 흘러내리면
  // 항목 경계가 흐려진다.
  const assemblyLines = GOAL_ASSEMBLY_STEPS.flatMap((step, i) =>
    wrapText(
      step,
      assemblyFontMm,
      SHEETS.goals.widthMm - assemblyLeftMm * 2 - assemblyIndentMm,
    ).map((value, line) => ({ index: i + 1, value, first: line === 0 })),
  );

  return svgDocument({
    widthMm: SHEETS.goals.widthMm,
    heightMm: SHEETS.goals.heightMm,
    title: '축구 게임판 · 골대 전개도',
    children: [
      markLayer('cut', [
        ...grids.map((g) => outline(g)),
        ...grids.map((g) => roofWindow(g)),
      ]),
      markLayer('fold-mountain', grids.flatMap(folds)),
      markLayer('glue', grids.flatMap(glueTabs)),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('골대 전개도 · 2개', SHEETS.goals.widthMm / 2, 12, 5, {
          'text-anchor': 'middle',
        }),
        text(
          `골문 ${num(mouthWidthMm)}×${num(mouthHeightMm)}mm · 깊이 ${num(depthMm)}mm · 골라인 바깥에 세운다`,
          SHEETS.goals.widthMm / 2,
          19,
          3,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
        ...grids.flatMap(netArt),
        ...grids.map((g) => crossbar(g)),
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
          assemblyTopMm + assemblyLineMm * (assemblyLines.length + 2.2),
        ),
      ]),
    ],
  });
};

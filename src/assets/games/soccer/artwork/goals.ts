/**
 * 조립물 파트 — 골대 전개도 2벌 (IDE-004)
 *
 * 구조는 **바닥이 없는 터널**이다. 뒷벽 하나, 옆벽 둘, 지붕 하나. 바닥을 깔면
 * 종이 두께만큼 턱이 생겨 미끄러져 오는 공이 입구에서 걸린다. 대신 옆벽 아래에
 * 바깥으로 눕는 발을 달아 세운다.
 *
 * 전개도 한 벌:
 *
 * ```
 *        ┌──────┐            ← 지붕(+ 좌우 풀칠탭)
 *   ┌────┼──────┼────┐       ← 왼벽 · 뒷벽 · 오른벽
 *   └────┘      └────┘       ← 발 둘
 * ```
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
  glueHatch,
  group,
  line,
  markLayer,
  num,
  path,
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

/** 어느 면이 무엇인지. 접다가 헷갈리지 않게 면 안에 작게 적는다. */
const faceLabels = (g: Grid, index: number): string[] => {
  const label = (value: string, xMm: number, yMm: number) =>
    text(value, xMm, yMm, 2.6, {
      fill: RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
    });
  return [
    label('지붕', (g.x1 + g.x2) / 2, (g.y0 + g.y1) / 2),
    label(`골대 ${index + 1}`, (g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2),
    label('옆벽', (g.x0 + g.x1) / 2, (g.y1 + g.y2) / 2),
    label('옆벽', (g.x2 + g.x3) / 2, (g.y1 + g.y2) / 2),
    label('발', (g.x0 + g.x1) / 2, (g.y2 + g.y3) / 2),
    label('발', (g.x2 + g.x3) / 2, (g.y2 + g.y3) / 2),
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

/** 시트 위 두 벌의 좌상단. */
export const GOAL_NET_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [24, 24],
  [114, 24],
];

export const renderGoals = (): string => {
  const grids = GOAL_NET_ORIGINS.map(([x, y]) => gridOf(x, y));
  const assemblyLeftMm = 24;
  const assemblyTopMm = 78;
  const assemblyLineMm = 5.4;
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
      markLayer(
        'cut',
        grids.map((g) => outline(g)),
      ),
      markLayer('fold-mountain', grids.flatMap(folds)),
      markLayer('glue', grids.flatMap(glueTabs)),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('골대 전개도 · 2개', SHEETS.goals.widthMm / 2, 14, 5, {
          'text-anchor': 'middle',
        }),
        text(
          `입구 ${num(mouthWidthMm)}×${num(mouthHeightMm)}mm · 깊이 ${num(depthMm)}mm`,
          SHEETS.goals.widthMm / 2,
          21,
          3,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
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
      ]),
    ],
  });
};

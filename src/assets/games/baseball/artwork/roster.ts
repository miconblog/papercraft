/**
 * 부속 파트 — 선수 로스터 기록 용지 (2026-09-12 사용자 요청)
 *
 * "1번부터 9번까지 선수 기록을 적을 수 있는 기록용 용지가 있으면 좋겠어."
 *
 * 스코어보드가 **이닝마다 몇 점**을 적는 종이라면 이쪽은 **누가 몇 번 쳐서 몇 번
 * 살았나**를 적는 종이다. 표 한 벌이 한 팀의 타순 아홉이고, 한 경기에 두 팀이
 * 필요하므로 한 장에 두 벌을 얹는다.
 *
 * **표 안은 전부 비어 있다** — 스코어보드·축구 점수 기록칸과 같은 규약이다
 * (2026-09-08). 이름도 기호도 아이가 직접 쓰는 자리다.
 *
 * 오른쪽 끝 세 열이 이 용지의 목적이다: 타수 · 안타 · **타율**. 타율은 나눗셈이라
 * 여섯 살이 못 하므로, 종이 아래에 **조견표**를 둬서 타수와 안타가 만나는 칸을
 * 찾아 옮겨 적게 했다.
 */
import {
  ROSTER,
  ROSTER_GUIDE,
  ROSTER_TABLE_WIDTH_MM,
  SHEETS,
  battingAverage,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  line,
  markLayer,
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const SHEET = SHEETS.roster;
const LEFT = ROSTER.xMm;
const RIGHT = LEFT + ROSTER_TABLE_WIDTH_MM;

/** 열 경계 x — 타순 · 이름 · 자리 · 타석 다섯 · 타수 · 안타 · 타율. */
const COLUMN_WIDTHS_MM: readonly number[] = [
  ROSTER.orderColumnMm,
  ROSTER.nameColumnMm,
  ROSTER.positionColumnMm,
  ...Array.from({ length: ROSTER.atBats }, () => ROSTER.atBatColumnMm),
  ROSTER.countColumnMm,
  ROSTER.countColumnMm,
  ROSTER.averageColumnMm,
];

export const COLUMN_LABELS: readonly string[] = [
  '타순',
  '선수 이름',
  '자리',
  ...Array.from({ length: ROSTER.atBats }, (_, i) => `${i + 1}타석`),
  '타수',
  '안타',
  '타율',
];

const EDGES: readonly number[] = COLUMN_WIDTHS_MM.reduce<number[]>(
  (edges, width) => [...edges, edges[edges.length - 1] + width],
  [LEFT],
);

const columnCenterMm = (index: number): number =>
  (EDGES[index] + EDGES[index + 1]) / 2;

/** 팀 이름과 날짜를 적는 줄. 표 위에 얇게 앉는다. */
const teamLine = (topYMm: number): string[] => {
  const baselineMm = topYMm + 5;
  const ruleYMm = baselineMm + 1.2;
  return [
    text('팀 이름', LEFT, baselineMm, ROSTER.headerFontMm, {
      fill: RULE_COLOR,
    }),
    line(LEFT + 16, ruleYMm, LEFT + 95, ruleYMm, {
      stroke: RULE_COLOR,
      'stroke-width': 0.3,
    }),
    text('날짜', LEFT + 105, baselineMm, ROSTER.headerFontMm, {
      fill: RULE_COLOR,
    }),
    line(LEFT + 116, ruleYMm, RIGHT, ruleYMm, {
      stroke: RULE_COLOR,
      'stroke-width': 0.3,
    }),
  ];
};

/** 표 한 벌 — 한 팀. 머리글 한 줄과 타순 아홉 줄이다. */
const rosterTable = (blockTopYMm: number): string[] => {
  const tableTopMm = blockTopYMm + ROSTER.teamLineHeightMm;
  const bodyTopMm = tableTopMm + ROSTER.headerHeightMm;
  const bottomMm = bodyTopMm + ROSTER.rowHeightMm * ROSTER.rows;

  return [
    ...teamLine(blockTopYMm),
    group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
      ...EDGES.map((x) => line(x, tableTopMm, x, bottomMm)),
      line(LEFT, tableTopMm, RIGHT, tableTopMm),
      ...Array.from({ length: ROSTER.rows }, (_, i) =>
        line(
          LEFT,
          bodyTopMm + ROSTER.rowHeightMm * (i + 1),
          RIGHT,
          bodyTopMm + ROSTER.rowHeightMm * (i + 1),
        ),
      ),
      // 머리글 아래만 굵게 — 표가 '이름 줄'과 '기록 줄' 두 덩이로 읽힌다.
      line(LEFT, bodyTopMm, RIGHT, bodyTopMm, {
        'stroke-width': 0.5,
        stroke: INK_COLOR,
      }),
    ]),
    ...COLUMN_LABELS.map((label, i) =>
      text(
        label,
        columnCenterMm(i),
        tableTopMm + ROSTER.headerHeightMm / 2 + 1.1,
        ROSTER.headerFontMm,
        { 'text-anchor': 'middle' },
      ),
    ),
    // 타순 번호는 미리 찍는다 — 1번부터 9번까지가 이 용지의 뼈대다.
    ...Array.from({ length: ROSTER.rows }, (_, i) =>
      text(
        String(i + 1),
        columnCenterMm(0),
        bodyTopMm + ROSTER.rowHeightMm * i + ROSTER.rowHeightMm / 2 + 1.3,
        ROSTER.orderFontMm,
        { 'text-anchor': 'middle' },
      ),
    ),
  ];
};

/** 타율 조견표 — 가로가 안타, 세로가 타수다. */
const averageGuide = (): string[] => {
  const { topYMm, labelColumnMm, cellWidthMm, cellHeightMm, maxAtBats } =
    ROSTER_GUIDE;
  const columns = maxAtBats + 1; // 안타 0~5
  const widthMm = labelColumnMm + cellWidthMm * columns;
  const heightMm = cellHeightMm * (maxAtBats + 1); // 머리글 한 줄 + 타수 다섯 줄
  const columnXMm = (i: number): number =>
    LEFT + labelColumnMm + cellWidthMm * i + cellWidthMm / 2;
  const rowYMm = (i: number): number =>
    topYMm + cellHeightMm * i + cellHeightMm / 2 + 0.9;

  return [
    text('타율 조견표', LEFT, topYMm - 2.5, ROSTER.headerFontMm, {
      fill: RULE_COLOR,
    }),
    group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
      ...Array.from({ length: columns + 2 }, (_, i) =>
        line(
          LEFT + (i === 0 ? 0 : labelColumnMm + cellWidthMm * (i - 1)),
          topYMm,
          LEFT + (i === 0 ? 0 : labelColumnMm + cellWidthMm * (i - 1)),
          topYMm + heightMm,
        ),
      ),
      ...Array.from({ length: maxAtBats + 2 }, (_, i) =>
        line(
          LEFT,
          topYMm + cellHeightMm * i,
          LEFT + widthMm,
          topYMm + cellHeightMm * i,
        ),
      ),
    ]),
    text(
      '타수＼안타',
      LEFT + labelColumnMm / 2,
      rowYMm(0),
      ROSTER_GUIDE.fontMm,
      {
        'text-anchor': 'middle',
        fill: RULE_COLOR,
      },
    ),
    ...Array.from({ length: columns }, (_, hits) =>
      text(String(hits), columnXMm(hits), rowYMm(0), ROSTER_GUIDE.fontMm, {
        'text-anchor': 'middle',
      }),
    ),
    ...Array.from({ length: maxAtBats }, (_, i) => {
      const atBats = i + 1;
      return [
        text(
          String(atBats),
          LEFT + labelColumnMm / 2,
          rowYMm(atBats),
          ROSTER_GUIDE.fontMm,
          { 'text-anchor': 'middle' },
        ),
        ...Array.from({ length: columns }, (_, hits) =>
          hits > atBats
            ? ''
            : text(
                battingAverage(hits, atBats),
                columnXMm(hits),
                rowYMm(atBats),
                ROSTER_GUIDE.fontMm,
                { 'text-anchor': 'middle' },
              ),
        ).filter(Boolean),
      ];
    }).flat(),
  ];
};

/** 기록하는 법 — 조견표 오른쪽에 선다. */
export const ROSTER_NOTES: readonly string[] = [
  '타석이 끝날 때마다 기호를 적는다',
  '안타 ○ · 2루타 ◎ · 홈런 ☆ · 아웃 ×',
  '파울은 적지 않는다 — 타석이 끝난 게 아니다',
  '타수 = 적은 기호의 수 · 안타 = ○ ◎ ☆의 수',
  '타율 = 안타 ÷ 타수 (왼쪽 표에서 찾아 적어도 된다)',
];

export const renderRoster = (): string =>
  svgDocument({
    widthMm: SHEET.widthMm,
    heightMm: SHEET.heightMm,
    title: '야구 게임판 · 선수 로스터',
    children: [
      markLayer('cut', [
        rect(
          ROSTER.cutInsetMm,
          ROSTER.cutInsetMm,
          SHEET.widthMm - ROSTER.cutInsetMm * 2,
          SHEET.heightMm - ROSTER.cutInsetMm * 2,
        ),
      ]),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text(
          '선수 로스터 · 타격 기록',
          SHEET.widthMm / 2,
          ROSTER.titleYMm,
          5.5,
          {
            'text-anchor': 'middle',
          },
        ),
        text(
          '한 표가 한 팀이다. 타순대로 이름을 적고 타석마다 결과를 남기면, 경기가 끝났을 때 타율이 나온다.',
          SHEET.widthMm / 2,
          ROSTER.titleYMm + 5,
          ROSTER.noteFontMm,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
        ...ROSTER.blockTopYMm.flatMap((topYMm) => rosterTable(topYMm)),
        ...averageGuide(),
        ...ROSTER_NOTES.map((note, i) =>
          text(
            note,
            LEFT +
              ROSTER_GUIDE.labelColumnMm +
              ROSTER_GUIDE.cellWidthMm * 6 +
              8,
            ROSTER_GUIDE.topYMm + 4 + i * 5.4,
            ROSTER.noteFontMm,
            { fill: RULE_COLOR },
          ),
        ),
      ]),

      // 표 안은 비워 둔다 — 이름도 기호도 아이가 직접 쓰는 자리다.
      '<g id="pc-slot" />',
    ],
  });

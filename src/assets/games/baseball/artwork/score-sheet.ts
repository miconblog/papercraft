/**
 * 부속 파트 — 스코어보드 (IDE-014)
 *
 * 옛 인쇄본은 스코어보드를 판 아래에 인쇄했다. 우리는 별지로 뺀다 — 판 위에
 * 남길 것은 한 타석 동안 바뀌는 것(아웃·주자)뿐이고, 이닝별 점수는 경기가
 * 끝난 뒤에도 남아야 하는 기록이기 때문이다. 판을 다시 쓰려면 지워야 하는
 * 숫자를 판에 적게 두면 판이 한 경기밖에 못 산다.
 *
 * **표 안은 전부 비어 있다.** 축구 게임판의 점수 기록칸과 같은 규약이다
 * (2026-09-08) — 팀 이름을 아이가 직접 쓰는 자리라 색이나 이름이 미리 정해져
 * 있으면 오히려 걸린다.
 *
 * 한 장에 표가 **다섯 벌** 들어가 다섯 판을 적는다(2026-09-08 사용자 요청).
 * 처음에는 A5 가로에 두 벌이었는데 A4에 얹으면 아래 절반이 남았다 — 표는 폭이
 * 고정(190mm)이라 옆으로 못 늘리고 세로로만 늘어나므로, 남는 자리를 표로 채웠다.
 */
import { SCORE_TABLE, SCORE_TABLE_WIDTH_MM, SHEETS } from '../dimensions.ts';
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

const {
  cutInsetMm,
  xMm,
  topYMm,
  rowHeightMm,
  teamColumnMm,
  inningColumnMm,
  innings,
  totalColumnMm,
} = SCORE_TABLE;

const SHEET = SHEETS.scoreSheet;
const tableRightMm = xMm + SCORE_TABLE_WIDTH_MM;

/** 열 경계 x — 팀 이름 열 · 이닝 아홉 · 합계 둘. */
const columnEdgesMm = (): number[] => {
  const edges = [xMm, xMm + teamColumnMm];
  for (let i = 0; i < innings; i += 1) {
    edges.push(edges[edges.length - 1] + inningColumnMm);
  }
  edges.push(edges[edges.length - 1] + totalColumnMm);
  edges.push(edges[edges.length - 1] + totalColumnMm);
  return edges;
};

const EDGES = columnEdgesMm();

/** 머리글 칸의 가운데 x. 이닝 번호와 합계 이름이 여기 앉는다. */
const columnCenterMm = (index: number): number =>
  (EDGES[index] + EDGES[index + 1]) / 2;

/**
 * 표 한 벌. 머리글 한 줄 + 팀 두 줄이다.
 *
 * 팀 이름 열의 머리글에는 옅은 안내만 둔다 — 그 아래 두 칸이 곧 두 팀이고,
 * 어느 칸이 어느 팀인지는 아이의 손글씨가 정한다.
 */
const scoreTable = (tableTopYMm: number, index: number): string[] => {
  const bodyTopMm = tableTopYMm + rowHeightMm;
  const bottomMm = tableTopYMm + rowHeightMm * 3;

  return [
    text(`${index + 1}번째 판`, xMm, tableTopYMm - 4, 3.4, {
      fill: RULE_COLOR,
      'text-anchor': 'start',
    }),
    group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
      ...EDGES.map((x) => line(x, tableTopYMm, x, bottomMm)),
      line(xMm, tableTopYMm, tableRightMm, tableTopYMm),
      line(xMm, bodyTopMm + rowHeightMm, tableRightMm, bodyTopMm + rowHeightMm),
      line(xMm, bottomMm, tableRightMm, bottomMm),
      // 머리글 아래만 굵게 — 표가 '이닝 줄'과 '팀 줄' 두 덩이로 읽힌다.
      line(xMm, bodyTopMm, tableRightMm, bodyTopMm, {
        'stroke-width': 0.5,
        stroke: INK_COLOR,
      }),
    ]),

    // 팀 이름 열의 머리글은 옅은 안내만 둔다 — 두 줄 다 아이가 쓰는 자리다.
    text(
      '팀 이름',
      xMm + teamColumnMm / 2,
      tableTopYMm + rowHeightMm / 2,
      3.2,
      {
        'text-anchor': 'middle',
        fill: RULE_COLOR,
      },
    ),
    ...Array.from({ length: innings }, (_, i) =>
      text(
        String(i + 1),
        columnCenterMm(i + 1),
        tableTopYMm + rowHeightMm / 2,
        3.6,
        { 'text-anchor': 'middle' },
      ),
    ),
    ...(['점수', '안타'] as const).map((label, i) =>
      text(
        label,
        columnCenterMm(innings + 1 + i),
        tableTopYMm + rowHeightMm / 2,
        3.4,
        { 'text-anchor': 'middle' },
      ),
    ),
  ];
};

export const renderScoreSheet = (): string =>
  svgDocument({
    widthMm: SHEET.widthMm,
    heightMm: SHEET.heightMm,
    title: '야구 게임판 · 스코어보드',
    children: [
      markLayer('cut', [
        rect(
          cutInsetMm,
          cutInsetMm,
          SHEET.widthMm - cutInsetMm * 2,
          SHEET.heightMm - cutInsetMm * 2,
        ),
      ]),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('스코어보드', SHEET.widthMm / 2, 16, 5.5, {
          'text-anchor': 'middle',
        }),
        ...topYMm.flatMap((yMm, i) => scoreTable(yMm, i)),
        text(
          `이닝마다 그 회에 낸 점수를 적고, 경기가 끝나면 점수와 안타를 합쳐 적는다. 표 ${topYMm.length}벌이니 ${topYMm.length}판을 적을 수 있다.`,
          xMm,
          topYMm[topYMm.length - 1] + rowHeightMm * 3 + 6,
          2.8,
          { fill: RULE_COLOR, 'text-anchor': 'start' },
        ),
      ]),

      // 표 안은 비워 둔다 — 팀 이름도 점수도 아이가 직접 쓰는 자리다.
      '<g id="pc-slot" />',
    ],
  });

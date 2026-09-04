/**
 * 부속 파트 — 점수 기록칸 (IDE-004)
 *
 * 사용자가 만든 판은 종이 네 변에 손글씨로 점수를 이어 적었다. 그 자리를 보드에서
 * 떼어내 별지로 옮긴 것이 이 파트다 — 운동장에는 공이 지나갈 면만 남긴다.
 */
import {
  SCORE_TABLE,
  SCORE_TABLE_WIDTH_MM,
  SCORE_TEAM_NAME_Y_MM,
  SHEETS,
  scoreTeamColumnCenterXMm,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  line,
  markLayer,
  num,
  rect,
  svgDocument,
  text,
} from './svg.ts';

const {
  cutInsetMm,
  xMm,
  headerYMm,
  headerHeightMm,
  rowHeightMm,
  rows,
  indexColumnMm,
  colorBarHeightMm,
} = SCORE_TABLE;

const tableRightMm = xMm + SCORE_TABLE_WIDTH_MM;
const bodyTopMm = headerYMm + headerHeightMm;
const tableBottomMm = bodyTopMm + rowHeightMm * rows;
/** 열 경계 x. 판 번호 열 + 두 팀 열. */
const columnEdgesMm = [
  xMm,
  xMm + indexColumnMm,
  scoreTeamColumnCenterXMm(0) + SCORE_TABLE.teamColumnMm / 2,
  tableRightMm,
];

const teamColorBar = (index: 0 | 1, layerId: string, fill: string): string =>
  group({ id: layerId, fill, stroke: 'none' }, [
    rect(
      columnEdgesMm[index + 1],
      headerYMm,
      SCORE_TABLE.teamColumnMm,
      colorBarHeightMm,
    ),
  ]);

export const renderScoreSheet = (): string =>
  svgDocument({
    widthMm: SHEETS.scoreSheet.widthMm,
    heightMm: SHEETS.scoreSheet.heightMm,
    title: '축구 게임판 · 점수 기록칸',
    children: [
      markLayer('cut', [
        rect(
          cutInsetMm,
          cutInsetMm,
          SHEETS.scoreSheet.widthMm - cutInsetMm * 2,
          SHEETS.scoreSheet.heightMm - cutInsetMm * 2,
        ),
      ]),

      teamColorBar(0, 'pc-team-home', '#1d4ed8'),
      teamColorBar(1, 'pc-team-away', '#dc2626'),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('점수 기록', SHEETS.scoreSheet.widthMm / 2, 18, 5.5, {
          'text-anchor': 'middle',
        }),

        // 괘선. 헤더 아래만 굵게 해 표가 두 덩이로 읽히게 한다.
        group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
          ...columnEdgesMm.map((x) => line(x, headerYMm, x, tableBottomMm)),
          line(xMm, headerYMm, tableRightMm, headerYMm),
          ...Array.from({ length: rows }, (_, i) => {
            const y = bodyTopMm + rowHeightMm * (i + 1);
            return line(xMm, y, tableRightMm, y);
          }),
          line(xMm, bodyTopMm, tableRightMm, bodyTopMm, {
            'stroke-width': 0.5,
            stroke: INK_COLOR,
          }),
        ]),

        text('판', xMm + indexColumnMm / 2, SCORE_TEAM_NAME_Y_MM, 4, {
          'text-anchor': 'middle',
        }),
        ...Array.from({ length: rows }, (_, i) =>
          text(
            String(i + 1),
            xMm + indexColumnMm / 2,
            bodyTopMm + rowHeightMm * (i + 0.5),
            3.6,
            { fill: RULE_COLOR, 'text-anchor': 'middle' },
          ),
        ),

        text(
          '한 판이 끝날 때마다 양쪽 점수를 적는다. 칸이 모자라면 한 장 더 뽑는다.',
          xMm,
          tableBottomMm + 2.6,
          2.8,
          { fill: RULE_COLOR, 'text-anchor': 'start' },
        ),
      ]),

      `<!-- 팀 이름: y=${num(SCORE_TEAM_NAME_Y_MM)}, x=${num(
        scoreTeamColumnCenterXMm(0),
      )} / ${num(scoreTeamColumnCenterXMm(1))} -->`,
      '<g id="pc-slot" />',
    ],
  });

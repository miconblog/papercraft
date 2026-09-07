/**
 * 부속 파트 — 점수 기록칸 (IDE-004)
 *
 * 사용자가 만든 판은 종이 네 변에 손글씨로 점수를 이어 적었다. 그 자리를 보드에서
 * 떼어내 별지로 옮긴 것이 이 파트다 — 운동장에는 공이 지나갈 면만 남긴다.
 *
 * **표는 판 · 이름 · 이름 세 칸이고 안은 전부 비어 있다**(2026-09-08 사용자 요청).
 * 예전에는 팀 칸 위에 파랑·빨강 색 막대를 얹어 "파랑 팀 = 파란 마커"를 맞물리게
 * 했는데, 그 막대를 뺐다 — 팀 이름을 아이가 직접 쓰는 자리라 색이 미리 정해져
 * 있으면 오히려 걸린다. 팀 색 슬롯은 남아 운동장 마커를 칠하지만, 이 시트에는
 * 더 이상 나타나지 않는다.
 */
import {
  SCORE_HEADER_Y_MM,
  SCORE_TABLE,
  SCORE_TABLE_WIDTH_MM,
  SHEETS,
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
} from './svg.ts';

const {
  cutInsetMm,
  xMm,
  headerYMm,
  headerHeightMm,
  rowHeightMm,
  rows,
  indexColumnMm,
} = SCORE_TABLE;

const tableRightMm = xMm + SCORE_TABLE_WIDTH_MM;
const bodyTopMm = headerYMm + headerHeightMm;
const tableBottomMm = bodyTopMm + rowHeightMm * rows;
/** 열 경계 x. 판 번호 열 + 두 팀 열. */
const columnEdgesMm = [
  xMm,
  xMm + indexColumnMm,
  xMm + indexColumnMm + SCORE_TABLE.teamColumnMm,
  tableRightMm,
];

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

        // 머리글 셋: 판 · 이름 · 이름. 팀 칸 아래는 비워 두고 아이가 이름을
        // 쓴다 — 어느 칸이 어느 팀인지도 그 손글씨가 정한다.
        text('판', xMm + indexColumnMm / 2, SCORE_HEADER_Y_MM, 4, {
          'text-anchor': 'middle',
        }),
        ...([0, 1] as const).map((i) =>
          text(
            '이름',
            (columnEdgesMm[i + 1] + columnEdgesMm[i + 2]) / 2,
            SCORE_HEADER_Y_MM,
            4,
            { 'text-anchor': 'middle' },
          ),
        ),
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

      // 표 안은 비워 둔다 — 팀 이름 슬롯을 뺐고(2026-09-06) 아이가 직접 쓰는
      // 자리다. 등번호와 같은 이유다.
      '<g id="pc-slot" />',
    ],
  });

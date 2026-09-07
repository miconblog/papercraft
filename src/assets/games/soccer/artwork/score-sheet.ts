/**
 * 부속 파트 — 점수 기록칸 (IDE-004)
 *
 * 사용자가 만든 판은 종이 네 변에 손글씨로 점수를 이어 적었다. 그 자리를 보드에서
 * 떼어내 별지로 옮긴 것이 이 파트다 — 운동장에는 공이 지나갈 면만 남긴다.
 *
 * **표 안은 전부 비어 있다**(2026-09-08 사용자 요청). 예전에는 팀 칸 위에 파랑·
 * 빨강 색 막대를 얹어 "파랑 팀 = 파란 마커"를 맞물리게 했는데, 그 막대를 뺐다 —
 * 팀 이름을 아이가 직접 쓰는 자리라 색이 미리 정해져 있으면 오히려 걸린다.
 * 팀 색 슬롯은 남아 운동장 마커를 칠하지만, 이 시트에는 더 이상 나타나지 않는다.
 *
 * 머리글은 **왼쪽 첫 칸 하나뿐**이다. 사선을 긋고 위에 "이름", 아래에 "판"을
 * 적는 학교 성적표식 칸이다(같은 날 사용자 요청) — 세로로 읽으면 판 번호,
 * 가로로 읽으면 그 팀 이름이라는 것을 칸 하나가 말해 준다. 오른쪽 두 칸은
 * 머리글까지 비어 있어 아이가 팀 이름을 쓴다.
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

/**
 * 사선 머리글의 글자 크기.
 *
 * 사선이 칸을 가르므로 큰 글자를 넣으면 선에 닿는다. 줄 번호(3.6mm)와 같은
 * 크기로 두면 30×12mm 칸에서 두 글자가 선을 피해 앉는다 — 최소 배율 0.7에서
 * 2.52mm라 가독성 하한도 지킨다.
 */
const HEADER_FONT_MM = 3.6;

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

        // 왼쪽 첫 칸의 사선 머리글 — 위 "이름", 아래 "판". 오른쪽 두 칸은
        // 머리글까지 비워 두고 아이가 팀 이름을 쓴다.
        line(xMm, headerYMm, xMm + indexColumnMm, headerYMm + headerHeightMm, {
          stroke: RULE_COLOR,
          'stroke-width': 0.3,
        }),
        text(
          '이름',
          xMm + indexColumnMm * 0.66,
          headerYMm + headerHeightMm * 0.3,
          HEADER_FONT_MM,
          { 'text-anchor': 'middle' },
        ),
        text(
          '판',
          xMm + indexColumnMm * 0.34,
          headerYMm + headerHeightMm * 0.72,
          HEADER_FONT_MM,
          { 'text-anchor': 'middle' },
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

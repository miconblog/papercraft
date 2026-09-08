/**
 * 조립물 파트 — 선수 스탠드 (IDE-014)
 *
 * 옛 인쇄본의 첫 번째 규칙이 "오려 있는 선수를 일으켜 세워서 수비진을 만든다"
 * 였다. 판에 인쇄된 평면 마커만으로도 게임은 되지만, **세워야 공이 부딪힌다** —
 * 타구가 수비수에 맞으면 아웃이라는 규칙이 종이 위에서 실제로 일어나려면 선수가
 * 서 있어야 한다. 그래서 마커와 별개로 이 시트를 낸다.
 *
 * ## 텐트형인 이유
 *
 * 카드 한가운데를 산접기로 접으면 두 면이 마주 보며 ∧ 로 선다. **풀도 칼도
 * 탭도 없다** — 축구 골대가 다섯 번 고쳐 가며 얻은 결론(2026-09-06)을 처음부터
 * 따랐다. 밑변이 벌어져 스스로 서므로 받침을 따로 붙이지 않아도 되고, 접는선이
 * 하나뿐이라 여섯 살도 접는다.
 *
 * 위쪽 면은 그림을 **180° 돌려** 그린다. 접으면 그 면이 뒤로 넘어가 뒤집히므로,
 * 미리 뒤집어 두어야 세웠을 때 양쪽에서 다 바로 보인다. 이름표는 앞면에만
 * 넣는다 — 글자는 돌려 그릴 수 없다(인쇄 렌더러가 요소 단위 회전을 받지
 * 않는다). 어차피 세우면 한쪽 이름만 보이면 된다.
 *
 * ## 앞은 수비, 뒤는 타자
 *
 * 두 면에 **서로 다른 그림**을 넣는다(2026-09-08 사용자 요청). 아래 면은 그
 * 자리의 자세와 이름표이고, 위 면은 타격 자세다. 카드 열이 타격 자세를 하나씩
 * 나눠 가지므로(`../dimensions.ts`의 `BATTER_POSES`) 돌려 세우면 그대로 타순이
 * 된다 — 판에서 타자 마커를 뺀 자리를 이 뒷면이 메운다.
 *
 * 지명타자 카드만 아래 면도 타자다(`DH_CARD`) — 수비를 나가지 않는 자리라
 * 수비 자세랄 것이 없다.
 *
 * ## 한 장에 두 팀
 *
 * 격자는 **10열 × 2행**이고 한 줄이 한 팀이다(2026-09-08 사용자 요청). 앞서는
 * 열 장짜리 시트를 두 벌 뽑게 했는데 A4에 얹으면 종이가 절반 넘게 남았다 —
 * 카드는 마커 자리에 서야 해서 키울 수 없으니(`../dimensions.ts`의 `SHEETS`)
 * 남는 자리를 두 번째 팀으로 채웠다. 한 줄 열은 판에 서는 수비 여덟에 포수와
 * 지명타자를 더한 한 팀 전부다.
 *
 * 그림은 **윤곽선**으로만 낸다. 판 위 마커처럼 팀 색을 받지 않는다 — 두 팀이
 * 한 줄씩 나눠 갖고 각자 칠하는 것을 전제로 한 부속이라 색을 미리 넣으면 그
 * 전제가 깨진다. 대신 줄마다 이름 띠를 얹어 어느 줄이 누구 것인지를 종이가
 * 말하게 했다.
 */
import {
  SHEETS,
  STAND,
  STAND_GRID,
  STAND_CARDS,
  STAND_ROW_HEIGHT_MM,
  STAND_TEAMS,
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
import { drawShape, figureModeAttrs, type Pt } from '../../../shared/figure.ts';
import { FIGURE_OUTLINE_MM, fittedShapes } from './player-markers.ts';

const SHEET = SHEETS.stands;

/** 한 줄 — 한 팀 아홉 장(`../dimensions.ts`의 `STAND_CARDS`). */
const TEAM_CARDS = STAND_CARDS;

const FIGURE_BOX = {
  widthMm: STAND.figureWidthMm,
  heightMm: STAND.figureHeightMm,
};

const gridLeftMm = (SHEET.widthMm - STAND_GRID.widthMm) / 2;
const gridTopMm =
  STAND.headerHeightMm +
  (SHEET.heightMm - STAND.headerHeightMm - STAND_GRID.heightMm) / 2;

const cardHeightMm = STAND.faceHeightMm * 2;

/** 줄(=팀) 한 칸의 위쪽 끝. 이름 띠가 여기서 시작하고 카드는 그 아래다. */
const rowTopMm = (row: number): number =>
  gridTopMm + row * (STAND_ROW_HEIGHT_MM + STAND.gapMm);

/** 카드 하나의 좌상단. */
const cardOriginMm = (
  row: number,
  column: number,
): { xMm: number; yMm: number } => ({
  xMm: gridLeftMm + column * (STAND.cardWidthMm + STAND.gapMm),
  yMm: rowTopMm(row) + STAND.teamBandHeightMm,
});

/**
 * 그림 한 면. `flip`이면 면 중심을 축으로 180° 돌려 그린다 — 접었을 때 뒤로
 * 넘어가는 위쪽 면이 그것이다.
 */
const face = (
  poseId: string,
  centerXMm: number,
  centerYMm: number,
  flip: boolean,
): string[] => {
  const attrs = figureModeAttrs('outline', FIGURE_OUTLINE_MM);
  const dxMm = centerXMm - FIGURE_BOX.widthMm / 2;
  const dyMm = centerYMm - FIGURE_BOX.heightMm / 2;

  const place = ([x, y]: Pt): Pt =>
    flip
      ? [2 * centerXMm - (dxMm + x), 2 * centerYMm - (dyMm + y)]
      : [dxMm + x, dyMm + y];

  return fittedShapes(poseId, FIGURE_BOX).map((shape) =>
    drawShape(
      shape.kind === 'poly'
        ? { ...shape, points: shape.points.map(place) }
        : { ...shape, center: place(shape.center) },
      attrs,
    ),
  );
};

export const renderStands = (): string => {
  const cutRects: string[] = [];
  const foldLines: string[] = [];
  const figures: string[] = [];
  const labels: string[] = [];
  const teamLabels: string[] = [];

  for (const [row, teamLabel] of STAND_TEAMS.entries()) {
    teamLabels.push(
      text(
        `${teamLabel} — 이 줄을 한 가지 색으로 칠한다`,
        gridLeftMm,
        rowTopMm(row) + STAND.teamBandHeightMm / 2,
        STAND.teamFontMm,
        { fill: RULE_COLOR, stroke: 'none' },
      ),
    );

    for (const [column, card] of TEAM_CARDS.entries()) {
      const { xMm, yMm } = cardOriginMm(row, column);
      const centerXMm = xMm + STAND.cardWidthMm / 2;
      const foldYMm = yMm + STAND.faceHeightMm;

      cutRects.push(rect(xMm, yMm, STAND.cardWidthMm, cardHeightMm));
      foldLines.push(line(xMm, foldYMm, xMm + STAND.cardWidthMm, foldYMm));

      // 접는선을 사이에 두고 같은 거리에 두 면을 놓는다 — 접으면 두 그림의
      // 발끝이 같은 높이에서 만난다. 아래가 수비, 위가 타자다.
      figures.push(
        ...face(card.poseId, centerXMm, foldYMm + STAND.figureOffsetMm, false),
        ...face(
          card.batterPoseId,
          centerXMm,
          foldYMm - STAND.figureOffsetMm,
          true,
        ),
      );
      labels.push(
        text(
          card.label,
          centerXMm,
          yMm + cardHeightMm - STAND.labelBaselineMm,
          STAND.labelFontMm,
          { 'text-anchor': 'middle', fill: INK_COLOR, stroke: 'none' },
        ),
      );
    }
  }

  return svgDocument({
    widthMm: SHEET.widthMm,
    heightMm: SHEET.heightMm,
    title: '야구 게임판 · 선수 스탠드',
    children: [
      markLayer('cut', cutRects),
      markLayer('fold-mountain', foldLines),

      group({ id: ART_LAYER_ID, fill: 'none', stroke: INK_COLOR }, [
        text('선수 스탠드', SHEET.widthMm / 2, 9, 5, {
          'text-anchor': 'middle',
          fill: INK_COLOR,
          stroke: 'none',
        }),
        text(
          '오려서 가운데 일점쇄선을 산 모양으로 접으면 혼자 선다. 한 면은 수비, 반대 면은 타자다. 한 줄이 한 팀이라 이 한 장에 양 팀 스무 명이 다 있다.',
          SHEET.widthMm / 2,
          15,
          2.8,
          { 'text-anchor': 'middle', fill: RULE_COLOR, stroke: 'none' },
        ),
        ...teamLabels,
        ...figures,
        ...labels,
      ]),
    ],
  });
};

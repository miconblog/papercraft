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
 * 그림은 **윤곽선**으로만 낸다. 판 위 마커처럼 팀 색을 받지 않는다 — 두 팀이
 * 한 벌씩 뽑아 각자 칠하는 것을 전제로 한 부속이라(`defaultCopies` 2) 색을
 * 미리 넣으면 그 전제가 깨진다.
 */
import {
  BATTER_POSITION,
  DEFENSE_POSITIONS,
  SHEETS,
  STAND,
  STAND_GRID,
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

/** 카드 열 장 — 수비 아홉에 타자 하나. */
const CARDS = [...DEFENSE_POSITIONS, BATTER_POSITION];

const FIGURE_BOX = {
  widthMm: STAND.figureWidthMm,
  heightMm: STAND.figureHeightMm,
};

const gridLeftMm = (SHEET.widthMm - STAND_GRID.widthMm) / 2;
const gridTopMm =
  STAND.headerHeightMm +
  (SHEET.heightMm - STAND.headerHeightMm - STAND_GRID.heightMm) / 2;

const cardHeightMm = STAND.faceHeightMm * 2;

/** 카드 하나의 좌상단. */
const cardOriginMm = (index: number): { xMm: number; yMm: number } => {
  const column = index % STAND.columns;
  const row = Math.floor(index / STAND.columns);
  return {
    xMm: gridLeftMm + column * (STAND.cardWidthMm + STAND.gapMm),
    yMm: gridTopMm + row * (cardHeightMm + STAND.gapMm),
  };
};

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

  for (const [index, card] of CARDS.entries()) {
    const { xMm, yMm } = cardOriginMm(index);
    const centerXMm = xMm + STAND.cardWidthMm / 2;
    const foldYMm = yMm + STAND.faceHeightMm;

    cutRects.push(rect(xMm, yMm, STAND.cardWidthMm, cardHeightMm));
    foldLines.push(line(xMm, foldYMm, xMm + STAND.cardWidthMm, foldYMm));

    // 접는선을 사이에 두고 같은 거리에 두 면을 놓는다 — 접으면 두 그림의
    // 발끝이 같은 높이에서 만난다.
    figures.push(
      ...face(card.poseId, centerXMm, foldYMm + STAND.figureOffsetMm, false),
      ...face(card.poseId, centerXMm, foldYMm - STAND.figureOffsetMm, true),
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
          '오려서 가운데 일점쇄선을 산 모양으로 접으면 혼자 선다. 접는 순서는 소개 페이지에 있다.',
          SHEET.widthMm / 2,
          15,
          2.8,
          { 'text-anchor': 'middle', fill: RULE_COLOR, stroke: 'none' },
        ),
        ...figures,
        ...labels,
      ]),
    ],
  });
};

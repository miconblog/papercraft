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
 * ## 한 장에 두 팀과 보관함
 *
 * 격자는 **7열 × 3행**이고 스무 장이 7·7·6으로 흐른다(2026-09-12). 오른쪽 세로
 * 칸을 **선수 보관함 전개도**(`./stand-box.ts`)에 내주면서 열이 줄었다 — 놀고 난
 * 선수가 온 집에 흩어진다는 사용자 신고에서 나온 부속이다. 팀은 이어 붙는다:
 * 첫 팀 열 장이 먼저, 두 번째 팀이 그 뒤이고, 팀이 바뀌는 자리마다 이름 띠가
 * 붙는다. 한 팀 열 장은 판에 서는 수비 여덟에 포수와 지명타자를 더한 전부다.
 *
 * 그림은 **윤곽선**으로만 낸다. 판 위 마커처럼 팀 색을 받지 않는다 — 두 팀이
 * 한 줄씩 나눠 갖고 각자 칠하는 것을 전제로 한 부속이라 색을 미리 넣으면 그
 * 전제가 깨진다. 대신 줄마다 이름 띠를 얹어 어느 줄이 누구 것인지를 종이가
 * 말하게 했다.
 */
import {
  SHEETS,
  STAND,
  STAND_BOX,
  STAND_BOX_NET_MM,
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
import { renderTrayNet } from './stand-box.ts';

const SHEET = SHEETS.stands;

const FIGURE_BOX = {
  widthMm: STAND.figureWidthMm,
  heightMm: STAND.figureHeightMm,
};

const gridLeftMm = STAND.sheetMarginMm;
const gridTopMm = STAND.headerHeightMm;

/** 보관함은 격자 오른쪽 세로 칸에 선다. */
const boxLeftMm = gridLeftMm + STAND_GRID.widthMm + STAND_BOX.gapMm;
const boxNotesTopMm = gridTopMm + STAND_BOX_NET_MM.heightMm + 8;

/**
 * 보관함 만드는 법. 전개도 아래 남는 자리에 그대로 적는다 — 상자를 만드는 자리가
 * 곧 설명을 읽는 자리다.
 */
export const BOX_SHEET_NOTES: readonly string[] = [
  '① 바깥 실선대로 오린다.',
  '② 파선을 인쇄면이 안으로 오게(골 모양) 접는다.',
  '③ 네 귀에 풀을 발라 옆벽 안쪽에 붙인다.',
  '④ 접은 선수를 세워 일렬로 담는다.',
];

const cardHeightMm = STAND.faceHeightMm * 2;

/** 줄 한 칸의 위쪽 끝. 이름 띠가 여기서 시작하고 카드는 그 아래다. */
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
 * 카드 스무 장이 앉을 자리 — 첫 팀 열 장이 먼저, 두 번째 팀이 그 뒤다.
 *
 * 줄이 곧 팀이던 시절에는 이 계산이 필요 없었지만(한 줄 = 한 팀), 열이 일곱으로
 * 줄면서 팀이 줄을 걸쳐 흐른다. 차례만 지키면 팀은 여전히 이어 붙는다.
 */
export const STAND_CELLS = STAND_TEAMS.flatMap((_, team) =>
  STAND_CARDS.map((card) => ({ team, card })),
).map((cell, index) => ({
  ...cell,
  row: Math.floor(index / STAND.columns),
  column: index % STAND.columns,
}));

/** 팀 이름 띠가 붙는 자리 — 줄마다, 팀이 바뀔 때마다 하나씩이다. */
export const teamBands = (): {
  team: number;
  row: number;
  column: number;
}[] => {
  const bands: { team: number; row: number; column: number }[] = [];
  for (const cell of STAND_CELLS) {
    const previous = bands.at(-1);
    if (previous?.row === cell.row && previous.team === cell.team) continue;
    bands.push({ team: cell.team, row: cell.row, column: cell.column });
  }
  return bands;
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
  const box = renderTrayNet(STAND_BOX.tray, boxLeftMm, gridTopMm);

  const cutRects: string[] = [];
  const foldLines: string[] = [];
  const figures: string[] = [];
  const labels: string[] = [];

  const teamLabels = teamBands().map((band) =>
    text(
      band.column === 0 && band.row === 0
        ? `${STAND_TEAMS[band.team]} — 한 가지 색으로 칠한다`
        : STAND_TEAMS[band.team],
      cardOriginMm(band.row, band.column).xMm,
      rowTopMm(band.row) + STAND.teamBandHeightMm / 2,
      STAND.teamFontMm,
      { fill: RULE_COLOR, stroke: 'none' },
    ),
  );

  for (const cell of STAND_CELLS) {
    const { xMm, yMm } = cardOriginMm(cell.row, cell.column);
    const centerXMm = xMm + STAND.cardWidthMm / 2;
    const foldYMm = yMm + STAND.faceHeightMm;

    cutRects.push(rect(xMm, yMm, STAND.cardWidthMm, cardHeightMm));
    foldLines.push(line(xMm, foldYMm, xMm + STAND.cardWidthMm, foldYMm));

    // 접는선을 사이에 두고 같은 거리에 두 면을 놓는다 — 접으면 두 그림의
    // 발끝이 같은 높이에서 만난다. 아래가 수비, 위가 타자다.
    figures.push(
      ...face(
        cell.card.poseId,
        centerXMm,
        foldYMm + STAND.figureOffsetMm,
        false,
      ),
      ...face(
        cell.card.batterPoseId,
        centerXMm,
        foldYMm - STAND.figureOffsetMm,
        true,
      ),
    );
    labels.push(
      text(
        cell.card.label,
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
      markLayer('cut', [...cutRects, box.cut]),
      markLayer('fold-mountain', foldLines),
      // 카드는 산접기(그림이 바깥), 보관함은 골접기(인쇄면이 안쪽)다.
      markLayer('fold-valley', [...box.folds]),
      markLayer('glue', [...box.glue]),

      group({ id: ART_LAYER_ID, fill: 'none', stroke: INK_COLOR }, [
        text('선수 스탠드', gridLeftMm, 6, 4.6, {
          'font-weight': 'bold',
          fill: INK_COLOR,
          stroke: 'none',
        }),
        text(
          '오려서 가운데 일점쇄선을 산 모양으로 접으면 혼자 선다. 한 면은 수비, 반대 면은 타자다. 다 놀고 나면 오른쪽 상자에 세워 담는다.',
          gridLeftMm,
          11,
          2.8,
          { fill: RULE_COLOR, stroke: 'none' },
        ),
        ...teamLabels,
        ...figures,
        ...labels,
        ...box.labels,
        ...BOX_SHEET_NOTES.map((note, i) =>
          text(
            note,
            boxLeftMm,
            boxNotesTopMm + i * STAND_BOX.noteLeadingMm,
            STAND_BOX.noteFontMm,
            { fill: RULE_COLOR, stroke: 'none' },
          ),
        ),
      ]),
    ],
  });
};

/**
 * 부속 파트 — 공 마커 (IDE-004)
 *
 * 연필로 튕기는 납작한 종이 공이다. 작고 잘 굴러가 잃어버리기 쉬우므로 한 시트에
 * 여러 개를 넣는다.
 *
 * 지름은 골대 입구보다 뚜렷이 작아야 하고(수용 기준), 동시에 가위로 오릴 만해야
 * 한다. 두 조건 사이에서 12mm를 잡았다 — ⚠︎ 튕기는 맛은 종이에 뽑아 봐야 안다.
 */
import { BALL, BALL_COUNT, SHEETS } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  line,
  markLayer,
  num,
  path,
  svgDocument,
  text,
} from './svg.ts';

/** 그리드 위쪽에 제목이 앉는 띠. */
const HEADER_HEIGHT_MM = 18;

const radiusMm = BALL.diameterMm / 2;
const gridWidthMm = BALL.pitchMm * BALL.columns;
const gridLeftMm = (SHEETS.ballMarkers.widthMm - gridWidthMm) / 2;

/** 공 하나의 중심. */
export const ballCenterMm = (
  column: number,
  row: number,
): readonly [number, number] => [
  gridLeftMm + BALL.pitchMm * (column + 0.5),
  HEADER_HEIGHT_MM + BALL.pitchMm * (row + 0.5),
];

export const ballCenters = (): ReadonlyArray<readonly [number, number]> =>
  Array.from({ length: BALL.rows }, (_, row) =>
    Array.from({ length: BALL.columns }, (_, column) =>
      ballCenterMm(column, row),
    ),
  ).flat();

/**
 * 축구공 무늬 — 가운데 검은 오각형 하나와 거기서 뻗는 이음선 다섯.
 * 12mm 원에 진짜 이십면체 무늬를 넣으면 인쇄에서 뭉개진다.
 */
const ballPattern = (cxMm: number, cyMm: number): string[] => {
  const pentagonRadiusMm = radiusMm * 0.42;
  const point = (angleDeg: number, rMm: number): readonly [number, number] => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cxMm + rMm * Math.cos(rad), cyMm + rMm * Math.sin(rad)];
  };

  const corners = Array.from({ length: 5 }, (_, i) =>
    point(i * 72, pentagonRadiusMm),
  );
  const pentagon = path(
    `${corners
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${num(x)} ${num(y)}`)
      .join(' ')} Z`,
    { fill: INK_COLOR, stroke: 'none' },
  );

  // 꼭짓점에서 원 가장자리 쪽으로 뻗는다 — 실제 축구공도 오각형 꼭짓점에서
  // 세 이음선이 만난다. 변 중점에서 뻗으면 별 모양이 된다.
  const seams = Array.from({ length: 5 }, (_, i) => {
    const angleDeg = i * 72;
    const [x1, y1] = point(angleDeg, pentagonRadiusMm);
    const [x2, y2] = point(angleDeg, radiusMm * 0.84);
    return line(x1, y1, x2, y2, {
      stroke: INK_COLOR,
      'stroke-width': 0.3,
      fill: 'none',
    });
  });

  return [pentagon, ...seams];
};

export const renderBallMarkers = (): string =>
  svgDocument({
    widthMm: SHEETS.ballMarkers.widthMm,
    heightMm: SHEETS.ballMarkers.heightMm,
    title: '축구 게임판 · 공 마커',
    children: [
      markLayer(
        'cut',
        ballCenters().map(([x, y]) => circle(x, y, radiusMm)),
      ),
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('공 마커', SHEETS.ballMarkers.widthMm / 2, 8, 4.5, {
          'text-anchor': 'middle',
        }),
        text(
          `지름 ${num(BALL.diameterMm)}mm · ${BALL_COUNT}개 — 잃어버릴 때를 대비한 여분이다`,
          SHEETS.ballMarkers.widthMm / 2,
          14,
          2.6,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
        ...ballCenters().flatMap(([x, y]) => ballPattern(x, y)),
      ]),
    ],
  });

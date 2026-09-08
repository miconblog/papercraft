/**
 * 보드 파트 — 말판(윷판) (IDE-017)
 *
 * 전통 윷판을 그대로 옮긴다. 밭 스물아홉(바깥 20 · 지름길 8 · 방 1), 큰 밭
 * 다섯, 대각선 넷. 좌표는 전부 `../dimensions.ts`가 격자에서 계산한 값이라
 * 여기서는 손으로 적은 수가 하나도 없다.
 *
 * ## 선을 긋지 않는 이유
 *
 * 바깥 밭 스물은 **잇는 선이 없다.** 전통 윷판이 그렇고, 그래서 대각선 넷만
 * 선으로 남아 **지름길이 어디서 갈라지는지가 그림만 보고 읽힌다.** 바깥까지
 * 선으로 이으면 판이 선 무더기가 되어 그 대비가 사라진다. 진행 방향은 밭
 * 사이 빈자리에 앉는 작은 세모가 말한다.
 *
 * ## 밭 이름을 적지 않는 이유
 *
 * 전통 윷판에 이름이 없다. 도·개·걸은 윷가락이 내는 값이지 밭 이름이 아니고,
 * 밭 이름은 지역마다 달라 하나를 고르면 틀린 쪽이 생긴다. 대신 **크기가 규칙을
 * 말한다** — 큰 밭 다섯이 곧 지름길이 갈라지고 만나는 자리다. 판이 말하지
 * 않는 것은 게임 방법 부속이 글로 적는다.
 */
import {
  BOARD,
  CENTER,
  FIELD,
  FIELDS,
  SHORTCUT_ENTRIES,
  SHORTCUT_EXITS,
  SHORTCUT_LINES,
  START_FIELD_ID,
  fieldRadiusMm,
  outerPoint,
  shortcutPoint,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  circle,
  group,
  line,
  num,
  path,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

/** 종이면. 밭을 흰색으로 채워 대각선이 밭 아래로 깔린다. */
const PAPER = '#ffffff';

/**
 * 지름길 색. 밭·글자와 다른 색이라 흑백으로 뽑아도 **선의 농도**가 달라 남는다.
 * 바깥 밭에 선이 없으므로 이 색은 판에서 오직 지름길만 뜻한다.
 */
export const SHORTCUT_COLOR = '#c2410c';

/** 진행 방향 세모. `p`를 중심으로 `(dx, dy)` 쪽을 가리킨다. */
const arrow = (
  p: { xMm: number; yMm: number },
  dx: number,
  dy: number,
  color: string,
): string => {
  const len = Math.hypot(dx, dy);
  const [ux, uy] = [dx / len, dy / len];
  // 진행 방향과 직각인 단위 벡터.
  const [px, py] = [-uy, ux];
  const half = FIELD.arrowLengthMm / 2;
  const wing = FIELD.arrowWidthMm / 2;
  const tip = [p.xMm + ux * half, p.yMm + uy * half];
  const back = [p.xMm - ux * half, p.yMm - uy * half];
  const points: ReadonlyArray<readonly [number, number]> = [
    [tip[0], tip[1]],
    [back[0] + px * wing, back[1] + py * wing],
    [back[0] - px * wing, back[1] - py * wing],
  ];
  return path(
    points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
      .join('') + 'Z',
    { fill: color, stroke: 'none' },
  );
};

/** 바깥길 화살표 — 각 변 한가운데, 밭과 밭 사이 빈자리에 앉는다. */
const outerArrows = (): string[] =>
  [2, 7, 12, 17].map((i) => {
    const from = outerPoint(i);
    const to = outerPoint(i + 1);
    return arrow(
      { xMm: (from.xMm + to.xMm) / 2, yMm: (from.yMm + to.yMm) / 2 },
      to.xMm - from.xMm,
      to.yMm - from.yMm,
      INK_COLOR,
    );
  });

/**
 * 지름길 화살표 — 갈래마다 하나씩 넷.
 *
 * 들어가는 갈래(오른쪽 위·왼쪽 위)는 방을 가리키고, 나오는 갈래(참먹이 쪽·
 * 왼쪽 아래)는 모서리를 가리킨다. 지름길은 한 방향으로만 다니므로 화살표가
 * 그 방향을 못 박는다 — 왼쪽 아래 모서리에서 방으로 거슬러 들어가지 않는
 * 것이 이 그림으로 읽힌다.
 */
const shortcutArrows = (): string[] => {
  const items: string[] = [];
  for (const corner of SHORTCUT_ENTRIES) {
    const from = shortcutPoint(corner, 1);
    const to = shortcutPoint(corner, 2);
    items.push(
      arrow(
        { xMm: (from.xMm + to.xMm) / 2, yMm: (from.yMm + to.yMm) / 2 },
        to.xMm - from.xMm,
        to.yMm - from.yMm,
        SHORTCUT_COLOR,
      ),
    );
  }
  for (const corner of SHORTCUT_EXITS) {
    const from = shortcutPoint(corner, 2);
    const to = shortcutPoint(corner, 1);
    items.push(
      arrow(
        { xMm: (from.xMm + to.xMm) / 2, yMm: (from.yMm + to.yMm) / 2 },
        to.xMm - from.xMm,
        to.yMm - from.yMm,
        SHORTCUT_COLOR,
      ),
    );
  }
  return items;
};

/** 대각선 둘 — 마주 보는 모서리를 방을 지나 잇는다. 밭 아래에 깔린다. */
const shortcutLines = (): string[] =>
  SHORTCUT_LINES.map(([a, b]) => {
    const from = outerPoint(a);
    const to = outerPoint(b);
    return line(from.xMm, from.yMm, to.xMm, to.yMm, {
      stroke: SHORTCUT_COLOR,
      'stroke-width': FIELD.shortcutLineWidthMm,
      'stroke-linecap': 'round',
    });
  });

/** 밭 스물아홉. 큰 밭은 겹원이라 멀리서도 갈림길이 보인다. */
const fieldCircles = (): string[] =>
  FIELDS.flatMap((field) => {
    const radius = fieldRadiusMm(field);
    const shapes = [
      circle(field.xMm, field.yMm, radius, {
        fill: PAPER,
        stroke: INK_COLOR,
        'stroke-width': FIELD.lineWidthMm,
      }),
    ];
    if (field.big) {
      shapes.push(
        circle(field.xMm, field.yMm, radius - FIELD.innerRingGapMm, {
          fill: 'none',
          stroke: INK_COLOR,
          'stroke-width': FIELD.lineWidthMm,
        }),
      );
    }
    return shapes;
  });

/**
 * 출발점 표시.
 *
 * 글자는 큰 밭 **안**에 넣는다. 판 가장자리에는 자리가 없고(모서리 밭에서 종이
 * 끝까지 4mm다), 밭 밖 안쪽은 이웃 밭과 대각선이 이미 차지했다. 말이 그 위에
 * 서면 글자가 가리지만 출발·도착은 판을 펼칠 때 한 번 읽으면 되는 안내다.
 */
const startLabels = (): string[] => {
  const start = FIELDS.find((f) => f.id === START_FIELD_ID)!;
  return [
    text(
      '출발',
      start.xMm,
      start.yMm - FIELD.startLabelOffsetMm,
      FIELD.startLabelFontMm,
      { 'text-anchor': 'middle', fill: INK_COLOR, 'font-weight': 700 },
    ),
    text(
      '도착',
      start.xMm,
      start.yMm + FIELD.startLabelOffsetMm,
      FIELD.startLabelFontMm,
      { 'text-anchor': 'middle', fill: INK_COLOR, 'font-weight': 700 },
    ),
  ];
};

export const renderBoard = (): string =>
  svgDocument({
    widthMm: BOARD.widthMm,
    heightMm: BOARD.heightMm,
    title: '윷놀이 · 말판',
    children: [
      group({ id: ART_LAYER_ID, fill: 'none', stroke: 'none' }, [
        ...shortcutLines(),
        ...outerArrows(),
        ...shortcutArrows(),
        ...fieldCircles(),
        ...startLabels(),
      ]),
    ],
  });

/** 방(중앙 밭)의 자리. 테스트가 대각선 넷이 여기서 만나는지 본다. */
export const BANG_CENTER = CENTER;

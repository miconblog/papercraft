/**
 * 조립물 파트 — 말 (IDE-017)
 *
 * 4편 × 말 넷 = 카드 열여섯. **텐트형**이다 — 카드 한가운데를 산접기로 접으면
 * 두 면이 마주 보며 ∧ 로 선다(야구 선수 스탠드와 같은 수법, `IDE-014`). 풀도
 * 탭도 없어 여섯 살도 접는다.
 *
 * 세계일주의 말은 눕혀 쓰는 원판이었다(`IDE-015`). 윷놀이는 밭이 지름 22mm로
 * 넓어 세워도 이웃 밭을 가리지 않고, **세운 말이라야 업힌 수가 옆에서 보인다.**
 *
 * ## 위쪽 면을 돌려 그리는 이유
 *
 * 접으면 위쪽 면이 뒤로 넘어가 뒤집히므로 **미리 180° 돌려** 그려야 세웠을 때
 * 양쪽에서 다 바로 보인다. 야구 스탠드는 이름표를 앞면에만 넣었는데, 윷놀이의
 * 업기 숫자는 **어느 쪽에서 보든 읽혀야 하는 값**이라 글자도 돌려 그린다
 * (`transform="rotate(180 …)"`). 편 이름은 슬롯이라 배치가 돌린다(`./index.ts`).
 *
 * ## 편을 가르는 것
 *
 * 색과 그림 양쪽이다. 색만으로 가르면 흑백 출력에서 누구 말인지 알 수 없다
 * (`IDE-009`). 색은 레이어 `pc-side-<n>`이 받고(`paint` 배치), 그 레이어 안에
 * 그림과 색 띠가 들어간다. 그림은 고정이다 — 고를 수 있게 하면 두 편이 같은
 * 그림을 고를 수 있다.
 */
import {
  SIDES,
  TOKEN,
  TOKEN_CARD_HEIGHT_MM,
  TOKEN_SHEET,
  TOKENS_PER_SIDE,
  carryLabel,
  sideLayerId,
  tokenCardOrigin,
  tokenCenterXMm,
  tokenFoldYMm,
  type SideShape,
} from '../dimensions.ts';
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
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const polygon = (points: ReadonlyArray<readonly [number, number]>): string =>
  points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
    .join('') + 'Z';

/**
 * 편 그림 하나. 중심 `(cx, cy)`에 한 변/지름 `size`로 앉는다. 채움은 레이어
 * 색을 물려받는다. `flip`이면 중심을 축으로 180° 돌린다 — 접어 세웠을 때 뒤로
 * 넘어가는 위쪽 면이 그것이다.
 */
const shapePath = (
  shape: SideShape,
  cx: number,
  cy: number,
  size: number,
  flip: boolean,
): string => {
  const h = size / 2;
  const at = (dx: number, dy: number): readonly [number, number] =>
    flip ? [cx - dx, cy - dy] : [cx + dx, cy + dy];

  switch (shape) {
    case 'circle':
      return circle(cx, cy, h);
    case 'square':
      return path(
        polygon([
          at(-h * 0.9, -h * 0.9),
          at(h * 0.9, -h * 0.9),
          at(h * 0.9, h * 0.9),
          at(-h * 0.9, h * 0.9),
        ]),
      );
    case 'triangle':
      return path(polygon([at(0, -h), at(h, h * 0.8), at(-h, h * 0.8)]));
    case 'star': {
      const points: Array<readonly [number, number]> = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? h : h * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push(at(r * Math.cos(a), r * Math.sin(a)));
      }
      return path(polygon(points));
    }
  }
};

/** 카드 한 면의 그림·색 띠. `flip`이면 접는선 위쪽 면이다. */
const faceArt = (
  shape: SideShape,
  centerXMm: number,
  foldYMm: number,
  flip: boolean,
): string[] => {
  const sign = flip ? -1 : 1;
  const bandYMm = foldYMm + sign * TOKEN.bandOffsetMm;
  return [
    shapePath(
      shape,
      centerXMm,
      foldYMm + sign * TOKEN.iconOffsetMm,
      TOKEN.iconSizeMm,
      flip,
    ),
    rect(
      centerXMm - TOKEN.cardWidthMm / 2 + TOKEN.bandInsetMm,
      bandYMm - TOKEN.bandHeightMm / 2,
      TOKEN.cardWidthMm - TOKEN.bandInsetMm * 2,
      TOKEN.bandHeightMm,
    ),
  ];
};

/**
 * 업기 숫자. 첫 말은 비어 있고 나머지 셋이 `2`·`3`·`4`다.
 *
 * 위쪽 면은 글자를 그 자리 중심으로 180° 돌린다 — 접어 세우면 그 면이 뒤집히기
 * 때문이다. 인쇄 렌더러가 `transform`을 좌표로 구워 넣으므로 PDF에서도 같다.
 */
const carryText = (
  label: string,
  centerXMm: number,
  foldYMm: number,
  flip: boolean,
): string[] => {
  if (label === '') return [];
  const yMm = foldYMm + (flip ? -1 : 1) * TOKEN.carryOffsetMm;
  return [
    text(label, centerXMm, yMm, TOKEN.carryFontMm, {
      'text-anchor': 'middle',
      fill: INK_COLOR,
      stroke: 'none',
      'font-weight': 700,
      transform: flip ? `rotate(180 ${num(centerXMm)} ${num(yMm)})` : undefined,
    }),
  ];
};

export const renderTokens = (): string => {
  const cuts: string[] = [];
  const folds: string[] = [];
  const sideLayers: string[] = [];
  const inkItems: string[] = [];

  for (const [sideIndex, side] of SIDES.entries()) {
    const foldYMm = tokenFoldYMm(sideIndex);
    const artOfSide: string[] = [];

    for (let tokenIndex = 0; tokenIndex < TOKENS_PER_SIDE; tokenIndex += 1) {
      const { xMm, yMm } = tokenCardOrigin(sideIndex, tokenIndex);
      const centerXMm = tokenCenterXMm(tokenIndex);

      cuts.push(rect(xMm, yMm, TOKEN.cardWidthMm, TOKEN_CARD_HEIGHT_MM));
      folds.push(line(xMm, foldYMm, xMm + TOKEN.cardWidthMm, foldYMm));

      artOfSide.push(
        ...faceArt(side.shape, centerXMm, foldYMm, false),
        ...faceArt(side.shape, centerXMm, foldYMm, true),
      );
      const label = carryLabel(tokenIndex);
      inkItems.push(
        ...carryText(label, centerXMm, foldYMm, false),
        ...carryText(label, centerXMm, foldYMm, true),
      );
    }

    // 색을 받는 레이어 — 그림과 색 띠. 채움을 여기서 정하지 않는다(렌더러가 칠한다).
    sideLayers.push(
      group(
        { id: sideLayerId(side.id), fill: side.color, stroke: 'none' },
        artOfSide,
      ),
    );
  }

  return svgDocument({
    widthMm: TOKEN_SHEET.widthMm,
    heightMm: TOKEN_SHEET.heightMm,
    title: '윷놀이 · 말',
    children: [
      markLayer('cut', cuts),
      markLayer('fold-mountain', folds),
      group({ id: ART_LAYER_ID, fill: 'none', stroke: 'none' }, [
        text('말 · 네 편', TOKEN_SHEET.widthMm / 2, 9, 5, {
          'text-anchor': 'middle',
          'font-weight': 700,
          fill: INK_COLOR,
        }),
        text(
          '한 줄이 한 편이다. 오려서 가운데를 산 모양으로 접으면 혼자 선다.',
          TOKEN_SHEET.widthMm / 2,
          15,
          2.5,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
        ...sideLayers,
        ...inkItems,
      ]),
    ],
  });
};

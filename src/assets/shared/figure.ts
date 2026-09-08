/**
 * 인물 마커 그림 엔진 — 뼈대에서 도형을 짓는다 (IDE-010 · IDE-014)
 *
 * 축구 게임판이 선수 마커를 **관절 각도만 적어** 그리도록 만든 장치를
 * (`games/soccer/artwork/player-markers.ts`), 야구 게임판이 같은 방식으로 쓰려고
 * 게임 폴더 밖으로 꺼낸 것이다. 여기 있는 것은 **어느 종목에도 없는 것들**이다 —
 * 관절을 도형으로 부풀리는 법, 상자에 맞춰 넣는 법, 모서리를 둥글리는 법.
 *
 * 종목이 갖는 것은 여기 두지 않는다. 몸 비율(`BODY`)·자세 각도(`POSE_ANGLES`)·
 * 부위를 쌓는 차례(`figureShapes`)는 게임마다 다르다 — 축구는 반바지에 맨머리고
 * 야구는 긴 바지에 모자를 쓴다. 그 차이가 그림을 종목처럼 보이게 하는 것이라
 * 공용으로 누르면 둘 다 어중간해진다.
 *
 * ## 실루엣과 윤곽선을 한 뼈대로 뽑는 규약
 *
 * 부위마다 **닫힌 도형**을 낸다. 실루엣(`illustration`)에서는 색이 같아 이음매가
 * 안 보이고, 윤곽선(`outline`)에서는 그 경계가 그대로 팔·다리·유니폼 선이 된다.
 * 뒤쪽 팔다리 → 몸통 → 앞쪽 팔다리 → 머리 차례로 그려, 흰 채움이 뒤 도형의
 * 안쪽 선을 덮는다. 이 차례를 정하는 것은 게임 쪽 `figureShapes`다.
 */
import { circle, num, path, type Attrs } from './svg.ts';

/** mm 좌표. 원점은 마커 상자의 좌상단이다. */
export type Pt = readonly [number, number];

/**
 * 관절 두 마디. 각도는 도(°)이고 **0°가 오른쪽, 90°가 아래**다 — SVG는 y가
 * 아래로 자라므로 각도가 커지면 내려간다.
 *
 * `upperDeg`는 몸통에 붙은 마디(위팔·허벅지), `lowerDeg`는 그다음 마디
 * (아래팔·정강이)다. 둘이 같으면 곧게 편 것이고, 벌어질수록 팔꿈치·무릎이
 * 굽는다.
 */
export interface Limb {
  readonly upperDeg: number;
  readonly lowerDeg: number;
}

/**
 * 그리기 전 단계의 도형. 상자에 맞춰 넣는 계산을 좌표로 하려고 기하로 둔다.
 *
 * 다각형은 `roundMm`만큼 모서리를 둥글려 그린다(`roundedPath`) — 각진 사각형을
 * 이어 붙이면 로봇처럼 보인다. 팔다리 끝은 폭의 절반으로 둥글려 캡슐이 되고,
 * 무릎·팔꿈치도 부드럽게 꺾인다.
 */
export type Shape =
  | {
      readonly kind: 'poly';
      readonly points: readonly Pt[];
      readonly roundMm: number;
    }
  | { readonly kind: 'disc'; readonly center: Pt; readonly radiusMm: number };

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** `from`에서 `deg` 방향으로 `lenMm`만큼 간 점. */
export const step = (from: Pt, deg: number, lenMm: number): Pt => [
  from[0] + lenMm * Math.cos(rad(deg)),
  from[1] + lenMm * Math.sin(rad(deg)),
];

/** `pivot`을 축으로 `deg`만큼 돌린 점. 상체 기울기에 쓴다. */
export const rotateAbout = (p: Pt, pivot: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const dx = p[0] - pivot[0];
  const dy = p[1] - pivot[1];
  return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
};

/** 선분에 수직인 단위 벡터. 마디를 폭 있는 도형으로 부풀릴 때 쓴다. */
export const normal = (a: Pt, b: Pt): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
};

export const off = (p: Pt, n: Pt, d: number): Pt => [
  p[0] + n[0] * d,
  p[1] + n[1] * d,
];

/**
 * 두 마디짜리 팔·다리를 **닫힌 도형 하나**로 낸다.
 *
 * 마디마다 도형을 내면 윤곽선 변형에서 팔꿈치·무릎마다 선이 하나씩 더 생겨
 * 그림이 조각조각 나 보인다. 관절에서는 두 마디의 법선을 평균 내 한 번에
 * 꺾는다 — 이러면 굽은 팔다리가 선 하나로 이어진다. 뿌리에서 끝으로
 * 가늘어진다.
 */
export const limbShape = (
  root: Pt,
  limb: Limb,
  upperMm: number,
  lowerMm: number,
  rootWidthMm: number,
  tipWidthMm: number,
): { readonly shape: Shape; readonly joint: Pt; readonly tip: Pt } => {
  const joint = step(root, limb.upperDeg, upperMm);
  const tip = step(joint, limb.lowerDeg, lowerMm);
  const nUpper = normal(root, joint);
  const nLower = normal(joint, tip);
  // 관절의 법선은 두 마디의 평균이다. 정규화해 두지 않으면 많이 굽은 관절에서
  // 폭이 잘록해진다.
  const mixLen = Math.hypot(nUpper[0] + nLower[0], nUpper[1] + nLower[1]) || 1;
  const nJoint: Pt = [
    (nUpper[0] + nLower[0]) / mixLen,
    (nUpper[1] + nLower[1]) / mixLen,
  ];
  const rootHalf = rootWidthMm / 2;
  const jointHalf = (rootWidthMm + tipWidthMm) / 4;
  const tipHalf = tipWidthMm / 2;

  return {
    shape: {
      kind: 'poly',
      points: [
        off(root, nUpper, rootHalf),
        off(joint, nJoint, jointHalf),
        off(tip, nLower, tipHalf),
        off(tip, nLower, -tipHalf),
        off(joint, nJoint, -jointHalf),
        off(root, nUpper, -rootHalf),
      ],
      roundMm: tipHalf,
    },
    joint,
    tip,
  };
};

/**
 * 한 마디 위에 얹는 통 — 소매·바지 가랑이·양말이다. 밑에 깔린 팔다리보다
 * 조금 넓어, 윤곽선 변형에서 그 구간의 바깥선을 대신하고 끝선이 옷 경계가 된다.
 */
export const tubeShape = (
  from: Pt,
  deg: number,
  lenMm: number,
  widthMm: number,
  roundMm: number,
): Shape => {
  const to = step(from, deg, lenMm);
  const n = normal(from, to);
  const half = widthMm / 2;
  return {
    kind: 'poly',
    points: [
      off(from, n, half),
      off(to, n, half),
      off(to, n, -half),
      off(from, n, -half),
    ],
    roundMm,
  };
};

export interface ShoeDims {
  readonly shoeLengthMm: number;
  readonly shoeHeelMm: number;
  readonly shoeHeightMm: number;
}

/**
 * 신발. 발목에서 정강이에 **직각**으로 낸다 — 정강이가 수직이면 발끝이 앞을
 * 보고, 슛처럼 정강이가 앞으로 뻗으면 발끝이 위를 본다. 발끝 방향이 곧 그림이
 * 보는 쪽이다.
 */
export const shoeShape = (ankle: Pt, shinDeg: number, d: ShoeDims): Shape => {
  const toeDeg = shinDeg - 90;
  const along = (u: number, v: number): Pt =>
    step(step(ankle, toeDeg, u), shinDeg, v);
  const { shoeLengthMm: len, shoeHeelMm: heel, shoeHeightMm: h } = d;
  return {
    kind: 'poly',
    points: [
      along(-heel, -0.2),
      along(len * 0.62, -0.2),
      along(len, h * 0.5),
      along(len * 0.82, h),
      along(-heel, h),
    ],
    roundMm: 0.45,
  };
};

/** 손에 씌우는 둥근 네모 — 골키퍼 장갑·야수 글러브가 이걸 쓴다. */
export const mittShape = (hand: Pt, sizeMm: number): Shape => {
  const half = sizeMm / 2;
  return {
    kind: 'poly',
    points: [
      [hand[0] - half, hand[1] - half],
      [hand[0] + half, hand[1] - half],
      [hand[0] + half, hand[1] + half],
      [hand[0] - half, hand[1] + half],
    ],
    roundMm: 0.5,
  };
};

export interface Box {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * 그림을 마커 상자 한가운데로 맞춰 넣는다.
 *
 * 자세마다 팔다리가 뻗는 범위가 달라, 각도만 적어 두면 어떤 자세는 상자를
 * 넘고 어떤 자세는 한쪽으로 쏠린다. 상자를 넘으면 이웃 마커와 겹친다 — 겹침
 * 판정은 상자로만 하기 때문이다(`styleSetBounds`). 그래서 **자세 각도를 손으로
 * 맞추는 대신** 나온 도형의 경계를 재서 필요한 만큼만 줄이고 가운데로 옮긴다.
 * 자세를 새로 더할 때 상자 걱정을 하지 않아도 되는 이유다.
 *
 * 마커의 기준점이 상자 중심이므로(IDE-010) 가운데 맞춤은 곧 "슬롯 좌표에
 * 선수가 선다"는 뜻이기도 하다. `marginMm`은 윤곽선이 상자 밖으로 삐져나오지
 * 않을 만큼만 두는 여백이라 보통 선 굵기를 그대로 넣는다.
 */
export const fitToBox = (
  shapes: readonly Shape[],
  box: Box,
  marginMm: number,
): Shape[] => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of shapes) {
    if (shape.kind === 'poly') {
      for (const [x, y] of shape.points) {
        xs.push(x);
        ys.push(y);
      }
    } else {
      xs.push(
        shape.center[0] - shape.radiusMm,
        shape.center[0] + shape.radiusMm,
      );
      ys.push(
        shape.center[1] - shape.radiusMm,
        shape.center[1] + shape.radiusMm,
      );
    }
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const scale = Math.min(
    1,
    (box.widthMm - 2 * marginMm) / (maxX - minX),
    (box.heightMm - 2 * marginMm) / (maxY - minY),
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const map = (p: Pt): Pt => [
    box.widthMm / 2 + (p[0] - cx) * scale,
    box.heightMm / 2 + (p[1] - cy) * scale,
  ];

  return shapes.map((shape) =>
    shape.kind === 'poly'
      ? {
          kind: 'poly',
          points: shape.points.map(map),
          roundMm: shape.roundMm * scale,
        }
      : {
          kind: 'disc',
          center: map(shape.center),
          radiusMm: shape.radiusMm * scale,
        },
  );
};

/**
 * 그림 모양. 값이 곧 변형 id이자 아트워크 파일 이름의 꼬리다 — 셋이 어긋날
 * 자리가 없다.
 */
export type FigureMode = 'illustration' | 'outline';

/**
 * 마커 아트워크가 그룹(팀) 색을 받는 레이어 id.
 *
 * 렌더러가 이 id의 `fill`과 `stroke`를 둘 다 갈아 끼운다
 * (`lib/customization/render.ts`) — 빈 원·윤곽선은 테두리로, 실루엣은 채움으로
 * 팀을 가르므로 한 레이어가 둘 다 받아야 변형들이 같은 규약을 쓴다. 안에서
 * 흰 속처럼 색을 받지 **말아야** 하는 도형은 제 값을 명시해 덮어쓴다.
 */
export const MARKER_TEAM_LAYER_ID = 'pc-marker-team';

/** 팀 색을 못 받았을 때 남는 색. 브라우저로 SVG를 열어 봤을 때의 모습이다. */
export const TEAM_COLOR_PLACEHOLDER = '#1a1a1a';

/** 색을 받지 않고 흰 종이로 남는 면 — 아이가 칠할 자리다. */
export const PAPER = '#ffffff';

/**
 * 도형 하나에 붙는 속성.
 *
 * 실루엣은 레이어의 팀 색 채움을 그대로 물려받고, 윤곽선은 속을 흰 종이로
 * 못 박고 테두리만 팀 색을 받는다 — 빈 원과 같은 규약이다. 윤곽선의 모서리는
 * 둥글게 잇는다(`stroke-linejoin`) — 뾰족하게 두면 앞머리·발끝 같은 예각에서
 * 선이 바늘처럼 튀어나온다.
 */
export const figureModeAttrs = (mode: FigureMode, outlineMm: number): Attrs =>
  mode === 'illustration'
    ? { stroke: 'none' }
    : {
        fill: PAPER,
        'stroke-width': outlineMm,
        'stroke-linejoin': 'round',
      };

/**
 * 모서리를 둥글린 다각형 경로. 꼭짓점마다 양옆 변을 `roundMm`만큼 잘라 내고
 * 그 사이를 꼭짓점을 제어점 삼은 2차 곡선으로 잇는다. 변이 짧으면 절반까지만
 * 자른다 — 그래야 이웃 모서리와 겹치지 않는다.
 */
export const roundedPath = (points: readonly Pt[], roundMm: number): string => {
  const n = points.length;
  if (roundMm <= 0) {
    return (
      points
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${num(x)} ${num(y)}`)
        .join(' ') + ' Z'
    );
  }
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i + n - 1) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const dPrev = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]) || 1;
    const dNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
    const cut = Math.min(roundMm, dPrev / 2, dNext / 2);
    const a: Pt = [
      cur[0] + ((prev[0] - cur[0]) / dPrev) * cut,
      cur[1] + ((prev[1] - cur[1]) / dPrev) * cut,
    ];
    const b: Pt = [
      cur[0] + ((next[0] - cur[0]) / dNext) * cut,
      cur[1] + ((next[1] - cur[1]) / dNext) * cut,
    ];
    parts.push(`${i === 0 ? 'M' : 'L'} ${num(a[0])} ${num(a[1])}`);
    parts.push(`Q ${num(cur[0])} ${num(cur[1])} ${num(b[0])} ${num(b[1])}`);
  }
  parts.push('Z');
  return parts.join(' ');
};

export const drawShape = (shape: Shape, attrs: Attrs): string =>
  shape.kind === 'disc'
    ? circle(shape.center[0], shape.center[1], shape.radiusMm, attrs)
    : path(roundedPath(shape.points, shape.roundMm), attrs);

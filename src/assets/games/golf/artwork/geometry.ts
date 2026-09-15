/**
 * 코스 기하 — 중심선 하나에서 페어웨이를 부풀리고, 숲을 심는다 (IDE-030)
 *
 * 홀 열여덟 개의 모양은 `dimensions.ts`의 `spine`(티 → 그린 중심선) 하나에서
 * 나온다. 페어웨이 가장자리를 좌표로 적지 않는 이유는 **어긋나지 않기
 * 위해서**다 — 중심선과 가장자리를 따로 적으면 한쪽만 고쳤을 때 티가
 * 페어웨이 밖에 서고, 종이에 뽑기 전에는 아무도 모른다.
 *
 * DOM에도 서버에도 매이지 않는 순수 함수다. 아트워크 생성기가 빌드 때 부르고
 * 테스트가 같은 함수로 "홀이 그린 안에 있는가"를 본다.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export const pt = (x: number, y: number): Pt => ({ x, y });

export const distance = (a: Pt, b: Pt): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 중심선을 부드럽게 펴서 조밀한 점열로 바꾼다 (Catmull-Rom).
 *
 * 손으로 적는 제어점은 홀마다 서넛뿐이라 그대로 이으면 꺾인 길이 된다.
 * 골프 홀은 휘어야 도그렉이 되므로 곡선이 필요하다. 양 끝은 제어점을 한 번씩
 * 되풀이해 곡선이 티와 그린 중심에서 정확히 시작하고 끝나게 한다.
 */
export function smoothSpine(
  controls: readonly (readonly [number, number])[],
  perSegment = 12,
): Pt[] {
  const p = controls.map(([x, y]) => pt(x, y));
  if (p.length < 2) return p;
  const extended = [p[0], ...p, p[p.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < extended.length - 2; i++) {
    const [p0, p1, p2, p3] = [
      extended[i - 1],
      extended[i],
      extended[i + 1],
      extended[i + 2],
    ];
    // 마지막 구간만 끝점(u = 1)까지 넣는다. 구간마다 넣으면 이음매에서 점이
    // 겹쳐 길이 계산과 가장자리 법선이 흔들린다.
    const last = i === extended.length - 3;
    const steps = last ? perSegment : perSegment - 1;
    for (let s = 0; s <= steps; s++) {
      const u = s / perSegment;
      const u2 = u * u;
      const u3 = u2 * u;
      out.push(
        pt(
          0.5 *
            (2 * p1.x +
              (-p0.x + p2.x) * u +
              (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
              (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
          0.5 *
            (2 * p1.y +
              (-p0.y + p2.y) * u +
              (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
              (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        ),
      );
    }
  }
  return out;
}

/** 점열의 길이. 홀이 파에 어울리는 길이인지 테스트가 이 값으로 본다. */
export const polylineLength = (points: readonly Pt[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += distance(points[i - 1], points[i]);
  return total;
};

/**
 * 끝에서 주어진 길이만큼 잘라 낸 점열.
 *
 * 페어웨이가 쓴다. 중심선은 그린 **중심**에서 끝나는데(그래야 홀 자리가
 * 선 하나로 정해진다) 페어웨이를 거기까지 부풀리면 굽은 홀에서 그린 옆구리로
 * 길이 삐져나온다. 잘라 두면 페어웨이 끝이 그린 밑에 묻힌다.
 */
export function trimEnd(points: readonly Pt[], lengthMm: number): Pt[] {
  if (points.length < 2 || lengthMm <= 0) return [...points];
  let remaining = lengthMm;
  const out = [...points];
  while (out.length > 2) {
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    const segment = distance(prev, last);
    if (segment >= remaining) {
      const t = (segment - remaining) / segment;
      out[out.length - 1] = pt(
        prev.x + (last.x - prev.x) * t,
        prev.y + (last.y - prev.y) * t,
      );
      return out;
    }
    remaining -= segment;
    out.pop();
  }
  return out;
}

/** 점열 위 각 점의 단위 접선. 끝점은 이웃 하나만 본다. */
const tangents = (points: readonly Pt[]): Pt[] =>
  points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    return pt(dx / len, dy / len);
  });

/** 접선을 90° 돌린 법선. 왼쪽 가장자리가 `+n`, 오른쪽이 `−n`이다. */
const normalOf = (t: Pt): Pt => pt(t.y, -t.x);

/** 반원 캡 — 띠의 끝을 둥글게 막는다. 각진 끝은 종이 위에서 잘린 것처럼 보인다. */
const capArc = (center: Pt, n: Pt, radius: number, steps = 8): Pt[] => {
  const a0 = Math.atan2(n.y, n.x);
  const out: Pt[] = [];
  for (let k = 1; k < steps; k++) {
    const a = a0 + (Math.PI * k) / steps;
    out.push(
      pt(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius),
    );
  }
  return out;
};

/**
 * 중심선을 폭만큼 부풀려 닫힌 띠를 만든다. 페어웨이와 개울이 같은 함수를 쓴다.
 *
 * 곡률 반지름이 반폭보다 작으면 안쪽 가장자리가 스스로를 넘는다. 홀 제어점을
 * 완만하게 두어 그 일이 없게 했고, 테스트(`artwork.test.ts`)가 가장자리가
 * 역행하지 않는지 본다 — 종이에 뽑기 전에 알아야 하는 종류의 어긋남이다.
 */
export function ribbon(
  points: readonly Pt[],
  widthMm: number,
  /** 끝을 둥글게 막을지. 코스를 가로지르는 개울은 막지 않는다 — 판 가장자리에서 딱 끊겨야 한다. */
  caps = true,
): Pt[] {
  const r = widthMm / 2;
  const ts = tangents(points);
  const left = points.map((p, i) => {
    const n = normalOf(ts[i]);
    return pt(p.x + n.x * r, p.y + n.y * r);
  });
  const right = points.map((p, i) => {
    const n = normalOf(ts[i]);
    return pt(p.x - n.x * r, p.y - n.y * r);
  });
  const last = points.length - 1;
  if (!caps) return [...left, ...[...right].reverse()];
  return [
    ...left,
    ...capArc(points[last], normalOf(ts[last]), r),
    ...[...right].reverse(),
    ...capArc(points[0], pt(-normalOf(ts[0]).x, -normalOf(ts[0]).y), r),
  ];
}

/** 닫힌 점열을 SVG path로. */
export const closedPath = (points: readonly Pt[]): string =>
  `${points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
    .join(' ')} Z`;

/** 열린 점열을 SVG path로. */
export const openPath = (points: readonly Pt[]): string =>
  points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
    .join(' ');

const round = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

export interface Rect {
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

export const rectContains = (r: Rect, p: Pt): boolean =>
  p.x >= r.xMm &&
  p.x <= r.xMm + r.widthMm &&
  p.y >= r.yMm &&
  p.y <= r.yMm + r.heightMm;

export const rectCorners = (r: Rect): Pt[] => [
  pt(r.xMm, r.yMm),
  pt(r.xMm + r.widthMm, r.yMm),
  pt(r.xMm + r.widthMm, r.yMm + r.heightMm),
  pt(r.xMm, r.yMm + r.heightMm),
];

export const grow = (r: Rect, byMm: number): Rect => ({
  xMm: r.xMm - byMm,
  yMm: r.yMm - byMm,
  widthMm: r.widthMm + byMm * 2,
  heightMm: r.heightMm + byMm * 2,
});

/**
 * 사각형과 다각형이 겹치는가. 홀 정보 카드가 앉을 빈자리를 고를 때 쓴다.
 *
 * 다각형 점이 사각형 안이거나 사각형 꼭짓점이 다각형 안이면 겹친 것이다.
 * 변만 스치는 경우는 놓칠 수 있지만, 여기 들어오는 다각형은 촘촘히 샘플링된
 * 것이라(페어웨이·타원 모두 1mm 안팎 간격) 실제로 새는 자리가 없다.
 */
export const rectOverlapsPolygon = (r: Rect, polygon: readonly Pt[]): boolean =>
  polygon.some((p) => rectContains(r, p)) ||
  rectCorners(r).some((c) => pointInPolygon(polygon, c));

/** 점이 다각형 안인가 (짝수-홀수 규칙). */
export function pointInPolygon(polygon: readonly Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.y > p.y !== b.y > p.y;
    if (
      straddles &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** 점에서 다각형 둘레까지의 최단 거리. 안팎을 가리지 않는다. */
export function distanceToEdges(polygon: readonly Pt[], p: Pt): number {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    best = Math.min(best, distanceToSegment(p, polygon[j], polygon[i]));
  }
  return best;
}

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 다각형 안이면 0, 밖이면 둘레까지의 거리. "얼마나 비켜 있나"를 잰다. */
export const clearanceFromPolygon = (polygon: readonly Pt[], p: Pt): number =>
  pointInPolygon(polygon, p) ? 0 : distanceToEdges(polygon, p);

/**
 * 회전한 타원 위의 점. 벙커·연못은 타원 하나로 되어 있고, 기울여야 모래밭이
 * 자연스럽다.
 */
export const ellipsePoints = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotDeg = 0,
  steps = 48,
): Pt[] => {
  const rot = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return Array.from({ length: steps }, (_, i) => {
    const a = (Math.PI * 2 * i) / steps;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return pt(cx + x * cos - y * sin, cy + x * sin + y * cos);
  });
};

/** 중심에서 어느 방향으로 잰 타원의 반지름. 벙커를 그린 밖으로 밀 때 쓴다. */
export const ellipseRadiusAt = (
  rx: number,
  ry: number,
  angleRad: number,
): number => {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return (rx * ry) / Math.hypot(ry * c, rx * s);
};

/** 점이 회전 타원 안인가. 나무를 심을 때 벙커·연못을 피하는 데 쓴다. */
export const inEllipse = (
  p: Pt,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotDeg = 0,
): boolean => {
  const rot = (-rotDeg * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const x = dx * Math.cos(rot) - dy * Math.sin(rot);
  const y = dx * Math.sin(rot) + dy * Math.cos(rot);
  return (x / rx) ** 2 + (y / ry) ** 2 <= 1;
};

/**
 * 씨앗이 같으면 같은 수열을 내는 난수 (mulberry32).
 *
 * 숲의 나무 자리를 여기서 뽑는다. `Math.random`을 쓰면 `npm run artwork`를
 * 돌릴 때마다 커밋된 SVG가 바뀌어, 아트워크 테스트가 매번 실패한다.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tree {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface PlantOptions {
  readonly box: {
    readonly xMm: number;
    readonly yMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
  };
  readonly count: number;
  readonly seed: number;
  readonly radiusMm: number;
  readonly jitterMm: number;
  readonly spacingMm: number;
  /** 참이면 그 자리에는 심지 않는다 — 페어웨이·그린·벙커·물이 그렇다. */
  readonly blocked: (p: Pt, radius: number) => boolean;
}

/**
 * 상자 안에 나무를 흩는다. 자리를 못 찾으면 그루 수가 모자란 채로 끝난다 —
 * 억지로 밀어 넣어 페어웨이를 덮느니 숲이 성긴 편이 낫다.
 */
export function plantForest(
  options: PlantOptions,
  existing: readonly Tree[] = [],
): Tree[] {
  const random = seededRandom(options.seed);
  const trees: Tree[] = [];
  const all = () => [...existing, ...trees];
  for (let attempt = 0; attempt < options.count * 60; attempt++) {
    if (trees.length >= options.count) break;
    const r = options.radiusMm + (random() - 0.5) * 2 * options.jitterMm;
    const x = options.box.xMm + random() * options.box.widthMm;
    const y = options.box.yMm + random() * options.box.heightMm;
    const candidate = pt(x, y);
    if (options.blocked(candidate, r)) continue;
    if (
      all().some(
        (t) => Math.hypot(t.x - x, t.y - y) < options.spacingMm + (t.r + r) / 2,
      )
    ) {
      continue;
    }
    trees.push({ x, y, r });
  }
  return trees;
}

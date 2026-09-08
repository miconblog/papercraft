/**
 * 윤곽선 위에 점을 찍고 번호를 붙인다 (IDE-019)
 *
 * **호길이를 N등분해 찍으면 형태가 뭉개진다.** 뾰족한 모서리가 두 점 사이에
 * 묻히기 때문이다 — 강아지 귀 끝이 점을 못 받으면 다 이어도 귀가 나오지 않는다.
 * 그래서 차례가 둘이다.
 *
 * 1. **모서리 먼저.** 단순화가 남긴 꼭짓점을 꺾인 각이 큰 순으로 집는다.
 * 2. **나머지를 호길이 균등으로.** 가장 넓게 벌어진 사이를 반으로 가르기를
 *    되풀이한다 — 긴 직선 구간이 점 없이 비지 않는다.
 *
 * 번호는 **점 옆**이다. 점 위에 겹쳐 찍으면 연필을 댈 표적이 가려진다
 * (2026-09-08 결정). 윤곽선 바깥쪽으로 밀어 도안 안쪽 — 아이가 그을 선이 지나갈
 * 자리 — 를 비운다.
 */
import {
  arcTable,
  clockwise,
  outwardNormal,
  perimeter,
  pointAt,
  tangentAt,
  toPoints,
  type Point,
} from './geometry.ts';
import type { Box } from './outline.ts';

/**
 * 실측으로 정할 값들의 **출발점**이다(IDE-019 「실측으로 정할 값」). 종이에
 * 뽑아 아이가 실제로 그어 본 뒤 바뀐다.
 */
export const DOT_METRICS = {
  /** 점 지름 — 연필 끝을 대기에 충분하고 선에 묻히지 않게. */
  dotDiameterMm: 1.8,
  /** 번호 글자 크기 — 만 4세가 혼자 읽는 최소 크기. */
  numberFontMm: 3.2,
  /** 최소 점 간격 — 점과 점 사이를 한 획으로 긋는 거리. 점 개수 상한을 정한다. */
  minGapMm: 8,
} as const;

/** 점 중심에서 번호 글자 중심까지의 첫 거리. 겹치면 여기서부터 더 민다. */
const LABEL_OFFSET_MM =
  DOT_METRICS.dotDiameterMm / 2 + DOT_METRICS.numberFontMm / 2 + 1.1;
/** 겹쳤을 때 한 번에 더 미는 거리. */
const LABEL_PUSH_MM = 1.3;
/** 글자 상자 사이에 두는 최소 틈. 붙어 있으면 두 수가 한 수로 읽힌다. */
const LABEL_PADDING_MM = 0.5;

/**
 * 번호를 놓아 볼 자리들 — **바깥으로 밀기, 안 되면 옆으로 비키기.**
 *
 * 바깥으로만 밀면 **오목한 자리에서 오히려 더 겹친다.** 고양이의 두 귀 사이나
 * 목처럼 윤곽이 안으로 굽은 곳에서는 바깥 법선이 한 점으로 모이기 때문이다.
 * 그런 자리에서는 선을 따라 앞뒤로 비키는 것이 답이다.
 *
 * 후보는 두 축의 격자이고 **제 점에서 멀어지는 정도가 작은 것부터** 쓴다.
 * 번호가 제 점에서 멀면 어느 점의 번호인지 헷갈리므로, 겹침을 피하는 것보다
 * 가까이 두는 것이 먼저다.
 */
const LABEL_OUT_STEPS = [0, 1, 2, 3, 4] as const;
const LABEL_ALONG_STEPS_MM = [0, 2.4, -2.4, 4.2, -4.2] as const;

const LABEL_SPOTS: ReadonlyArray<{ out: number; along: number }> =
  LABEL_OUT_STEPS.flatMap((out) =>
    LABEL_ALONG_STEPS_MM.map((along) => ({ out, along })),
  ).sort(
    (a, b) =>
      a.out * LABEL_PUSH_MM +
      Math.abs(a.along) -
      (b.out * LABEL_PUSH_MM + Math.abs(b.along)),
  );

/** 꺾인 각이 이보다 크면 모서리로 본다(라디안, 약 17°). */
const CORNER_MIN_TURN = 0.3;

/** 숫자 한 글자의 폭 어림값 — 글자 크기에 대한 비율. 라틴·숫자는 반각에 가깝다. */
const DIGIT_WIDTH_EM = 0.55;

export interface Dot {
  /** 1부터. 아이가 따라 읽는 수 그대로다. */
  readonly number: number;
  readonly xMm: number;
  readonly yMm: number;
  /** 번호 글자의 **중심**. `dominant-baseline: central`로 그린다. */
  readonly labelXMm: number;
  readonly labelYMm: number;
  /** 윤곽선 바깥 방향. 시작 화살표와 마지막 안내가 같은 쪽을 쓴다. */
  readonly outward: Point;
  /** 진행 방향. 시작 화살표가 가리키는 쪽이다. */
  readonly tangent: Point;
}

export interface DotPlan {
  readonly dots: readonly Dot[];
  /** 사용자가 넣은 수. */
  readonly requested: number;
  /** 이 윤곽에 넣을 수 있는 최대치. */
  readonly capacity: number;
  /** 상한에 걸려 요청보다 적게 찍혔는가. `IDE-020`이 이것을 보고 알린다. */
  readonly clamped: boolean;
  /** 다 밀었는데도 번호가 겹치는가. 상한 계산이 헐거웠다는 뜻이다. */
  readonly crowded: boolean;
}

export interface DotOptions {
  readonly minGapMm?: number;
  readonly dotDiameterMm?: number;
  readonly numberFontMm?: number;
  /** 번호가 이 사각형을 벗어나지 않게 붙든다. 보통 판의 인쇄 가능 영역이다. */
  readonly clampTo?: Box;
}

/** 점을 찍을 수 있는 최소 개수. 셋보다 적으면 이을 형태가 없다. */
export const MIN_DOTS = 3;

/**
 * 이 윤곽에 넣을 수 있는 점의 최대 개수.
 *
 * 둘레를 최소 간격으로 나눈 수다. 이보다 많이 넣으면 번호가 서로 겹쳐 읽을 수
 * 없다 — 그때는 넣을 수 있는 최대치를 알려 주고 거기서 멈춘다(안내 문구는
 * `IDE-020`).
 */
export function dotCapacity(
  outline: readonly number[],
  minGapMm: number = DOT_METRICS.minGapMm,
): number {
  const points = toPoints(outline);
  if (points.length < 3) return 0;
  return Math.max(MIN_DOTS, Math.floor(perimeter(points) / minGapMm));
}

/** 꼭짓점에서 꺾인 각(라디안). 0이면 곧고 π에 가까울수록 뾰족하다. */
function turnAngle(previous: Point, current: Point, next: Point): number {
  const ax = current.x - previous.x;
  const ay = current.y - previous.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la === 0 || lb === 0) return 0;
  const cos = (ax * bx + ay * by) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/** 고리 위 두 호길이 위치 사이의 짧은 쪽 거리. */
const cyclicDistance = (a: number, b: number, total: number): number => {
  const d = Math.abs(a - b) % total;
  return Math.min(d, total - d);
};

/**
 * 점을 찍을 호길이 위치들 — 모서리 먼저, 나머지는 균등하게.
 *
 * 모서리를 고를 때도 **간격을 지킨다.** 귀 끝처럼 꼭짓점 둘이 1mm 사이로 붙어
 * 있는 자리가 있는데, 둘 다 집으면 그 사이에 번호 두 개가 겹쳐 앉는다.
 */
function dotPositions(
  points: readonly Point[],
  count: number,
  minGapMm: number,
): number[] {
  const table = arcTable(points);
  const total = table.total;
  if (total === 0) return [];

  const corners = points
    .map((point, i) => ({
      s: table.cumulative[i],
      score: turnAngle(
        points[(i - 1 + points.length) % points.length],
        point,
        points[(i + 1) % points.length],
      ),
    }))
    .filter((c) => c.score >= CORNER_MIN_TURN)
    .sort((a, b) => b.score - a.score);

  const positions: number[] = [];
  for (const corner of corners) {
    if (positions.length >= count) break;
    if (
      positions.every((s) => cyclicDistance(s, corner.s, total) >= minGapMm)
    ) {
      positions.push(corner.s);
    }
  }
  // 모서리가 하나도 없는 도형(원)도 있다. 어디서든 시작하면 된다.
  if (positions.length === 0) positions.push(0);

  positions.sort((a, b) => a - b);
  while (positions.length < count) {
    let widestIndex = 0;
    let widest = -1;
    for (let i = 0; i < positions.length; i += 1) {
      const next =
        i + 1 < positions.length ? positions[i + 1] : positions[0] + total;
      const gap = next - positions[i];
      if (gap > widest) {
        widest = gap;
        widestIndex = i;
      }
    }
    const next =
      widestIndex + 1 < positions.length
        ? positions[widestIndex + 1]
        : positions[0] + total;
    positions.push(((positions[widestIndex] + next) / 2) % total);
    positions.sort((a, b) => a - b);
  }
  return positions;
}

interface Box2 {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

const overlaps = (a: Box2, b: Box2, padding: number): boolean =>
  Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + padding &&
  Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight + padding;

/** 숫자 글자 상자의 폭. 라벨은 늘 숫자뿐이라 어림값 하나면 된다. */
const labelWidthMm = (text: string, fontMm: number): number =>
  text.length * DIGIT_WIDTH_EM * fontMm;

/**
 * 윤곽선과 점 개수 → 점·번호 배치.
 *
 * **1번은 가장 위쪽 점이고 진행은 시계 방향**이다. 저장된 윤곽의 방향이 어느
 * 쪽이든 여기서 시계로 맞추므로, 다시 연 도안도 같은 차례로 번호가 붙는다.
 */
export function planDots(
  outline: readonly number[],
  requested: number,
  options: DotOptions = {},
): DotPlan {
  const minGapMm = options.minGapMm ?? DOT_METRICS.minGapMm;
  const dotDiameterMm = options.dotDiameterMm ?? DOT_METRICS.dotDiameterMm;
  const fontMm = options.numberFontMm ?? DOT_METRICS.numberFontMm;

  const raw = toPoints(outline);
  if (raw.length < 3) {
    return {
      dots: [],
      requested,
      capacity: 0,
      clamped: requested > 0,
      crowded: false,
    };
  }

  const points = clockwise(raw);
  const capacity = dotCapacity(outline, minGapMm);
  const count = Math.max(MIN_DOTS, Math.min(requested, capacity));

  const table = arcTable(points);
  const positions = dotPositions(points, count, minGapMm);

  // 1번은 가장 위쪽 점이다. 시계 방향으로 오름차순인 배열을 그 자리에서 자른다.
  const placed = positions.map((s) => ({ s, point: pointAt(table, s) }));
  let first = 0;
  for (let i = 1; i < placed.length; i += 1) {
    const best = placed[first].point;
    const candidate = placed[i].point;
    if (
      candidate.y < best.y ||
      (candidate.y === best.y && candidate.x < best.x)
    ) {
      first = i;
    }
  }
  const ordered = [...placed.slice(first), ...placed.slice(0, first)];

  const dotHalf = dotDiameterMm / 2 + 0.4;
  const dotBoxes: Box2[] = ordered.map(({ point }) => ({
    x: point.x,
    y: point.y,
    halfWidth: dotHalf,
    halfHeight: dotHalf,
  }));

  const labelBoxes: Box2[] = [];
  const dots: Dot[] = [];
  let crowded = false;

  for (const [i, { s, point }] of ordered.entries()) {
    const tangent = tangentAt(table, s);
    const outward = outwardNormal(tangent);
    const text = String(i + 1);
    const halfWidth = labelWidthMm(text, fontMm) / 2;
    const halfHeight = fontMm / 2;

    let chosen: Box2 | null = null;
    for (const [tries, spot] of LABEL_SPOTS.entries()) {
      const offset = LABEL_OFFSET_MM + spot.out * LABEL_PUSH_MM;
      let x = point.x + outward.x * offset + tangent.x * spot.along;
      let y = point.y + outward.y * offset + tangent.y * spot.along;
      if (options.clampTo) {
        const box = options.clampTo;
        x = Math.min(
          Math.max(x, box.x + halfWidth),
          box.x + box.width - halfWidth,
        );
        y = Math.min(
          Math.max(y, box.y + halfHeight),
          box.y + box.height - halfHeight,
        );
      }
      const candidate = { x, y, halfWidth, halfHeight };
      const hitsLabel = labelBoxes.some((b) =>
        overlaps(candidate, b, LABEL_PADDING_MM),
      );
      const hitsDot = dotBoxes.some((b) =>
        overlaps(candidate, b, LABEL_PADDING_MM),
      );
      if (!hitsLabel && !hitsDot) {
        chosen = candidate;
        break;
      }
      // 마지막 자리까지 다 막히면 그것을 그대로 쓴다. 번호를 아예 빼면 아이가
      // 셀 수를 잃는다 — 겹쳐도 있는 편이 낫고, 대신 `crowded`로 알린다.
      if (tries === LABEL_SPOTS.length - 1) {
        chosen = candidate;
        crowded = true;
      }
    }

    const label = chosen!;
    labelBoxes.push(label);
    dots.push({
      number: i + 1,
      xMm: point.x,
      yMm: point.y,
      labelXMm: label.x,
      labelYMm: label.y,
      outward,
      tangent,
    });
  }

  return {
    dots,
    requested,
    capacity,
    clamped: count < requested,
    crowded,
  };
}

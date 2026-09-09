/**
 * 피사체 안쪽의 **세부 선** (IDE-021)
 *
 * 윤곽선만 따면 다 이어도 실루엣 하나가 남는다 — 무엇을 찍은 사진인지
 * 알아보기 어렵다(2026-09-09 사용자). 눈·입·머리카락 경계 같은 선은 임계값이
 * **하나뿐이라** 안 나온다: 얼굴도 머리도 눈도 전부 마스크 `1`로 뭉쳐 고리가
 * 아예 생기지 않는다. 그래서 **밝기를 여러 단으로 나눠 각 단의 경계를 딴다.**
 *
 *     gray + subject → 깎기 → 다단계 임계값 → 단마다 traceContours → 고르기
 *
 * 여기서 나온 선은 **아이가 잇지 않는다.** 판에 미리 그려 두고, 아이는 여전히
 * 윤곽 하나만 이어 한 붓 그리기를 지킨다(IDE-021 결정).
 *
 * 뒤 단계(Chaikin · RDP · 상자에 맞춰 넣기)는 윤곽과 똑같은 것을 쓴다 — 세부와
 * 윤곽이 **같은 변환**으로 판에 앉아야 서로 어긋나지 않는다.
 */
import { area, bounds, type Point } from './geometry.ts';
import type { GrayImage, Mask } from './image.ts';
import { chaikin, simplify, simplifyEpsilon, traceContours } from './trace.ts';

/** 밝기를 최대 몇 단 더 나눌 수 있나. 넘어가면 선이 너무 많아 그림이 뭉갠다. */
export const MAX_DETAIL_LEVELS = 3;

/**
 * 피사체 테두리에서 안으로 깎아 들어가는 거리 — **짧은 변에 대한 비율**이다.
 *
 * 깎지 않으면 머리카락 경계처럼 실루엣에 딱 붙은 고리가 나와, 아이가 점을 잇기
 * 전에 답이 종이에 보인다. 화소 수로 적으면 사진 크기에 따라 뜻이 달라진다.
 */
const INSET_RATIO = 0.012;

/** 고리 하나가 피사체 넓이에서 차지해야 하는 최소 몫. 이보다 작으면 잔티다. */
export const DETAIL_MIN_AREA_RATIO = 0.005;

/**
 * 이보다 크면 **실루엣을 알려 주는 고리**다. 깎아 놓아도 가장 바깥 단의 경계는
 * 윤곽선을 거의 그대로 되짚으므로 여기서 걸러 낸다.
 */
export const DETAIL_MAX_AREA_RATIO = 0.6;

/** 고리 수 상한. 도안 슬롯의 `maxRings`와 같은 값을 쓴다. */
export const DETAIL_MAX_RINGS = 10;

/**
 * 모든 고리의 점 수 합 상한.
 *
 * 값이 `localStorage`에 사진과 함께 들어가고 판 요청에도 실려 간다(IDE-020).
 * 점 하나가 좌표 둘이므로 800점이면 JSON 8KB쯤이다.
 */
export const DETAIL_MAX_POINTS = 800;

/** 최소 꼭짓점. 이보다 적으면 선이라 할 것이 없다. */
const MIN_VERTICES = 6;

export interface DetailOptions {
  /** 밝기를 몇 단 더 나눌지. 0이면 세부를 따지 않는다. */
  readonly levels?: number;
  readonly minAreaRatio?: number;
  readonly maxAreaRatio?: number;
  readonly maxRings?: number;
  readonly maxPoints?: number;
}

/**
 * 구간 `[lo, hi]` 안에서의 Otsu 임계값. 없으면 -1.
 *
 * `image.ts`의 `otsuThreshold`가 사진 전체를 보는 것과 달리 여기는 **구간**을
 * 본다 — 한 번 가른 단을 또 가르려면 그 단의 히스토그램만 봐야 한다.
 */
function otsuInRange(
  histogram: Float64Array,
  lo: number,
  hi: number,
): { threshold: number; variance: number } {
  let total = 0;
  let sum = 0;
  for (let i = lo; i <= hi; i += 1) {
    total += histogram[i];
    sum += i * histogram[i];
  }
  if (total === 0) return { threshold: -1, variance: 0 };

  let weightLow = 0;
  let sumLow = 0;
  let best = -1;
  let bestVariance = 0;
  for (let t = lo; t < hi; t += 1) {
    weightLow += histogram[t];
    sumLow += t * histogram[t];
    const weightHigh = total - weightLow;
    if (weightLow === 0 || weightHigh === 0) continue;
    const meanLow = sumLow / weightLow;
    const meanHigh = (sum - sumLow) / weightHigh;
    const between =
      weightLow * weightHigh * (meanLow - meanHigh) * (meanLow - meanHigh);
    if (between > bestVariance) {
      bestVariance = between;
      best = t;
    }
  }
  return { threshold: best, variance: bestVariance };
}

/**
 * 밝기를 `count`단 더 가르는 임계값들. 작은 수부터 늘어선다.
 *
 * **가장 잘 갈리는 단을 골라 다시 가른다.** 구간을 균등하게 나누면 아무것도
 * 없는 곳에 선이 생기고 정작 눈과 얼굴 사이는 안 갈린다. 256단짜리 완전
 * 다단계 Otsu 대신 이 되풀이를 쓰는 것은, 세 단 안쪽에서는 결과가 거의 같고
 * 코드가 열 줄이면 끝나기 때문이다.
 */
export function multiThresholds(
  histogram: Float64Array,
  count: number,
): number[] {
  const bands: Array<[number, number]> = [[0, 255]];
  const thresholds: number[] = [];

  for (let n = 0; n < count; n += 1) {
    let pick = -1;
    let pickAt: { threshold: number; variance: number } = {
      threshold: -1,
      variance: 0,
    };
    for (const [i, [lo, hi]] of bands.entries()) {
      if (hi - lo < 2) continue;
      const found = otsuInRange(histogram, lo, hi);
      if (found.threshold >= 0 && found.variance > pickAt.variance) {
        pick = i;
        pickAt = found;
      }
    }
    if (pick === -1) break;

    const [lo, hi] = bands[pick];
    bands.splice(pick, 1, [lo, pickAt.threshold], [pickAt.threshold + 1, hi]);
    thresholds.push(pickAt.threshold);
  }

  return thresholds.sort((a, b) => a - b);
}

/**
 * 마스크를 `radius`만큼 깎는다 — 둘레의 화소를 벗겨 낸다.
 *
 * 가로·세로로 나눠 훑는다(최소값 필터는 분리 가능하다). 사진 밖은 배경으로
 * 보므로 테두리에 닿은 피사체도 그만큼 깎인다.
 */
export function erodeMask(mask: Mask, radius: number): Mask {
  if (radius <= 0) return mask;
  const { width, height } = mask;
  const mid = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let k = -radius; k <= radius && on === 1; k += 1) {
        const sx = x + k;
        if (sx < 0 || sx >= width || mask.data[y * width + sx] === 0) on = 0;
      }
      mid[y * width + x] = on;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let k = -radius; k <= radius && on === 1; k += 1) {
        const sy = y + k;
        if (sy < 0 || sy >= height || mid[sy * width + x] === 0) on = 0;
      }
      out[y * width + x] = on;
    }
  }
  return { width, height, data: out };
}

const countOn = (mask: Mask): number => {
  let total = 0;
  for (const v of mask.data) total += v;
  return total;
};

/**
 * 피사체 안쪽에서 세부 선을 딴다. 화소 좌표의 닫힌 고리들이 나온다.
 *
 * `levels`가 0이면 빈 배열이다 — 세부를 끈 사용자에게 지금까지와 똑같은 판이
 * 나와야 한다.
 */
export function traceDetail(
  gray: GrayImage,
  subject: Mask,
  options: DetailOptions = {},
): Point[][] {
  const levels = Math.min(MAX_DETAIL_LEVELS, Math.floor(options.levels ?? 0));
  if (levels <= 0) return [];

  const inset = Math.max(
    1,
    Math.round(Math.min(subject.width, subject.height) * INSET_RATIO),
  );
  const inner = erodeMask(subject, inset);
  const innerArea = countOn(inner);
  if (innerArea === 0) return [];

  const histogram = new Float64Array(256);
  for (let i = 0; i < inner.data.length; i += 1) {
    if (inner.data[i] === 1) histogram[gray.data[i]] += 1;
  }

  const minArea = innerArea * (options.minAreaRatio ?? DETAIL_MIN_AREA_RATIO);
  const maxArea = innerArea * (options.maxAreaRatio ?? DETAIL_MAX_AREA_RATIO);

  const found: Array<{ points: Point[]; size: number }> = [];
  for (const threshold of multiThresholds(histogram, levels)) {
    const band: Mask = {
      width: inner.width,
      height: inner.height,
      data: new Uint8Array(inner.data.length),
    };
    for (let i = 0; i < band.data.length; i += 1) {
      band.data[i] = inner.data[i] === 1 && gray.data[i] <= threshold ? 1 : 0;
    }

    for (const contour of traceContours(band)) {
      const size = area(contour);
      if (size < minArea || size > maxArea) continue;
      const smoothed = chaikin(contour);
      const points = simplify(smoothed, simplifyEpsilon(smoothed));
      if (points.length < MIN_VERTICES) continue;
      found.push({ points, size });
    }
  }

  // 큰 것부터 담되 점 예산 안에서 멈춘다. 작은 고리를 먼저 담아 예산을 쓰면
  // 정작 눈에 띄는 선이 빠진다.
  found.sort((a, b) => b.size - a.size);
  const maxRings = options.maxRings ?? DETAIL_MAX_RINGS;
  const maxPoints = options.maxPoints ?? DETAIL_MAX_POINTS;
  const rings: Point[][] = [];
  let spent = 0;
  for (const candidate of found) {
    if (rings.length >= maxRings) break;
    if (spent + candidate.points.length > maxPoints) continue;
    if (rings.some((ring) => sameRing(ring, candidate.points))) continue;
    rings.push(candidate.points);
    spent += candidate.points.length;
  }
  return rings;
}

/**
 * 두 고리가 사실상 같은 선인가. 단이 이웃하면 같은 경계를 두 번 딸 수 있는데,
 * 겹쳐 그으면 선이 굵어 보이기만 하고 점 예산을 두 번 먹는다.
 */
function sameRing(a: readonly Point[], b: readonly Point[]): boolean {
  const ba = bounds(a);
  const bb = bounds(b);
  const span = Math.max(ba.maxX - ba.minX, ba.maxY - ba.minY, 1);
  const slack = span * 0.03;
  return (
    Math.abs(ba.minX - bb.minX) < slack &&
    Math.abs(ba.minY - bb.minY) < slack &&
    Math.abs(ba.maxX - bb.maxX) < slack &&
    Math.abs(ba.maxY - bb.maxY) < slack
  );
}

/**
 * 닫힌 다각형을 다루는 최소한의 기하 (IDE-019)
 *
 * 이 놀이가 다루는 도형은 **닫힌 폴리라인 하나**뿐이다. 마지막 점 다음은 늘
 * 첫 점이고, 그래서 점 배열에 첫 점을 되풀이해 적지 않는다 — 되풀이해 두면
 * 호길이·둘레·넓이 계산이 저마다 "마지막 점을 셀 것인가"를 다르게 답한다.
 *
 * 단위는 이 파일이 정하지 않는다. 추적 단계에서는 화소이고 도안에서는 mm다.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * 값으로 오가는 윤곽선 — `[x0, y0, x1, y1, …]`이 납작하게 늘어선 배열이다.
 *
 * 커스터마이즈에 실려 서버로 가는 모양이라(`outline` 슬롯) 점마다 객체를 두지
 * 않는다. 점 400개가 객체면 12KB, 납작한 수 배열이면 4KB다 — `localStorage`에
 * 사진과 함께 들어가야 하므로(`IDE-020`) 이 차이가 실제로 걸린다.
 */
export type FlatOutline = number[];

export const toPoints = (flat: readonly number[]): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
};

export const toFlat = (points: readonly Point[]): FlatOutline =>
  points.flatMap((p) => [p.x, p.y]);

export const distance = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/**
 * 신발끈 공식. **부호가 방향을 말한다** — y가 아래로 자라는 좌표계(도안·화면)
 * 에서 양수면 **시계 방향**이다. 번호를 시계 방향으로 매기려면 이 부호를 봐야
 * 한다(`docs/game-authoring.md`의 좌표계).
 */
export function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export const area = (points: readonly Point[]): number =>
  Math.abs(signedArea(points));

export function perimeter(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    sum += distance(points[i], points[(i + 1) % points.length]);
  }
  return sum;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function bounds(points: readonly Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** 시계 방향(y 아래로 자라는 좌표계)으로 맞춘다. 이미 그러면 그대로다. */
export const clockwise = (points: readonly Point[]): Point[] =>
  signedArea(points) >= 0 ? [...points] : [...points].reverse();

/** 배열을 돌려 `index`가 첫 점이 되게 한다. 닫힌 도형이라 뜻이 바뀌지 않는다. */
export const rotateTo = (points: readonly Point[], index: number): Point[] => [
  ...points.slice(index),
  ...points.slice(0, index),
];

/**
 * 호길이 위치 → 점. `s`는 0부터 둘레까지이고 넘으면 한 바퀴 돌아 이어진다.
 *
 * 변마다 길이를 다시 재지 않게 누적 길이를 미리 받는다 — 점 100개를 배분하며
 * 수천 번 부르는 자리라 여기서 O(n)을 쓰면 전체가 O(n²)이 된다.
 */
export interface ArcTable {
  readonly points: readonly Point[];
  /** `cumulative[i]` = 0번 점에서 i번 점까지의 길이. 마지막 칸이 둘레다. */
  readonly cumulative: readonly number[];
  readonly total: number;
}

export function arcTable(points: readonly Point[]): ArcTable {
  const cumulative: number[] = [0];
  for (let i = 0; i < points.length; i += 1) {
    cumulative.push(
      cumulative[i] + distance(points[i], points[(i + 1) % points.length]),
    );
  }
  return { points, cumulative, total: cumulative[points.length] };
}

/** 누적 길이 표에서 `s`가 어느 변에 있는지 이분 탐색으로 찾는다. */
export function pointAt(table: ArcTable, s: number): Point {
  const { points, cumulative, total } = table;
  if (total === 0) return points[0];
  let target = s % total;
  if (target < 0) target += total;

  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (cumulative[mid] <= target) low = mid;
    else high = mid - 1;
  }
  const segment = cumulative[low + 1] - cumulative[low];
  const t = segment === 0 ? 0 : (target - cumulative[low]) / segment;
  const a = points[low];
  const b = points[(low + 1) % points.length];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 호길이 위치에서의 진행 방향(단위 벡터). 변의 방향을 그대로 쓴다. */
export function tangentAt(table: ArcTable, s: number): Point {
  const { points, cumulative, total } = table;
  if (total === 0) return { x: 1, y: 0 };
  let target = s % total;
  if (target < 0) target += total;

  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (cumulative[mid] <= target) low = mid;
    else high = mid - 1;
  }
  const a = points[low];
  const b = points[(low + 1) % points.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
}

/**
 * 진행 방향의 **바깥쪽** 법선.
 *
 * 시계 방향(y 아래로 자라는 좌표계)으로 도는 다각형에서 바깥은 진행 방향을
 * −90° 돌린 쪽이다. 번호를 여기로 밀어야 도안 안쪽 — 아이가 그을 선이 지나갈
 * 자리 — 이 빈다(IDE-019 「번호」).
 */
export const outwardNormal = (tangent: Point): Point => ({
  x: tangent.y,
  y: -tangent.x,
});

/** 두 점을 잇는 선분 위에서 `t`(0~1) 지점. */
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

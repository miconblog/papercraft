/**
 * 세계일주 게임판의 지도 투영 (IDE-015)
 *
 * **로빈슨 도법, 동경 150° 중심**이다.
 *
 * - 로빈슨을 고른 이유: 등장방형은 고위도가 크게 늘어나 북극해 구간의 칸이
 *   실제보다 멀어 보이고, 메르카토르는 그린란드가 아프리카만 해진다. 로빈슨은
 *   학교 지도책이 세계 전도에 쓰는 절충안이라 아이 눈에 익다.
 * - 태평양 중심인 이유: **서울 → 태평양 → 남아메리카가 끊기지 않아야** 한다.
 *   0° 중심 지도에서는 이 첫 구간이 종이 좌우로 갈라진다. 옛 인쇄본도 유럽이
 *   왼쪽 끝, 북아메리카가 오른쪽 끝인 태평양 중심이었다.
 *
 * 중심을 150°E에 두면 지도의 좌우 끝(자오선 30°W)이 대서양 한가운데를 지난다.
 * 아이슬란드(24°W)는 왼쪽에 온전히 남고 브라질 동쪽 끝(35°W)은 오른쪽에 남는다.
 * 그린란드와 남극은 어쩔 수 없이 갈라진다 — 어느 중심을 잡아도 둘 중 하나는
 * 갈라진다.
 *
 * 여기 있는 것은 순수 계산뿐이다. 치수(지도 상자)는 `./dimensions.ts`가 갖고,
 * 폴리곤을 자르고 그리는 일은 `./artwork/`가 한다.
 */

/** 지도의 중앙 자오선. */
export const CENTER_LON_DEG = 150;

/**
 * 로빈슨 도법 표 — 위도 5°마다 (X: 위선 길이 비율, Y: 적도에서의 거리 비율).
 * 두 값을 선형 보간한다. 로빈슨 자신이 표로 정의한 도법이라 식이 따로 없다.
 */
const TABLE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1.0, 0.0],
  [5, 0.9986, 0.062],
  [10, 0.9954, 0.124],
  [15, 0.99, 0.186],
  [20, 0.9822, 0.248],
  [25, 0.973, 0.31],
  [30, 0.96, 0.372],
  [35, 0.9427, 0.434],
  [40, 0.9216, 0.4958],
  [45, 0.8962, 0.5571],
  [50, 0.8679, 0.6176],
  [55, 0.835, 0.6769],
  [60, 0.7986, 0.7346],
  [65, 0.7597, 0.7903],
  [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936],
  [80, 0.6213, 0.9394],
  [85, 0.5722, 0.9761],
  [90, 0.5322, 1.0],
];

const X_SCALE = 0.8487;
const Y_SCALE = 1.3523;

/** 적도 전체 길이 대비 높이 — 지도 상자의 가로세로비를 정한다(≈ 1.972). */
export const ROBINSON_ASPECT = (X_SCALE * 2 * Math.PI) / (Y_SCALE * 2);

const interpolate = (latDeg: number): { x: number; y: number } => {
  const lat = Math.min(90, Math.max(0, Math.abs(latDeg)));
  const i = Math.min(TABLE.length - 2, Math.floor(lat / 5));
  const t = (lat - TABLE[i][0]) / 5;
  const x = TABLE[i][1] + (TABLE[i + 1][1] - TABLE[i][1]) * t;
  const y = TABLE[i][2] + (TABLE[i + 1][2] - TABLE[i][2]) * t;
  return { x, y: latDeg < 0 ? -y : y };
};

/**
 * 중앙 자오선 기준 상대 경도. **[-180, 180) 범위로 감는다.**
 *
 * 폴리곤을 그릴 때는 이 값을 그대로 쓰면 안 된다 — 지도 끝을 넘는 고리는
 * 이웃한 점끼리 360° 뛴다. `unwrapRing`으로 이어 붙인 뒤 `splitAtEdges`로
 * 잘라야 한다.
 */
export const relativeLon = (lonDeg: number): number => {
  let d = lonDeg - CENTER_LON_DEG;
  d = ((((d + 180) % 360) + 360) % 360) - 180;
  return d;
};

/**
 * 정규화된 로빈슨 좌표. x는 [-1, 1](좌우 끝이 ±1), y는 [-1, 1](북극이 +1).
 * `relLonDeg`는 중앙 자오선 기준 상대 경도(감지 않은 값이어도 된다).
 */
export const robinsonUnit = (
  relLonDeg: number,
  latDeg: number,
): { x: number; y: number } => {
  const { x, y } = interpolate(latDeg);
  return { x: (x * relLonDeg) / 180, y };
};

export interface MapBox {
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

/** 경위도 → 지도 상자 안의 mm 좌표(파트 로컬, y는 아래로). */
export const projectToMap = (
  lonDeg: number,
  latDeg: number,
  box: MapBox,
): { xMm: number; yMm: number } => {
  const { x, y } = robinsonUnit(relativeLon(lonDeg), latDeg);
  return {
    xMm: box.xMm + box.widthMm / 2 + (x * box.widthMm) / 2,
    yMm: box.yMm + box.heightMm / 2 - (y * box.heightMm) / 2,
  };
};

export type LonLat = readonly [number, number];

/**
 * 고리의 경도를 중앙 자오선 기준으로 옮기고, 이웃한 점이 180°보다 크게 뛰지
 * 않도록 ±360°를 더해 **연속된 선**으로 만든다.
 *
 * 극을 감싸는 고리(남극)는 한 바퀴를 돌아 끝점이 시작점에서 360° 떨어진다.
 * 그대로 닫으면 마지막 점에서 첫 점으로 닫는 변이 대륙을 가로질러 지도를
 * 반으로 가른다. 그래서 고리를 **지도 끝 자오선(±180°)을 지나는 자리에서
 * 다시 시작**하게 돌리고, 양 끝에서 극점으로 내려가는 변 둘로 닫는다 — 그
 * 변 둘이 정확히 지도 끝에 놓여야 `splitAtEdges`가 자른 조각의 경계와 겹치고,
 * 지도 안쪽에 틈새 선이 남지 않는다.
 */
export const unwrapRing = (ring: readonly LonLat[]): LonLat[] => {
  if (ring.length === 0) return [];
  const out: LonLat[] = [];
  let prev = relativeLon(ring[0][0]);
  out.push([prev, ring[0][1]]);
  let latSum = ring[0][1];
  for (let i = 1; i < ring.length; i += 1) {
    let lon = relativeLon(ring[i][0]);
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
    latSum += ring[i][1];
    prev = lon;
  }
  // 열린 고리라 끝점은 시작점 바로 옆이다. 한 바퀴 돈 고리는 양 끝이 360°에
  // 가깝게 벌어진다 — 180°보다 크면 한 바퀴다(닫힌 변이 180°를 넘을 수는 없다).
  const turn = out[out.length - 1][0] - out[0][0];
  if (Math.abs(turn) <= 180) return out;
  const wrap = turn > 0 ? 360 : -360;

  const pole = latSum / ring.length < 0 ? -90 : 90;
  // 고리가 덮는 경도 구간 안에 있는 지도 끝 자오선.
  const start = out[0][0];
  const meridian =
    wrap > 0
      ? 180 + 360 * Math.ceil((start - 180) / 360)
      : 180 + 360 * Math.floor((start - 180) / 360);
  let crossing = -1;
  for (let i = 0; i + 1 < out.length; i += 1) {
    const a = out[i][0] - meridian;
    const b = out[i + 1][0] - meridian;
    if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
      crossing = i;
      break;
    }
  }
  if (crossing === -1) {
    // 자오선을 지나는 변이 없다(이론상 없는 경우). 옛 방식으로 닫는다.
    out.push([out[out.length - 1][0], pole], [out[0][0], pole]);
    return out;
  }
  const a = out[crossing];
  const b = out[crossing + 1];
  const t = (meridian - a[0]) / (b[0] - a[0]);
  const lat = a[1] + (b[1] - a[1]) * t;
  const rotated: LonLat[] = [
    [meridian, lat],
    ...out.slice(crossing + 1),
    ...out.slice(0, crossing + 1).map(([lon, y]) => [lon + wrap, y] as const),
    [meridian + wrap, lat],
    [meridian + wrap, pole],
    [meridian, pole],
  ];
  return rotated;
};

type Pt = readonly [number, number];

/**
 * Sutherland–Hodgman — 볼록한 창(여기서는 축에 평행한 반평면) 하나로 자른다.
 * `inside(p)`가 참인 쪽을 남기고, 경계와의 교점은 `cross(a, b)`가 준다.
 */
const clipHalfPlane = (
  points: readonly Pt[],
  inside: (p: Pt) => boolean,
  cross: (a: Pt, b: Pt) => Pt,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[(i + points.length - 1) % points.length];
    const b = points[i];
    const aIn = inside(a);
    const bIn = inside(b);
    if (bIn) {
      if (!aIn) out.push(cross(a, b));
      out.push(b);
    } else if (aIn) {
      out.push(cross(a, b));
    }
  }
  return out;
};

const crossAtX =
  (x: number) =>
  (a: Pt, b: Pt): Pt => {
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + (b[1] - a[1]) * t];
  };

const crossAtY =
  (y: number) =>
  (a: Pt, b: Pt): Pt => {
    const t = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * t, y];
  };

/** 축 평행 사각형으로 폴리곤을 자른다. 남는 것이 없으면 빈 배열이다. */
export const clipToRect = (
  points: readonly Pt[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): Pt[] => {
  let out: Pt[] = [...points];
  out = clipHalfPlane(out, (p) => p[0] >= minX, crossAtX(minX));
  if (out.length < 3) return [];
  out = clipHalfPlane(out, (p) => p[0] <= maxX, crossAtX(maxX));
  if (out.length < 3) return [];
  out = clipHalfPlane(out, (p) => p[1] >= minY, crossAtY(minY));
  if (out.length < 3) return [];
  out = clipHalfPlane(out, (p) => p[1] <= maxY, crossAtY(maxY));
  return out.length < 3 ? [] : out;
};

/**
 * 이어 붙인 고리(`unwrapRing`의 결과)를 지도 좌우 끝(상대 경도 ±180°)에서
 * 잘라 **지도 안에 들어오는 조각들**로 나눈다. 한 고리가 두 조각이 되는 것은
 * 그린란드·남극처럼 지도 끝에 걸친 땅이다.
 *
 * 경도는 감기 전 값이라 [-540, 540] 어디에나 있을 수 있다. 고리를 ±360° 옮긴
 * 사본 셋을 각각 [-180, 180]로 잘라 모은다.
 */
export const splitAtEdges = (unwrapped: readonly LonLat[]): LonLat[][] => {
  const pieces: LonLat[][] = [];
  for (const shift of [-360, 0, 360]) {
    const shifted = unwrapped.map(([lon, lat]) => [lon + shift, lat] as Pt);
    const piece = clipToRect(shifted, -180, 180, -90, 90);
    if (piece.length >= 3) pieces.push(piece);
  }
  return pieces;
};

/**
 * 경위도 고리 하나 → 지도 상자 안 mm 폴리곤들.
 *
 * 지도 끝에서 자르고, 투영하고, 상자 밖으로 삐져나온 부분(반올림 오차)을 한 번
 * 더 자른다 — 인쇄 렌더러는 클립을 받지 않으므로 종이 밖으로 나가는 도형을
 * 도안이 만들면 안 된다.
 */
export const ringToMapPolygons = (
  ring: readonly LonLat[],
  box: MapBox,
): Array<Array<readonly [number, number]>> =>
  splitAtEdges(unwrapRing(ring))
    .map((piece) =>
      piece.map(([relLon, lat]) => {
        const { x, y } = robinsonUnit(relLon, lat);
        return [
          box.xMm + box.widthMm / 2 + (x * box.widthMm) / 2,
          box.yMm + box.heightMm / 2 - (y * box.heightMm) / 2,
        ] as const;
      }),
    )
    .map((polygon) =>
      clipToRect(
        polygon,
        box.xMm,
        box.xMm + box.widthMm,
        box.yMm,
        box.yMm + box.heightMm,
      ),
    )
    .filter((polygon) => polygon.length >= 3);

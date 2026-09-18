/**
 * Natural Earth 나라 경계 내려받기 (방문 통계 지도)
 *
 * 방문 통계의 "어느 나라에서 왔나" 지도가 쓰는 나라 경계다. 원본은 Natural
 * Earth 의 `ne_50m_admin_0_countries`(퍼블릭 도메인, 저작권 표시 의무 없음).
 * 3MB 짜리 GeoJSON 을 들이지 않고 **미리 투영하고 화면 해상도만큼 줄여서** SVG
 * 경로 문자열로 `src/assets/shared/world-countries.json` 에 쓴다.
 *
 *     npm run fetch:countries
 *
 * **110m 이 아니라 50m 이다.** 110m 에는 싱가포르·홍콩·마카오가 아예 없다 —
 * 한국 사이트에 해외 방문이 오면 가장 먼저 찍힐 곳들이다. 너무 작아 면으로
 * 안 보이는 나라는 `dot` 에 대표점을 남겨 지도가 점으로 그린다.
 *
 * **도법은 Equal Earth 다.** 나라를 방문 수로 칠하는 지도라 면적이 왜곡되면
 * 안 된다 — 메르카토르면 그린란드·러시아가 실제보다 몇 배 커 보여서 같은
 * 색이라도 더 많이 온 것처럼 읽힌다. 남극은 뺀다(방문이 올 곳이 아니고, 폭
 * 전체를 차지하는 흰 띠가 된다).
 *
 * 산출물은 커밋한다. 이 스크립트는 산출물을 다시 만들 때만 돌린다.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

/** 투영한 지도의 폭(SVG 단위). 관리자 화면에서 700px 남짓으로 그려진다. */
const WIDTH = 1000;
/** 이 위도 아래는 자른다 — 남극을 뺀 가장 남쪽 땅(티에라델푸에고)이 −56° 다. */
const SOUTH_LIMIT_DEG = -58;
/** Douglas–Peucker 허용 오차(SVG 단위). 화면에서 0.4px 쯤이다. */
const TOLERANCE = 0.6;
/** 이보다 작은 고리는 버린다(상자의 긴 변, SVG 단위). */
const MIN_RING = 1.2;
/** 나라 전체가 이보다 작으면 면 대신 점으로도 그린다(상자의 긴 변). */
const DOT_BELOW = 4;

type Pt = readonly [number, number];
type Ring = Pt[];

interface Feature {
  properties: {
    ISO_A2_EH: string;
    NAME: string;
    LABEL_X: number;
    LABEL_Y: number;
  };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

// ── Equal Earth (Šavrič·Patterson·Jenny 2018) ─────────────────────────
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/** 경위도(도) → 투영 좌표. 단위 없는 값이고 `x ∈ ±2.7064`, `y ∈ ±1.3173`. */
function equalEarth(lon: number, lat: number): Pt {
  const lambda = (lon * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const x =
    (2 * Math.sqrt(3) * lambda * Math.cos(theta)) /
    (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = theta * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1);
  return [x, y];
}

const X_MAX = equalEarth(180, 0)[0];
const Y_TOP = equalEarth(0, 90)[1];
const Y_BOTTOM = equalEarth(0, SOUTH_LIMIT_DEG)[1];
const SCALE = WIDTH / (2 * X_MAX);
const HEIGHT = Math.round((Y_TOP - Y_BOTTOM) * SCALE);

/** 경위도 → SVG 좌표(왼쪽 위가 원점, 아래로 커진다). */
const project = (lon: number, lat: number): Pt => {
  const [x, y] = equalEarth(lon, lat);
  return [(x + X_MAX) * SCALE, (Y_TOP - y) * SCALE];
};

// ── 단순화 (`fetch-natural-earth.mts` 와 같은 반복형 Douglas–Peucker) ──
const perpendicularDistance = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

const simplify = (points: Ring, tolerance: number): Ring => {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = from + 1; i < to; i += 1) {
      const d = perpendicularDistance(points[i], points[from], points[to]);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (maxDistance > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([from, index], [index, to]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
};

type Box = { minX: number; minY: number; maxX: number; maxY: number };
const EMPTY_BOX: Box = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
};
const grow = (box: Box, [x, y]: Pt): Box => ({
  minX: Math.min(box.minX, x),
  minY: Math.min(box.minY, y),
  maxX: Math.max(box.maxX, x),
  maxY: Math.max(box.maxY, y),
});
const span = (box: Box): number =>
  Math.max(box.maxX - box.minX, box.maxY - box.minY);

const r1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * 고리 하나를 `M x y l dx dy … z` 로. 반올림한 **절대** 좌표끼리의 차이를 적어
 * 상대 좌표가 쌓여도 오차가 번지지 않는다.
 */
function ringPath(ring: Ring): string {
  const pts = ring.map(([x, y]) => [r1(x), r1(y)] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i += 1) {
    const dx = r1(pts[i][0] - pts[i - 1][0]);
    const dy = r1(pts[i][1] - pts[i - 1][1]);
    if (dx === 0 && dy === 0) continue;
    d += `l${dx} ${dy}`;
  }
  return `${d}z`;
}

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`내려받기 실패: ${response.status} ${SOURCE}`);
}
const geo = (await response.json()) as { features: Feature[] };

type Country = { code: string; d: string; dot?: Pt };
const byCode = new Map<string, { paths: string[]; box: Box; label: Pt }>();
let before = 0;
let after = 0;

for (const feature of geo.features) {
  const { ISO_A2_EH: rawCode, LABEL_X, LABEL_Y } = feature.properties;
  if (rawCode === 'AQ') continue;
  // 국가 코드가 없는 땅(북키프로스·소말릴란드·시아첸)은 코드 없이 땅으로만
  // 그린다 — 빼면 지도에 구멍이 난다. 방문 국가 코드와 맞을 일이 없다.
  const code = /^[A-Z]{2}$/.test(rawCode) ? rawCode : '';
  const entry = byCode.get(code) ?? {
    paths: [],
    box: EMPTY_BOX,
    label: project(LABEL_X, LABEL_Y),
  };

  const { geometry } = feature;
  const shapes =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of shapes) {
    for (const [ringIndex, raw] of rings.entries()) {
      before += raw.length;
      // 닫힌 고리는 마지막 점이 첫 점과 같다. 열린 채로 줄이고 `z` 로 닫는다.
      const ring = raw
        .slice(0, -1)
        .map(([lon, lat]) => project(lon, Math.max(lat, SOUTH_LIMIT_DEG)));
      for (const pt of ring) entry.box = grow(entry.box, pt);
      const simplified = simplify(ring, TOLERANCE);
      if (
        simplified.length < 3 ||
        span(simplified.reduce(grow, EMPTY_BOX)) < MIN_RING
      ) {
        // 바깥 고리가 너무 작으면 그 폴리곤(구멍 포함)을 통째로 버린다.
        if (ringIndex === 0) break;
        continue;
      }
      after += simplified.length;
      entry.paths.push(ringPath(simplified));
    }
  }
  byCode.set(code, entry);
}

const countries: Country[] = [...byCode.entries()]
  .map(([code, { paths, box, label }]) => ({
    code,
    d: paths.join(''),
    // 면으로 안 보이는 나라는 대표점에 점을 찍는다. 코드 없는 땅은 찍지 않는다.
    ...(code && span(box) < DOT_BELOW
      ? { dot: [r1(label[0]), r1(label[1])] as const }
      : {}),
  }))
  .filter((country) => country.d || country.dot)
  .sort((a, b) => a.code.localeCompare(b.code));

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(repoRoot, 'src/assets/shared/world-countries.json');

// 나라 하나를 한 줄에 쓴다 — prettier 가 펼치면 파일이 몇 배가 된다.
const body =
  '{\n' +
  `  "source": ${JSON.stringify(SOURCE)},\n` +
  `  "license": "Natural Earth — public domain",\n` +
  `  "projection": "Equal Earth",\n` +
  `  "width": ${WIDTH},\n` +
  `  "height": ${HEIGHT},\n` +
  '  "countries": [\n' +
  countries.map((country) => `    ${JSON.stringify(country)}`).join(',\n') +
  '\n  ]\n}\n';

await writeFile(outFile, body, 'utf8');
console.log(
  `world-countries.json: 나라 ${countries.length}곳(점 ${countries.filter((c) => c.dot).length}), ` +
    `꼭짓점 ${before} → ${after}, ${WIDTH}×${HEIGHT}, ${(body.length / 1024).toFixed(0)}KB`,
);

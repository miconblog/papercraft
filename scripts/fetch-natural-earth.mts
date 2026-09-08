/**
 * Natural Earth 해안선 내려받기 (IDE-015)
 *
 * 세계일주 게임판의 지도는 **실제 지형**이다(2026-09-08 사용자 결정). 원본은
 * Natural Earth의 `ne_50m_land`(퍼블릭 도메인, 저작권 표시 의무 없음)이고,
 * 1.6MB짜리 GeoJSON을 저장소에 그대로 두는 대신 **인쇄에 필요한 만큼만
 * 단순화해** `src/assets/games/world-tour/artwork/land.json`에 쓴다.
 *
 *     npm run fetch:land
 *
 * 단순화 기준은 종이 위 치수다. A4 가로에 세계 전체를 놓으면 경도 1°가
 * 0.8mm쯤이라, 0.1° 아래의 굴곡은 어차피 선 굵기에 묻힌다. 50m 데이터를
 * 쓰는 이유는 110m에는 한반도·일본·타이완·스리랑카의 윤곽이 뭉개지고 제주·
 * 하와이·괌 같은 섬이 아예 없기 때문이다 — 도시 칸이 바다 한가운데 찍히면
 * 지리 공부라는 목적이 무너진다.
 *
 * 산출물은 커밋한다. 이 스크립트는 산출물을 다시 만들 때만 돌린다 — 네트워크가
 * 없어도 `npm run artwork`는 돌아가야 한다.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson';

/** Douglas–Peucker 허용 오차(도). 0.1° ≈ 종이 위 0.08mm. */
const TOLERANCE_DEG = 0.1;
/** 이보다 작은 폴리곤은 버린다(경위도 상자의 긴 변, 도). 0.12° ≈ 0.1mm. */
const MIN_EXTENT_DEG = 0.12;
/** 좌표 소수 자리. 0.001° ≈ 0.001mm — 인쇄에서 뜻이 없다. */
const DECIMALS = 3;

type Pt = readonly [number, number];
type Ring = Pt[];

interface GeoJson {
  features: Array<{
    geometry:
      | { type: 'Polygon'; coordinates: number[][][] }
      | { type: 'MultiPolygon'; coordinates: number[][][][] };
  }>;
}

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

/** 반복형 Douglas–Peucker. 재귀로 하면 긴 해안선에서 스택이 깊어진다. */
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

const round = (value: number): number =>
  Math.round(value * 10 ** DECIMALS) / 10 ** DECIMALS;

const extent = (ring: Ring): number => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
};

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`내려받기 실패: ${response.status} ${SOURCE}`);
}
const geo = (await response.json()) as GeoJson;

const polygons: Ring[][] = [];
let before = 0;
let after = 0;

for (const feature of geo.features) {
  const { geometry } = feature;
  const shapes =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of shapes) {
    const kept: Ring[] = [];
    for (const [ringIndex, raw] of rings.entries()) {
      const ring: Ring = raw.map(([x, y]) => [x, y] as const);
      before += ring.length;
      // 닫힌 고리는 마지막 점이 첫 점과 같다. 단순화는 열린 채로 하고 다시 닫는다.
      const open = ring.slice(0, -1);
      const simplified = simplify(open, TOLERANCE_DEG);
      if (simplified.length < 3) continue;
      if (extent(simplified) < MIN_EXTENT_DEG) {
        // 바깥 고리가 너무 작으면 폴리곤 전체를 버린다.
        if (ringIndex === 0) break;
        continue;
      }
      const rounded = simplified.map(([x, y]) => [round(x), round(y)] as const);
      after += rounded.length;
      kept.push(rounded);
    }
    if (kept.length > 0) polygons.push(kept);
  }
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(repoRoot, 'src/assets/games/world-tour/artwork/land.json');

const payload = {
  source: SOURCE,
  license: 'Natural Earth — public domain',
  toleranceDeg: TOLERANCE_DEG,
  minExtentDeg: MIN_EXTENT_DEG,
  /** 폴리곤 → 고리(첫 번째가 바깥, 나머지는 구멍) → [경도, 위도]. 열린 고리다. */
  polygons,
};

// 한 고리를 한 줄에 쓴다 — prettier가 숫자마다 줄을 바꾸면 파일이 열 배가 된다.
const body =
  '{\n' +
  `  "source": ${JSON.stringify(payload.source)},\n` +
  `  "license": ${JSON.stringify(payload.license)},\n` +
  `  "toleranceDeg": ${TOLERANCE_DEG},\n` +
  `  "minExtentDeg": ${MIN_EXTENT_DEG},\n` +
  '  "polygons": [\n' +
  polygons
    .map(
      (rings) =>
        '    [\n' +
        rings.map((ring) => `      ${JSON.stringify(ring)}`).join(',\n') +
        '\n    ]',
    )
    .join(',\n') +
  '\n  ]\n}\n';

await writeFile(outFile, body, 'utf8');
console.log(
  `land.json: 폴리곤 ${polygons.length}개, 꼭짓점 ${before} → ${after}, ` +
    `${(body.length / 1024).toFixed(0)}KB`,
);

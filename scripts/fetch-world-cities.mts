/**
 * 세계 도시 검색용 데이터 내려받기 (IDE-016)
 *
 * 만들기 화면에서 풀(112개) 밖의 도시를 **검색해서 더할 수 있게** 한다
 * (2026-09-08 사용자 요청). 외부 지오코더 대신 Natural Earth의
 * `ne_10m_populated_places`(퍼블릭 도메인, 7,342곳, 한국어 이름 포함)를 쓴다 —
 * 외부 서비스에 기대지 않고, 같은 질의에 늘 같은 답이 나오며, 테스트에서도
 * 돌아간다. 나라 이름의 한국어는 `ne_110m_admin_0_countries`의 `NAME_KO`다.
 *
 *     npm run fetch:cities
 *
 * 19MB짜리 원본을 저장소에 두지 않고 필요한 것만 뽑아
 * `src/assets/games/world-tour/search/world-cities.json`(약 500KB)에 쓴다.
 * 서버에서만 읽는다(`lib/games/list-search.ts`).
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACES =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson';
const COUNTRIES =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

interface Feature {
  properties: Record<string, unknown>;
  geometry: { coordinates: [number, number] };
}

const fetchJson = async (url: string): Promise<{ features: Feature[] }> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`내려받기 실패: ${response.status} ${url}`);
  return (await response.json()) as { features: Feature[] };
};

const [places, countries] = await Promise.all([
  fetchJson(PLACES),
  fetchJson(COUNTRIES),
]);

const countryKo = new Map<string, string>();
for (const feature of countries.features) {
  const a3 = String(feature.properties.ADM0_A3 ?? feature.properties.ISO_A3);
  const ko = feature.properties.NAME_KO;
  if (a3 && typeof ko === 'string' && ko !== '') countryKo.set(a3, ko);
}

const round = (value: number): number => Math.round(value * 1000) / 1000;
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** [NE id, 한국어 이름, 영어 이름, 나라(한국어), 경도, 위도, 인구]. */
type Row = [number, string, string, string, number, number, number];

const rows: Row[] = [];
for (const feature of places.features) {
  const p = feature.properties;
  const nameKo = text(p.NAME_KO) || text(p.NAME);
  const nameEn = text(p.NAME_EN) || text(p.NAME);
  if (!nameKo && !nameEn) continue;
  const a3 = text(p.ADM0_A3);
  const country = countryKo.get(a3) ?? text(p.ADM0NAME);
  const [lon, lat] = feature.geometry.coordinates;
  rows.push([
    Number(p.NE_ID),
    nameKo,
    nameEn,
    country,
    round(lon),
    round(lat),
    Number(p.POP_MAX ?? 0),
  ]);
}
// 인구 많은 곳이 먼저 — 검색 결과의 기본 차례다.
rows.sort((a, b) => b[6] - a[6]);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(
  repoRoot,
  'src/assets/games/world-tour/search/world-cities.json',
);
const body =
  '{\n' +
  `  "source": ${JSON.stringify(PLACES)},\n` +
  '  "license": "Natural Earth — public domain",\n' +
  '  "columns": ["neId", "nameKo", "nameEn", "country", "lon", "lat", "population"],\n' +
  '  "rows": [\n' +
  rows.map((row) => `    ${JSON.stringify(row)}`).join(',\n') +
  '\n  ]\n}\n';
await writeFile(outFile, body, 'utf8');
console.log(
  `world-cities.json: ${rows.length}곳, ${(body.length / 1024).toFixed(0)}KB`,
);

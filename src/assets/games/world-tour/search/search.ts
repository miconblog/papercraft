/**
 * 도시 검색 (IDE-016)
 *
 * 풀(`../cities.ts`)과 세계 도시 데이터(`./world-cities.json`, Natural Earth
 * 7,342곳)를 함께 찾는다. 결과는 둘 중 하나다:
 *
 * - **옵션** — 풀에 있는 도시. 더하면 목록 슬롯의 옵션 id가 켜진다.
 * - **직접 추가** — 풀 밖의 도시. 이름·경위도를 실은 `ListItem`이 값에 들어간다.
 *
 * 세계 도시 가운데 풀의 도시와 같은 곳(이름이 같거나 0.5° 안)은 옵션으로 접는다
 * — 파리를 검색했는데 파리가 둘 나오면 안 된다. 서버에서만 읽는다 — JSON이
 * 500KB다.
 */
import { CITIES } from '../cities.ts';
import data from './world-cities.json' with { type: 'json' };

type Row = readonly [
  neId: number,
  nameKo: string,
  nameEn: string,
  country: string,
  lon: number,
  lat: number,
  population: number,
];

const ROWS = data.rows as unknown as readonly Row[];

export interface SearchResult {
  /** 옵션이면 옵션 id, 직접 추가면 새 항목 id(`ne-<id>`). */
  readonly id: string;
  readonly label: string;
  /** 나라 이름 — 같은 이름의 도시를 가른다. */
  readonly detail: string;
  /** 풀 밖의 도시. 값에 실릴 항목이다. */
  readonly item?: {
    readonly id: string;
    readonly label: string;
    readonly data: { readonly lon: number; readonly lat: number };
  };
}

const normalize = (value: string): string =>
  value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s·.,'’-]/g, '');

const poolByName = new Map(CITIES.map((c) => [normalize(c.name), c] as const));

/** 풀의 도시와 같은 곳인가 — 이름이 같거나 0.5° 안이다. */
const poolTwin = (row: Row) =>
  poolByName.get(normalize(row[1])) ??
  CITIES.find(
    (c) => Math.abs(c.lon - row[4]) < 0.5 && Math.abs(c.lat - row[5]) < 0.5,
  );

export const customCityId = (neId: number): string => `ne-${neId}`;

/** 질의에 맞는 도시. 두 글자 미만이면 빈 배열이다. 인구 많은 곳이 먼저다. */
export const searchCities = (query: string, limit = 20): SearchResult[] => {
  const q = normalize(query);
  if (q.length < 1) return [];
  const results: SearchResult[] = [];
  const seenPool = new Set<string>();

  // 풀 먼저 — 앞부분 일치가 부분 일치보다 앞이다.
  const poolHits = CITIES.filter((c) => normalize(c.name).includes(q)).sort(
    (a, b) =>
      Number(normalize(b.name).startsWith(q)) -
      Number(normalize(a.name).startsWith(q)),
  );
  for (const city of poolHits) {
    seenPool.add(city.id);
    results.push({ id: city.id, label: city.name, detail: '풀에 있는 도시' });
  }

  for (const row of ROWS) {
    if (results.length >= limit) break;
    const [neId, nameKo, nameEn, country] = row;
    const hit =
      normalize(nameKo).includes(q) ||
      normalize(nameEn).includes(q) ||
      (q.length >= 2 && normalize(country) === q);
    if (!hit) continue;
    const twin = poolTwin(row);
    if (twin) {
      if (!seenPool.has(twin.id)) {
        seenPool.add(twin.id);
        results.push({
          id: twin.id,
          label: twin.name,
          detail: '풀에 있는 도시',
        });
      }
      continue;
    }
    results.push({
      id: customCityId(neId),
      label: nameKo || nameEn,
      detail:
        nameKo && nameEn && nameKo !== nameEn
          ? `${country} · ${nameEn}`
          : country,
      item: {
        id: customCityId(neId),
        label: nameKo || nameEn,
        data: { lon: row[4], lat: row[5] },
      },
    });
  }
  return results.slice(0, limit);
};

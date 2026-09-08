/**
 * 도시 검색 (IDE-016)
 *
 * 풀에 있는 도시는 옵션으로, 풀 밖의 도시는 이름·경위도를 실은 항목으로 온다.
 * 같은 곳이 둘 나오면 안 된다.
 */
import { describe, expect, it } from 'vitest';
import { searchCities } from '../search/search';
import { cityById } from '../cities';

describe('searchCities', () => {
  it('풀에 있는 도시는 옵션 id로 오고 세계 도시의 짝은 접힌다', () => {
    const hits = searchCities('파리');
    const paris = hits.filter((h) => h.label === '파리');
    expect(paris).toHaveLength(1);
    expect(paris[0].id).toBe('paris');
    expect(paris[0].item).toBeUndefined();
  });

  it('풀 밖의 도시는 이름과 경위도를 실은 항목으로 온다', () => {
    const [hit] = searchCities('류블랴나');
    expect(hit).toBeDefined();
    expect(hit.id).toMatch(/^ne-\d+$/);
    expect(hit.item?.label).toBe('류블랴나');
    expect(hit.item?.data.lon).toBeCloseTo(14.5, 0);
    expect(hit.item?.data.lat).toBeCloseTo(46.05, 0);
    expect(hit.detail).toContain('슬로베니아');
  });

  it('영어 이름으로도 찾고, 인구 많은 곳이 먼저다', () => {
    const hits = searchCities('lisbon');
    expect(hits[0].id).toBe('lisbon');
    const springfields = searchCities('Springfield');
    expect(springfields.length).toBeGreaterThan(1);
    for (const hit of springfields) expect(hit.item).toBeDefined();
  });

  it('빈 질의는 빈 결과이고 결과는 스무 개까지다', () => {
    expect(searchCities('  ')).toEqual([]);
    expect(searchCities('a').length).toBeLessThanOrEqual(20);
  });

  it('풀 도시의 좌표 0.5° 안에 있는 세계 도시는 그 풀 도시로 접힌다', () => {
    // 나하(오키나와)는 풀의 '오키나와'와 같은 자리다.
    const hits = searchCities('나하');
    const okinawa = cityById('okinawa');
    expect(hits.some((h) => h.id === okinawa.id)).toBe(true);
    expect(
      hits.filter(
        (h) =>
          h.item &&
          Math.abs(h.item.data.lon - okinawa.lon) < 0.5 &&
          Math.abs(h.item.data.lat - okinawa.lat) < 0.5,
      ),
    ).toHaveLength(0);
  });
});

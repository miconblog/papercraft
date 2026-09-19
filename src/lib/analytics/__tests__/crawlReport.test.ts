/**
 * 크롤러 집계 접기 (IDE-040)
 */
import { describe, expect, it } from 'vitest';
import { foldCrawls, type CrawlRow } from '../crawlReport';

const row = (
  crawler: string,
  path: string,
  hits: number,
  day = '2026-09-19',
  last_seen = `${day}T01:00:00Z`,
): CrawlRow => ({ day, crawler, path, hits, last_seen });

describe('foldCrawls', () => {
  it('크롤러마다 요청 · 읽은 페이지 · 마지막을 접는다 — 많이 온 순서', () => {
    const report = foldCrawls([
      row('googlebot', '/', 5),
      row(
        'googlebot',
        '/games/soccer',
        3,
        '2026-09-18',
        '2026-09-18T09:00:00Z',
      ),
      row('gptbot', '/', 2),
      row('googlebot', '/', 1, '2026-09-18', '2026-09-18T02:00:00Z'),
    ]);
    expect(report.crawlers.map((c) => [c.id, c.hits, c.pages])).toEqual([
      ['googlebot', 9, 2],
      ['gptbot', 2, 1],
    ]);
    expect(report.crawlers[0].lastSeen).toBe('2026-09-19T01:00:00Z');
    expect(report.crawlers[0].kind).toBe('search');
  });

  it('AI 가 읽은 페이지는 색인과 사용자 요청만 센다 — 학습 · 일반 검색은 뺀다', () => {
    const report = foldCrawls([
      row('oai-searchbot', '/games/soccer', 2),
      row('chatgpt-user', '/games/soccer', 1),
      row('claude-searchbot', '/blog/a', 1),
      row('gptbot', '/games/yut', 50),
      row('googlebot', '/games/yut', 50),
    ]);
    expect(report.aiPaths).toEqual([
      { path: '/games/soccer', hits: 3 },
      { path: '/blog/a', hits: 1 },
    ]);
  });

  it('목록에 없는 이름은 버린다', () => {
    expect(foldCrawls([row('old-bot', '/', 9)]).crawlers).toEqual([]);
  });
});

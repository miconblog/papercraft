/**
 * 크롤러 집계 접기 (IDE-040)
 *
 * `crawler_daily` 의 줄(날짜 · 크롤러 · 경로 · 횟수)을 화면이 쓰는 두 표로 접는다.
 * 순수 함수라 시험이 같은 것을 본다(`funnel.ts` 와 같은 모양).
 */
import { crawlerById, type CrawlerKind } from './crawlers';

export type CrawlRow = {
  day: string;
  crawler: string;
  path: string;
  hits: number;
  last_seen: string;
};

export type CrawlerTotal = {
  id: string;
  vendor: string;
  kind: CrawlerKind;
  hits: number;
  /** 서로 다른 경로 수 — 얼마나 넓게 읽었나. */
  pages: number;
  /** 마지막으로 온 때(ISO). */
  lastSeen: string;
};

export type PathTotal = { path: string; hits: number };

export type CrawlReport = {
  crawlers: CrawlerTotal[];
  /** AI(색인 · 사용자 대신)가 가장 많이 읽은 경로. 인용될 후보다. */
  aiPaths: PathTotal[];
};

/** 목록에서 빠진 이름(옛 이름 등)은 버린다 — 종류를 모르면 어느 칸에도 못 넣는다. */
export function foldCrawls(
  rows: readonly CrawlRow[],
  topPaths = 10,
): CrawlReport {
  const byCrawler = new Map<
    string,
    { hits: number; paths: Set<string>; lastSeen: string }
  >();
  const aiPaths = new Map<string, number>();

  for (const row of rows) {
    const crawler = crawlerById(row.crawler);
    if (!crawler) continue;
    const hits = Number(row.hits) || 0;
    const entry = byCrawler.get(crawler.id) ?? {
      hits: 0,
      paths: new Set<string>(),
      lastSeen: '',
    };
    entry.hits += hits;
    entry.paths.add(row.path);
    if (row.last_seen > entry.lastSeen) entry.lastSeen = row.last_seen;
    byCrawler.set(crawler.id, entry);

    if (crawler.kind === 'ai-search' || crawler.kind === 'ai-user') {
      aiPaths.set(row.path, (aiPaths.get(row.path) ?? 0) + hits);
    }
  }

  const crawlers = [...byCrawler.entries()]
    .map(([id, entry]) => {
      const crawler = crawlerById(id)!;
      return {
        id,
        vendor: crawler.vendor,
        kind: crawler.kind,
        hits: entry.hits,
        pages: entry.paths.size,
        lastSeen: entry.lastSeen,
      };
    })
    .sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id));

  return {
    crawlers,
    aiPaths: [...aiPaths.entries()]
      .map(([path, hits]) => ({ path, hits }))
      .sort((a, b) => b.hits - a.hits || a.path.localeCompare(b.path))
      .slice(0, topPaths),
  };
}

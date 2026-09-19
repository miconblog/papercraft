/**
 * 크롤러 한 번 세기 (IDE-040)
 *
 * 문지기(`proxy.ts`)가 응답을 보낸 뒤 부른다(`waitUntil`). **절대 던지지
 * 않는다** — 세기 실패가 크롤러에게 나가는 응답을 흔들면 주객이 뒤바뀐다.
 *
 * supabase-js 를 쓰지 않는다. 문지기 번들에 클라이언트 라이브러리를 끌고 들어갈
 * 이유가 없다(`lib/supabase/rest.ts` 와 같은 이유) — PostgREST 의 RPC 주소를
 * 한 번 두드린다.
 */
import { ANALYTICS_SCHEMA, supabaseConnection } from './config';
import { crawlPath, type Crawler } from './crawlers';
import { kstDay } from '@/lib/kst';

export async function recordCrawl(
  crawler: Crawler,
  pathname: string,
  now: Date = new Date(),
): Promise<void> {
  const config = supabaseConnection();
  if (!config) return;
  try {
    const response = await fetch(
      `${config.url.replace(/\/+$/, '')}/rest/v1/rpc/record_crawl`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Content-Profile': ANALYTICS_SCHEMA,
        },
        body: JSON.stringify({
          // 방문 통계와 같은 KST 날짜 경계(`analyticsDay` 가 쓰는 것과 같다).
          p_day: kstDay(now),
          p_crawler: crawler.id,
          p_path: crawlPath(pathname),
        }),
      },
    );
    if (!response.ok) {
      console.warn('[crawler] 세지 못했다:', response.status);
    }
  } catch (cause) {
    console.warn('[crawler] 세지 못했다:', cause);
  }
}

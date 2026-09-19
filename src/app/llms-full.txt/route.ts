/**
 * `/llms-full.txt` — AI 에게 주는 사이트 안내서 (IDE-041)
 *
 * 내용과 이유는 `lib/llms.ts` 에 적었다. 여기는 **공개된 것만** 모아 넘긴다 —
 * 사이트맵(`app/sitemap.ts`)과 같은 필터다.
 */
import { publishedPosts } from '@/lib/blog/posts';
import { openGames } from '@/lib/games/open';
import { renderLlmsFull } from '@/lib/llms';
import { siteUrl } from '@/lib/site';

// 사이트맵 · RSS 와 같은 주기 — 글을 내면 1분 안에 여기도 바뀐다.
export const revalidate = 60;

export async function GET(): Promise<Response> {
  const [games, posts] = await Promise.all([openGames(), publishedPosts()]);
  return new Response(renderLlmsFull({ origin: siteUrl(), games, posts }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

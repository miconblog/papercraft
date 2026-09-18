import { renderFeed } from '@/lib/blog/feed';
import { publishedPosts } from '@/lib/blog/posts';
import { siteUrl } from '@/lib/site';

/**
 * 공방 일지 RSS (SEO)
 *
 * 네이버는 사이트맵과 함께 **RSS 를 따로 받는다**(서치어드바이저 › 요청 ›
 * RSS 제출). 새 글을 여기서 먼저 알아채므로 글이 검색에 빨리 실린다. 구독기로
 * 읽는 사람에게도 그대로 쓰인다.
 *
 * 주소가 `/blog/feed.xml` 이 아니라 `/feed.xml` 인 것은 문지기(`proxy.ts`)
 * 때문이다 — `/blog/` 아래의 조각은 전부 글 슬러그로 보고, 낸 글이 아니면
 * 404 를 낸다.
 *
 * 담는 것은 `publishedPosts` 뿐이다 — 사이트맵과 같은 목록이라, 안 낸 글이
 * 여기로 새지 않는다.
 */

/**
 * 60초마다 다시 만든다 — `RENDER_REVALIDATE_S` 와 같은 값이다(리터럴이어야
 * 해서 상수를 못 쓴다. 홈이 같은 이유로 숫자를 적어 두고 있다).
 */
export const revalidate = 60;

export async function GET(): Promise<Response> {
  const posts = await publishedPosts();
  return new Response(renderFeed(posts, siteUrl()), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}

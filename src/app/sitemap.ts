import type { MetadataRoute } from 'next';
import { publishedPosts } from '@/lib/blog/posts';
import { openGames } from '@/lib/games/open';
import { siteUrl } from '@/lib/site';

/**
 * 사이트맵 (IDE-023)
 *
 * 공방 일지는 **검색으로 들어오라고 쓰는 것**이라 이게 빠지면 쓴 보람이 없다.
 * 그래서 이 이슈에서 처음 만든다 — 그전에는 게임 다섯이 전부라 사람이 링크로
 * 데려오면 됐다.
 *
 * 담는 것은 **지금 열려 있는 것만**이다. 오픈 전 게임(IDE-022)과 안 낸
 * 글(IDE-023)은 문지기가 404 를 내는데, 그 주소를 여기 적으면 검색엔진에
 * "여기 무언가 있다"고 알려 주면서 동시에 404 를 내주는 꼴이 된다.
 *
 * 인쇄 화면은 넣지 않는다. 도구지 읽을거리가 아니다. `/games/<id>` 는
 * 2026-09-12부터 만들기 화면이지만 게임의 대표 주소라 그대로 싣고, 소개와
 * 규칙이 있는 `/games/<id>/rules` 를 함께 싣는다.
 *
 * 두 목록 모두 재검증이 걸린 `fetch` 를 타므로 이 파일도 60초마다 다시
 * 만들어진다 — 게임이 열리거나 글이 나가면 사람 손 없이 실린다.
 */
/**
 * 60초마다 다시 그린다 — `RENDER_REVALIDATE_S` 와 같은 값이다(리터럴이어야
 * 해서 상수를 못 쓴다. 홈이 같은 이유로 숫자를 적어 두고 있다).
 */
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [games, posts] = await Promise.all([openGames(), publishedPosts()]);

  const newest = posts[0]?.publishAt ?? undefined;

  return [
    {
      url: `${base}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/blog`,
      lastModified: newest === undefined ? undefined : new Date(newest),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...games.flatMap((game) => [
      {
        url: `${base}/games/${game.id}`,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      },
      // 게임 방법은 읽을거리다 — 만들기 화면이 `/games/<id>` 가 되면서
      // 떨어져 나온 소개·규칙 페이지다(2026-09-12).
      {
        url: `${base}/games/${game.id}/rules`,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      },
    ]),
    ...posts.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt || (post.publishAt ?? Date.now())),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}

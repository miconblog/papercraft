import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * robots.txt (IDE-023)
 *
 * `sitemap` 을 만든 김에 그것을 어디서 찾는지 알려 준다 — 적어 두지 않으면
 * 크롤러가 주소를 짐작해야 한다.
 *
 * `/admin` 은 막는다. 어차피 비밀번호가 지키고 페이지마다 `robots: noindex` 를
 * 달아 두었지만, 크롤러가 들어와 봐야 로그인 화면뿐이라 부를 이유가 없다.
 *
 * `/api/` 는 **통째로 막지 않는다.** 만들기 화면의 미리보기가
 * `/api/games/<id>/artwork` 로 그림을 받아 오는데, 구글은 페이지를 그릴 때도
 * 이 파일을 따른다 — 막으면 검색엔진이 보는 화면에서 게임판이 빈다.
 * 막는 것은 둘이다(SEO).
 *
 * - `/api/print/` — 인쇄 화면의 "여백 재기 시트" 링크가 여기를 가리킨다.
 *   인쇄 화면은 `noindex, follow` 라 크롤러가 링크를 따라와 **올 때마다 PDF 를
 *   새로 만들고**, `?margin=` 값마다 다른 주소라 끝이 없다.
 * - `/api/analytics/` — 방문 기록을 받는 곳이다. 페이지를 그리는 데 필요 없고,
 *   크롤러가 스크립트를 돌리며 보낸 기록은 통계만 흐린다.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/print/', '/api/analytics/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

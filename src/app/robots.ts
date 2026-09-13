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
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin' },
    sitemap: `${base}/sitemap.xml`,
  };
}

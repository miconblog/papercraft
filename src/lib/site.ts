/**
 * 사이트 주소 한 곳 (IDE-023)
 *
 * 루트 레이아웃의 `metadataBase` 와 `sitemap`·`robots` 가 같은 값을 봐야 한다
 * — 어긋나면 검색엔진에 **서로 다른 두 사이트**로 알려지고, 그 상태는 눈으로
 * 보이지 않는다.
 *
 * 고르는 순서:
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — 사람이 정한 주소.
 * 2. 운영 빌드면 `PRODUCTION_SITE_URL`. 미리보기 배포도 운영 빌드라서, 미리보기
 *    에서 만든 공유 링크·대표 주소가 미리보기 주소로 새지 않는다.
 * 3. 로컬 개발 서버.
 *
 * **2 가 없던 동안(~2026-09-19) 라이브가 전부 `localhost` 였다.** 1 을 운영에
 * 넣지 않아서 사이트맵·robots·대표 주소·공유 카드 이미지가 로컬을 가리켰고,
 * 방문자의 공유 버튼이 `http://localhost:3000/…` 을 나눴다. 사람이 넣어야만
 * 맞는 값은 언젠가 빠진다 — 코드가 아는 값으로 떨어지게 한다.
 *
 * Vercel 이 넣어 주는 `VERCEL_PROJECT_PRODUCTION_URL` 은 쓰지 않는다. 그 값은
 * **가장 짧은** 도메인을 고르므로 `daddyscraft.com` 이 되는데, 그 주소는
 * `www` 로 308 을 돌려준다 — 대표 주소가 리다이렉트를 가리키면 검색엔진이
 * 어느 쪽을 믿을지 헷갈린다.
 *
 * 끝의 `/` 는 뗀다. 붙은 채로 경로를 이으면 `//blog` 가 된다.
 */
type Env = Record<string, string | undefined>;

/** 운영 도메인. `daddyscraft.com` 은 여기로 넘어온다(308). */
export const PRODUCTION_SITE_URL = 'https://www.daddyscraft.com';

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * 1·2 중 있는 것. 로컬 개발 서버면 `null` — 부르는 쪽이 로컬에서 무엇으로
 * 떨어질지 정한다. 관리자 공유 화면은 지금 보고 있는 호스트로 떨어진다.
 */
export function deployedSiteUrl(env: Env = process.env): string | null {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return trimSlash(configured);
  return env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : null;
}

export const siteUrl = (env: Env = process.env): string =>
  deployedSiteUrl(env) ?? 'http://localhost:3000';

/**
 * 사이트 이름·소개·지은이 (SEO)
 *
 * 헤더에 걸리는 이름과 같은 문구다 — 탭 제목·공유 카드·검색 결과·구조화
 * 데이터·RSS 가 사이트에서 보이는 이름과 어긋나지 않게 한 곳에서 정한다.
 */
export const SITE_TITLE = '아빠 뭐해?, 아빠 공방';
export const SITE_DESCRIPTION =
  '추억의 종이 보드게임을 아이와 함께 만든다. 팀 색과 배치를 원하는 대로 바꿔 집 프린터로 정확한 크기에 맞춰 뽑는다.';
export const SITE_AUTHOR = "Daddy's Craft";
export const SITE_AUTHOR_URL = 'https://buymeacoffee.com/miconblog';

/**
 * 페이지마다 `openGraph` 에 펼쳐 넣는 공통 칸.
 *
 * Next 는 메타데이터를 **얕게** 합친다 — 페이지가 `openGraph` 를 적는 순간
 * 레이아웃의 `siteName`·`locale` 이 통째로 사라진다. 그러면 카카오톡·페이스북
 * 카드에서 사이트 이름이 빠지고, 한국어 페이지라는 표시도 없어진다.
 */
export const OPEN_GRAPH_BASE = {
  siteName: SITE_TITLE,
  locale: 'ko_KR',
} as const;

/**
 * 공방 일지 이름과 소개. 목록 화면의 탭 제목·공유 카드와 RSS 채널이 같은
 * 문구를 쓴다.
 */
export const BLOG_TITLE = '공방 일지';
export const BLOG_DESCRIPTION =
  '옛 인쇄본을 다시 그리며 겪은 것들 — 종이로 뽑고 접고 아이와 놀아 본 기록.';

/**
 * 공방 일지 RSS (`app/feed.xml`) 를 알리는 `<link rel="alternate">`.
 *
 * 레이아웃에 두지 않는 것은 `alternates` 도 얕게 합쳐지기 때문이다 — 대표
 * 주소를 적는 페이지마다 이 칸이 지워진다. 피드를 찾으러 오는 자리인 홈과
 * 공방 일지 목록이 `canonical` 옆에 함께 적는다.
 */
export const RSS_ALTERNATE = {
  'application/rss+xml': [
    { url: '/feed.xml', title: `${SITE_TITLE} · ${BLOG_TITLE}` },
  ],
};

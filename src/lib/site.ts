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

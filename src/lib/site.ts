/**
 * 사이트 주소 한 곳 (IDE-023)
 *
 * 루트 레이아웃의 `metadataBase` 와 `sitemap`·`robots` 가 같은 값을 봐야 한다
 * — 어긋나면 검색엔진에 **서로 다른 두 사이트**로 알려지고, 그 상태는 눈으로
 * 보이지 않는다.
 *
 * 배포 도메인은 아직 정해지지 않았다(IDE-008, blocked). 정해지면
 * `NEXT_PUBLIC_SITE_URL` 로 넘긴다 — 그 전까지는 로컬 기준이다.
 *
 * 끝의 `/` 는 뗀다. 붙은 채로 경로를 이으면 `//blog` 가 된다.
 */
export const siteUrl = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );

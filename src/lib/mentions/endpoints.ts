/**
 * 멘션을 받는 주소 (IDE-046)
 *
 * 받는 주소를 알리는 곳이 셋이다 — 응답 헤더(`next.config.ts`) · 화면의
 * `<link>`(`components/mentions/MentionEndpoints.tsx`) · 라우트 폴더 이름. 셋이
 * 어긋나면 **알리는 주소와 받는 주소가 달라지고**, 그 상태는 아무 오류도 내지
 * 않는다. 보내는 쪽이 404 를 받고 조용히 그만둘 뿐이다. 그래서 여기 한 곳에서
 * 정한다.
 *
 * 순수한 값만 둔다. `next.config.ts` 가 이 파일을 읽으므로 `@/` 별칭도
 * `server-only` 도 쓰지 않는다.
 */

/** 웹멘션 — `source` · `target` 을 폼으로 받는다. */
export const WEBMENTION_PATH = '/api/webmention';

/** 핑백 — XML-RPC `pingback.ping` 을 받는다. */
export const PINGBACK_PATH = '/api/pingback';

/**
 * 멘션을 받는 화면. `next.config.ts` 의 헤더 규칙과 `target.ts` 의 대상 읽기가
 * 같은 모양을 본다 — 글 하나와 게임 하나, 조각이 정확히 둘인 주소다.
 */
export const MENTIONABLE_SOURCES = ['/blog/:slug', '/games/:id'] as const;

/** `Link` 헤더 값. 웹멘션은 상대 주소도 되지만 헤더만 보는 쪽을 위해 다 적는다. */
export const webmentionLinkHeader = (site: string): string =>
  `<${site}${WEBMENTION_PATH}>; rel="webmention"`;

/** 핑백 주소. 규약이 **절대 주소**를 요구한다. */
export const pingbackUrl = (site: string): string => `${site}${PINGBACK_PATH}`;

/**
 * 밖으로 나가는 요청이 밝히는 이름.
 *
 * 웹멘션 규약이 이름에 `Webmention` 을 넣으라고 권한다 — 받는 쪽 로그에서 이
 * 요청이 무엇인지 보이고, 막고 싶은 사람이 막을 수 있다.
 */
export const MENTION_USER_AGENT =
  'Mozilla/5.0 (compatible; DaddysCraft-Webmention/1.0; +https://www.daddyscraft.com)';

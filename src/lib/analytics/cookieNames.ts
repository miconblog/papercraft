/**
 * 쿠키 이름만 (IDE-027)
 *
 * `session.ts` 는 `node:crypto` 를 쓴다 — 브라우저가 import 하면 번들에
 * 딸려 오고, 그 파일에는 서명 로직까지 들어 있다. 헤더의 `AdminLink` 가
 * 필요한 것은 **이름 문자열 하나**뿐이라 여기에 따로 둔다.
 *
 * `session.ts` 가 이 파일을 다시 내보내므로, 서버 쪽 코드는 지금까지처럼
 * `session.ts` 하나만 보면 된다.
 */

/** 주인의 브라우저 표시. 값은 없고 **있느냐 없느냐**만 본다. */
export const OWNER_COOKIE = 'dc_owner';

/**
 * IDE-026 이 잠깐 쓴 이름.
 *
 * 로그아웃이 이것도 함께 지운다 — 안 지우면 그때 심긴 브라우저가 **영영
 * 통계에서 빠진 채로** 남는다. 지우는 것은 공짜이고, 잊었을 때의 대가는 조용하다.
 */
export const LEGACY_NOCOUNT_COOKIE = 'dc_nocount';

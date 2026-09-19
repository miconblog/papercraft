/**
 * Google Analytics 4 — 자체 통계와 나란히 (IDE-038)
 *
 * `IDE-013` 은 "GA 같은 외부 도구는 붙이지 않는다"로 시작했다. 2026-09-19 사용자가
 * **병행**으로 방향을 바꿨다 — 자체 통계(유입 · 퍼널 · 지도)는 그대로 두고, 검색
 * 유입 · 서치 콘솔 연동처럼 GA 에만 있는 것을 얻는다.
 *
 * 지키는 것이 셋이다.
 *
 * 1. **관리자는 세지 않는다** — 자체 통계와 같은 잣대(`dc_owner` 쿠키 ·
 *    `/admin` 경로). GA 의 공식 끄기 스위치(`window['ga-disable-<ID>']`)를 쓴다.
 * 2. **광고 신호를 끈다** — 구글 신호 · 광고 개인화. 이것까지 켜면 방문자를 다른
 *    구글 서비스의 기록과 잇게 되고, 처리방침의 고지만으로는 모자라진다.
 * 3. **운영 배포에서만 싣는다** — 로컬 · CI · 미리보기 배포의 방문이 섞이면
 *    GA 의 숫자를 믿을 수 없게 된다.
 *
 * 순수 함수만 둔다 — 화면과 테스트가 같은 것을 본다.
 */
import { EXCLUDED_PREFIXES, isExcludedPath } from './excluded';
import { OWNER_COOKIE } from './cookieNames';

type Env = Record<string, string | undefined>;

/** 이 사이트의 GA4 측정 ID(2026-09-19 사용자). 페이지 소스에 그대로 실리는 공개 값이다. */
export const GA_MEASUREMENT_ID = 'G-7VJZZEC422';

const VALID_ID = /^G-[A-Z0-9]{4,}$/;

/**
 * 실을 측정 ID. 없으면 `null` — 스크립트를 아예 싣지 않는다.
 *
 * - `NEXT_PUBLIC_GA_ID` 가 있으면 그것(`off` 면 끈다). 다른 속성으로 옮기거나
 *   미리보기에서 시험할 때 배포 없이 바꾼다
 * - 없으면 **운영 배포(`VERCEL_ENV=production`)에서만** 기본값
 *
 * 모양이 틀린 값은 버린다 — 이 값은 인라인 스크립트에 그대로 들어간다.
 */
export function gaMeasurementId(env: Env = process.env): string | null {
  const configured = env.NEXT_PUBLIC_GA_ID?.trim();
  if (configured) {
    if (configured.toLowerCase() === 'off') return null;
    return VALID_ID.test(configured) ? configured : null;
  }
  return env.VERCEL_ENV === 'production' ? GA_MEASUREMENT_ID : null;
}

/** GA 가 매 요청 전에 보는 끄기 스위치의 이름. */
export const disableKey = (id: string): string => `ga-disable-${id}`;

/** `document.cookie` 문자열에 그 이름의 쿠키가 있나. `AdminLink` 와 같은 잣대다. */
export const hasCookie = (cookie: string, name: string): boolean =>
  cookie.split(';').some((part) => part.trim().split('=')[0] === name);

/** 이 화면을 GA 에 보내지 않을까 — 관리자 브라우저이거나 관리자 경로. */
export const gaSuppressed = (path: string, cookie: string): boolean =>
  hasCookie(cookie, OWNER_COOKIE) || isExcludedPath(path);

/** GA 설정. 광고 신호 둘을 끈다. */
export const GA_CONFIG = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

/**
 * gtag 를 부르기 전에 도는 초기화.
 *
 * **끄기 스위치를 `config` 보다 먼저 세운다** — 늦게 세우면 첫 페이지뷰가 이미
 * 나간 뒤다. 판정은 `gaSuppressed` 와 같은 규칙을 문자열로 옮긴 것이고, 시험이
 * 둘이 같은 답을 내는지 본다.
 */
export function gaInitScript(id: string): string {
  if (!VALID_ID.test(id)) throw new Error(`GA 측정 ID 모양이 아니다: ${id}`);
  const prefixes = JSON.stringify(EXCLUDED_PREFIXES);
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    `var p=location.pathname,x=${prefixes}.some(function(a){return p===a||p.indexOf(a+'/')===0;});`,
    `var o=document.cookie.split(';').some(function(c){return c.trim().split('=')[0]===${JSON.stringify(OWNER_COOKIE)};});`,
    `window[${JSON.stringify(disableKey(id))}]=x||o;`,
    "gtag('js',new Date());",
    `gtag('config',${JSON.stringify(id)},${JSON.stringify(GA_CONFIG)});`,
  ].join('');
}

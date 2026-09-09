/**
 * 관리자 세션 (IDE-013)
 *
 * 관리자가 한 명뿐이라 사용자 표도 세션 저장소도 두지 않는다. 비밀번호가
 * 맞으면 **만료 시각에 서명한 쿠키** 하나를 심고, 그 뒤로는 서명만 확인한다.
 * 서버는 아무것도 기억하지 않는다.
 *
 * 서명 키는 비밀번호에서 유도한다 — 비밀번호를 바꾸면 이미 나간 쿠키가 전부
 * 무효가 된다. 로그아웃을 따로 만들 필요가 없다는 뜻이기도 하다.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  LEGACY_NOCOUNT_COOKIE,
  OWNER_COOKIE,
} from '@/lib/analytics/cookieNames';

// 이름은 `cookieNames.ts` 가 주인이다 — 브라우저(`AdminLink`)도 그 파일을
// 읽는다. 서버 쪽은 지금까지처럼 이 파일 하나만 보면 되도록 다시 내보낸다.
export { LEGACY_NOCOUNT_COOKIE, OWNER_COOKIE };

export const ADMIN_COOKIE = 'dc_admin';

/**
 * 90일.
 *
 * 12시간이었다. 브라우저를 껐다 켤 때마다 다시 로그인하는 것이 귀찮다는
 * 사용자 지적으로 늘렸다(2026-09-09). 여는 것이 집계 숫자뿐이고, 비밀번호를
 * 바꾸면 이미 나간 쿠키가 전부 무효가 되므로 길게 두어도 잃을 것이 적다.
 */
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

const sign = (password: string, payload: string): string =>
  createHmac('sha256', `dc-admin|${password}`).update(payload).digest('hex');

/**
 * 길이가 달라도 안전하게 비교한다.
 *
 * `timingSafeEqual` 은 길이가 다르면 던진다 — 그 예외 자체가 "길이가 틀렸다"를
 * 알려 주는 신호가 되므로, 먼저 양쪽을 고정 길이로 눌러 놓고 비교한다.
 */
export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) =>
    createHmac('sha256', 'compare').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** 쿠키에 담을 값 — `만료시각.서명`. */
export function issueSession(password: string, now: Date = new Date()): string {
  const expiresAt = String(now.getTime() + TTL_MS);
  return `${expiresAt}.${sign(password, expiresAt)}`;
}

export function isValidSession(
  token: string | undefined | null,
  password: string,
  now: Date = new Date(),
): boolean {
  if (!token) return false;
  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < now.getTime())
    return false;
  return safeEqual(signature, sign(password, expiresAt));
}

/** 두 쿠키가 함께 쓰는 몫. 한쪽만 고쳐 놓는 일이 없게 한 곳에 둔다. */
const base = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export const sessionCookie = (value: string) => ({
  ...base,
  name: ADMIN_COOKIE,
  value,
  // `/admin` 밖으로 내보내지 않는다. 인증 쿠키가 사이트의 모든 요청에 딸려
  // 다닐 이유가 없다.
  path: '/admin',
  maxAge: TTL_MS / 1000,
});

/**
 * 주인 표시 쿠키 (IDE-026 · IDE-027)
 *
 * 관리자가 자기 사이트를 둘러보는 것은 방문이 아니다. `/admin` 경로는
 * `excluded.ts` 가 이미 빼지만, 홈과 게임 페이지를 열어 보는 것은 못 뺀다.
 *
 * **인증 쿠키를 넓히지 않고 따로 심는다.** 넓히면 인증 쿠키가 모든 요청에
 * 실리고, 세션이 끝나면 제외도 함께 끝난다.
 *
 * 하는 일이 둘이다.
 *
 * 1. 이 브라우저의 방문은 세지 않는다(`record.ts`).
 * 2. 헤더에 관리자 메뉴를 보인다(`AdminLink`).
 *
 * **`httpOnly` 가 아니다.** 2번 때문이다 — 헤더에서 이것을 서버가 읽으면
 * 루트 레이아웃이 쿠키를 만지게 되고, 그 순간 **사이트 전체가 정적 렌더링에서
 * 빠진다.** `PageViews` 가 `useSearchParams` 를 피한 것과 같은 이유다.
 *
 * 비밀이 아니라서 열어 두어도 잃을 것이 없다. 이 쿠키를 손으로 만들어 넣어도
 * 할 수 있는 일은 **자기를 통계에서 빼고 링크 하나를 보는 것**뿐이고, 그 링크
 * 끝에는 비밀번호를 묻는 화면이 있다. 문지기는 `proxy.ts` 와 페이지가 한다.
 *
 * 1년을 간다. 로그아웃 말고는 지우지 않기로 했다(2026-09-09 사용자 결정).
 */
const OWNER_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const ownerCookie = () => ({
  ...base,
  // 위 주석의 이유로 브라우저가 읽을 수 있어야 한다.
  httpOnly: false,
  name: OWNER_COOKIE,
  value: '1',
  // 사이트 어디를 열어도 실려야 한다 — 수집 API 는 `/api` 아래에 있다.
  path: '/',
  maxAge: OWNER_TTL_MS / 1000,
});

/**
 * 지우는 쿠키.
 *
 * `delete(name)` 은 경로를 모른다. `/admin` 에 심은 것을 `/` 로 지우려 들면
 * **지워지지 않고 그대로 남는다.** 심을 때 쓴 경로를 그대로 준다.
 */
export const expiredCookie = (name: string, path: string) => ({
  ...base,
  name,
  value: '',
  path,
  maxAge: 0,
});

/**
 * 주인의 브라우저인가 — 세지 않아야 하는가.
 *
 * `includes('dc_owner=')` 로 보면 `xdc_owner=` 같은 남의 쿠키에 걸린다.
 * 이름을 통째로 견준다.
 */
export function isOwnerBrowser(headers: Headers): boolean {
  const raw = headers.get('cookie');
  if (!raw) return false;

  return raw
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .some((name) => name === OWNER_COOKIE || name === LEGACY_NOCOUNT_COOKIE);
}

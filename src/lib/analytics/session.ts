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
 * "나는 세지 마라" 쿠키 (IDE-026)
 *
 * 관리자가 자기 사이트를 둘러보는 것은 방문이 아니다. `/admin` 경로는
 * `excluded.ts` 가 이미 빼지만, 홈과 게임 페이지를 열어 보는 것은 못 뺀다.
 *
 * **인증 쿠키를 넓히지 않고 따로 심는다.** 넓히면 인증 쿠키가 모든 요청에
 * 실리고, 세션이 끝나면 제외도 함께 끝난다. 이쪽은 비밀이 아니라서 값이
 * 새어도 잃을 것이 없다 — 할 수 있는 일이 **자기를 통계에서 빼는 것**뿐이고,
 * 남의 수치를 부풀리지는 못한다.
 *
 * 그래서 서명하지 않는다. 있으면 세지 않는다, 그것뿐이다.
 */
export const NOCOUNT_COOKIE = 'dc_nocount';

/** 1년. 로그아웃 말고는 지우지 않기로 했다(2026-09-09 사용자 결정). */
const NOCOUNT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const noCountCookie = () => ({
  ...base,
  name: NOCOUNT_COOKIE,
  value: '1',
  // 사이트 어디를 열어도 실려야 한다 — 수집 API 는 `/api` 아래에 있다.
  path: '/',
  maxAge: NOCOUNT_TTL_MS / 1000,
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
 * 이 요청을 세지 않아야 하는가.
 *
 * `includes('dc_nocount=')` 로 보면 `xdc_nocount=` 같은 남의 쿠키에 걸린다.
 * 이름을 통째로 견준다.
 */
export function hasNoCountCookie(headers: Headers): boolean {
  const raw = headers.get('cookie');
  if (!raw) return false;

  return raw
    .split(';')
    .some((part) => part.trim().split('=')[0] === NOCOUNT_COOKIE);
}

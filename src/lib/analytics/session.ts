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

/** 12시간. 통계를 보는 일은 오래 앉아 있을 일이 아니다. */
const TTL_MS = 12 * 60 * 60 * 1000;

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

export const sessionCookie = (value: string) => ({
  name: ADMIN_COOKIE,
  value,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/admin',
  maxAge: TTL_MS / 1000,
});

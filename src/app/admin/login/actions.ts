'use server';

/**
 * 관리자 로그인 (IDE-013)
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { adminPassword } from '@/lib/analytics/config';
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_PATH,
  LEGACY_NOCOUNT_COOKIE,
  LEGACY_ADMIN_COOKIE_PATH,
  OWNER_COOKIE,
  expiredCookie,
  issueSession,
  ownerCookie,
  safeEqual,
  sessionCookie,
} from '@/lib/analytics/session';

export type LoginState = { error: string | null };

/** 돌아갈 곳은 `/admin` 아래로만 허용한다 — 열린 리다이렉트를 만들지 않는다. */
const safeNext = (value: FormDataEntryValue | null): string => {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/admin/') && !next.startsWith('/admin//')
    ? next
    : '/admin/analytics';
};

export async function login(
  _state: LoginState,
  form: FormData,
): Promise<LoginState> {
  const password = adminPassword();
  if (!password) notFound();

  const typed =
    typeof form.get('password') === 'string'
      ? String(form.get('password'))
      : '';

  // `===` 는 몇 글자까지 맞았는지가 응답 시간에 새어 나온다.
  if (!safeEqual(typed, password)) {
    return { error: '비밀번호가 맞지 않습니다.' };
  }

  const jar = await cookies();
  // 예전에 `/admin` 에 심긴 것을 먼저 지운다 (IDE-022 가 경로를 `/` 로 넓혔다).
  // 남겨 두면 `/admin` 요청에 같은 이름의 쿠키가 둘 실리고, 어느 쪽이 읽힐지는
  // 브라우저 마음이다 — 옛것이 먼저 읽히면 로그인한 채로 로그인 화면을 본다.
  jar.set(expiredCookie(ADMIN_COOKIE, LEGACY_ADMIN_COOKIE_PATH));
  jar.set(sessionCookie(issueSession(password)));
  // 로그인한 브라우저는 사이트 어디를 열어도 세지 않고, 헤더에 관리자 메뉴가
  // 보인다 (IDE-026 · IDE-027).
  jar.set(ownerCookie());
  redirect(safeNext(form.get('next')));
}

/**
 * 로그아웃 (IDE-026)
 *
 * 여기가 **제외를 끄는 유일한 자리**다(2026-09-09 사용자 결정). 둘을 함께
 * 지운다 — 하나만 지우면 로그인은 풀렸는데 통계에서는 계속 빠지거나, 그 반대가
 * 된다.
 *
 * 심을 때 쓴 경로를 그대로 줘야 지워진다. 둘 다 `/` 이고, 인증 쿠키는 옛
 * 경로(`/admin`)짜리도 함께 지운다 (IDE-022).
 */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.set(expiredCookie(ADMIN_COOKIE, ADMIN_COOKIE_PATH));
  // 경로를 넓히기 전에 로그인한 브라우저에는 아직 `/admin` 짜리가 남아 있다.
  jar.set(expiredCookie(ADMIN_COOKIE, LEGACY_ADMIN_COOKIE_PATH));
  jar.set(expiredCookie(OWNER_COOKIE, '/'));
  // 옛 이름도 함께 지운다 — 안 지우면 그때 심긴 브라우저가 영영 빠진 채 남는다.
  jar.set(expiredCookie(LEGACY_NOCOUNT_COOKIE, '/'));
  redirect('/');
}

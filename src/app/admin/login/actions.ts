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
  NOCOUNT_COOKIE,
  expiredCookie,
  issueSession,
  noCountCookie,
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
  jar.set(sessionCookie(issueSession(password)));
  // 로그인한 브라우저는 사이트 어디를 열어도 세지 않는다 (IDE-026).
  jar.set(noCountCookie());
  redirect(safeNext(form.get('next')));
}

/**
 * 로그아웃 (IDE-026)
 *
 * 여기가 **제외를 끄는 유일한 자리**다(2026-09-09 사용자 결정). 둘을 함께
 * 지운다 — 하나만 지우면 로그인은 풀렸는데 통계에서는 계속 빠지거나, 그 반대가
 * 된다.
 *
 * 심을 때 쓴 경로를 그대로 줘야 지워진다. 인증 쿠키는 `/admin`, 제외 쿠키는
 * `/` 다.
 */
export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.set(expiredCookie(ADMIN_COOKIE, '/admin'));
  jar.set(expiredCookie(NOCOUNT_COOKIE, '/'));
  redirect('/');
}

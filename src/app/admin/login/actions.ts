'use server';

/**
 * 관리자 로그인 (IDE-013)
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { adminPassword } from '@/lib/analytics/config';
import {
  issueSession,
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

  (await cookies()).set(sessionCookie(issueSession(password)));
  redirect(safeNext(form.get('next')));
}

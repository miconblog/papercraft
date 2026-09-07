/**
 * 로그인 서버 액션 (IDE-013)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});

vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }));
vi.mock('next/navigation', () => ({ redirect, notFound }));

const { login } = await import('../actions');
const { isValidSession } = await import('@/lib/analytics/session');

const PASSWORD = 'admin-password-for-tests';

const form = (password: string, next?: string) => {
  const data = new FormData();
  data.set('password', password);
  if (next !== undefined) data.set('next', next);
  return data;
};

beforeEach(() => {
  set.mockReset();
  redirect.mockClear();
  vi.unstubAllEnvs();
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
});

describe('login', () => {
  it('맞으면 서명 쿠키를 심고 통계로 보낸다', async () => {
    await expect(login({ error: null }, form(PASSWORD))).rejects.toThrow(
      'REDIRECT:/admin/analytics',
    );

    const cookie = set.mock.calls[0][0];
    expect(cookie).toMatchObject({
      name: 'dc_admin',
      httpOnly: true,
      sameSite: 'lax',
    });
    expect(isValidSession(cookie.value, PASSWORD)).toBe(true);
  });

  it('틀리면 쿠키를 심지 않는다', async () => {
    await expect(login({ error: null }, form('틀린값'))).resolves.toEqual({
      error: '비밀번호가 맞지 않습니다.',
    });
    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('돌아갈 곳은 /admin 아래로만 — 열린 리다이렉트를 만들지 않는다', async () => {
    for (const evil of [
      'https://evil.example',
      '//evil.example',
      '/',
      '/admin//evil',
    ]) {
      await expect(
        login({ error: null }, form(PASSWORD, evil)),
        evil,
      ).rejects.toThrow('REDIRECT:/admin/analytics');
    }
    await expect(
      login({ error: null }, form(PASSWORD, '/admin/analytics?days=7')),
    ).rejects.toThrow('REDIRECT:/admin/analytics?days=7');
  });

  it('비밀번호가 설정돼 있지 않으면 404 다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    await expect(login({ error: null }, form('아무거나'))).rejects.toThrow(
      'NOT_FOUND',
    );
  });
});

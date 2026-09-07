/**
 * `/admin` 문지기 (IDE-013)
 *
 * Next 16 에서 미들웨어는 `proxy` 다. 여기서 막는 것만 믿지는 않지만
 * (`/admin/analytics` 페이지도 스스로 확인한다), 첫 관문이 제 일을 하는지는
 * 확인해 둔다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueSession } from '@/lib/analytics/session';
import { proxy } from '../proxy';

const PASSWORD = 'admin-password-for-tests';

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(`https://daddyscraft.example${path}`), {
    headers: cookie ? { cookie } : undefined,
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('proxy', () => {
  it('쿠키가 없으면 로그인으로 보낸다', () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);

    const res = proxy(request('/admin/analytics'));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get('location')!);
    expect(to.pathname).toBe('/admin/login');
    expect(to.searchParams.get('next')).toBe('/admin/analytics');
  });

  it('제대로 서명된 쿠키는 통과시킨다', () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);

    const res = proxy(
      request('/admin/analytics', `dc_admin=${issueSession(PASSWORD)}`),
    );
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('위조하거나 만료된 쿠키는 되돌려보낸다', () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);

    const expired = issueSession(PASSWORD, new Date(Date.now() - 86_400_000));
    for (const cookie of [
      'dc_admin=99999999999.deadbeef',
      `dc_admin=${expired}`,
    ]) {
      expect(proxy(request('/admin/analytics', cookie)).status, cookie).toBe(
        307,
      );
    }
  });

  it('로그인 화면 자체는 막지 않는다 — 막으면 들어갈 방법이 없다', () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    expect(proxy(request('/admin/login')).status).toBe(200);
  });

  it('비밀번호가 없으면 리다이렉트하지 않는다 — 페이지가 404 를 낸다', () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    // 401 이나 로그인 리다이렉트를 내면 "여기 관리자 화면이 있다"를 알려 준다.
    const res = proxy(request('/admin/analytics'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

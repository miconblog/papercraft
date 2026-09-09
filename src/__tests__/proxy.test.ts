/**
 * 문지기 (IDE-013 · IDE-022)
 *
 * Next 16 에서 미들웨어는 `proxy` 다. 여기서 막는 것만 믿지는 않지만
 * (`/admin/analytics` 페이지도, 내보내기 API 도 스스로 확인한다), 첫 관문이 제
 * 일을 하는지는 확인해 둔다.
 *
 * 오픈 전 게임(IDE-022)은 **화면도 도안 SVG 도** 여기서 막힌다 — 페이지가
 * 스스로 판정하려면 쿠키를 읽어야 하고, 그러면 게임 화면 전체가 정적 렌더링에서
 * 빠진다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueSession } from '@/lib/analytics/session';
import { forgetReleases } from '@/lib/games/release';
import { proxy } from '../proxy';

const PASSWORD = 'admin-password-for-tests';

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(`https://daddyscraft.example${path}`), {
    headers: cookie ? { cookie } : undefined,
  });

beforeEach(() => {
  forgetReleases();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  forgetReleases();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('proxy', () => {
  it('쿠키가 없으면 로그인으로 보낸다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);

    const res = await proxy(request('/admin/analytics'));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get('location')!);
    expect(to.pathname).toBe('/admin/login');
    expect(to.searchParams.get('next')).toBe('/admin/analytics');
  });

  it('제대로 서명된 쿠키는 통과시킨다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);

    const res = await proxy(
      request('/admin/analytics', `dc_admin=${issueSession(PASSWORD)}`),
    );
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('위조하거나 만료된 쿠키는 되돌려보낸다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);

    // TTL 은 90일이다(IDE-026). 하루 전 것은 아직 살아 있다.
    const ago = 91 * 24 * 60 * 60 * 1000;
    const expired = issueSession(PASSWORD, new Date(Date.now() - ago));
    for (const cookie of [
      'dc_admin=99999999999.deadbeef',
      `dc_admin=${expired}`,
    ]) {
      expect(
        (await proxy(request('/admin/analytics', cookie))).status,
        cookie,
      ).toBe(307);
    }
  });

  it('로그인 화면 자체는 막지 않는다 — 막으면 들어갈 방법이 없다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    expect((await proxy(request('/admin/login'))).status).toBe(200);
  });

  it('비밀번호가 없으면 리다이렉트하지 않는다 — 페이지가 404 를 낸다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    // 401 이나 로그인 리다이렉트를 내면 "여기 관리자 화면이 있다"를 알려 준다.
    const res = await proxy(request('/admin/analytics'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('proxy · 오픈 전 게임 (IDE-022)', () => {
  /** `/games/soccer` 만 미래에 열리는 상태로 만든다. */
  const scheduleSoccer = () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubEnv('ANALYTICS_HASH_SALT', 'salt');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { game_id: 'soccer', publish_at: '2099-01-01T00:00:00+09:00' },
            ]),
            { status: 200 },
          ),
      ),
    );
  };

  /** 되돌려보낸 곳. 통과했으면 `null`. */
  const rewrittenTo = (res: { headers: Headers }): string | null => {
    const to = res.headers.get('x-middleware-rewrite');
    return to ? new URL(to).pathname : null;
  };

  it('화면 셋이 전부 없는 게임이 된다', async () => {
    scheduleSoccer();
    for (const path of [
      '/games/soccer',
      '/games/soccer/edit',
      '/games/soccer/print',
    ]) {
      expect(rewrittenTo(await proxy(request(path))), path).toBe(
        '/games/__closed',
      );
    }
  });

  it('도안 SVG 도 함께 막힌다 — 화면만 막으면 그림이 그대로 샌다', async () => {
    scheduleSoccer();
    const res = await proxy(request('/games/soccer/field.svg'));
    expect(rewrittenTo(res)).toBe('/games/__closed');
  });

  it('오픈일을 지정하지 않은 게임은 그대로 열려 있다', async () => {
    scheduleSoccer();
    expect(rewrittenTo(await proxy(request('/games/baseball')))).toBeNull();
  });

  it('관리자 세션이면 오픈 전에도 통과한다', async () => {
    scheduleSoccer();
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const res = await proxy(
      request('/games/soccer', `dc_admin=${issueSession(PASSWORD)}`),
    );
    expect(rewrittenTo(res)).toBeNull();
  });

  it('위조한 쿠키로는 못 들어온다', async () => {
    scheduleSoccer();
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const res = await proxy(
      request('/games/soccer', 'dc_admin=99999999999.deadbeef'),
    );
    expect(rewrittenTo(res)).toBe('/games/__closed');
  });

  it('내려 둔 게임은 오픈 시각이 지났어도 막힌다 — 스위치가 날짜를 이긴다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                game_id: 'soccer',
                publish_at: '2020-01-01T00:00:00+09:00',
                hidden: true,
              },
            ]),
            { status: 200 },
          ),
      ),
    );
    expect(rewrittenTo(await proxy(request('/games/soccer')))).toBe(
      '/games/__closed',
    );
  });

  it('저장소에 닿지 못하면 전부 열어 준다 — 사고가 게임을 지우지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('네트워크가 끊겼다');
      }),
    );
    expect(rewrittenTo(await proxy(request('/games/soccer')))).toBeNull();
  });
});

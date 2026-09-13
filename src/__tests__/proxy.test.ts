/**
 * 문지기 (IDE-013 · IDE-022 · IDE-023)
 *
 * Next 16 에서 미들웨어는 `proxy` 다. 여기서 막는 것만 믿지는 않지만
 * (`/admin/analytics` 페이지도, 내보내기 API 도 스스로 확인한다), 첫 관문이 제
 * 일을 하는지는 확인해 둔다.
 *
 * 오픈 전 게임(IDE-022)은 **화면도 도안 SVG 도** 여기서 막힌다 — 페이지가
 * 스스로 판정하려면 쿠키를 읽어야 하고, 그러면 게임 화면 전체가 정적 렌더링에서
 * 빠진다. 아직 안 낸 글(IDE-023)도 같은 이유로 여기서 막힌다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueSession } from '@/lib/analytics/session';
import { forgetPosts } from '@/lib/blog/posts';
import { forgetReleases } from '@/lib/games/release';
import { proxy } from '../proxy';

const PASSWORD = 'admin-password-for-tests';

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(`https://daddyscraft.example${path}`), {
    headers: cookie ? { cookie } : undefined,
  });

beforeEach(() => {
  forgetReleases();
  forgetPosts();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  forgetReleases();
  forgetPosts();
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

  it('옛 경로에 갇힌 세션을 `/` 로 넓혀 준다 (IDE-023)', async () => {
    // `IDE-022` 전에 로그인한 브라우저는 쿠키가 `/admin` 에 갇혀 있어, 관리자
    // 화면은 열리는데 `/games`·`/blog` 미리보기만 404 가 났다. 관리자 화면을
    // 한 번 열면 낫는다.
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const token = issueSession(PASSWORD);

    const res = await proxy(request('/admin/analytics', `dc_admin=${token}`));
    const widened = res.cookies.get('dc_admin');
    expect(widened?.value).toBe(token);
    expect(widened?.path).toBe('/');

    // **세션을 지우지 않는다.** `NextResponse.cookies` 는 이름만 보고 덮어써서,
    // 옛 경로 지우기를 나란히 두면 그것만 나가고 로그인이 통째로 날아간다.
    expect(res.headers.getSetCookie()).toHaveLength(1);
    expect(res.headers.getSetCookie()[0]).not.toContain('Max-Age=0');
  });

  it('로그인 화면에서는 쿠키를 건드리지 않는다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const res = await proxy(
      request('/admin/login', `dc_admin=${issueSession(PASSWORD)}`),
    );
    expect(res.cookies.getAll('dc_admin')).toHaveLength(0);
  });

  it('위조한 쿠키는 옮겨 주지 않는다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const res = await proxy(
      request('/admin/analytics', 'dc_admin=99999999999.deadbeef'),
    );
    expect(res.status).toBe(307);
    expect(res.cookies.getAll('dc_admin')).toHaveLength(0);
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

describe('proxy · 아직 안 낸 글 (IDE-023)', () => {
  /** 되돌려보낸 곳. 통과했으면 `null`. */
  const rewrittenTo = (res: { headers: Headers }): string | null => {
    const to = res.headers.get('x-middleware-rewrite');
    return to ? new URL(to).pathname : null;
  };

  /** 낸 글 하나(`shipped`)와 안 낸 글 하나(`draft`)가 있는 상태. */
  const twoPosts = () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            // 문지기의 질의는 `?select=slug,publish_at,hidden` 이라 **`id` 가
            // 오지 않는다.** 대역이 진짜보다 후하면(여기에 `id` 를 넣어 두면)
            // 줄을 버리는 버그를 못 잡는다 — 실제로 그렇게 놓쳤다(2026-09-09).
            JSON.stringify([
              { slug: 'shipped', publish_at: '2020-01-01T00:00:00+09:00' },
              { slug: 'draft', publish_at: null },
              { slug: 'later', publish_at: '2099-01-01T00:00:00+09:00' },
              {
                slug: 'pulled',
                publish_at: '2020-01-01T00:00:00+09:00',
                hidden: true,
              },
            ]),
            { status: 200 },
          ),
      ),
    );
  };

  it('낸 글은 그대로 열린다', async () => {
    twoPosts();
    expect(rewrittenTo(await proxy(request('/blog/shipped')))).toBeNull();
  });

  it('초안·게시 예정·내려 둔 글은 없는 글이 된다', async () => {
    twoPosts();
    for (const slug of ['draft', 'later', 'pulled']) {
      expect(rewrittenTo(await proxy(request(`/blog/${slug}`))), slug).toBe(
        '/blog/__closed',
      );
    }
  });

  it('목록은 막지 않는다 — 안 낸 글은 목록 화면이 스스로 뺀다', async () => {
    twoPosts();
    expect(rewrittenTo(await proxy(request('/blog')))).toBeNull();
  });

  it('한글이 섞인 주소도 같은 잣대로 본다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { slug: '윷가락', publish_at: '2020-01-01T00:00:00+09:00' },
            ]),
            { status: 200 },
          ),
      ),
    );
    // 브라우저는 퍼센트 인코딩해서 보낸다. 디코드하지 않으면 낸 글이 404 가 된다.
    expect(
      rewrittenTo(
        await proxy(request(`/blog/${encodeURIComponent('윷가락')}`)),
      ),
    ).toBeNull();
  });

  it('관리자 세션이어도 안 낸 글은 여기서 안 열린다 — 미리보기는 `/admin` 아래다', async () => {
    // 게임(IDE-022)은 오픈 전 실물을 공개 주소에서 봐야 해서 우회가 있다. 글은
    // 미리보기를 `/admin/posts/<id>/preview` 로 옮겨서(2026-09-09 사용자 제안)
    // **이 주소가 누구에게나 같다** — 그래서 글 화면이 스스로도 검사할 수 있다.
    twoPosts();
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const res = await proxy(
      request('/blog/draft', `dc_admin=${issueSession(PASSWORD)}`),
    );
    expect(rewrittenTo(res)).toBe('/blog/__closed');
  });

  it('저장소에 닿지 못하면 글이 하나도 없다 — 게임과 반대 방향이다', async () => {
    // 게임은 사고가 나면 전부 열어 준다(도안은 코드에 있다). 글은 DB 가 유일한
    // 원본이라, 반대로 두면 사고 한 번에 안 낸 글이 세상에 나간다.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('네트워크가 끊겼다');
      }),
    );
    expect(rewrittenTo(await proxy(request('/blog/shipped')))).toBe(
      '/blog/__closed',
    );
  });
});

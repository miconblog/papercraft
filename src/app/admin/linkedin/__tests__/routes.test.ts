/**
 * 링크드인 연결 — 시작과 콜백 (IDE-037)
 *
 * 지키는 것: **관리자만** · **`state` 가 심어 둔 쿠키와 같아야** 토큰을 받는다
 * (CSRF) · **돌아갈 곳은 관리자 화면 안** · 한 번 쓴 `state` 는 버린다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as connect } from '../connect/route';
import { GET as callback } from '../callback/route';
import { issueSession } from '@/lib/analytics/session';

const PASSWORD = 'admin-password-for-tests';
const ORIGIN = 'https://www.daddyscraft.com';

const request = (path: string, cookies: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; '),
    },
  });

const admin = () => ({ dc_admin: issueSession(PASSWORD) });

/** 돌아간 곳과 그 알림. */
const landed = (response: Response) => {
  const url = new URL(response.headers.get('location') ?? '');
  return {
    path: url.pathname,
    saved: url.searchParams.get('saved'),
    error: url.searchParams.get('error'),
  };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('LINKEDIN_CLIENT_ID', 'cid');
  vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('연결 시작', () => {
  it('관리자가 아니면 404 다', () => {
    expect(connect(request('/admin/linkedin/connect')).status).toBe(404);
  });

  it('동의 화면으로 보내고, state 와 돌아갈 곳을 쿠키에 심는다', () => {
    const response = connect(
      request('/admin/linkedin/connect?back=/admin/posts/abc', admin()),
    );
    const to = new URL(response.headers.get('location') ?? '');
    expect(to.origin).toBe('https://www.linkedin.com');
    expect(to.searchParams.get('redirect_uri')).toBe(
      `${ORIGIN}/admin/linkedin/callback`,
    );

    const cookie = response.cookies.get('dc_li_state');
    const saved = JSON.parse(cookie?.value ?? '{}');
    expect(saved.state).toBe(to.searchParams.get('state'));
    expect(saved.back).toBe('/admin/posts/abc');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/admin/linkedin');
  });

  it('밖으로 튕기는 back 은 목록으로 돌린다', () => {
    const response = connect(
      request('/admin/linkedin/connect?back=//evil.example/', admin()),
    );
    const saved = JSON.parse(
      response.cookies.get('dc_li_state')?.value ?? '{}',
    );
    expect(saved.back).toBe('/admin/posts');
  });

  it('앱 키가 없으면 무엇을 넣어야 하는지 알리고 돌아간다', () => {
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', '');
    const response = connect(
      request('/admin/linkedin/connect?back=/admin/posts/abc', admin()),
    );
    const back = landed(response);
    expect(back.path).toBe('/admin/posts/abc');
    expect(back.error).toContain('LINKEDIN_CLIENT_ID');
  });
});

describe('콜백', () => {
  const stateCookie = (state: string, back = '/admin/posts/abc') => ({
    ...admin(),
    dc_li_state: JSON.stringify({ state, back }),
  });

  /** 가짜 링크드인과 저장소. 담긴 계정 줄을 돌려준다. */
  const network = () => {
    const saved: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init: RequestInit = {}) => {
        const url = String(input);
        if (url === 'https://www.linkedin.com/oauth/v2/accessToken') {
          const body = new URLSearchParams(String(init.body));
          expect(body.get('redirect_uri')).toBe(
            `${ORIGIN}/admin/linkedin/callback`,
          );
          expect(body.get('client_secret')).toBe('secret');
          return Response.json({ access_token: 'tok', expires_in: 5_184_000 });
        }
        if (url === 'https://api.linkedin.com/v2/userinfo') {
          return Response.json({ sub: 'me', name: '손병대' });
        }
        if (url.includes('/rest/v1/social_accounts')) {
          saved.push(JSON.parse(String(init.body)));
          return new Response(null, { status: 201 });
        }
        return new Response('', { status: 500 });
      }),
    );
    return saved;
  };

  it('관리자가 아니면 404 다', async () => {
    const response = await callback(
      request('/admin/linkedin/callback?code=c&state=s'),
    );
    expect(response.status).toBe(404);
  });

  it('state 가 쿠키와 같으면 토큰과 계정을 담고 돌아간다', async () => {
    const saved = network();
    const response = await callback(
      request('/admin/linkedin/callback?code=c&state=s1', stateCookie('s1')),
    );

    expect(landed(response)).toMatchObject({
      path: '/admin/posts/abc',
      saved: '링크드인 연결됨 — 손병대',
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      provider: 'linkedin',
      access_token: 'tok',
      member_urn: 'urn:li:person:me',
      member_name: '손병대',
    });
    // 한 번 쓴 state 는 버린다.
    expect(response.cookies.get('dc_li_state')?.value).toBe('');
  });

  it('state 가 다르면 토큰을 받지 않는다 — 남이 만든 링크로 내 계정이 묶이면 안 된다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const response = await callback(
      request('/admin/linkedin/callback?code=c&state=other', stateCookie('s1')),
    );
    expect(landed(response).error).toContain('다시 눌러');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('쿠키가 없으면(만료) 목록으로 돌아가 알린다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const response = await callback(
      request('/admin/linkedin/callback?code=c&state=s1', admin()),
    );
    expect(landed(response).path).toBe('/admin/posts');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('동의 화면에서 취소하면 그렇게 알린다', async () => {
    const response = await callback(
      request(
        '/admin/linkedin/callback?error=user_cancelled_login&state=s1',
        stateCookie('s1'),
      ),
    );
    expect(landed(response).error).toBe('링크드인 연결을 취소했습니다.');
  });
});

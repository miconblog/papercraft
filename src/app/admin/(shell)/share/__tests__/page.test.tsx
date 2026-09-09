/**
 * `/admin/share` (IDE-013 · 화면 분리는 IDE-022)
 *
 * 통계 화면 아래에 붙어 있던 것을 자기 화면으로 뺐다. 문지기 뒤에 있다는 것과,
 * **공유할 주소를 잘못 고르지 않는다**는 것을 여기서 지킨다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name)
        ? { name, value: cookieStore.get(name) }
        : undefined,
  }),
  // 설정값이 없을 때만 떨어지는 곳이다.
  headers: async () => new Headers({ host: 'daddyscraft.example' }),
}));

const { default: SharePage } = await import('../page');
const { issueSession } = await import('@/lib/analytics/session');
const { forgetReleases } = await import('@/lib/games/release');

const PASSWORD = 'admin-password-for-tests';

const loggedIn = () => {
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  cookieStore.set('dc_admin', issueSession(PASSWORD));
};

beforeEach(() => {
  cookieStore.clear();
  forgetReleases();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.unstubAllEnvs();
  // 오픈일 저장소에 닿지 않는 상태 — 그러면 전부 공개로 읽힌다.
  vi.stubEnv('SUPABASE_URL', '');
});

afterEach(() => {
  forgetReleases();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SharePage', () => {
  it('비밀번호가 설정돼 있지 않으면 404 다 — 경로의 존재 자체를 숨긴다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    await expect(SharePage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('쿠키 없이 열리지 않는다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    await expect(SharePage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('다른 비밀번호로 만든 쿠키도 열지 못한다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    cookieStore.set('dc_admin', issueSession('예전-비밀번호'));
    await expect(SharePage()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('NEXT_PUBLIC_SITE_URL 을 쓴다 — 미리보기 주소를 뿌리면 안 된다', async () => {
    loggedIn();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://daddyscraft.kr/');

    const tree = JSON.stringify(await SharePage());
    // 지금 보고 있는 호스트(daddyscraft.example)가 아니라 설정값이어야 한다.
    expect(tree).toContain('https://daddyscraft.kr');
    expect(tree).not.toContain('daddyscraft.example');
  });

  it('아직 안 열린 게임은 그렇다고 적는다 — 죽은 링크를 세상에 뿌리지 않게', async () => {
    loggedIn();
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { game_id: 'soccer', publish_at: null, hidden: true },
            ]),
            { status: 200 },
          ),
      ),
    );

    const tree = JSON.stringify(await SharePage());
    expect(tree).toContain('축구 게임판 (아직 안 열림)');
    // 내려 둔 게임도 목록에는 남는다 — 공개에 맞춰 링크를 미리 만들어 둔다.
    expect(tree).toContain('/games/soccer');
    // 열려 있는 게임에는 아무것도 안 붙는다.
    expect(tree).toContain('"야구 게임판"');
  });
});

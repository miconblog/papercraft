/**
 * `/admin/analytics` 자체 방어 (IDE-013)
 *
 * proxy 가 이미 막지만 여기서 한 번 더 본다 — matcher 를 잘못 건드리거나
 * 경로를 옮기면 그 검사가 **조용히** 사라진다. 그때 통계가 그대로 열리면
 * 아무도 눈치채지 못한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name)
        ? { name, value: cookieStore.get(name) }
        : undefined,
  }),
  // 공유 링크의 앞부분을 만들 때 읽는다.
  headers: async () => new Headers({ host: 'daddyscraft.example' }),
}));

const { default: AnalyticsPage } = await import('../page');
const { issueSession } = await import('@/lib/analytics/session');

const PASSWORD = 'admin-password-for-tests';

beforeEach(() => {
  cookieStore.clear();
  vi.unstubAllEnvs();
  // 수집이 꺼진 상태로 둔다 — 여기서 보는 것은 문지기지 숫자가 아니다.
  vi.stubEnv('SUPABASE_URL', '');
});

/** `notFound()` 는 Next 가 알아보는 특별한 예외를 던진다. */
const rendering = () => AnalyticsPage();

describe('AnalyticsPage', () => {
  it('비밀번호가 설정돼 있지 않으면 404 다 — 경로의 존재 자체를 숨긴다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    await expect(rendering()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('쿠키 없이 열리지 않는다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    await expect(rendering()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('다른 비밀번호로 만든 쿠키도 열지 못한다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    cookieStore.set('dc_admin', issueSession('예전-비밀번호'));
    await expect(rendering()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('제대로 된 쿠키면 화면을 그린다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    cookieStore.set('dc_admin', issueSession(PASSWORD));
    await expect(rendering()).resolves.toBeTruthy();
  });

  it('공유 링크는 NEXT_PUBLIC_SITE_URL 을 쓴다 — 미리보기 주소를 뿌리면 안 된다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://daddyscraft.kr/');
    cookieStore.set('dc_admin', issueSession(PASSWORD));

    const tree = JSON.stringify(await rendering());
    // 지금 보고 있는 호스트(daddyscraft.example)가 아니라 설정값이어야 한다.
    expect(tree).toContain('https://daddyscraft.kr');
    expect(tree).not.toContain('daddyscraft.example');
  });
});

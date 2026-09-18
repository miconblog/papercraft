/**
 * `/admin/funnel` 이 퍼널 분석을 그린다 (IDE-035)
 *
 * 방문 통계에서 떨어져 나온 화면이다. 조회 결과를 꽂아 넣고 실제로 그려서,
 * 기간이 조회로 넘어가는지와 사이트 줄·게임 줄이 섞이지 않는지를 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ name: 'dc_admin', value: 'ok' }) }),
}));
vi.mock('@/lib/analytics/session', async (original) => ({
  ...(await original()),
  isValidSession: () => true,
}));

const loadFunnel = vi.fn();
vi.mock('@/lib/analytics/report', () => ({
  loadFunnel: (range: unknown) => loadFunnel(range),
}));
vi.mock('@/lib/analytics/visitor', async (original) => ({
  ...(await original()),
  analyticsDay: () => '2026-09-19',
}));

const { default: FunnelPage } = await import('../page');

const funnelRow = (
  game_id: string,
  device: string,
  counts: Record<string, number>,
) => ({
  game_id,
  device,
  channel: 'direct',
  sessions: 0,
  game_views: 0,
  edits: 0,
  print_opens: 0,
  export_fails: 0,
  downloads: 0,
  ...counts,
});

const ROWS = [
  funnelRow('', 'mobile', { sessions: 20, game_views: 10, print_opens: 2 }),
  funnelRow('', 'desktop', {
    sessions: 5,
    game_views: 4,
    edits: 2,
    print_opens: 2,
    downloads: 1,
  }),
  funnelRow('soccer', 'mobile', {
    sessions: 10,
    game_views: 10,
    print_opens: 2,
  }),
  funnelRow('soccer', 'desktop', {
    sessions: 4,
    game_views: 4,
    edits: 2,
    print_opens: 2,
    downloads: 1,
    export_fails: 1,
  }),
];

const draw = async (searchParams: Record<string, string>) =>
  render(
    await FunnelPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(searchParams),
    }),
  );

const bodyRows = (name: string) =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent);

beforeEach(() => {
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', 'pw');
  loadFunnel.mockReset().mockResolvedValue(ROWS);
});

describe('FunnelPage', () => {
  it('기본은 최근 30일이고, 그 기간으로 조회한다', async () => {
    await draw({});
    expect(loadFunnel).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-08-21', to: '2026-09-19' }),
    );
  });

  it('기기별로 가른다', async () => {
    await draw({});
    expect(bodyRows('기기별')).toEqual([
      '모바일201050%00%210%00%0',
      '데스크톱5480%240%240%120%0',
    ]);
  });

  it('게임별은 게임 줄만 더한다 — 사이트 줄과 섞지 않는다', async () => {
    await draw({});
    const [soccer] = bodyRows('게임별');
    expect(soccer).toMatch(/^축구.*14.*1$/);
  });

  it('표를 못 읽으면 안내를 띄운다', async () => {
    loadFunnel.mockResolvedValue(null);
    await draw({});
    expect(screen.getByText(/012-download-funnel.sql/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

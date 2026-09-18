/**
 * `/admin/analytics` 가 기간과 나라를 그린다
 *
 * 저장소 대신 조회 결과를 꽂아 넣고 화면을 실제로 그린다. 기간 필터가 고른
 * 기간이 조회로 넘어가는지, 나라 지도와 표가 같은 숫자를 보이는지 본다.
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

const loadReport = vi.fn();
vi.mock('@/lib/analytics/report', () => ({
  loadReport: (range: unknown) => loadReport(range),
}));
vi.mock('@/lib/analytics/visitor', async (original) => ({
  ...(await original()),
  analyticsDay: () => '2026-09-19',
}));

const { default: AnalyticsPage } = await import('../page');

const REPORT = {
  available: true,
  days: [
    {
      day: '2026-09-18',
      pageviews: 10,
      visitors: 4,
      sessions: 5,
      downloads: 1,
    },
  ],
  channels: [],
  sources: [],
  games: [],
  countries: [
    { country: 'KR', sessions: 40, pageviews: 90, downloads: 3 },
    { country: 'US', sessions: 5, pageviews: 6, downloads: 0 },
    { country: '', sessions: 5, pageviews: 5, downloads: 0 },
  ],
  funnel: [],
};

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

const draw = async (searchParams: Record<string, string>) =>
  render(
    await AnalyticsPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(searchParams),
    }),
  );

beforeEach(() => {
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', 'pw');
  loadReport.mockReset().mockResolvedValue(REPORT);
});

describe('AnalyticsPage — 기간과 나라', () => {
  it('기본은 최근 30일이고, 그 기간으로 조회한다', async () => {
    await draw({});
    expect(loadReport).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-08-21', to: '2026-09-19' }),
    );
    expect(screen.getByRole('link', { name: '30일' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('heading', { name: '일자별 순 페이지뷰' }),
    ).toBeInTheDocument();
  });

  it('1년을 고르면 추이가 주별로 묶인다', async () => {
    await draw({ range: '1y' });
    expect(loadReport).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2025-09-20' }),
    );
    expect(
      screen.getByRole('heading', { name: '주별 순 페이지뷰' }),
    ).toBeInTheDocument();
  });

  it('직접 고른 날짜로 조회한다', async () => {
    await draw({ from: '2026-09-01', to: '2026-09-10' });
    expect(loadReport).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-09-01', to: '2026-09-10' }),
    );
    expect(screen.getByText(/2026-09-01 ~ 2026-09-10 · 10일/)).toBeTruthy();
  });

  it('지도와 표가 같은 숫자를 보인다 — 알 수 없음은 지도에 없다', async () => {
    await draw({});
    const map = screen.getByRole('img', { name: /나라별 방문 지도/ });
    expect(map.getAttribute('aria-label')).toContain('대한민국 40');
    expect(
      within(map).getByLabelText('미국 방문 5', { selector: 'path' }),
    ).toBeInTheDocument();

    const table = screen.getByRole('table', { name: /나라별/ });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '대한민국4080.0%903',
      '미국510.0%60',
      '알 수 없음510.0%50',
    ]);
  });

  it('나라 표를 못 읽으면 지도 대신 안내를 띄운다', async () => {
    loadReport.mockResolvedValue({ ...REPORT, countries: null });
    await draw({});
    expect(screen.queryByRole('img', { name: /나라별/ })).toBeNull();
    expect(screen.getByText(/011-daily-country.sql/)).toBeInTheDocument();
  });

  it('퍼널을 기기별·게임별로 가른다 (IDE-035)', async () => {
    loadReport.mockResolvedValue({
      ...REPORT,
      funnel: [
        funnelRow('', 'mobile', {
          sessions: 20,
          game_views: 10,
          print_opens: 2,
        }),
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
      ],
    });
    await draw({});

    const byDevice = screen.getByRole('table', { name: '기기별' });
    expect(
      within(byDevice)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['모바일201050%00%210%00%0', '데스크톱5480%240%240%120%0']);

    const byGame = screen.getByRole('table', { name: '게임별' });
    const [soccer] = within(byGame).getAllByRole('row').slice(1);
    // 게임 줄은 사이트 줄과 섞지 않는다 — 게임 화면 14, 막힘 1.
    expect(soccer.textContent).toMatch(/^축구.*14.*1$/);
  });

  it('퍼널 표를 못 읽으면 안내를 띄운다', async () => {
    loadReport.mockResolvedValue({ ...REPORT, funnel: null });
    await draw({});
    expect(screen.getByText(/012-download-funnel.sql/)).toBeInTheDocument();
  });
});

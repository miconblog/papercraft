/**
 * 대시보드 조회 (`loadReport`)
 *
 * 지키는 것이 둘이다. **1,000줄이 넘어도 끝까지 읽는다**(PostgREST 는 넘는
 * 줄을 말없이 버린다 — 기간을 1년으로 넓히면 소스·나라 표가 그만큼 된다) ·
 * **나라 표를 못 읽어도 나머지는 선다**(`011` 보다 앱이 먼저 배포된 경우).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Rows = Record<string, unknown>[];
let tables: Record<string, Rows | Error> = {};
const requested: { table: string; from: number; to: number }[] = [];

/** PostgREST 처럼 `range` 로 자르고, 한 번에 1,000줄을 넘겨 주지 않는다. */
function fakeClient() {
  return {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from(table: string) {
      const builder = {
        select: () => builder,
        gte: () => builder,
        lte: () => builder,
        order: () => builder,
        range: async (from: number, to: number) => {
          requested.push({ table, from, to });
          const rows = tables[table] ?? [];
          if (rows instanceof Error) {
            return { data: null, error: { message: rows.message } };
          }
          return {
            data: rows.slice(from, Math.min(to + 1, from + 1000)),
            error: null,
          };
        },
      };
      return builder;
    },
  };
}

vi.mock('../client', () => ({ reportClient: () => fakeClient() }));

const { loadFunnel, loadReport } = await import('../report');
const RANGE = { from: '2025-09-20', to: '2026-09-19' };

beforeEach(() => {
  tables = {};
  requested.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('loadReport', () => {
  it('1,000줄이 넘는 표도 끝까지 읽어 합친다', async () => {
    // 2,500줄 — 나라 둘이 하루씩 번갈아.
    tables.daily_country = Array.from({ length: 2500 }, (_, i) => ({
      day: '2026-01-01',
      country: i % 2 ? 'US' : 'KR',
      pageviews: 1,
      sessions: 1,
      downloads: 0,
    }));

    const report = await loadReport(RANGE);
    expect(report.countries).toEqual([
      { country: 'KR', pageviews: 1250, sessions: 1250, downloads: 0 },
      { country: 'US', pageviews: 1250, sessions: 1250, downloads: 0 },
    ]);
    expect(
      requested.filter((r) => r.table === 'daily_country').map((r) => r.from),
    ).toEqual([0, 1000, 2000]);
  });

  it('나라 표를 못 읽어도 나머지 통계는 선다', async () => {
    tables.daily_traffic = [
      {
        day: '2026-09-19',
        pageviews: 3,
        visitors: 2,
        sessions: 2,
        downloads: 1,
      },
    ];
    tables.daily_country = new Error('relation "daily_country" does not exist');

    const report = await loadReport(RANGE);
    expect(report.available).toBe(true);
    expect(report.days).toHaveLength(1);
    expect(report.countries).toBeNull();
  });

  it('다른 표를 못 읽으면 전체가 없는 것으로 다룬다', async () => {
    tables.daily_channel = new Error('boom');
    const report = await loadReport(RANGE);
    expect(report.available).toBe(false);
  });

  it('퍼널 표를 읽어 기간 합으로 접는다 (IDE-035)', async () => {
    tables.daily_funnel = ['2026-09-18', '2026-09-19'].map((day) => ({
      day,
      game_id: '',
      device: 'mobile',
      channel: 'social',
      sessions: 2,
      game_views: 1,
      edits: 1,
      print_opens: 1,
      export_fails: 0,
      downloads: 0,
    }));

    expect(await loadFunnel(RANGE)).toEqual([
      {
        game_id: '',
        device: 'mobile',
        channel: 'social',
        sessions: 4,
        game_views: 2,
        edits: 2,
        print_opens: 2,
        export_fails: 0,
        downloads: 0,
      },
    ]);
  });

  it('퍼널 표를 못 읽으면 null — 화면이 그렇다고 알린다', async () => {
    tables.daily_funnel = new Error('relation "daily_funnel" does not exist');
    expect(await loadFunnel(RANGE)).toBeNull();
  });

  it('방문 통계는 퍼널 표를 읽지 않는다 — 화면이 갈라졌다', async () => {
    await loadReport(RANGE);
    expect(requested.map((r) => r.table)).not.toContain('daily_funnel');
  });
});

/**
 * 대시보드가 읽는 값 (IDE-013)
 *
 * **집계 표만 읽는다.** 원본은 365일 뒤에 사라지지만 집계는 남아야 하므로,
 * 화면이 원본을 직접 세면 1년 전 그래프가 어느 날 갑자기 0이 된다.
 *
 * 읽기 직전에 최근 사흘을 다시 집계한다 — 오늘 숫자가 내일까지 안 보이면
 * 대시보드를 볼 이유가 없다. 하루치 재계산이라 비용은 무시할 만하다.
 */
import 'server-only';
import { analyticsClient } from './client';
import { analyticsDay } from './visitor';

export type DailyTraffic = {
  day: string;
  pageviews: number;
  visitors: number;
  sessions: number;
  downloads: number;
};

export type ChannelTotal = {
  channel: string;
  pageviews: number;
  visitors: number;
  sessions: number;
};

export type GameTotal = { game_id: string; views: number; downloads: number };

export type Report = {
  days: DailyTraffic[];
  channels: ChannelTotal[];
  games: GameTotal[];
  /** 집계가 비어 있는 것과 수집이 꺼져 있는 것은 다른 이야기다. */
  available: boolean;
};

const EMPTY: Report = { days: [], channels: [], games: [], available: false };

/**
 * `2026-09-07` 에서 며칠 뒤로. 날짜 문자열끼리의 계산이라 시간대가 끼어들 틈이
 * 없다 — `analyticsDay` 가 이미 KST 로 접어 놓은 값을 받는다.
 */
export const daysAgo = (day: string, count: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) - count * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * 채널·게임 표는 구간 합으로 접는다 — 날짜별로 펼치면 화면이 읽히지 않는다.
 *
 * 합칠 수 있는 것만 합친다. `visitors` 는 날짜별 순방문자라 더해도 기간
 * 순방문자가 되지 않는데, 그건 UV 정의가 그렇게 생긴 것이라 화면에서 대략치
 * 라고 밝힌다(결정 기록 2026-09-07).
 */
function fold<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  add: (into: number[], row: T) => number[],
  width: number,
): [string, number[]][] {
  const totals = new Map<string, number[]>();
  for (const row of rows) {
    const key = keyOf(row);
    totals.set(key, add(totals.get(key) ?? Array<number>(width).fill(0), row));
  }
  return [...totals.entries()];
}

const n = (value: unknown): number => Number(value ?? 0);

export async function loadReport(windowDays = 30): Promise<Report> {
  const supabase = analyticsClient();
  if (!supabase) return EMPTY;

  try {
    const today = analyticsDay();
    const from = daysAgo(today, windowDays - 1);

    // 오늘·어제 것을 화면에 띄우기 전에 원본에서 다시 접는다.
    await supabase.rpc('rollup_daily', {
      p_from: daysAgo(today, 2),
      p_to: today,
    });

    const [traffic, channels, games] = await Promise.all([
      supabase
        .from('daily_traffic')
        .select('day, pageviews, visitors, sessions, downloads')
        .gte('day', from)
        .order('day'),
      supabase
        .from('daily_channel')
        .select('day, channel, pageviews, visitors, sessions')
        .gte('day', from),
      supabase
        .from('daily_game')
        .select('day, game_id, views, downloads')
        .gte('day', from),
    ]);

    if (traffic.error || channels.error || games.error) {
      console.warn(
        '[analytics] 집계 조회 실패:',
        traffic.error?.message ??
          channels.error?.message ??
          games.error?.message,
      );
      return EMPTY;
    }

    return {
      available: true,
      days: (traffic.data ?? []) as DailyTraffic[],
      channels: fold(
        channels.data ?? [],
        (row) => String(row.channel),
        (into, row) => [
          into[0] + n(row.pageviews),
          into[1] + n(row.visitors),
          into[2] + n(row.sessions),
        ],
        3,
      )
        .map(([channel, [pageviews, visitors, sessions]]) => ({
          channel,
          pageviews,
          visitors,
          sessions,
        }))
        .sort((a, b) => b.pageviews - a.pageviews),
      games: fold(
        games.data ?? [],
        (row) => String(row.game_id),
        (into, row) => [into[0] + n(row.views), into[1] + n(row.downloads)],
        2,
      )
        .map(([game_id, [views, downloads]]) => ({ game_id, views, downloads }))
        .sort((a, b) => b.views - a.views),
    };
  } catch (cause) {
    // 대시보드는 있으면 좋은 화면이다. Supabase 가 죽었다고 500 을 낼 이유가 없다.
    console.warn('[analytics] 집계 조회 실패:', cause);
    return EMPTY;
  }
}

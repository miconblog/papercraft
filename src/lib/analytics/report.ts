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
import { reportClient, type AnalyticsSupabase } from './client';
import { daysAgo } from './days';
import { analyticsDay } from './visitor';

export { daysAgo };

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
  downloads: number;
};

/**
 * 채널 한 칸을 소스·매체·캠페인으로 편 줄.
 *
 * 세션 안에서 옮겨 다닌 화면과 받은 PDF 는 **그 세션이 들어온 곳**으로 센다
 * (`record_event` 가 물려준다). 그래서 이 표의 PDF 가 "어디서 온 사람이 도안을
 * 받았나"다.
 */
export type SourceTotal = {
  channel: string;
  /** `utm_source` · referrer 호스트 · `app:<앱>` 중 하나. 없으면 빈 문자열. */
  source: string;
  medium: string;
  campaign: string;
  pageviews: number;
  sessions: number;
  downloads: number;
};

export type GameTotal = { game_id: string; views: number; downloads: number };

/**
 * 나라 하나. 배포 플랫폼이 붙여 주는 ISO 3166-1 alpha-2 코드다(`countryOf`).
 * 코드를 모르는 줄은 빈 문자열로 모인다.
 */
export type CountryTotal = {
  country: string;
  pageviews: number;
  sessions: number;
  downloads: number;
};

export type Report = {
  days: DailyTraffic[];
  channels: ChannelTotal[];
  sources: SourceTotal[];
  games: GameTotal[];
  /**
   * 나라별. `null` 이면 표를 읽지 못한 것이다 — 나라 표(`011`)가 아직 없는
   * DB 여도 나머지 통계는 선다.
   */
  countries: CountryTotal[] | null;
  /** 집계가 비어 있는 것과 수집이 꺼져 있는 것은 다른 이야기다. */
  available: boolean;
};

const EMPTY: Report = {
  days: [],
  channels: [],
  sources: [],
  games: [],
  countries: null,
  available: false,
};

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

/** PostgREST 가 한 번에 돌려주는 줄 수의 상한(Supabase 기본 `max-rows`). */
const PAGE = 1000;

type Row = Record<string, unknown>;
type Page = { data: Row[] | null; error: { message: string } | null };

/**
 * 기간 안의 줄을 **전부** 읽는다.
 *
 * PostgREST 는 한 번에 `max-rows`(1,000줄)까지만 주고 **나머지를 말없이
 * 버린다.** 30일이면 표마다 수백 줄이라 걸리지 않았지만, 기간을 1년으로 넓히면
 * 소스·나라 표가 수천 줄이 되어 합계가 조용히 모자라진다. 그래서 1,000줄씩
 * 끝까지 넘겨 읽는다. 순서는 기본키로 못박는다 — 순서 없이 나눠 읽으면 페이지
 * 사이에서 줄이 겹치거나 빠진다.
 */
async function readAll(
  page: (from: number, to: number) => PromiseLike<Page>,
): Promise<Page> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await page(offset, offset + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return { data: rows, error: null };
  }
}

/** 일자별 집계 표 하나를 기간으로 잘라 전부 읽는다. */
const readDaily = (
  supabase: AnalyticsSupabase,
  table: string,
  columns: string,
  order: readonly string[],
  range: { from: string; to: string },
) =>
  readAll((start, end) => {
    let query = supabase
      .from(table)
      .select(columns)
      .gte('day', range.from)
      .lte('day', range.to);
    for (const column of order) query = query.order(column);
    return query.range(start, end) as unknown as PromiseLike<Page>;
  });

export async function loadReport(range: {
  from: string;
  to: string;
}): Promise<Report> {
  const supabase = reportClient();
  if (!supabase) return EMPTY;

  try {
    const today = analyticsDay();

    // 오늘·어제 것을 화면에 띄우기 전에 원본에서 다시 접는다.
    await supabase.rpc('rollup_daily', {
      p_from: daysAgo(today, 2),
      p_to: today,
    });

    const [traffic, channels, sources, games, countries] = await Promise.all([
      readDaily(
        supabase,
        'daily_traffic',
        'day, pageviews, visitors, sessions, downloads',
        ['day'],
        range,
      ),
      readDaily(
        supabase,
        'daily_channel',
        'day, channel, pageviews, visitors, sessions, downloads',
        ['day', 'channel'],
        range,
      ),
      readDaily(
        supabase,
        'daily_source',
        'day, channel, source, medium, campaign, pageviews, sessions, downloads',
        ['day', 'channel', 'source', 'medium', 'campaign'],
        range,
      ),
      readDaily(
        supabase,
        'daily_game',
        'day, game_id, views, downloads',
        ['day', 'game_id'],
        range,
      ),
      readDaily(
        supabase,
        'daily_country',
        'day, country, pageviews, sessions, downloads',
        ['day', 'country'],
        range,
      ),
    ]);

    // 나라 표만은 실패해도 화면을 세운다. `011` 을 적용하기 전에 앱이 먼저
    // 배포돼도 나머지 통계까지 "저장소에 닿지 못했다"가 되지 않는다.
    if (countries.error) {
      console.warn(
        '[analytics] 나라별 집계 조회 실패:',
        countries.error.message,
      );
    }

    const failed = [traffic, channels, sources, games].find((q) => q.error);
    if (failed) {
      console.warn('[analytics] 집계 조회 실패:', failed.error?.message);
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
          into[3] + n(row.downloads),
        ],
        4,
      )
        .map(([channel, [pageviews, visitors, sessions, downloads]]) => ({
          channel,
          pageviews,
          visitors,
          sessions,
          downloads,
        }))
        .sort((a, b) => b.pageviews - a.pageviews),
      sources: fold(
        sources.data ?? [],
        // utm 값은 누구나 링크에 적어 보낼 수 있다 — 어떤 구분자를 골라도 값
        // 안에 들어올 수 있으니 이어 붙이지 않고 배열째 직렬화한다.
        (row) =>
          JSON.stringify([row.channel, row.source, row.medium, row.campaign]),
        (into, row) => [
          into[0] + n(row.pageviews),
          into[1] + n(row.sessions),
          into[2] + n(row.downloads),
        ],
        3,
      )
        .map(([key, [pageviews, sessions, downloads]]) => {
          const [channel, source, medium, campaign] = JSON.parse(
            key,
          ) as string[];
          return {
            channel,
            source,
            medium,
            campaign,
            pageviews,
            sessions,
            downloads,
          };
        })
        .sort((a, b) => b.sessions - a.sessions || b.pageviews - a.pageviews),
      games: fold(
        games.data ?? [],
        (row) => String(row.game_id),
        (into, row) => [into[0] + n(row.views), into[1] + n(row.downloads)],
        2,
      )
        .map(([game_id, [views, downloads]]) => ({ game_id, views, downloads }))
        .sort((a, b) => b.views - a.views),
      countries: countries.error
        ? null
        : fold(
            countries.data ?? [],
            (row) => String(row.country ?? ''),
            (into, row) => [
              into[0] + n(row.pageviews),
              into[1] + n(row.sessions),
              into[2] + n(row.downloads),
            ],
            3,
          )
            .map(([country, [pageviews, sessions, downloads]]) => ({
              country,
              pageviews,
              sessions,
              downloads,
            }))
            .sort(
              (a, b) => b.sessions - a.sessions || b.pageviews - a.pageviews,
            ),
    };
  } catch (cause) {
    // 대시보드는 있으면 좋은 화면이다. Supabase 가 죽었다고 500 을 낼 이유가 없다.
    console.warn('[analytics] 집계 조회 실패:', cause);
    return EMPTY;
  }
}

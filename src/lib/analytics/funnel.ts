/**
 * PDF 다운로드 퍼널 (IDE-035)
 *
 * `daily_funnel` 한 줄은 (날짜 · 게임 · 기기 · 채널) 한 칸에서 **각 단계에 닿은
 * 세션 수**다. 여기서는 기간 합으로 접고, 대시보드가 고른 기준으로 다시 묶는다.
 *
 * `game_id` 가 빈 문자열인 줄이 사이트 전체다(`012` 머리말). 게임 줄과 섞어
 * 더하면 한 세션이 두 번 센다 — 전체·기기·채널은 사이트 줄만, 게임별은 게임
 * 줄만 쓴다.
 *
 * 날짜를 더하는 것이라 자정을 넘긴 세션은 두 날에 한 번씩 센다. 세션 표
 * (`daily_traffic.sessions`)와 같은 셈이다.
 */

export const FUNNEL_STEPS = [
  { key: 'sessions', label: '방문' },
  { key: 'game_views', label: '게임 화면' },
  { key: 'edits', label: '편집 시작' },
  { key: 'print_opens', label: '출력 창' },
  { key: 'downloads', label: 'PDF' },
] as const;

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]['key'];

export type FunnelCounts = Record<FunnelStepKey, number> & {
  /** 막힌 세션. 단계가 아니라 곁가지라 따로 둔다. */
  export_fails: number;
};

export type FunnelRow = FunnelCounts & {
  /** 빈 문자열이면 사이트 전체 줄. */
  game_id: string;
  device: string;
  channel: string;
};

export type FunnelDimension = 'total' | 'device' | 'channel' | 'game';

export type FunnelGroup = FunnelCounts & { key: string };

const COUNT_KEYS = [
  ...FUNNEL_STEPS.map((step) => step.key),
  'export_fails',
] as const;

const empty = (): FunnelCounts =>
  Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as FunnelCounts;

const n = (value: unknown): number => Number(value ?? 0);

/** 날짜를 떼고 (게임 · 기기 · 채널) 칸마다 더한다. */
export function foldFunnel(
  rows: readonly Record<string, unknown>[],
): FunnelRow[] {
  const totals = new Map<string, FunnelRow>();
  for (const row of rows) {
    const game_id = String(row.game_id ?? '');
    const device = String(row.device ?? '');
    const channel = String(row.channel ?? '');
    const key = JSON.stringify([game_id, device, channel]);
    const into = totals.get(key) ?? { ...empty(), game_id, device, channel };
    for (const count of COUNT_KEYS) into[count] += n(row[count]);
    totals.set(key, into);
  }
  return [...totals.values()];
}

/**
 * 고른 기준으로 묶는다. 방문(첫 단계)이 큰 순서다 — 게임별은 방문이 곧 그
 * 게임에 닿은 세션이라 게임 화면 순서와 같다.
 */
export function groupFunnel(
  rows: readonly FunnelRow[],
  by: FunnelDimension,
): FunnelGroup[] {
  const site = by !== 'game';
  const keyOf = (row: FunnelRow): string =>
    by === 'total' ? '' : by === 'game' ? row.game_id : row[by];

  const groups = new Map<string, FunnelGroup>();
  for (const row of rows) {
    if ((row.game_id === '') !== site) continue;
    const key = keyOf(row);
    const into = groups.get(key) ?? { ...empty(), key };
    for (const count of COUNT_KEYS) into[count] += row[count];
    groups.set(key, into);
  }
  return [...groups.values()].sort(
    (a, b) => b.sessions - a.sessions || b.downloads - a.downloads,
  );
}

/** 첫 단계 대비 비율(%). 첫 단계가 0 이면 `null` — 0% 와 "잴 것이 없다"는 다르다. */
export function rateOf(value: number, base: number): number | null {
  return base > 0 ? Math.round((value / base) * 1000) / 10 : null;
}

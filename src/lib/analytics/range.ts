/**
 * 대시보드 기간 (방문 통계 기간 필터)
 *
 * 주소가 기간을 쥔다 — `?range=7d` 또는 `?from=2026-09-01&to=2026-09-19`.
 * 새로고침해도, 링크로 넘겨도 같은 기간이 열린다.
 *
 * 날짜는 전부 `analyticsDay` 가 쓰는 KST 날짜 문자열(`YYYY-MM-DD`)이다. 집계
 * 표의 `day` 칸과 같은 값이라 시간대가 끼어들 틈이 없다.
 *
 * 주소는 누구나 고쳐 칠 수 있다 — 관리자만 오는 화면이지만 틀린 값에 500 을
 * 내지 않는다. 읽지 못하는 값은 기본 기간으로 떨어진다.
 */
import { daysAgo } from './days';

export type RangePreset = 'today' | '7d' | '30d' | '90d' | '1y';

export const RANGE_PRESETS: readonly {
  id: RangePreset;
  label: string;
  days: number;
}[] = [
  { id: 'today', label: '오늘', days: 1 },
  { id: '7d', label: '7일', days: 7 },
  { id: '30d', label: '30일', days: 30 },
  { id: '90d', label: '90일', days: 90 },
  { id: '1y', label: '1년', days: 365 },
];

/** 처음 열면 최근 7일 (2026-09-22 사용자 요청 — 전에는 30일). */
export const DEFAULT_PRESET: RangePreset = '7d';

export type DayRange = {
  /** 첫날(포함). */
  from: string;
  /** 마지막 날(포함). 오늘을 넘지 않는다. */
  to: string;
  /** 고른 프리셋. 날짜를 직접 골랐으면 `null`. */
  preset: RangePreset | null;
  /** 양 끝을 포함한 날 수. */
  days: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 달력에 있는 날인가. `2026-02-30` 은 `Date` 가 3월로 넘겨 버리므로 되짚는다. */
const isRealDay = (value: string): boolean =>
  DAY.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  ) + 1;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function presetRange(preset: RangePreset, today: string): DayRange {
  const { days } = RANGE_PRESETS.find((p) => p.id === preset)!;
  return { from: daysAgo(today, days - 1), to: today, preset, days };
}

/**
 * 주소의 검색 인자에서 기간을 읽는다.
 *
 * `from`·`to` 가 둘 다 제대로 있으면 그것이 이긴다. 뒤바뀌어 있으면 바로잡고,
 * 미래는 오늘로 자른다 — 내일 칸은 비어 있을 수밖에 없는데 그걸 0 으로 그리면
 * 방문이 끊긴 것처럼 보인다.
 */
export function parseRange(
  params: Record<string, string | string[] | undefined>,
  today: string,
): DayRange {
  const from = first(params.from);
  const to = first(params.to);
  if (from && to && isRealDay(from) && isRealDay(to)) {
    let [start, end] = from <= to ? [from, to] : [to, from];
    if (end > today) end = today;
    if (start > end) start = end;
    return {
      from: start,
      to: end,
      preset: null,
      days: daysBetween(start, end),
    };
  }

  const preset = first(params.range);
  const known = RANGE_PRESETS.find((p) => p.id === preset);
  return presetRange(known?.id ?? DEFAULT_PRESET, today);
}

/** 화면 위에 적는 한 줄. */
export function describeRange(range: DayRange): string {
  const preset = RANGE_PRESETS.find((p) => p.id === range.preset);
  const span = `${range.from} ~ ${range.to}`;
  if (preset?.id === 'today') return `오늘 · ${range.to}`;
  return preset
    ? `최근 ${preset.label} · ${span}`
    : `${span} · ${range.days}일`;
}

export type Bucket = {
  /** 칸의 첫날. 표와 막대의 키다. */
  from: string;
  to: string;
  /** 표에 적는 이름. */
  label: string;
};

/**
 * 추이를 몇 날씩 묶어 그릴지.
 *
 * 1년을 하루 한 칸으로 그리면 막대가 1px 도 안 되고 표가 365줄이 된다. 석 달
 * 까지는 하루, 그 뒤로는 한 주, 1년이 넘으면 한 달(30일)씩 묶는다. 칸은
 * **마지막 날부터 거꾸로** 자른다 — 가장 최근 칸이 늘 꽉 차 있어야 "이번 주"를
 * 지난주와 견줄 수 있다. 모자라는 것은 맨 앞 칸이다.
 */
export function bucketsOf(range: DayRange): {
  unit: string;
  buckets: Bucket[];
} {
  const size = range.days <= 92 ? 1 : range.days <= 400 ? 7 : 30;
  const unit = size === 1 ? '일자별' : size === 7 ? '주별' : '30일별';
  const buckets: Bucket[] = [];
  for (let end = range.to; end >= range.from; end = daysAgo(end, size)) {
    const candidate = daysAgo(end, size - 1);
    const start = candidate < range.from ? range.from : candidate;
    buckets.push({
      from: start,
      to: end,
      label: size === 1 ? end : `${start} ~ ${end.slice(5)}`,
    });
  }
  return { unit, buckets: buckets.reverse() };
}

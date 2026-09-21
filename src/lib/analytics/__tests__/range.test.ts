/**
 * 방문 통계 기간 필터
 *
 * 주소는 누구나 고쳐 칠 수 있다. 틀린 값은 기본 기간으로 떨어지고, 미래는
 * 오늘로 잘리며, 긴 기간의 추이는 칸으로 묶인다.
 */
import { describe, expect, it } from 'vitest';
import { bucketsOf, describeRange, parseRange } from '../range';

const TODAY = '2026-09-19';

describe('parseRange', () => {
  it('아무것도 없으면 최근 7일이다 (2026-09-22 사용자 요청)', () => {
    expect(parseRange({}, TODAY)).toEqual({
      from: '2026-09-13',
      to: TODAY,
      preset: '7d',
      days: 7,
    });
  });

  it('오늘은 오늘 하루다', () => {
    expect(parseRange({ range: 'today' }, TODAY)).toEqual({
      from: TODAY,
      to: TODAY,
      preset: 'today',
      days: 1,
    });
  });

  it('프리셋을 읽는다', () => {
    expect(parseRange({ range: '7d' }, TODAY)).toMatchObject({
      from: '2026-09-13',
      preset: '7d',
      days: 7,
    });
    expect(parseRange({ range: '1y' }, TODAY).days).toBe(365);
  });

  it('모르는 프리셋은 기본 기간이다', () => {
    expect(parseRange({ range: 'forever' }, TODAY).preset).toBe('7d');
  });

  it('날짜를 직접 고르면 그것이 이긴다', () => {
    expect(
      parseRange({ range: '7d', from: '2026-09-01', to: '2026-09-10' }, TODAY),
    ).toEqual({ from: '2026-09-01', to: '2026-09-10', preset: null, days: 10 });
  });

  it('뒤바뀐 날짜는 바로잡고, 미래는 오늘로 자른다', () => {
    expect(parseRange({ from: '2026-12-31', to: '2026-09-01' }, TODAY)).toEqual(
      { from: '2026-09-01', to: TODAY, preset: null, days: 19 },
    );
    expect(parseRange({ from: '2027-01-01', to: '2027-02-01' }, TODAY)).toEqual(
      { from: TODAY, to: TODAY, preset: null, days: 1 },
    );
  });

  it('달력에 없는 날·틀린 형식은 버린다', () => {
    expect(parseRange({ from: '2026-02-30', to: TODAY }, TODAY).preset).toBe(
      '7d',
    );
    expect(parseRange({ from: '어제', to: TODAY }, TODAY).preset).toBe('7d');
    expect(parseRange({ from: '2026-09-01' }, TODAY).preset).toBe('7d');
  });

  it('같은 인자가 두 번 오면 첫 값을 쓴다', () => {
    expect(
      parseRange({ from: ['2026-09-01', 'x'], to: TODAY }, TODAY).from,
    ).toBe('2026-09-01');
  });
});

describe('describeRange', () => {
  it('프리셋이면 이름과 날짜를, 직접 고른 기간이면 날 수를 적는다', () => {
    expect(describeRange(parseRange({ range: '7d' }, TODAY))).toBe(
      '최근 7일 · 2026-09-13 ~ 2026-09-19',
    );
    // "최근 오늘"이 아니라 그냥 오늘.
    expect(describeRange(parseRange({ range: 'today' }, TODAY))).toBe(
      '오늘 · 2026-09-19',
    );
    expect(
      describeRange(
        parseRange({ from: '2026-09-01', to: '2026-09-10' }, TODAY),
      ),
    ).toBe('2026-09-01 ~ 2026-09-10 · 10일');
  });
});

describe('bucketsOf', () => {
  it('석 달까지는 하루 한 칸이다', () => {
    const { unit, buckets } = bucketsOf(parseRange({ range: '90d' }, TODAY));
    expect(unit).toBe('일자별');
    expect(buckets).toHaveLength(90);
    expect(buckets.at(-1)).toEqual({ from: TODAY, to: TODAY, label: TODAY });
  });

  it('1년은 한 주씩 묶고, 가장 최근 칸이 꽉 찬다', () => {
    const { unit, buckets } = bucketsOf(parseRange({ range: '1y' }, TODAY));
    expect(unit).toBe('주별');
    expect(buckets).toHaveLength(53);
    expect(buckets.at(-1)).toMatchObject({ from: '2026-09-13', to: TODAY });
    // 칸이 기간을 빈틈없이 덮는다 — 모자라는 것은 맨 앞 칸이다.
    expect(buckets[0].from).toBe('2025-09-20');
  });

  it('1년이 넘으면 30일씩 묶는다', () => {
    const { unit } = bucketsOf(
      parseRange({ from: '2024-01-01', to: TODAY }, TODAY),
    );
    expect(unit).toBe('30일별');
  });
});

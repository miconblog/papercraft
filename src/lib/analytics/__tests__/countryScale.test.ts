/**
 * 나라별 지도의 색 구간
 *
 * 한국 하나가 압도하는 분포에서도 해외 방문 1과 30이 다른 색이어야 한다.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_BINS,
  binBreaks,
  binLabel,
  binOf,
  countryName,
  rampStep,
} from '../countryScale';

describe('binBreaks', () => {
  it('방문이 없으면 칸도 없다', () => {
    expect(binBreaks(0)).toEqual([]);
  });

  it('1·2·5 로 늘려 가며 다섯 칸을 넘기지 않는다', () => {
    expect(binBreaks(1)).toEqual([1]);
    expect(binBreaks(4)).toEqual([1, 2]);
    expect(binBreaks(30)).toEqual([1, 2, 5, 10, 20]);
  });

  it('넘치면 더 성긴 수열로 바꾼다', () => {
    expect(binBreaks(80)).toEqual([1, 3, 10, 30]);
    // 1·3 이 여섯 칸으로 넘치면 1·5 로 — 1·10·100 세 칸까지 성기게 가지 않는다.
    expect(binBreaks(412)).toEqual([1, 5, 10, 50, 100]);
    expect(binBreaks(5000)).toEqual([1, 10, 100, 1000]);
  });

  it('아무리 커도 다섯 칸이다', () => {
    for (const max of [1, 7, 99, 12_345, 9_999_999]) {
      expect(binBreaks(max).length).toBeLessThanOrEqual(MAX_BINS);
    }
  });
});

describe('binOf · binLabel', () => {
  const breaks = [1, 2, 5, 10, 20];

  it('값이 들어가는 칸을 찾는다 — 0 은 방문 없음', () => {
    expect(binOf(0, breaks)).toBe(-1);
    expect(binOf(1, breaks)).toBe(0);
    expect(binOf(4, breaks)).toBe(1);
    expect(binOf(19, breaks)).toBe(3);
    expect(binOf(500, breaks)).toBe(4);
  });

  it('범례 이름', () => {
    expect(breaks.map((_, i) => binLabel(i, breaks))).toEqual([
      '1',
      '2–4',
      '5–9',
      '10–19',
      '20 이상',
    ]);
    expect(binLabel(0, [1, 1000])).toBe('1–999');
    expect(binLabel(1, [1, 1000])).toBe('1,000 이상');
  });
});

describe('rampStep', () => {
  it('칸이 적어도 가장 많은 칸이 가장 진한 쪽이다', () => {
    expect(rampStep(0, 1)).toBe(2);
    expect([0, 1].map((b) => rampStep(b, 2))).toEqual([1, 3]);
    expect([0, 1, 2].map((b) => rampStep(b, 3))).toEqual([0, 2, 4]);
    expect([0, 1, 2, 3, 4].map((b) => rampStep(b, 5))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('countryName', () => {
  it('한국어 이름을 쓴다 — 빈 코드는 알 수 없음', () => {
    expect(countryName('KR')).toBe('대한민국');
    expect(countryName('US')).toBe('미국');
    expect(countryName('')).toBe('알 수 없음');
  });
});

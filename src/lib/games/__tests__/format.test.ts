import { describe, expect, it } from 'vitest';
import { formatPlayers } from '../format';

describe('formatPlayers', () => {
  it('최소·최대가 같으면 한 번만 적는다', () => {
    expect(formatPlayers({ min: 2, max: 2 })).toBe('2인용');
  });

  it('다르면 범위로 적는다', () => {
    expect(formatPlayers({ min: 2, max: 4 })).toBe('2~4인용');
  });
});

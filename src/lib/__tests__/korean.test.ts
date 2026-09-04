import { describe, expect, it } from 'vitest';
import { roParticle } from '../korean';

describe('roParticle', () => {
  it('받침이 없으면 로를 고른다', () => {
    expect(roParticle('학교')).toBe('로');
  });

  it('ㄹ받침도 로를 고른다', () => {
    expect(roParticle('서울')).toBe('로');
  });

  it('그 외 받침은 으로를 고른다', () => {
    expect(roParticle('축구 게임판')).toBe('으로');
    expect(roParticle('집')).toBe('으로');
  });
});

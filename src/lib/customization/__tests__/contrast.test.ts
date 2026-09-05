import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  findIndistinguishablePair,
  relativeLuminance,
} from '../contrast';

describe('relativeLuminance', () => {
  it('검정은 0, 흰색은 1', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('검정과 흰색은 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('같은 색은 1:1', () => {
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 5);
  });

  it('밝기가 비슷한 채도 높은 두 색은 명암비가 낮다', () => {
    // 순빨강(#ff0000)과 순파랑(#0000ff) — 색조는 다르지만 흑백에서는 둘 다
    // 어두운 회색에 가깝다.
    expect(contrastRatio('#ff0000', '#0000ff')).toBeLessThan(3);
  });
});

describe('findIndistinguishablePair', () => {
  it('밝기 차가 뚜렷한 팀 색은 통과한다', () => {
    const pair = findIndistinguishablePair([
      { id: 'home', label: '홈', hex: '#1d4ed8' }, // 어두운 파랑
      { id: 'away', label: '원정', hex: '#facc15' }, // 밝은 노랑
    ]);
    expect(pair).toBeNull();
  });

  it('밝기가 비슷한 팀 색은 짝을 돌려준다', () => {
    const pair = findIndistinguishablePair([
      { id: 'home', label: '홈', hex: '#dc2626' }, // 빨강
      { id: 'away', label: '원정', hex: '#2563eb' }, // 파랑 — 비슷한 중간 밝기
    ]);
    expect(pair).not.toBeNull();
    expect([pair?.a.id, pair?.b.id]).toEqual(['home', 'away']);
  });

  it('그룹이 하나뿐이면 비교할 짝이 없다', () => {
    expect(findIndistinguishablePair([{ id: 'home', label: '홈', hex: '#dc2626' }])).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { Part } from '@/lib/schema';
import { formatPlayers, groupPartsBySeries } from '../format';

describe('formatPlayers', () => {
  it('최소·최대가 같으면 한 번만 적는다', () => {
    expect(formatPlayers({ min: 2, max: 2 })).toBe('2인용');
  });

  it('다르면 범위로 적는다', () => {
    expect(formatPlayers({ min: 2, max: 4 })).toBe('2~4인용');
  });
});

describe('groupPartsBySeries (IDE-030)', () => {
  const part = (id: string, series?: string) =>
    ({ id, title: `${id} 제목`, series }) as unknown as Part;

  it('묶음 이름이 없으면 파트마다 따로 선다', () => {
    const groups = groupPartsBySeries([part('a'), part('b')]);
    expect(groups.map((g) => g.label)).toEqual(['a 제목', 'b 제목']);
    expect(groups.every((g) => g.parts.length === 1)).toBe(true);
  });

  it('같은 이름을 단 파트는 한 묶음이 된다', () => {
    const groups = groupPartsBySeries([
      part('hole-1', '홀 판'),
      part('hole-2', '홀 판'),
      part('card'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('홀 판');
    expect(groups[0].parts.map((p) => p.id)).toEqual(['hole-1', 'hole-2']);
    expect(groups[1].label).toBe('card 제목');
  });

  it('묶음은 그 이름이 처음 나온 자리에 앉는다 — 화면의 차례가 인쇄물과 같아야 한다', () => {
    const groups = groupPartsBySeries([
      part('first'),
      part('hole-1', '홀 판'),
      part('card'),
      part('hole-2', '홀 판'),
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      'first 제목',
      '홀 판',
      'card 제목',
    ]);
    expect(groups[1].parts.map((p) => p.id)).toEqual(['hole-1', 'hole-2']);
  });
});

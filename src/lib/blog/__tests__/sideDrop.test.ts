/**
 * 사진을 사진 옆에 끌어 놓기 — 좌표와 줄 계산 (IDE-028)
 *
 * 끌기 자체는 브라우저에서만 되지만, **어디에 붙는가**와 **무엇이 되는가**는
 * 여기서 전부 정해진다. 사람 손으로 확인할 몫을 좌표 계산의 실수로 낭비하지
 * 않게 이쪽을 촘촘히 덮는다.
 */
import { describe, expect, it } from 'vitest';
import { EDGE_BAND, gapX, joinRow, sideDropIndex } from '../sideDrop';

const box = { left: 100, top: 200, width: 400, height: 300 };
const middleY = box.top + box.height / 2;
const img = (src: string) => ({ src, alt: '' });

describe('sideDropIndex', () => {
  it('낱장의 왼쪽 절반에 놓으면 왼쪽(0), 오른쪽 절반이면 오른쪽(1)에 붙는다', () => {
    expect(sideDropIndex(box, box.left + 50, middleY, 1)).toBe(0);
    expect(sideDropIndex(box, box.left + 350, middleY, 1)).toBe(1);
  });

  it('위·아래 가장자리 띠에 놓으면 옆에 붙이지 않는다 — 평소처럼 위나 아래로 옮긴다', () => {
    const topEdge = box.top + box.height * (EDGE_BAND / 2);
    const bottomEdge = box.top + box.height * (1 - EDGE_BAND / 2);
    expect(sideDropIndex(box, box.left + 50, topEdge, 1)).toBeNull();
    expect(sideDropIndex(box, box.left + 50, bottomEdge, 1)).toBeNull();
  });

  it('줄 위에서는 가장 가까운 틈을 고른다', () => {
    // 두 칸짜리 줄: 틈은 0(맨 앞)·1(가운데)·2(맨 뒤).
    expect(sideDropIndex(box, box.left + 10, middleY, 2)).toBe(0);
    expect(sideDropIndex(box, box.left + 200, middleY, 2)).toBe(1);
    expect(sideDropIndex(box, box.left + 390, middleY, 2)).toBe(2);
  });

  it('상자 옆 빈자리에 놓아도 받는다 — 너비를 줄인 사진은 옆이 비어 있다', () => {
    expect(sideDropIndex(box, box.left + box.width + 80, middleY, 1)).toBe(1);
    expect(sideDropIndex(box, box.left - 80, middleY, 1)).toBe(0);
  });

  it('크기가 없는 상자나 사진이 없는 마디는 받지 않는다', () => {
    expect(sideDropIndex({ ...box, width: 0 }, 150, middleY, 1)).toBeNull();
    expect(sideDropIndex({ ...box, height: 0 }, 150, middleY, 1)).toBeNull();
    expect(sideDropIndex(box, 150, middleY, 0)).toBeNull();
  });
});

describe('joinRow', () => {
  it('틈 자리에 끼운다', () => {
    const row = [img('a'), img('b')];
    expect(joinRow(row, [img('x')], 0)!.map((i) => i.src)).toEqual([
      'x',
      'a',
      'b',
    ]);
    expect(joinRow(row, [img('x')], 1)!.map((i) => i.src)).toEqual([
      'a',
      'x',
      'b',
    ]);
    expect(joinRow(row, [img('x')], 2)!.map((i) => i.src)).toEqual([
      'a',
      'b',
      'x',
    ]);
  });

  it('줄을 끌어 오면 그 사진들을 차례 그대로 끼운다', () => {
    expect(
      joinRow([img('a')], [img('x'), img('y')], 1)!.map((i) => i.src),
    ).toEqual(['a', 'x', 'y']);
  });

  it('넉 장을 넘기면 합치지 않는다 — 조용히 잘라 넣으면 사진이 사라진다', () => {
    const three = [img('a'), img('b'), img('c')];
    expect(joinRow(three, [img('x'), img('y')], 1)).toBeNull();
    expect(joinRow(three, [img('x')], 3)).not.toBeNull();
  });

  it('틈 번호가 범위를 벗어나면 끝으로 붙인다', () => {
    expect(joinRow([img('a')], [img('x')], 9)!.map((i) => i.src)).toEqual([
      'a',
      'x',
    ]);
    expect(joinRow([img('a')], [img('x')], -3)!.map((i) => i.src)).toEqual([
      'x',
      'a',
    ]);
  });

  it('빈 쪽이 있으면 합치지 않는다', () => {
    expect(joinRow([], [img('x')], 0)).toBeNull();
    expect(joinRow([img('a')], [], 0)).toBeNull();
  });
});

describe('gapX', () => {
  it('틈을 칸 경계에 둔다', () => {
    expect(gapX(box, 0, 2)).toBe(100);
    expect(gapX(box, 1, 2)).toBe(300);
    expect(gapX(box, 2, 2)).toBe(500);
  });
});

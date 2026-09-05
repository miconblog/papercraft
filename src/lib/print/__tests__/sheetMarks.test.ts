/**
 * 타일 표식.
 *
 * 스파이크는 장 번호를 용지 아래 1.6mm에 두었는데, 그 자리는 가정용 프린터가
 * 인쇄하지 못하는 여백이라 종이에서는 사라진다. 표식이 **인쇄 가능 영역 안에**
 * 있는지가 여기서 가장 중요한 검사다.
 */
import { describe, expect, it } from 'vitest';
import type { Draw, PathDraw, TextDraw } from '../draw';
import { tileMarks } from '../sheetMarks';
import { planTiles, type TilePlan } from '../tile';

const tiled = planTiles({ partWidthMm: 594, partHeightMm: 420 });
const single = planTiles({ partWidthMm: 148.5, partHeightMm: 105 });

const marksFor = (plan: TilePlan, index = 0, copies = 1): Draw[] =>
  tileMarks({
    plan,
    tile: plan.tiles[index],
    sheetLabel: '축구 게임판 · 운동장',
    scaleLabel: '200%',
    copy: copies > 1 ? { index: 1, total: copies } : null,
  });

const texts = (items: Draw[]) =>
  items.filter((i): i is TextDraw => i.kind === 'text');
const paths = (items: Draw[]) =>
  items.filter((i): i is PathDraw => i.kind === 'path');

/**
 * 표식 하나가 차지하는 세로 범위.
 *
 * 글자는 `dominant-baseline: central`이라 기준점이 글자 상자의 세로 중심이다.
 * Noto Sans KR의 상자 높이는 크기의 1.448배(ascent 1.16em + descent 0.288em)이므로
 * 중심에서 위아래로 0.724배씩 잡는다.
 */
const TEXT_HALF_BOX = 0.724;

const extentOf = (item: Draw): { x: number[]; y: number[] } =>
  item.kind === 'text'
    ? {
        x: [item.xMm, item.xMm],
        y: [
          item.yMm - item.sizeMm * TEXT_HALF_BOX,
          item.yMm + item.sizeMm * TEXT_HALF_BOX,
        ],
      }
    : {
        x: item.commands.flatMap((c) => ('x' in c ? [c.x] : [])),
        y: item.commands.flatMap((c) => ('y' in c ? [c.y] : [])),
      };

describe('tileMarks', () => {
  it('모든 표식이 인쇄 가능 영역 안에 있다', () => {
    for (let i = 0; i < tiled.total; i++) {
      for (const item of marksFor(tiled, i)) {
        const { y } = extentOf(item);
        // 세로만 본다 — 글자 폭은 maxWidthMm이 줄여 맞추므로 여기서 재지 않는다.
        for (const value of y) {
          expect(value).toBeGreaterThanOrEqual(tiled.marginMm - 1e-9);
          expect(value).toBeLessThanOrEqual(
            tiled.pageHeightMm - tiled.marginMm + 1e-9,
          );
        }
      }
    }
  });

  it('장 번호에 몇 번째 장인지와 행·열이 함께 적힌다', () => {
    const stamp = texts(marksFor(tiled, 4)).find((t) =>
      t.text.includes('/8장'),
    );
    expect(stamp?.text).toBe('축구 게임판 · 운동장 · 5/8장 (2행 1열)');
  });

  it('여러 벌이면 몇 벌째인지도 적는다 — 섞이면 알 수 없다', () => {
    const stamp = texts(marksFor(tiled, 0, 3)).find((t) =>
      t.text.includes('/8장'),
    );
    expect(stamp?.text).toContain('3벌 중 1벌째');
  });

  it('배율 100%로 인쇄하라는 문구를 장마다 박는다', () => {
    expect(
      texts(marksFor(tiled, 0)).some((t) => t.text.includes('맞춤 없음')),
    ).toBe(true);
  });

  it('이웃 장 번호를 하단 띠에 모은다 — 겹침 띠에 적으면 붙인 뒤에도 남는다', () => {
    const label = texts(marksFor(tiled, 5)).find((t) =>
      t.text.startsWith('이어 붙일 장'),
    );
    // 6번 장(2행 2열)의 이웃은 왼쪽 5·오른쪽 7·위 2다.
    expect(label?.text).toContain('◀ 5번');
    expect(label?.text).toContain('▶ 7번');
    expect(label?.text).toContain('▲ 2번');
    expect(label?.text).not.toContain('▼');
  });

  it('한 장짜리에는 재단선도 이웃 표시도 없다', () => {
    const items = marksFor(single);
    expect(texts(items).some((t) => t.text.startsWith('이어 붙일 장'))).toBe(
      false,
    );
    // 오림선을 가진 부속 위에 네모를 하나 더 그리면 어디를 자를지 헷갈린다.
    expect(paths(items)).toHaveLength(0);
    expect(texts(items).some((t) => t.text.includes('1/1장'))).toBe(true);
  });

  it('여러 장이면 재단 테두리와 겹침 파선을 그린다', () => {
    const items = paths(marksFor(tiled, 0));
    expect(items.some((p) => p.dashMm !== null)).toBe(true);
    expect(items.length).toBeGreaterThan(4);
    // 표식은 배율을 먹지 않는다 — 200%로 뽑아도 재단선은 같은 굵기다.
    expect(items.every((p) => p.fixedStroke)).toBe(true);
  });
});

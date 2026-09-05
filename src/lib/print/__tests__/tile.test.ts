import { describe, expect, it } from 'vitest';
import { contentPerTile, countTiles, planTiles } from '../tile';
import { A4, DEFAULT_OVERLAP_MM, STAMP_BAND_MM } from '../geometry';

const BOARD = { widthMm: 297, heightMm: 210 };

describe('planTiles', () => {
  it('파트가 인쇄 가능 영역에 들어가면 한 장이고 겹침이 없다', () => {
    const plan = planTiles({ partWidthMm: 100, partHeightMm: 140 });
    expect(plan.total).toBe(1);
    expect(plan.overlapXMm).toBe(0);
    expect(plan.overlapYMm).toBe(0);
    expect(plan.tiles[0].srcWMm).toBe(100);
  });

  it('배율 100% 가로 보드는 A4 세로 2장이다 (print-spec §5)', () => {
    const plan = planTiles({
      partWidthMm: BOARD.widthMm,
      partHeightMm: BOARD.heightMm,
    });
    expect(plan.total).toBe(2);
    expect(plan.orientation).toBe('portrait');
    expect(plan.cols).toBe(2);
    expect(plan.rows).toBe(1);
  });

  it('배율 100% 세로 보드는 A4 가로 2장이다 (print-spec §5)', () => {
    const plan = planTiles({ partWidthMm: 210, partHeightMm: 297 });
    expect(plan.total).toBe(2);
    expect(plan.orientation).toBe('landscape');
    expect(plan.cols).toBe(1);
    expect(plan.rows).toBe(2);
  });

  // 하단 표식 띠(STAMP_BAND_MM)를 뗀 뒤에도 이 표가 유지되는지가 띠 폭을 정한
  // 근거다. 띠를 네 변에 두면 125%에서 2장이 3장이 된다.
  it('print-spec §5 배율별 장수 표를 그대로 만족한다', () => {
    const expected: ReadonlyArray<readonly [number, number, number]> = [
      // [배율, 세로 보드 210×297, 가로 보드 297×210]
      [0.5, 1, 1],
      [0.75, 1, 1],
      [1, 2, 2],
      [1.25, 2, 2],
      [1.5, 4, 4],
      [2, 8, 8],
      [3, 15, 15],
    ];
    for (const [scale, portraitPages, landscapePages] of expected) {
      expect(
        planTiles({ partWidthMm: 210 * scale, partHeightMm: 297 * scale })
          .total,
      ).toBe(portraitPages);
      expect(
        planTiles({ partWidthMm: 297 * scale, partHeightMm: 210 * scale })
          .total,
      ).toBe(landscapePages);
    }
  });

  it('겹침을 뺀 나머지를 균등 분배한다 — 장마다 겹침이 같다', () => {
    const plan = planTiles({ partWidthMm: 594, partHeightMm: 420 });
    const gaps = new Set<number>();
    for (const tile of plan.tiles) {
      if (tile.col < plan.cols) {
        const right = plan.tiles.find(
          (t) => t.row === tile.row && t.col === tile.col + 1,
        )!;
        gaps.add(
          Math.round((tile.srcXMm + tile.srcWMm - right.srcXMm) * 1000) / 1000,
        );
      }
    }
    expect([...gaps]).toEqual([DEFAULT_OVERLAP_MM]);
  });

  it('타일을 이어 붙이면 파트 전체를 빠짐없이 덮는다', () => {
    const plan = planTiles({ partWidthMm: 594, partHeightMm: 420 });
    const last = plan.tiles[plan.tiles.length - 1];
    expect(last.srcXMm + last.srcWMm).toBeCloseTo(594, 6);
    expect(last.srcYMm + last.srcHMm).toBeCloseTo(420, 6);
    expect(plan.tiles[0].srcXMm).toBe(0);
    expect(plan.tiles[0].srcYMm).toBe(0);
  });

  it('도안 영역은 인쇄 가능 영역을 넘지 않는다', () => {
    for (const scale of [0.5, 1, 1.5, 2, 3]) {
      const plan = planTiles({
        partWidthMm: 297 * scale,
        partHeightMm: 210 * scale,
      });
      expect(plan.tileWidthMm).toBeLessThanOrEqual(plan.liveWidthMm + 1e-9);
      expect(plan.tileHeightMm).toBeLessThanOrEqual(plan.liveHeightMm + 1e-9);
      for (const tile of plan.tiles) {
        expect(tile.dstXMm).toBeGreaterThanOrEqual(plan.marginMm - 1e-9);
        expect(tile.dstYMm).toBeGreaterThanOrEqual(plan.marginMm - 1e-9);
      }
    }
  });

  it('도안을 좌우 가운데에 놓는다 — 네 변 여백이 고르게 남는다', () => {
    const plan = planTiles({ partWidthMm: 297, partHeightMm: 210 });
    const tile = plan.tiles[0];
    expect(tile.dstXMm * 2 + tile.srcWMm).toBeCloseTo(plan.pageWidthMm, 6);
  });

  it('방향을 지정하면 그 방향만 쓴다', () => {
    const plan = planTiles({
      partWidthMm: 297,
      partHeightMm: 210,
      orientation: 'landscape',
    });
    expect(plan.orientation).toBe('landscape');
    expect(plan.pageWidthMm).toBe(A4.heightMm);
  });

  it('여백을 낮추면 장수가 줄어든다 — 프린터 여백을 재서 넣는 값이 결과를 바꾼다', () => {
    const wide = planTiles({
      partWidthMm: 297,
      partHeightMm: 210,
      marginMm: 6,
    });
    const narrow = planTiles({
      partWidthMm: 297,
      partHeightMm: 210,
      marginMm: 0,
    });
    expect(wide.total).toBe(2);
    expect(narrow.total).toBe(1);
  });

  it('하단 표식 띠는 장수를 늘리지 않는다 — 남는 여유에서만 가져간다', () => {
    // 여유가 넉넉하면 희망 폭을 그대로 쓴다.
    const roomy = planTiles({ partWidthMm: 100, partHeightMm: 100 });
    expect(roomy.liveHeightMm).toBe(roomy.pageHeightMm - 2 * roomy.marginMm);
    expect(roomy.stampBandMm).toBe(STAMP_BAND_MM);

    // 도안이 인쇄 가능 영역을 꽉 채우면 띠가 0이 된다. 장수는 그대로 1장이다.
    const tight = planTiles({
      partWidthMm: 198,
      partHeightMm: 285,
      orientation: 'portrait',
    });
    expect(tight.total).toBe(1);
    expect(tight.stampBandMm).toBeCloseTo(0, 9);
  });

  it('표식 띠 아래로 도안이 내려오지 않는다 — 표식이 도안을 덮지 않는다', () => {
    for (const scale of [0.5, 1, 1.25, 1.357, 2, 3]) {
      const plan = planTiles({
        partWidthMm: 297 * scale,
        partHeightMm: 210 * scale,
      });
      for (const tile of plan.tiles) {
        expect(tile.dstYMm + tile.srcHMm).toBeLessThanOrEqual(
          plan.pageHeightMm - plan.marginMm - plan.stampBandMm + 1e-9,
        );
        expect(tile.dstYMm).toBeGreaterThanOrEqual(plan.marginMm - 1e-9);
      }
    }
  });

  it('무여백에 가까운 프린터라면 100% 보드가 A4 한 장에 들어간다', () => {
    const plan = planTiles({
      partWidthMm: 297,
      partHeightMm: 210,
      marginMm: 0,
    });
    expect(plan.total).toBe(1);
  });

  it('겹침이 인쇄 가능 영역보다 넓으면 실패한다 — 장수가 수렴하지 않는다', () => {
    expect(() =>
      planTiles({ partWidthMm: 400, partHeightMm: 400, overlapMm: 300 }),
    ).toThrow(/타일 계산 실패/);
  });

  it('파트 크기가 0 이하면 실패한다', () => {
    expect(() => planTiles({ partWidthMm: 0, partHeightMm: 10 })).toThrow(
      /0보다 커야/,
    );
  });
});

describe('countTiles · contentPerTile', () => {
  it('c = (L + (n-1)V) / n 이다', () => {
    expect(contentPerTile(400, 3, 10)).toBeCloseTo((400 + 2 * 10) / 3, 9);
  });

  it('n = ceil((L - V) / (P - V)) 이다', () => {
    expect(countTiles(400, 198, 10)).toBe(Math.ceil((400 - 10) / (198 - 10)));
  });

  it('한 장에 들어가면 겹침을 만들지 않는다', () => {
    expect(countTiles(100, 198, 10)).toBe(1);
    expect(contentPerTile(100, 1, 10)).toBe(100);
  });
});

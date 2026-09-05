/**
 * 마커를 손으로 옮길 때의 경계.
 *
 * 화면(드래그·화살표 키)과 저장 검증이 **같은 규칙**을 써야 한다. 드래그가
 * 허용한 자리를 `validateCustomization`이 거부하면 사용자가 만든 값이 조용히
 * 버려진다(`storage.ts`가 안 맞는 저장값을 버리기 때문이다).
 */
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import {
  defaultCustomization,
  findRegion,
  findSlot,
  slotMarker,
  validateCustomization,
  type GameDefinition,
} from '@/lib/schema';
import { clampToBounds, markerBounds, movedPoint } from '../movement';

const game = getGame('soccer') as GameDefinition;
const playerSlot = findSlot(game, 'home-player-9')!;
const nameSlot = findSlot(game, 'home-name')!;

describe('markerBounds', () => {
  it('옮길 수 없는 슬롯은 범위가 없다', () => {
    expect(markerBounds(game, nameSlot)).toBeNull();
  });

  it('슬롯이 가리키는 영역 안으로 제한한다', () => {
    const marker = slotMarker(playerSlot)!;
    const part = game.parts.find((p) => p.id === marker.partId)!;
    const region = findRegion(part, marker.regionId)!;
    const bounds = markerBounds(game, playerSlot)!;

    expect(bounds.minXMm).toBeGreaterThanOrEqual(region.rect.xMm);
    expect(bounds.maxXMm).toBeLessThanOrEqual(
      region.rect.xMm + region.rect.widthMm,
    );
    expect(bounds.minYMm).toBeGreaterThanOrEqual(region.rect.yMm);
    expect(bounds.maxYMm).toBeLessThanOrEqual(
      region.rect.yMm + region.rect.heightMm,
    );
  });

  it('마커가 파트 밖으로 비어져 나가지 않는다 — 인쇄물에서 반쪽이 된다', () => {
    const marker = slotMarker(playerSlot)!;
    const part = game.parts.find((p) => p.id === marker.partId)!;
    const styleSet = game.styleSets.find((s) => s.id === marker.styleSetId)!;
    const halfWidthMm =
      Math.max(...styleSet.variants.map((v) => v.widthMm)) / 2;
    const halfHeightMm =
      Math.max(...styleSet.variants.map((v) => v.heightMm)) / 2;
    const bounds = markerBounds(game, playerSlot)!;

    expect(bounds.minXMm).toBeGreaterThanOrEqual(halfWidthMm);
    expect(bounds.maxXMm).toBeLessThanOrEqual(part.widthMm - halfWidthMm);
    expect(bounds.minYMm).toBeGreaterThanOrEqual(halfHeightMm);
    expect(bounds.maxYMm).toBeLessThanOrEqual(part.heightMm - halfHeightMm);
  });
});

describe('clampToBounds', () => {
  const bounds = { minXMm: 10, maxXMm: 100, minYMm: 20, maxYMm: 80 };

  it('범위 안이면 그대로 둔다', () => {
    expect(clampToBounds(bounds, { xMm: 50, yMm: 50 })).toEqual({
      xMm: 50,
      yMm: 50,
    });
  });

  it('범위 밖은 경계에 붙인다', () => {
    expect(clampToBounds(bounds, { xMm: -999, yMm: 999 })).toEqual({
      xMm: 10,
      yMm: 80,
    });
  });

  it('범위가 뒤집혀도 값이 NaN이 되지 않는다', () => {
    const impossible = { minXMm: 60, maxXMm: 40, minYMm: 60, maxYMm: 40 };
    expect(clampToBounds(impossible, { xMm: 0, yMm: 0 })).toEqual({
      xMm: 50,
      yMm: 50,
    });
  });
});

describe('movedPoint', () => {
  it('0.1mm 단위로 정리한다 — 저장값이 지저분해지지 않게', () => {
    expect(movedPoint(game, playerSlot, { xMm: 100.04, yMm: 100.06 })).toEqual({
      xMm: 100,
      yMm: 100.1,
    });
  });

  it('어디로 끌든 저장 검증을 통과하는 좌표만 낸다', () => {
    const base = defaultCustomization(game);
    for (const point of [
      { xMm: -1000, yMm: -1000 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 0, yMm: 0 },
      { xMm: 148.5, yMm: 105 },
    ]) {
      const moved = movedPoint(game, playerSlot, point);
      const customization = {
        ...base,
        positions: { ...base.positions, [playerSlot.id]: moved },
      };
      expect(
        validateCustomization(game, customization),
        `(${point.xMm}, ${point.yMm})에서 끌었을 때`,
      ).toEqual([]);
    }
  });
});

/**
 * 땅·바다 격자 (IDE-015 · IDE-016)
 *
 * 칸 번호 원을 **바다에 앉히기** 위한 판별표다. 원이 도시의 실제 위치 위에
 * 앉으면 아이가 배워야 할 자리를 가린다(2026-09-08 사용자 지적 — "숫자는
 * 가능한 지도 밖이나 위치와 관계 없는 곳으로"). 지도 밖은 없으므로(지도가 종이
 * 폭을 다 쓴다) 가장 가까운 빈 바다가 그 자리다.
 *
 * 지도 상자를 1mm 칸으로 나누고, 투영·분할이 끝난 땅 폴리곤을 주사선으로
 * 채운다. 한 폴리곤의 고리(바깥 + 구멍)를 한꺼번에 짝수·홀수 규칙으로 채우면
 * 구멍(카스피해)이 바다로 남는다. 상자 밖은 땅으로 친다 — 원이 지도 밖으로
 * 나가면 안 된다.
 */
import { ringToMapPolygons, type LonLat, type MapBox } from '../projection.ts';
import landData from './land.json' with { type: 'json' };

type Ring = readonly LonLat[];
const LAND = landData.polygons as unknown as ReadonlyArray<ReadonlyArray<Ring>>;

export interface LandMask {
  readonly box: MapBox;
  /** (x, y)가 땅인가. 상자 밖은 땅이다. */
  isLand(xMm: number, yMm: number): boolean;
  /** 중심 (x, y)·반지름 r인 원판이 전부 바다인가. */
  isOpenSea(xMm: number, yMm: number, radiusMm: number): boolean;
}

const CELL_MM = 1;

/** 지도 상자마다 한 번 만든다. 종이 크기(A4·A3·A2)별로 캐시된다. */
const cache = new Map<string, LandMask>();

export const landMaskFor = (box: MapBox): LandMask => {
  const key = `${box.xMm},${box.yMm},${box.widthMm},${box.heightMm}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const mask = buildLandMask(box);
  cache.set(key, mask);
  return mask;
};

const buildLandMask = (box: MapBox): LandMask => {
  const cols = Math.ceil(box.widthMm / CELL_MM);
  const rows = Math.ceil(box.heightMm / CELL_MM);
  const cells = new Uint8Array(cols * rows);

  for (const rings of LAND) {
    const pieces = rings.flatMap((ring) => ringToMapPolygons(ring, box));
    if (pieces.length === 0) continue;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const piece of pieces) {
      for (const [, y] of piece) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const rowFrom = Math.max(0, Math.floor((minY - box.yMm) / CELL_MM));
    const rowTo = Math.min(rows - 1, Math.ceil((maxY - box.yMm) / CELL_MM));
    for (let row = rowFrom; row <= rowTo; row += 1) {
      const scanY = box.yMm + (row + 0.5) * CELL_MM;
      const crossings: number[] = [];
      for (const piece of pieces) {
        for (let i = 0; i < piece.length; i += 1) {
          const [x1, y1] = piece[i];
          const [x2, y2] = piece[(i + 1) % piece.length];
          if (y1 === y2) continue;
          if ((scanY >= y1 && scanY < y2) || (scanY >= y2 && scanY < y1)) {
            crossings.push(x1 + ((scanY - y1) * (x2 - x1)) / (y2 - y1));
          }
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const colFrom = Math.max(
          0,
          Math.round((crossings[i] - box.xMm) / CELL_MM),
        );
        const colTo = Math.min(
          cols - 1,
          Math.round((crossings[i + 1] - box.xMm) / CELL_MM) - 1,
        );
        for (let col = colFrom; col <= colTo; col += 1) {
          cells[row * cols + col] = 1;
        }
      }
    }
  }

  const isLand = (xMm: number, yMm: number): boolean => {
    const col = Math.floor((xMm - box.xMm) / CELL_MM);
    const row = Math.floor((yMm - box.yMm) / CELL_MM);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return true;
    return cells[row * cols + col] === 1;
  };

  const isOpenSea = (xMm: number, yMm: number, radiusMm: number): boolean => {
    const r = Math.ceil(radiusMm / CELL_MM);
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        if (isLand(xMm + dx * CELL_MM, yMm + dy * CELL_MM)) return false;
      }
    }
    return true;
  };

  return { box, isLand, isOpenSea };
};

const offsetCache = new Map<
  number,
  ReadonlyArray<readonly [number, number, number]>
>();

/**
 * 반지름 안의 격자 오프셋(1mm 격자)을 거리순으로. 같은 거리는 y, x 순이다 —
 * 결과가 결정적이어야 한다. 칸 자리 탐색(`layout.ts`)이 쓴다.
 */
export const searchOffsets = (
  maxDistanceMm: number,
): ReadonlyArray<readonly [number, number, number]> => {
  const cached = offsetCache.get(maxDistanceMm);
  if (cached) return cached;
  const r = Math.ceil(maxDistanceMm / CELL_MM);
  const list: Array<readonly [number, number, number]> = [];
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const d = Math.hypot(dx, dy) * CELL_MM;
      if (d <= maxDistanceMm) list.push([dx * CELL_MM, dy * CELL_MM, d]);
    }
  }
  list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  offsetCache.set(maxDistanceMm, list);
  return list;
};

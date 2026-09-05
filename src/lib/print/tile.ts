/**
 * A4 타일 분할 계산 (IDE-007)
 *
 * 규격은 `docs/print-spec.md` §5. 스파이크(`spikes/print-pipeline/lib/tile.mjs`)의
 * 계산을 그대로 옮기고 타입과 테스트를 붙였다.
 */
import {
  A4,
  DEFAULT_OVERLAP_MM,
  DEFAULT_PRINTER_MARGIN_MM,
  round3,
  STAMP_BAND_MM,
} from './geometry';

export type PageOrientation = 'portrait' | 'landscape';
export type OrientationChoice = PageOrientation | 'auto';

export interface Tile {
  /** 1부터 시작하는 장 번호. 행 우선(왼쪽→오른쪽, 위→아래)이다. */
  readonly index: number;
  readonly row: number;
  readonly col: number;
  /** 이 장이 담는 도안 영역(배율 적용 후 mm, 파트 좌상단 기준). */
  readonly srcXMm: number;
  readonly srcYMm: number;
  readonly srcWMm: number;
  readonly srcHMm: number;
  /** 용지 위 도안 영역의 좌상단 — 가운데 정렬한 자리. */
  readonly dstXMm: number;
  readonly dstYMm: number;
}

export interface TilePlan {
  readonly orientation: PageOrientation;
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
  /** 인쇄 가능 영역. */
  readonly liveWidthMm: number;
  readonly liveHeightMm: number;
  readonly cols: number;
  readonly rows: number;
  /** 한 장이 담는 도안 크기 — 겹침을 포함한다. */
  readonly tileWidthMm: number;
  readonly tileHeightMm: number;
  /** 실제 겹침. 그 축이 한 장뿐이면 0이다. */
  readonly overlapXMm: number;
  readonly overlapYMm: number;
  readonly marginMm: number;
  /**
   * 장 번호·인쇄 안내를 위해 아래쪽에 실제로 떼어 낸 띠.
   *
   * 희망 폭(`STAMP_BAND_MM`)과 도안을 놓고 남은 여유 중 **작은 쪽**이다.
   * 여유가 없으면 0이 되고, 그때는 표식을 그리지 않는다 — 종이를 한 장 더
   * 쓰는 것보다 표식을 포기하는 편이 낫다.
   */
  readonly stampBandMm: number;
  /** 배율을 적용한 파트 크기. */
  readonly partWidthMm: number;
  readonly partHeightMm: number;
  readonly tiles: readonly Tile[];
  readonly total: number;
}

export interface PlanTilesInput {
  /** 배율을 **이미 적용한** 파트 크기다. */
  readonly partWidthMm: number;
  readonly partHeightMm: number;
  readonly marginMm?: number;
  readonly overlapMm?: number;
  readonly orientation?: OrientationChoice;
  /** 하단 표식 띠의 희망 폭. 남는 여유가 없으면 그만큼만 떼어 낸다. */
  readonly stampBandMm?: number;
}

const CANDIDATES: Record<PageOrientation, { w: number; h: number }> = {
  portrait: { w: A4.widthMm, h: A4.heightMm },
  landscape: { w: A4.heightMm, h: A4.widthMm },
};

/**
 * 한 축을 몇 장으로 나눠야 하는가.
 *
 * `c ≤ P`(장당 도안 길이 ≤ 인쇄 가능 길이)를 만족하는 최소 n은
 * `n = ceil((L - V) / (P - V))`다.
 */
/**
 * 계획이 만들 수 있는 최대 장수.
 *
 * 배율 칸에 숫자를 잘못 넣으면(자릿수 하나만 더 붙어도) 수백만 장짜리 계획이
 * 나와 메모리가 터진다. 실제로 UI에서 그렇게 터진 적이 있다 — 값을 검사하는
 * 쪽만 고치면 다음에 부르는 곳에서 같은 일이 반복되므로 계산 자체가 막는다.
 * 내보내기 상한(`MAX_PAGES`)보다 넉넉히 잡아, 상한 초과는 계산이 아니라
 * 검증 메시지로 알려지게 둔다.
 */
export const MAX_TILES = 5000;

export const countTiles = (
  totalMm: number,
  liveMm: number,
  overlapMm: number,
): number =>
  totalMm <= liveMm
    ? 1
    : Math.max(1, Math.ceil((totalMm - overlapMm) / (liveMm - overlapMm)));

/**
 * 장당 도안 길이 — **겹침을 뺀 나머지를 균등 분배**한다.
 *
 * 마지막 장에 남는 만큼 몰아주면 겹침이 장마다 달라져 붙이는 사람이 헷갈리고,
 * 어떤 장은 겹침이 100mm 가까이 나와 종이를 버린다(IDE-002 결정 기록).
 */
export const contentPerTile = (
  totalMm: number,
  count: number,
  overlapMm: number,
): number =>
  count === 1 ? totalMm : (totalMm + (count - 1) * overlapMm) / count;

/** 파트 하나를 A4 여러 장으로 쪼갠다. */
export function planTiles({
  partWidthMm,
  partHeightMm,
  marginMm = DEFAULT_PRINTER_MARGIN_MM,
  overlapMm = DEFAULT_OVERLAP_MM,
  orientation = 'auto',
  stampBandMm = STAMP_BAND_MM,
}: PlanTilesInput): TilePlan {
  if (!(partWidthMm > 0) || !(partHeightMm > 0)) {
    throw new Error('파트 크기가 0보다 커야 한다');
  }

  const names: PageOrientation[] =
    orientation === 'auto' ? ['portrait', 'landscape'] : [orientation];

  let best: TilePlan | null = null;
  for (const name of names) {
    const { w: pageWidthMm, h: pageHeightMm } = CANDIDATES[name];
    // 띠는 장수 계산에 끼어들지 않는다 — `docs/print-spec.md` §5의 배율별
    // 장수 표가 그대로 유지되어야 한다.
    const liveWidthMm = pageWidthMm - 2 * marginMm;
    const liveHeightMm = pageHeightMm - 2 * marginMm;
    // 겹침이 인쇄 가능 영역보다 넓으면 장수가 수렴하지 않는다.
    if (liveWidthMm <= overlapMm || liveHeightMm <= overlapMm) continue;

    const cols = countTiles(partWidthMm, liveWidthMm, overlapMm);
    const rows = countTiles(partHeightMm, liveHeightMm, overlapMm);
    const tileWidthMm = contentPerTile(partWidthMm, cols, overlapMm);
    const tileHeightMm = contentPerTile(partHeightMm, rows, overlapMm);
    const plan: TilePlan = {
      orientation: name,
      pageWidthMm,
      pageHeightMm,
      liveWidthMm,
      liveHeightMm,
      cols,
      rows,
      tileWidthMm,
      tileHeightMm,
      overlapXMm: cols > 1 ? overlapMm : 0,
      overlapYMm: rows > 1 ? overlapMm : 0,
      marginMm,
      // 도안을 놓고 남은 세로 여유에서만 띠를 가져간다.
      stampBandMm: Math.min(stampBandMm, liveHeightMm - tileHeightMm),
      partWidthMm,
      partHeightMm,
      tiles: [],
      total: cols * rows,
    };
    // 장수가 적은 쪽, 같으면 종이를 덜 쓰는 쪽(§5 '용지 방향').
    if (
      !best ||
      plan.total < best.total ||
      (plan.total === best.total && paperUsed(plan) < paperUsed(best))
    ) {
      best = plan;
    }
  }
  if (!best) {
    throw new Error(
      `타일 계산 실패 — 여백 ${marginMm}mm·겹침 ${overlapMm}mm면 A4에 남는 자리가 없다`,
    );
  }

  if (best.total > MAX_TILES) {
    throw new Error(
      `타일이 너무 많다 — ${best.total}장(최대 ${MAX_TILES}장). 배율을 낮춘다`,
    );
  }

  const stepX = best.tileWidthMm - best.overlapXMm;
  const stepY = best.tileHeightMm - best.overlapYMm;
  const dstXMm = round3((best.pageWidthMm - best.tileWidthMm) / 2);
  // 세로는 인쇄 가능 영역에서 띠를 뺀 나머지의 가운데다 — 아래쪽에 늘 띠만큼의
  // 자리가 남아 표식이 도안을 덮지 않는다.
  const slackYMm = best.liveHeightMm - best.tileHeightMm;
  const dstYMm = round3(best.marginMm + (slackYMm - best.stampBandMm) / 2);

  const tiles: Tile[] = [];
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      tiles.push({
        index: r * best.cols + c + 1,
        row: r + 1,
        col: c + 1,
        srcXMm: round3(c * stepX),
        srcYMm: round3(r * stepY),
        srcWMm: round3(best.tileWidthMm),
        srcHMm: round3(best.tileHeightMm),
        dstXMm,
        dstYMm,
      });
    }
  }
  return { ...best, tiles, total: tiles.length };
}

const paperUsed = (plan: TilePlan): number =>
  plan.total * plan.pageWidthMm * plan.pageHeightMm;

/** 배율 UI가 "A4 몇 장"을 실시간으로 보여줄 때 쓰는 지름길. */
export const pageCount = (input: PlanTilesInput): number =>
  planTiles(input).total;

// A4 타일 분할 계산 (IDE-002 — 타일 분할 규격)
import { A4, DEFAULT_OVERLAP, DEFAULT_PRINTER_MARGIN } from './geometry.mjs';

/**
 * 파트(mm) 하나를 A4 여러 장으로 쪼갠다.
 *
 * 한 축을 n장으로 나눌 때 장당 도안 길이 c는 `c = (L + (n-1)V) / n`이다
 * (L=파트 길이, V=겹침). 즉 **겹침을 뺀 나머지를 균등 분배**한다. 마지막 장만
 * 남는 만큼 가져가게 하면 겹침이 장마다 달라져 붙이는 사람이 헷갈리고,
 * 어떤 장은 겹침이 100mm 가까이 나와 종이를 낭비한다.
 *
 * c ≤ P(인쇄 가능 길이)를 만족하는 최소 n은 `n = ceil((L - V) / (P - V))`.
 * 도안은 용지 가운데에 놓아 네 변 여백이 고르게 남는다.
 */
export function planTiles({
  partW,
  partH,
  margin = DEFAULT_PRINTER_MARGIN,
  overlap = DEFAULT_OVERLAP,
  orientation = 'auto', // 'portrait' | 'landscape' | 'auto'
}) {
  const candidates =
    orientation === 'auto'
      ? [
          { name: 'portrait', pageW: A4.w, pageH: A4.h },
          { name: 'landscape', pageW: A4.h, pageH: A4.w },
        ]
      : orientation === 'portrait'
        ? [{ name: 'portrait', pageW: A4.w, pageH: A4.h }]
        : [{ name: 'landscape', pageW: A4.h, pageH: A4.w }];

  let best = null;
  for (const c of candidates) {
    const liveW = c.pageW - 2 * margin;
    const liveH = c.pageH - 2 * margin;
    if (liveW <= overlap || liveH <= overlap) continue;
    const cols = countTiles(partW, liveW, overlap);
    const rows = countTiles(partH, liveH, overlap);
    const tileW = contentPerTile(partW, cols, overlap);
    const tileH = contentPerTile(partH, rows, overlap);
    const plan = {
      ...c,
      liveW,
      liveH,
      cols,
      rows,
      tileW,
      tileH,
      pages: cols * rows,
      margin,
      overlap,
      // 실제 겹침 — 한 장뿐이면 겹침이 없다
      overlapX: cols > 1 ? overlap : 0,
      overlapY: rows > 1 ? overlap : 0,
    };
    // 장수가 적은 쪽, 같으면 종이를 덜 쓰는 쪽
    if (
      !best ||
      plan.pages < best.pages ||
      (plan.pages === best.pages && paperUsed(plan) < paperUsed(best))
    ) {
      best = plan;
    }
  }
  if (!best) throw new Error('타일 계산 실패 — 여백이 용지보다 큽니다');

  const stepX = best.tileW - best.overlapX;
  const stepY = best.tileH - best.overlapY;
  const tiles = [];
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      tiles.push({
        index: r * best.cols + c + 1,
        row: r + 1,
        col: c + 1,
        srcX: c * stepX,
        srcY: r * stepY,
        srcW: best.tileW,
        srcH: best.tileH,
        // 용지 위 도안 영역 — 가운데 정렬
        dstX: (best.pageW - best.tileW) / 2,
        dstY: (best.pageH - best.tileH) / 2,
      });
    }
  }
  return { ...best, partW, partH, tiles, total: tiles.length };
}

function countTiles(total, live, overlap) {
  if (total <= live) return 1;
  return Math.max(1, Math.ceil((total - overlap) / (live - overlap)));
}

function contentPerTile(total, n, overlap) {
  return n === 1 ? total : (total + (n - 1) * overlap) / n;
}

function paperUsed(plan) {
  return plan.pages * plan.pageW * plan.pageH;
}

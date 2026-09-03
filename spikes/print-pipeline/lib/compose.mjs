// 도안 + 배율 + 타일 계획 -> "시트" 목록. 렌더러는 시트만 받아 그린다.
import { A4 } from './geometry.mjs';
import { planTiles } from './tile.mjs';
import { tileMarks } from './marks.mjs';
import { expand } from './expand.mjs';

/** 타일 분할 없이 파트 크기 그대로 한 페이지 — 기하 검증용(디지털 실측). */
export function composeSingle(pattern, scale) {
  const s = pattern.noScale ? 1 : scale;
  return {
    label: `${pattern.name}-single-${pct(s)}`,
    scale: s,
    pages: [
      {
        pageW: round(pattern.w * s),
        pageH: round(pattern.h * s),
        clip: null,
        transform: { tx: 0, ty: 0, scale: s },
        content: expand(pattern.items),
        marks: [],
      },
    ],
  };
}

/** A4 타일 분할 — 실제 인쇄용. */
export function composeTiled(pattern, scale, opts = {}) {
  const s = pattern.noScale ? 1 : scale;
  const partW = pattern.w * s;
  const partH = pattern.h * s;
  const plan = planTiles({ partW, partH, ...opts });
  const pageW = plan.pageW;
  const pageH = plan.pageH;
  const content = expand(pattern.items);
  const pages = plan.tiles.map((tile) => ({
    pageW,
    pageH,
    clip: { x: tile.dstX, y: tile.dstY, w: tile.srcW, h: tile.srcH },
    transform: {
      tx: tile.dstX - tile.srcX,
      ty: tile.dstY - tile.srcY,
      scale: s,
    },
    content,
    marks: expand(
      tileMarks({
        plan,
        tile,
        pageH,
        scaleLabel: `배율 ${pct(s)}`,
        partLabel:
          pattern.name === 'board'
            ? '보드'
            : pattern.name === 'accessory'
              ? '부속'
              : pattern.name,
      }),
    ),
  }));
  return {
    label: `${pattern.name}-tiled-${pct(s)}`,
    scale: s,
    plan,
    pages,
    a4: A4,
  };
}

const pct = (s) => `${Math.round(s * 1000) / 10}%`;
const round = (v) => Math.round(v * 1000) / 1000;

// PDF -> 그레이스케일 래스터 -> 실측. Ghostscript로 렌더하고 PGM(P5)을 직접 읽는다.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pxToMm, mmToPx } from './geometry.mjs';

/** PDF 각 페이지를 dpi로 렌더해 { w, h, data, dpi } 배열로 준다. */
export function rasterizePdf(pdfPath, dpi = 600) {
  const dir = mkdtempSync(join(tmpdir(), 'pc-ras-'));
  try {
    execFileSync(
      'gs',
      [
        '-q',
        '-dNOPAUSE',
        '-dBATCH',
        '-dSAFER',
        '-sDEVICE=pgmraw',
        `-r${dpi}`,
        '-dTextAlphaBits=4',
        '-dGraphicsAlphaBits=4',
        `-sOutputFile=${join(dir, 'p%03d.pgm')}`,
        pdfPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const pages = [];
    for (let i = 1; i < 200; i++) {
      const f = join(dir, `p${String(i).padStart(3, '0')}.pgm`);
      try {
        pages.push({ ...parsePgm(readFileSync(f)), dpi });
      } catch {
        break;
      }
    }
    return pages;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function parsePgm(buf) {
  let p = 0;
  const tok = () => {
    for (;;) {
      while (p < buf.length && /\s/.test(String.fromCharCode(buf[p]))) p++;
      if (buf[p] === 0x23) {
        while (buf[p] !== 0x0a) p++;
        continue;
      }
      break;
    }
    const s = p;
    while (p < buf.length && !/\s/.test(String.fromCharCode(buf[p]))) p++;
    return buf.toString('latin1', s, p);
  };
  const magic = tok();
  if (magic !== 'P5') throw new Error(`PGM 아님: ${magic}`);
  const w = +tok(),
    h = +tok();
  tok(); // maxval
  p++; // 헤더 뒤 공백 1바이트
  return { w, h, off: p, data: buf };
}

export const at = (img, x, y) => img.data[img.off + y * img.w + x];

/**
 * (cx, cy) mm 주변 radius mm 창에서 잉크 무게중심을 mm로 돌려준다.
 * 잉크가 없으면 null(= 인쇄 불가 여백에 걸려 안 찍힌 경우).
 */
export function inkCentroidMm(img, cxMm, cyMm, radiusMm = 3, threshold = 128) {
  const r = mmToPx(radiusMm, img.dpi);
  const cx = mmToPx(cxMm, img.dpi);
  const cy = mmToPx(cyMm, img.dpi);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(img.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(img.h - 1, Math.ceil(cy + r));
  let sw = 0,
    sx = 0,
    sy = 0,
    n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const v = at(img, x, y);
      if (v < threshold) {
        const wgt = (threshold - v) / threshold;
        sw += wgt;
        sx += (x + 0.5) * wgt;
        sy += (y + 0.5) * wgt;
        n++;
      }
    }
  }
  if (n === 0 || sw === 0) return null;
  return {
    x: pxToMm(sx / sw, img.dpi),
    y: pxToMm(sy / sw, img.dpi),
    pixels: n,
  };
}

/**
 * 두 이미지의 지정 영역이 같은 내용인지, 최적 정합 이동량(mm)을 찾는다.
 * 0에 가까울수록 두 타일이 정확히 이어진다.
 */
export function bestAlignment(
  imgA,
  boxA,
  imgB,
  boxB,
  searchMm = 2,
  stepPx = 1,
) {
  const dpi = imgA.dpi;
  const w = Math.floor(mmToPx(Math.min(boxA.w, boxB.w), dpi));
  const h = Math.floor(mmToPx(Math.min(boxA.h, boxB.h), dpi));
  const ax = Math.round(mmToPx(boxA.x, dpi));
  const ay = Math.round(mmToPx(boxA.y, dpi));
  const bx = Math.round(mmToPx(boxB.x, dpi));
  const by = Math.round(mmToPx(boxB.y, dpi));
  const s = Math.round(mmToPx(searchMm, dpi));
  let best = null;
  for (let dy = -s; dy <= s; dy += stepPx) {
    for (let dx = -s; dx <= s; dx += stepPx) {
      let diff = 0,
        cnt = 0;
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
          const pa = px(imgA, ax + x, ay + y);
          const pb = px(imgB, bx + x + dx, by + y + dy);
          if (pa == null || pb == null) continue;
          diff += Math.abs(pa - pb);
          cnt++;
        }
      }
      if (!cnt) continue;
      const score = diff / cnt;
      if (!best || score < best.score) best = { score, dx, dy };
    }
  }
  if (!best) return null;
  return { ...best, dxMm: pxToMm(best.dx, dpi), dyMm: pxToMm(best.dy, dpi) };
}

const px = (img, x, y) =>
  x < 0 || y < 0 || x >= img.w || y >= img.h ? null : at(img, x, y);

/** 잉크 경계 상자(mm) — 페이지 안에서 도안이 실제로 차지한 범위 */
export function inkBoundsMm(img, threshold = 200) {
  let minX = img.w,
    minY = img.h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (at(img, x, y) < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    x: pxToMm(minX, img.dpi),
    y: pxToMm(minY, img.dpi),
    w: pxToMm(maxX - minX + 1, img.dpi),
    h: pxToMm(maxY - minY + 1, img.dpi),
  };
}

// 후보 ② 뒷단 — 코드가 직접 만드는 벡터 PDF. MediaBox를 mm에서 pt로 정확히 잡는다.
import { readFileSync } from 'node:fs';
import {
  PDFDocument,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { mmToPt } from './geometry.mjs';

const BLACK = rgb(0, 0, 0);

/**
 * 글자를 폰트로 넣지 않고 벡터 윤곽선(패스)으로 그린다.
 * pdf-lib의 한글 CID 임베딩이 뷰어마다 깨지는 문제를 우회하는 경로다.
 */
export function createOutliner(fontPath) {
  const font = fontkit.create(readFileSync(fontPath));
  const upem = font.unitsPerEm;
  return {
    name: font.postscriptName,
    widthMm: (text, sizeMm) => (font.layout(text).advanceWidth * sizeMm) / upem,
    /** 좌상단 원점·y 아래 기준 pt 좌표로 된 SVG path 문자열 */
    svgPathPt(text, sizeMm, xMm, yMm) {
      const run = font.layout(text);
      const k = mmToPt(sizeMm) / upem;
      const baseX = mmToPt(xMm);
      const baseY = mmToPt(yMm);
      let cursor = 0;
      const parts = [];
      run.glyphs.forEach((g, i) => {
        const pos = run.positions[i];
        const tx = baseX + (cursor + (pos.xOffset ?? 0)) * k;
        const ty = baseY - (pos.yOffset ?? 0) * k;
        const d = g.path.transform(k, 0, 0, -k, tx, ty).toSVG();
        if (d) parts.push(d);
        cursor += pos.xAdvance;
      });
      return parts.join(' ');
    },
  };
}

/** 종이 좌상단 원점(mm, y 아래) -> PDF 좌하단 원점(pt, y 위) */
const mk = (pageH) => ({
  X: (mm) => mmToPt(mm),
  Y: (mm) => mmToPt(pageH - mm),
});

export async function renderSheetPdf(
  sheet,
  { fontPath, subset = true, textMode = 'outline' } = {},
) {
  const doc = await PDFDocument.create();
  doc.setTitle(sheet.label);
  doc.setProducer('papercraft print spike (IDE-002)');
  let font = null;
  let outliner = null;
  if (textMode === 'outline') {
    outliner = createOutliner(fontPath);
  } else {
    doc.registerFontkit(fontkit);
    font = await doc.embedFont(readFileSync(fontPath), { subset });
  }

  for (const page of sheet.pages) {
    const p = doc.addPage([mmToPt(page.pageW), mmToPt(page.pageH)]);
    const { X, Y } = mk(page.pageH);
    const { tx, ty, scale } = page.transform;
    const T = (x, y) => [tx + scale * x, ty + scale * y]; // design mm -> page mm

    if (page.clip) {
      p.pushOperators(
        pushGraphicsState(),
        rectangle(
          X(page.clip.x),
          Y(page.clip.y + page.clip.h),
          mmToPt(page.clip.w),
          mmToPt(page.clip.h),
        ),
        clip(),
        endPath(),
      );
    }
    for (const it of page.content) draw(p, it, T, scale, X, Y, font, outliner);
    if (page.clip) p.pushOperators(popGraphicsState());
    for (const it of page.marks)
      draw(p, it, (x, y) => [x, y], 1, X, Y, font, outliner);
  }
  return doc.save({ useObjectStreams: true });
}

function draw(p, it, T, scale, X, Y, font, outliner) {
  const sw = (it.strokeMm ?? 0.2) * scale;
  const dash = it.dash ? it.dash.map((d) => mmToPt(d * scale)) : undefined;
  const strokeOpts = {
    thickness: mmToPt(sw),
    color: BLACK,
    ...(dash ? { dashArray: dash } : {}),
  };
  switch (it.kind) {
    case 'line': {
      const [x1, y1] = T(it.x1, it.y1);
      const [x2, y2] = T(it.x2, it.y2);
      p.drawLine({
        start: { x: X(x1), y: Y(y1) },
        end: { x: X(x2), y: Y(y2) },
        ...strokeOpts,
      });
      break;
    }
    case 'rect': {
      const [x, y] = T(it.x, it.y);
      const filled = it.fill && it.fill !== 'none';
      const stroked = (it.strokeMm ?? 0) > 0;
      p.drawRectangle({
        x: X(x),
        y: Y(y + it.h * scale),
        width: mmToPt(it.w * scale),
        height: mmToPt(it.h * scale),
        color: filled ? BLACK : undefined,
        borderWidth: stroked ? mmToPt(sw) : 0,
        ...(stroked ? { borderColor: BLACK } : {}),
        ...(stroked && dash ? { borderDashArray: dash } : {}),
      });
      break;
    }
    case 'circle': {
      const [cx, cy] = T(it.cx, it.cy);
      const filled = it.fill && it.fill !== 'none';
      const stroked = (it.strokeMm ?? 0) > 0;
      p.drawCircle({
        x: X(cx),
        y: Y(cy),
        size: mmToPt(it.r * scale),
        color: filled ? BLACK : undefined,
        borderWidth: stroked ? mmToPt(sw) : 0,
        ...(stroked ? { borderColor: BLACK } : {}),
      });
      break;
    }
    case 'poly': {
      // drawSvgPath는 경로를 SVG 좌표(y 아래)로 받고 (x, y)에 그 원점을 놓는다.
      // 원점을 페이지 좌상단에 두면 우리 좌표계와 일치한다.
      const pts = it.pts.map(([x, y]) => T(x, y));
      const svgPath = `M ${pts.map(([x, y]) => `${mmToPt(x)},${mmToPt(y)}`).join(' L ')} Z`;
      p.drawSvgPath(svgPath, {
        x: 0,
        y: p.getSize().height,
        color: BLACK,
        borderWidth: 0,
        scale: 1,
      });
      break;
    }
    case 'text': {
      const sizeMm = (it.sizeMm ?? 3) * scale;
      const [x, y] = T(it.x, it.y);
      if (outliner) {
        const w = outliner.widthMm(it.text, sizeMm);
        const dx =
          it.anchor === 'middle' ? -w / 2 : it.anchor === 'end' ? -w : 0;
        const d = outliner.svgPathPt(it.text, sizeMm, x + dx, y);
        if (d)
          p.drawSvgPath(d, {
            x: 0,
            y: p.getSize().height,
            color: BLACK,
            borderWidth: 0,
            scale: 1,
          });
      } else {
        const size = mmToPt(sizeMm);
        const w = font.widthOfTextAtSize(it.text, size);
        const dx =
          it.anchor === 'middle' ? -w / 2 : it.anchor === 'end' ? -w : 0;
        p.drawText(it.text, {
          x: X(x) + dx,
          y: Y(y),
          size,
          font,
          color: BLACK,
        });
      }
      break;
    }
  }
}

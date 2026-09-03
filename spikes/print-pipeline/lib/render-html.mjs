// 후보 ① — CSS @page + 브라우저 인쇄.
// 도형은 SVG로 그리되(브라우저 인쇄가 SVG를 벡터로 보낸다) 페이지 크기·여백은
// 순수 CSS @page로 지정한다. 즉 "치수를 CSS에 맡기는" 경로를 그대로 시험한다.
import { pageSvgDocument } from './render-svg.mjs';

export function sheetToPrintHtml(sheet, { title }) {
  const first = sheet.pages[0];
  const pages = sheet.pages
    .map((p, i) => {
      const svg = pageSvgDocument(p, { id: `p${i}` }).replace(
        /^<svg /,
        `<svg style="display:block;width:${p.pageW}mm;height:${p.pageH}mm" `,
      );
      return `<section class="sheet">${svg}</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: ${first.pageW}mm ${first.pageH}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .sheet { width: ${first.pageW}mm; height: ${first.pageH}mm; overflow: hidden;
           page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  @media screen { body { background:#888; } .sheet { background:#fff; margin: 8px auto; box-shadow: 0 0 6px #0006; } }
</style></head><body>
${pages}
</body></html>`;
}

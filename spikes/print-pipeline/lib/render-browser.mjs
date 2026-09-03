// 후보 ②-a (jsPDF + svg2pdf.js, 브라우저 벡터) 와 후보 ③ (Canvas 래스터 -> PDF 임베드)
// 를 돌리기 위한 HTML. 헤드리스 Chrome 안에서 실행하고 base64 PDF를 돌려받는다.
import { pageSvgDocument } from './render-svg.mjs';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

/** 후보 ②-a — 같은 SVG를 svg2pdf.js로 벡터 PDF로 변환 */
export function svg2pdfHtml(sheet, { fontBase64, fontName = 'NotoSansKR' }) {
  const svgs = sheet.pages.map((p, i) => pageSvgDocument(p, { id: `p${i}` }));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<script src="./vendor/jspdf.umd.min.js"></script>
<script src="./vendor/svg2pdf.umd.min.js"></script>
</head><body>
<div id="host" style="position:absolute;left:-99999px;top:0"></div>
<script>
window.PAGES = ${JSON.stringify(svgs.map(b64))};
window.FONT = ${fontBase64 ? `"${fontName}"` : 'null'};
window.makePdf = async function () {
  const { jsPDF } = window.jspdf;
  const first = ${JSON.stringify({ w: sheet.pages[0].pageW, h: sheet.pages[0].pageH })};
  const doc = new jsPDF({ unit: 'mm', format: [first.w, first.h], orientation: first.w > first.h ? 'landscape' : 'portrait', compress: true });
  ${
    fontBase64
      ? `doc.addFileToVFS('${fontName}.ttf', ${JSON.stringify(fontBase64)});
  doc.addFont('${fontName}.ttf', '${fontName}', 'normal');
  doc.setFont('${fontName}');`
      : ''
  }
  const host = document.getElementById('host');
  for (let i = 0; i < window.PAGES.length; i++) {
    if (i > 0) doc.addPage([first.w, first.h], first.w > first.h ? 'landscape' : 'portrait');
    host.innerHTML = decodeURIComponent(escape(atob(window.PAGES[i])));
    const el = host.querySelector('svg');
    const conv = window.svg2pdf.svg2pdf ?? window.svg2pdf;
    await conv(el, doc, { x: 0, y: 0, width: first.w, height: first.h });
  }
  const ab = doc.output('arraybuffer');
  let s = ''; const u8 = new Uint8Array(ab);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};
</script></body></html>`;
}

/** 후보 ③ — SVG를 Canvas에 래스터해서 PDF에 이미지로 넣는다 */
export function canvasPdfHtml(sheet, { dpi = 300 }) {
  const svgs = sheet.pages.map((p, i) => pageSvgDocument(p, { id: `p${i}` }));
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<script src="./vendor/jspdf.umd.min.js"></script>
</head><body><script>
window.PAGES = ${JSON.stringify(svgs.map(b64))};
window.DPI = ${dpi};
window.makePdf = async function () {
  const { jsPDF } = window.jspdf;
  const first = ${JSON.stringify({ w: sheet.pages[0].pageW, h: sheet.pages[0].pageH })};
  const doc = new jsPDF({ unit: 'mm', format: [first.w, first.h], orientation: first.w > first.h ? 'landscape' : 'portrait', compress: true });
  const pxW = Math.round(first.w / 25.4 * window.DPI);
  const pxH = Math.round(first.h / 25.4 * window.DPI);
  for (let i = 0; i < window.PAGES.length; i++) {
    if (i > 0) doc.addPage([first.w, first.h], first.w > first.h ? 'landscape' : 'portrait');
    const svgText = decodeURIComponent(escape(atob(window.PAGES[i])));
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    const img = new Image();
    img.width = pxW; img.height = pxH;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = pxW; cv.height = pxH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pxW, pxH);
    ctx.drawImage(img, 0, 0, pxW, pxH);
    URL.revokeObjectURL(url);
    doc.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, first.w, first.h, undefined, 'NONE');
  }
  const ab = doc.output('arraybuffer');
  let s = ''; const u8 = new Uint8Array(ab);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};
</script></body></html>`;
}

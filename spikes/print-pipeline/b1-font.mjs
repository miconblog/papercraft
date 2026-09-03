// 후보 ②-a(jsPDF)에서 한글을 내려면 얼마가 드는가 — 서브셋이 없다는 주장을 실측한다.
// `node spikes/print-pipeline/b1-font.mjs`
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boardTestPattern } from './lib/pattern.mjs';
import { composeSingle } from './lib/compose.mjs';
import { svg2pdfHtml } from './lib/render-browser.mjs';
import { launchChrome, openPage, evalToBuffer } from './lib/cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const TTF = join(HERE, 'assets/NotoSansKR-VF.ttf');
const fontBase64 = readFileSync(TTF).toString('base64');
console.log(
  `폰트 ${(statSync(TTF).size / 1024 / 1024).toFixed(1)} MB → base64 ${(fontBase64.length / 1024 / 1024).toFixed(1)} MB`,
);

const sheet = composeSingle(boardTestPattern(), 1);
const html = join(OUT, 'B1-board-single-100-withfont.html');
// SVG의 font-family와 jsPDF에 등록하는 이름을 맞춰야 svg2pdf가 그 폰트를 쓴다
writeFileSync(
  html,
  svg2pdfHtml(sheet, { fontBase64, fontName: 'Noto Sans KR' }),
);
console.log(`HTML ${(statSync(html).size / 1024 / 1024).toFixed(1)} MB`);

const chrome = await launchChrome();
try {
  const t0 = Date.now();
  const { session } = await openPage(chrome.port, pathToFileURL(html).href);
  const buf = await evalToBuffer(session, 'window.makePdf()', 240000);
  const out = join(OUT, 'B1-board-single-100-withfont.pdf');
  writeFileSync(out, buf);
  console.log(
    `PDF ${(buf.length / 1024 / 1024).toFixed(2)} MB · ${((Date.now() - t0) / 1000).toFixed(1)}초`,
  );
  session.close();
} catch (e) {
  console.log(`실패: ${String(e.message ?? e).split('\n')[0]}`);
} finally {
  chrome.close();
}

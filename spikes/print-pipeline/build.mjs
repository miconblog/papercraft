// 산출물 생성 — 후보 3안 × 도안 × 배율. `node spikes/print-pipeline/build.mjs`
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  boardTestPattern,
  accessoryTestPattern,
  printableAreaProbe,
} from './lib/pattern.mjs';
import { composeSingle, composeTiled } from './lib/compose.mjs';
import { sheetToPrintHtml } from './lib/render-html.mjs';
import { renderSheetPdf } from './lib/render-pdf.mjs';
import { svg2pdfHtml, canvasPdfHtml } from './lib/render-browser.mjs';
import {
  launchChrome,
  openPage,
  printToPdf,
  evalToBuffer,
} from './lib/cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const FONT_OTF = join(HERE, 'assets/NotoSansKR-Regular.otf');
mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => {
  console.log(s);
  log.push(s);
};
const save = (name, buf) => {
  writeFileSync(join(OUT, name), buf);
  note(`  ${name}  ${(statSync(join(OUT, name)).size / 1024).toFixed(1)} KB`);
  return name;
};

const board = boardTestPattern();
const accessory = accessoryTestPattern();
const probe = printableAreaProbe();

// 후보 하나만 다시 만들 때 — `node build.mjs b2` 처럼 접두어를 준다
const only = process.argv.slice(2).map((a) => a.toLowerCase());
const want = (id) => only.length === 0 || only.includes(id);

const chrome = await launchChrome();
note(`Chrome 디버깅 포트 ${chrome.port}`);

try {
  // ───────────── 후보 ② 뒷단: pdf-lib 직접 벡터 PDF ─────────────
  if (want('b2')) {
    note('\n[B2] pdf-lib 직접 벡터 PDF (글자는 벡터 윤곽선)');
    for (const scale of [0.5, 1, 2]) {
      save(
        `B2-board-single-${pct(scale)}.pdf`,
        await renderSheetPdf(composeSingle(board, scale), {
          fontPath: FONT_OTF,
        }),
      );
    }
    for (const scale of [1, 2]) {
      save(
        `B2-board-tiled-${pct(scale)}.pdf`,
        await renderSheetPdf(composeTiled(board, scale), {
          fontPath: FONT_OTF,
        }),
      );
    }
    save(
      'B2-accessory-tiled-100.pdf',
      await renderSheetPdf(composeTiled(accessory, 1), { fontPath: FONT_OTF }),
    );
    save(
      'B2-probe-printable-area.pdf',
      await renderSheetPdf(composeSingle(probe, 1), { fontPath: FONT_OTF }),
    );
    // 대조군 — 같은 도안을 한글 폰트 임베딩(CID) 방식으로. 뷰어별 재현을 비교한다.
    save(
      'B2-fontembed-board-single-100.pdf',
      await renderSheetPdf(composeSingle(board, 1), {
        fontPath: FONT_OTF,
        textMode: 'embed',
      }),
    );
  }

  // ───────────── 후보 ①: CSS @page + 브라우저 인쇄 ─────────────
  // (가) = 헤드리스 Chrome이 용지·배율·여백을 지정받아 뽑은 것 (앱이 대신 설정)
  // (나) = 사용자가 인쇄 대화상자 기본값 그대로 뽑은 것 (후보 ①의 실제 모습)
  if (want('a')) {
    note('\n[A] CSS @page + 브라우저 인쇄');
    for (const scale of [0.5, 1, 2]) {
      const sheet = composeSingle(board, scale);
      const html = `A-board-single-${pct(scale)}.html`;
      writeFileSync(join(OUT, html), sheetToPrintHtml(sheet, { title: html }));
      const { session } = await openPage(
        chrome.port,
        pathToFileURL(join(OUT, html)).href,
      );
      // (가) 규격대로: CSS 페이지 크기 존중 · 여백 0 · 배율 1
      save(
        `A-board-single-${pct(scale)}.pdf`,
        await printToPdf(session, {
          widthMm: sheet.pages[0].pageW,
          heightMm: sheet.pages[0].pageH,
          marginMm: 0,
        }),
      );
      // (나) 사용자 기본 설정 흉내: CSS 크기 무시 · A4 · 기본 여백 10mm
      save(
        `A-board-single-${pct(scale)}-userdefault.pdf`,
        await printToPdf(session, {
          widthMm: 210,
          heightMm: 297,
          marginMm: 10,
          preferCSSPageSize: false,
        }),
      );
      session.close();
    }
    for (const scale of [1, 2]) {
      const sheet = composeTiled(board, scale);
      const html = `A-board-tiled-${pct(scale)}.html`;
      writeFileSync(join(OUT, html), sheetToPrintHtml(sheet, { title: html }));
      const { session } = await openPage(
        chrome.port,
        pathToFileURL(join(OUT, html)).href,
      );
      save(
        `A-board-tiled-${pct(scale)}.pdf`,
        await printToPdf(session, {
          widthMm: sheet.pages[0].pageW,
          heightMm: sheet.pages[0].pageH,
          marginMm: 0,
        }),
      );
      session.close();
    }
  }

  // ───────────── 후보 ②-a: jsPDF + svg2pdf.js (브라우저 벡터) ─────────────
  if (want('b1')) {
    note('\n[B1] jsPDF + svg2pdf.js');
    for (const scale of [0.5, 1, 2]) {
      const sheet = composeSingle(board, scale);
      const html = `B1-board-single-${pct(scale)}.html`;
      writeFileSync(join(OUT, html), svg2pdfHtml(sheet, { fontBase64: null }));
      const { session } = await openPage(
        chrome.port,
        pathToFileURL(join(OUT, html)).href,
      );
      try {
        save(
          `B1-board-single-${pct(scale)}.pdf`,
          await evalToBuffer(session, 'window.makePdf()'),
        );
      } catch (e) {
        note(`  !! B1 ${pct(scale)}% 실패: ${short(e)}`);
      }
      session.close();
    }
  }

  // ───────────── 후보 ③: Canvas 래스터 -> PDF 임베드 ─────────────
  if (want('c')) {
    note('\n[C] Canvas 래스터 -> PDF 임베드');
    for (const [scale, dpi] of [
      [1, 150],
      [1, 300],
      [1, 600],
      [2, 300],
    ]) {
      const t0 = Date.now();
      const sheet = composeSingle(board, scale);
      const html = `C-board-single-${pct(scale)}-${dpi}dpi.html`;
      writeFileSync(join(OUT, html), canvasPdfHtml(sheet, { dpi }));
      const { session } = await openPage(
        chrome.port,
        pathToFileURL(join(OUT, html)).href,
      );
      try {
        save(
          `C-board-single-${pct(scale)}-${dpi}dpi.pdf`,
          await evalToBuffer(session, 'window.makePdf()'),
        );
        note(`     ↳ 생성 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
      } catch (e) {
        note(`  !! C ${pct(scale)}%/${dpi}dpi 실패: ${short(e)}`);
      }
      session.close();
    }
  }
} finally {
  chrome.close();
}

writeFileSync(join(OUT, 'build.log'), log.join('\n') + '\n');
note('\n산출물: spikes/print-pipeline/out/');

function pct(s) {
  return String(Math.round(s * 100));
}
function short(e) {
  return String(e.message ?? e)
    .split('\n')[0]
    .slice(0, 200);
}

// 실측 — 만들어진 PDF를 렌더해 치수를 잰다. `node spikes/print-pipeline/measure.mjs`
//
// 사람이 자로 재는 것과 같은 대상을 프로그램이 잰다. 다른 점은 정밀도(≈0.01mm)와,
// 프린터 자체의 오차는 못 잡는다는 것뿐이다. 종이 검증은 README.md의 체크리스트로 한다.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { boardTestPattern } from './lib/pattern.mjs';
import { composeTiled } from './lib/compose.mjs';
import {
  rasterizePdf,
  inkBoundsMm,
  inkCentroidMm,
  bestAlignment,
  at,
} from './lib/raster.mjs';
import { ptToMm, mmToPx } from './lib/geometry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const board = boardTestPattern();
const SPANS = board.spans;
const FID = Object.fromEntries(board.fiducials.map((f) => [f.id, f]));

const rows = [];
const seams = [];
const lines = [];
const say = (s) => {
  console.log(s);
  lines.push(s);
};

const files = readdirSync(OUT)
  .filter((f) => f.endsWith('.pdf'))
  .sort();

say('# IDE-002 인쇄 파이프라인 실측 결과\n');
say(
  `생성: ${new Date().toLocaleDateString('sv-SE')} · Ghostscript 렌더 600dpi(단일) / 300dpi(타일 조립)\n`,
);

// ───────────── 1. 단일 페이지 기하 정확도 ─────────────
say('## 1. 단일 시트 기하 — 도안 좌표가 종이 mm로 정확히 옮겨졌나\n');
for (const f of files) {
  const m =
    /^(A|B1|B2|C)-(?:fontembed-)?board-single-(\d+)(?:-(\d+)dpi)?(-userdefault)?\.pdf$/.exec(
      f,
    );
  if (!m) continue;
  const [, cand, pctStr, dpiStr, userDefault] = m;
  const scale = +pctStr / 100;
  const path = join(OUT, f);
  const doc = await PDFDocument.load(readFileSync(path), {
    updateMetadata: false,
  });
  const p0 = doc.getPage(0);
  const box = { w: ptToMm(p0.getWidth()), h: ptToMm(p0.getHeight()) };
  const imgs = rasterizePdf(path, 600);
  const img = imgs[0];
  const bounds = inkBoundsMm(img);
  // 도안 테두리(0,0,210,297)가 잉크 경계와 같다고 보고 design->page 변환을 되찾는다
  const eff = bounds ? bounds.w / board.w : null;
  const map = (pt) => ({
    x: bounds.x + eff * pt.x,
    y: bounds.y + (bounds.h / board.h) * pt.y,
  });
  // 측정 창은 도안과 같이 줄어야 한다 — 축소 출력에서는 이웃 도형까지
  // 3mm 안에 들어오므로 창을 고정하면 엉뚱한 잉크의 무게중심을 잡는다
  const win = bounds ? Math.max(0.8, 3 * eff) : 3;
  const cent = {};
  for (const id of Object.keys(FID))
    cent[id] = bounds
      ? inkCentroidMm(img, map(FID[id]).x, map(FID[id]).y, win)
      : null;
  for (const sp of SPANS) {
    const a = cent[sp.from];
    const b = cent[sp.to];
    const measured = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null;
    const intended = sp.nominal * scale;
    rows.push({
      file: f,
      cand: label(cand, userDefault, dpiStr),
      scale: `${pctStr}%`,
      span: sp.id,
      intended,
      measured,
      err: measured == null ? null : measured - intended,
      pageMm: `${box.w.toFixed(2)}×${box.h.toFixed(2)}`,
      kb: statSync(path).size / 1024,
    });
  }
}

say(
  '| 산출물 | 후보 | 배율 | 측정 구간 | 지정(mm) | 실측(mm) | 오차(mm) | 페이지 상자(mm) | 용량 |',
);
say('| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: |');
for (const r of rows) {
  say(
    `| \`${r.file}\` | ${r.cand} | ${r.scale} | ${r.span} | ${r.intended.toFixed(2)} | ${
      r.measured == null ? '측정 실패' : r.measured.toFixed(3)
    } | ${r.err == null ? '—' : signed(r.err)} | ${r.pageMm} | ${r.kb.toFixed(0)} KB |`,
  );
}

// ───────────── 2. 타일 이음 정합 ─────────────
say('\n## 2. 타일 이음 — 겹침 구간에서 두 장이 정확히 포개지나\n');
say('| 산출물 | 이음 | 최적 정합 이동 X(mm) | Y(mm) | 판정 |');
say('| --- | --- | ---: | ---: | --- |');
for (const f of files) {
  const m = /^(A|B2)-board-tiled-(\d+)\.pdf$/.exec(f);
  if (!m) continue;
  const scale = +m[2] / 100;
  const sheet = composeTiled(board, scale);
  const plan = sheet.plan;
  const imgs = rasterizePdf(join(OUT, f), 300);
  if (imgs.length !== plan.total) {
    say(
      `| \`${f}\` | — | — | — | 페이지 수 불일치 (${imgs.length} ≠ ${plan.total}) |`,
    );
    continue;
  }
  for (let r = 0; r < plan.rows; r++) {
    for (let c = 0; c < plan.cols; c++) {
      const i = r * plan.cols + c;
      const t = plan.tiles[i];
      // 겹침 구간에서 양쪽 가장자리 0.5mm를 뺀 띠를 서로 비교한다.
      // 두 창은 반드시 "도안상 같은 구간"을 가리켜야 한다 — 한쪽만 0.5mm를
      // 밀면 정합 결과에 그 0.5mm가 그대로 오차로 나타난다.
      if (c < plan.cols - 1) {
        const t2 = plan.tiles[i + 1];
        const band = plan.overlapX - 1;
        const a = bestAlignment(
          imgs[i],
          {
            x: t.dstX + t.srcW - plan.overlapX + 0.5,
            y: t.dstY + 5,
            w: band,
            h: t.srcH - 10,
          },
          imgs[i + 1],
          { x: t2.dstX + 0.5, y: t2.dstY + 5, w: band, h: t.srcH - 10 },
          2,
        );
        seams.push({ f, name: `${i + 1}↔${i + 2} 세로`, a });
      }
      if (r < plan.rows - 1) {
        const t2 = plan.tiles[i + plan.cols];
        const band = plan.overlapY - 1;
        const a = bestAlignment(
          imgs[i],
          {
            x: t.dstX + 5,
            y: t.dstY + t.srcH - plan.overlapY + 0.5,
            w: t.srcW - 10,
            h: band,
          },
          imgs[i + plan.cols],
          { x: t2.dstX + 5, y: t2.dstY + 0.5, w: t.srcW - 10, h: band },
          2,
        );
        seams.push({ f, name: `${i + 1}↔${i + 1 + plan.cols} 가로`, a });
      }
    }
  }
}
for (const s of seams) {
  const ok = s.a && Math.abs(s.a.dxMm) < 0.15 && Math.abs(s.a.dyMm) < 0.15;
  say(
    `| \`${s.f}\` | ${s.name} | ${s.a ? s.a.dxMm.toFixed(3) : '—'} | ${s.a ? s.a.dyMm.toFixed(3) : '—'} | ${
      ok ? '✅ 어긋남 없음' : '⚠︎ 확인 필요'
    } |`,
  );
}

// ───────────── 3. 타일을 조립했을 때의 치수 ─────────────
say('\n## 3. 타일 조립 후 치수 — 붙이고 나서도 지정 배율이 유지되나\n');
say('| 산출물 | 배율 | 측정 구간 | 지정(mm) | 조립 실측(mm) | 오차(mm) |');
say('| --- | --- | --- | ---: | ---: | ---: |');
for (const f of files) {
  const m = /^(A|B2)-board-tiled-(\d+)\.pdf$/.exec(f);
  if (!m) continue;
  const scale = +m[2] / 100;
  const sheet = composeTiled(board, scale);
  const plan = sheet.plan;
  const dpi = 300;
  const imgs = rasterizePdf(join(OUT, f), dpi);
  if (imgs.length !== plan.total) continue;
  const asm = assemble(imgs, plan, dpi);
  const win = Math.max(0.8, 3 * scale);
  for (const sp of SPANS) {
    const a = inkCentroidMm(
      asm,
      FID[sp.from].x * scale,
      FID[sp.from].y * scale,
      win,
    );
    const b = inkCentroidMm(
      asm,
      FID[sp.to].x * scale,
      FID[sp.to].y * scale,
      win,
    );
    const measured = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null;
    const intended = sp.nominal * scale;
    say(
      `| \`${f}\` | ${m[2]}% | ${sp.id} | ${intended.toFixed(2)} | ${
        measured == null ? '측정 실패' : measured.toFixed(3)
      } | ${measured == null ? '—' : signed(measured - intended)} |`,
    );
  }
}

writeFileSync(join(OUT, 'measure-report.md'), lines.join('\n') + '\n');
say('\n보고서: spikes/print-pipeline/out/measure-report.md');

/** 타일 라이브 영역을 계획대로 이어 붙여 하나의 이미지로 만든다(= 풀칠 완료 상태). */
function assemble(imgs, plan, dpi) {
  const W = Math.ceil(mmToPx(plan.partW, dpi));
  const H = Math.ceil(mmToPx(plan.partH, dpi));
  const data = Buffer.alloc(W * H, 255);
  const asm = { w: W, h: H, off: 0, data, dpi };
  plan.tiles.forEach((t, i) => {
    const src = imgs[i];
    const sx0 = Math.round(mmToPx(t.dstX, dpi));
    const sy0 = Math.round(mmToPx(t.dstY, dpi));
    const dw = Math.round(mmToPx(t.srcW, dpi));
    const dh = Math.round(mmToPx(t.srcH, dpi));
    const dx0 = Math.round(mmToPx(t.srcX, dpi));
    const dy0 = Math.round(mmToPx(t.srcY, dpi));
    for (let y = 0; y < dh; y++) {
      const sy = sy0 + y;
      const dy = dy0 + y;
      if (sy >= src.h || dy >= H) break;
      for (let x = 0; x < dw; x++) {
        const sx = sx0 + x;
        const dx = dx0 + x;
        if (sx >= src.w || dx >= W) break;
        const v = at(src, sx, sy);
        const idx = dy * W + dx;
        if (v < data[idx]) data[idx] = v; // 겹침은 더 어두운 쪽(잉크)을 남긴다
      }
    }
  });
  return asm;
}

function label(cand, userDefault, dpi) {
  const base = {
    A: '①′ 헤드리스 Chrome(설정 고정)',
    B1: '② SVG→PDF (svg2pdf.js)',
    B2: '② SVG→PDF (pdf-lib)',
    C: '③ Canvas 래스터',
  }[cand];
  if (userDefault) return '① 브라우저 인쇄 · 사용자 기본설정';
  if (dpi) return `${base} ${dpi}dpi`;
  return base;
}
function signed(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(3);
}

// 한글 폰트 임베딩 방식과 결과 용량 — `node spikes/print-pipeline/fonts.mjs`
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { mmToPt } from './lib/geometry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

// 실제 도안에 나올 법한 한글 — 축구 게임판 라벨 + 게임 방법 문장
const SAMPLE = [
  '대한민국 · 브라질 · 전반 · 후반 · 골 · 코너킥 · 프리킥 · 페널티킥',
  '점수판 · 주사위 트랙 · 게임 방법 · 준비물 · 인원 2명 · 연필 한 자루',
  '공을 연필로 튕겨 상대 골문에 넣으면 1점. 선을 넘으면 상대에게 넘어간다.',
  '오림선을 따라 자르고 접는선은 산접기, 풀칠면에 풀을 발라 붙인다.',
  '배율 100%로 인쇄하세요. 프린터의 "용지에 맞춤"을 끄지 않으면 치수가 틀어집니다.',
];
const UNIQUE = new Set([...SAMPLE.join('')].filter((c) => c.trim()));

const CASES = [
  { id: 'otf-subset', file: 'NotoSansKR-Regular.otf', subset: true },
  { id: 'otf-full', file: 'NotoSansKR-Regular.otf', subset: false },
  { id: 'vf-ttf-subset', file: 'NotoSansKR-VF.ttf', subset: true },
];

const results = [];
for (const c of CASES) {
  const src = join(HERE, 'assets', c.file);
  let bytes,
    err = null;
  const t0 = Date.now();
  try {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(readFileSync(src), { subset: c.subset });
    const page = doc.addPage([mmToPt(210), mmToPt(297)]);
    SAMPLE.forEach((line, i) => {
      page.drawText(line, {
        x: mmToPt(12),
        y: mmToPt(280 - i * 10),
        size: mmToPt(3.2),
        font,
        color: rgb(0, 0, 0),
      });
    });
    bytes = await doc.save({ useObjectStreams: true });
    writeFileSync(join(OUT, `font-${c.id}.pdf`), bytes);
  } catch (e) {
    err = String(e.message ?? e).split('\n')[0];
  }
  results.push({
    ...c,
    srcKB: readFileSync(src).length / 1024,
    pdfKB: bytes ? bytes.length / 1024 : null,
    ms: Date.now() - t0,
    err,
  });
}

const lines = [];
const say = (s) => {
  console.log(s);
  lines.push(s);
};
say('# 한글 폰트 임베딩 — 방식별 결과\n');
say(
  `표본: 한글 ${UNIQUE.size}자(중복 제외), 5줄. 실제 도안 라벨과 게임 방법 문장을 흉내 냈다.\n`,
);
say('| 방식 | 원본 폰트 | PDF 용량 | 생성 시간 | 결과 |');
say('| --- | ---: | ---: | ---: | --- |');
for (const r of results) {
  say(
    `| ${r.file} · ${r.subset ? '서브셋' : '전체 임베딩'} | ${r.srcKB.toFixed(0)} KB | ${
      r.pdfKB == null ? '—' : r.pdfKB.toFixed(1) + ' KB'
    } | ${r.ms} ms | ${r.err ? '❌ ' + r.err : '✅'} |`,
  );
}
writeFileSync(join(OUT, 'font-report.md'), lines.join('\n') + '\n');
say('\n보고서: spikes/print-pipeline/out/font-report.md');

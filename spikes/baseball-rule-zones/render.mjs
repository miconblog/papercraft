/**
 * IDE-044 설명용 목업 — 「실제 야구 규칙」 판이 어떻게 생겼는지 그려 본다.
 *
 * 진짜 도안 생성기가 아니다. `public/games/baseball/field.svg`(지금 판)를 그대로
 * 깔고 그 위에 제안 영역을 얹은 뒤, 오른쪽에 설명 패널을 붙인 한 장이다.
 * 구현은 IDE-044에서 `src/assets/games/baseball/artwork/field.ts`에 들어간다.
 *
 *     node spikes/baseball-rule-zones/render.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

// 판 치수 — dimensions.ts와 같은 값이다(목업이라 베껴 적는다).
const BOARD = { w: 210, h: 297 };
const HOME = { x: 105, y: 274 };
const OUT_R = 48;
const SECOND_BASE_R = 95 * Math.SQRT2; // 134.4 — 2루까지
const LINE_WEDGE_DEG = 38; // 파울라인(45°) 안쪽 7°
const BUNT_DEG = 30; // 아웃선 안을 가르는 각

const PANEL_W = 150;
const DOC = { w: BOARD.w + PANEL_W, h: BOARD.h };

const n = (v) => Number(v.toFixed(3));
const pt = (deg, r) => ({
  x: HOME.x + r * Math.sin((deg * Math.PI) / 180),
  y: HOME.y - r * Math.cos((deg * Math.PI) / 180),
});
/** 방위각 deg 방향으로 종이를 벗어나는 거리. */
const edgeR = (deg) => {
  const rad = (Math.abs(deg) * Math.PI) / 180;
  return Math.min(HOME.x / Math.sin(rad), HOME.y / Math.cos(rad));
};

const DOUBLE = '#1d4ed8';
const TRIPLE = '#7c3aed';
const BUNT_HIT = '#0f766e';
const BUNT_FAIL = '#dc2626';
const INK = '#1f2937';

/** 선상 쐐기 — 안쪽 r에서 종이 끝까지, 방위각 a..b. 부호로 좌우를 가른다. */
const wedge = (sign, innerR, outerR) => {
  const a = sign * LINE_WEDGE_DEG;
  const b = sign * 45;
  const i1 = pt(a, innerR);
  const i2 = pt(b, innerR);
  const o2 = pt(b, Math.min(outerR, edgeR(45)));
  const o1 = pt(a, Math.min(outerR, edgeR(LINE_WEDGE_DEG)));
  const sweepIn = sign > 0 ? 1 : 0;
  const sweepOut = sign > 0 ? 0 : 1;
  const outerArc =
    outerR >= edgeR(45)
      ? `L ${n(o2.x)} ${n(o2.y)} L ${n(o1.x)} ${n(o1.y)}` // 종이 끝을 따라 간다
      : `L ${n(o2.x)} ${n(o2.y)} A ${n(outerR)} ${n(outerR)} 0 0 ${sweepOut} ${n(o1.x)} ${n(o1.y)}`;
  return (
    `M ${n(i1.x)} ${n(i1.y)} ` +
    `A ${n(innerR)} ${n(innerR)} 0 0 ${sweepIn} ${n(i2.x)} ${n(i2.y)} ` +
    `${outerArc} Z`
  );
};

/** 홈에서 퍼지는 부채꼴 — 번트 영역. */
const sector = (fromDeg, toDeg, r) => {
  const a = pt(fromDeg, r);
  const b = pt(toDeg, r);
  return (
    `M ${n(HOME.x)} ${n(HOME.y)} L ${n(a.x)} ${n(a.y)} ` +
    `A ${n(r)} ${n(r)} 0 0 1 ${n(b.x)} ${n(b.y)} Z`
  );
};

/** 홈 중심 원호 — 쐐기 안을 가르는 점선. */
const arcInWedge = (r, sign) => {
  const a = pt(sign * LINE_WEDGE_DEG, r);
  const b = pt(sign * 45, r);
  const sweep = sign > 0 ? 1 : 0;
  return `M ${n(a.x)} ${n(a.y)} A ${n(r)} ${n(r)} 0 0 ${sweep} ${n(b.x)} ${n(b.y)}`;
};

// ── 지금 판을 그대로 깐다 ────────────────────────────────────────────────
const field = readFileSync(
  join(repo, 'public', 'games', 'baseball', 'field.svg'),
  'utf8',
);
const inner = field
  .slice(
    field.indexOf('>', field.indexOf('<svg')) + 1,
    field.lastIndexOf('</svg>'),
  )
  .replace(/<title>[\s\S]*?<\/title>/, '');

// ── 얹는 영역 ───────────────────────────────────────────────────────────
const zones = [
  // 선상 2루타 — 아웃선 밖부터 2루 거리까지
  ...[1, -1].map(
    (s) =>
      `<path d="${wedge(s, OUT_R, SECOND_BASE_R)}" fill="${DOUBLE}" fill-opacity="0.16" stroke="${DOUBLE}" stroke-width="0.9" />`,
  ),
  // 선상 3루타 — 그 바깥 조각(종이 끝까지)
  ...[1, -1].map(
    (s) =>
      `<path d="${wedge(s, SECOND_BASE_R, 999)}" fill="${TRIPLE}" fill-opacity="0.2" stroke="${TRIPLE}" stroke-width="0.9" />`,
  ),
  ...[1, -1].map(
    (s) =>
      `<path d="${arcInWedge(SECOND_BASE_R, s)}" fill="none" stroke="${TRIPLE}" stroke-width="0.6" stroke-dasharray="2 1.5" />`,
  ),
  // 쐐기를 베이스 바깥부터로 자를지 — 남은 물음(내야와 겹친다)
  ...[1, -1].map(
    (s) =>
      `<path d="${arcInWedge(95, s)}" fill="none" stroke="#6b7280" stroke-width="0.6" stroke-dasharray="1.5 1.5" />`,
  ),
  // 번트 — 아웃선 안을 방향으로 가른다
  `<path d="${sector(BUNT_DEG, 45, OUT_R)}" fill="${BUNT_HIT}" fill-opacity="0.22" stroke="${BUNT_HIT}" stroke-width="0.7" />`,
  `<path d="${sector(-45, -BUNT_DEG, OUT_R)}" fill="${BUNT_HIT}" fill-opacity="0.22" stroke="${BUNT_HIT}" stroke-width="0.7" />`,
  `<path d="${sector(-BUNT_DEG, BUNT_DEG, OUT_R)}" fill="${BUNT_FAIL}" fill-opacity="0.12" stroke="none" />`,
];

/** 쐐기 안에 세로로 눕는 글자 — 파울라인과 나란히 돈다. */
const wedgeLabel = (sign, r, label, size, color) => {
  const p = pt(sign * 41.5, r);
  const angle = sign > 0 ? 41.5 : -41.5;
  return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${size}" fill="${color}" text-anchor="middle" transform="rotate(${n(-angle)} ${n(p.x)} ${n(p.y)})">${label}</text>`;
};

const labels = [
  wedgeLabel(-1, 116, '좌익선상 2루타', 3.4, DOUBLE),
  wedgeLabel(1, 116, '우익선상 2루타', 3.4, DOUBLE),
  wedgeLabel(-1, 148, '선상 3루타', 3.4, TRIPLE),
  wedgeLabel(1, 148, '선상 3루타', 3.4, TRIPLE),
  `<text x="${n(pt(-37, 40).x)}" y="${n(pt(-37, 40).y)}" font-size="2.6" fill="${BUNT_HIT}" text-anchor="middle">번트안타</text>`,
  `<text x="${n(pt(37, 40).x)}" y="${n(pt(37, 40).y)}" font-size="2.6" fill="${BUNT_HIT}" text-anchor="middle">번트안타</text>`,
  `<text x="${HOME.x}" y="${n(HOME.y - 32)}" font-size="2.8" fill="${BUNT_FAIL}" text-anchor="middle">번트 실패 · 땅볼 아웃</text>`,
  `<text x="${HOME.x}" y="${n(HOME.y - 27.5)}" font-size="2.8" fill="${BUNT_FAIL}" text-anchor="middle">주자 1루면 병살</text>`,
];

// ── 오른쪽 설명 패널 ────────────────────────────────────────────────────
const px = BOARD.w + 10;
const row = (y, color, opacity, title, body) =>
  [
    `<rect x="${px}" y="${y}" width="7" height="7" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="0.6" />`,
    `<text x="${px + 11}" y="${y + 5.6}" font-size="4.2" fill="${INK}" font-weight="600">${title}</text>`,
    ...body.map(
      (t, i) =>
        `<text x="${px + 11}" y="${y + 12 + i * 5}" font-size="3.4" fill="#4b5563">${t}</text>`,
    ),
  ].join('\n');

const panel = [
  `<text x="${px}" y="24" font-size="6" fill="${INK}" font-weight="700">실제 야구 규칙 (옵션)</text>`,
  `<text x="${px}" y="32" font-size="3.4" fill="#6b7280">IDE-044 · 기본 판 위에 얹는 영역 — 목업</text>`,
  `<line x1="${px}" y1="38" x2="${px + 130}" y2="38" stroke="#d1d5db" stroke-width="0.4" />`,
  row(46, DOUBLE, 0.16, '좌익선상 · 우익선상 2루타', [
    '파울라인 안쪽 7°(38°~45°), 아웃선 밖부터.',
    '양쪽 합 28cm² — 페어 지역의 6.1%.',
    '지금은 이 자리가 전부 단타다.',
    '회색 점선 = 베이스(95mm). 여기부터로 자르면',
    '내야와 안 겹친다 — 20cm² · 4.3%.',
  ]),
  row(84, TRIPLE, 0.2, '선상 3루타 (넣을지 미정)', [
    '같은 쐐기에서 2루 거리(134mm) 바깥.',
    '양쪽 합 9cm² — 1.9%. 가장 드문 안타.',
    '점선이 2루 거리 경계다.',
  ]),
  row(114, BUNT_HIT, 0.22, '번트안타', [
    '아웃선 안(48mm)에서 3루선·1루선 쪽 15°.',
    '6cm² — 1.3%. 치기 전에 "번트"를 선언한다.',
  ]),
  row(139, BUNT_FAIL, 0.12, '번트 실패 · 땅볼 · 병살', [
    '아웃선 안 가운데(투수 정면) 12cm² — 2.6%.',
    '번트 선언이면 실패, 아니면 지금처럼 땅볼 아웃.',
    '주자 1루 + 2아웃 전이면 병살 — 아웃 둘.',
    '상황은 그릴 수 없어 글로만 적는다.',
  ]),
  `<line x1="${px}" y1="171" x2="${px + 130}" y2="171" stroke="#d1d5db" stroke-width="0.4" />`,
  `<text x="${px}" y="180" font-size="4.2" fill="${INK}" font-weight="600">지금 판이 나눠 갖는 몫</text>`,
  ...[
    ['땅볼 아웃 (아웃선 안)', '3.9%'],
    ['안타 (48~175mm)', '46.4%'],
    ['2루타 (175~249mm)', '35.0%'],
    ['홈런 (249mm 밖)', '14.7%'],
  ].flatMap(([k, v], i) => [
    `<text x="${px}" y="${189 + i * 6}" font-size="3.4" fill="#4b5563">${k}</text>`,
    `<text x="${px + 130}" y="${189 + i * 6}" font-size="3.4" fill="${INK}" text-anchor="end">${v}</text>`,
  ]),
  `<text x="${px}" y="220" font-size="3.2" fill="#6b7280">페어 지역 465cm² 기준. 면적은 확률이 아니다 —</text>`,
  `<text x="${px}" y="225" font-size="3.2" fill="#6b7280">연필로 튕긴 공은 균일하게 멈추지 않는다.</text>`,
  `<line x1="${px}" y1="234" x2="${px + 130}" y2="234" stroke="#d1d5db" stroke-width="0.4" />`,
  `<text x="${px}" y="243" font-size="4.2" fill="${INK}" font-weight="600">바뀌지 않는 것</text>`,
  ...[
    '판정선 넷과 색(빨강·파랑·초록)은 그대로다.',
    '새 색은 2루타 파랑을 빌려 쓰고, 3루타만 보라다.',
    '기본 규칙을 고르면 이 층이 통째로 빠진다 —',
    '지금 야구장과 한 획도 다르지 않다.',
  ].map(
    (t, i) =>
      `<text x="${px}" y="${251 + i * 5}" font-size="3.4" fill="#4b5563">${t}</text>`,
  ),
].join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${DOC.w}mm" height="${DOC.h}mm" viewBox="0 0 ${DOC.w} ${DOC.h}" font-family="Noto Sans KR, sans-serif">
<title>IDE-044 · 실제 야구 규칙 영역 목업</title>
<rect x="0" y="0" width="${DOC.w}" height="${DOC.h}" fill="#ffffff" />
<g id="field">${inner}</g>
<g id="zones">
${zones.join('\n')}
</g>
<g id="zone-labels" font-weight="600">
${labels.join('\n')}
</g>
<rect x="0.25" y="0.25" width="${BOARD.w - 0.5}" height="${BOARD.h - 0.5}" fill="none" stroke="#9ca3af" stroke-width="0.5" stroke-dasharray="3 2" />
<g id="panel">
${panel}
</g>
</svg>
`;

const out = join(here, 'out', 'baseball-rule-zones.svg');
writeFileSync(out, svg, 'utf8');
console.log(`${out}  ${(svg.length / 1024).toFixed(1)}KB`);

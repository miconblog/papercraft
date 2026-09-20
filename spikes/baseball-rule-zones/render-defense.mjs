/**
 * IDE-044 목업 2 — **수비수가 곧 영역이다 · 수비 범위는 능력치로 배분한다**
 *
 * 첫 목업(`render.mjs`)은 판정을 홈에서의 거리로만 나눴다. 사용자가 되돌렸다
 * (2026-09-20): 공이 멈춘 자리가 결과를 읽는 자리인데, 우익선상 2루타 영역이
 * 1루 안쪽까지 내려오면 **땅볼 구간에 떨어진 공이 2루타**가 된다. 그리고 이 판은
 * 수비수가 그려져 있고 거기 닿으면 아웃이라, **수비수 바로 앞에 멈춘 공이 안타**인
 * 것도 현실과 어긋난다 — 유격수 앞은 병살이 나오는 자리다.
 *
 * 이어서 범위를 **고정값이 아니라 배분**으로 하자는 요청이 왔다(같은 날):
 * 기본 내야 20 · 외야 28mm에서 **팀 능력치 10mm**를 나눠 주고, 한 자리가
 * 최대(내야 26 · 외야 34)까지만 커진다. 중견수를 28 → 34로 올리면 남은 4mm를
 * 다른 자리에 준다.
 *
 *     node spikes/baseball-rule-zones/render-defense.mjs
 *     node spikes/baseball-rule-zones/render-defense.mjs 중견수=6,유격수=4
 *     node spikes/baseball-rule-zones/render-defense.mjs 기본        (배분 없음)
 *
 * 면적 몫은 **그때그때 적분해서** 패널에 찍는다 — 배분을 바꾸면 숫자도 따라
 * 바뀌어야 밸런스를 눈으로 맞출 수 있다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const art = join(repo, 'public', 'games', 'baseball');

const BOARD = { w: 210, h: 297 };
const HOME = { x: 105, y: 274 };
const OUT_R = 48; // 아웃선 — 그대로 둔다
const BASE_R = 95; // 선상 쐐기는 베이스 바깥부터
const LINE_DEG = 38;
const DOUBLE_R = 175;
const HOMERUN_R = 249;

/** 수비 범위 — 기본값과 상한. 능력치는 그 사이를 메운다(2026-09-20 사용자). */
const REACH = {
  in: { base: 20, max: 26 },
  out: { base: 28, max: 34 },
};
/** 팀 능력치 — 한 팀이 나눠 쓸 수 있는 mm의 합. 놀아 보며 맞출 나사다. */
const BUDGET = 10;

const PANEL_W = 150;
const DOC = { w: BOARD.w + PANEL_W, h: BOARD.h };

const n = (v) => Number(v.toFixed(3));
const pt = (deg, r) => ({
  x: HOME.x + r * Math.sin((deg * Math.PI) / 180),
  y: HOME.y - r * Math.cos((deg * Math.PI) / 180),
});
const edgeR = (deg) => {
  const rad = (Math.abs(deg) * Math.PI) / 180;
  return Math.min(HOME.x / Math.sin(rad), HOME.y / Math.cos(rad));
};

const GROUND = '#dc2626'; // 땅볼 — 아웃선과 같은 빨강
const FLY = '#ea580c'; // 뜬공
const DOUBLE = '#1d4ed8';
const INK = '#1f2937';
const MUTED = '#9ca3af';

/** 기본 수비 시프트 — `index.ts`의 SHIFTS[0]. */
const DEFENSE = [
  { id: 'pitcher', label: '투수', pose: 'pitch', x: 105, y: 210, kind: 'in' },
  { id: 'first', label: '1루수', pose: 'field', x: 158, y: 194, kind: 'in' },
  {
    id: 'second',
    label: '2루수',
    pose: 'throw',
    x: 145,
    y: 144,
    kind: 'in',
    dp: true,
  },
  { id: 'third', label: '3루수', pose: 'field', x: 52, y: 194, kind: 'in' },
  {
    id: 'short',
    label: '유격수',
    pose: 'run',
    x: 65,
    y: 144,
    kind: 'in',
    dp: true,
  },
  { id: 'left', label: '좌익수', pose: 'run', x: 35, y: 82, kind: 'out' },
  { id: 'center', label: '중견수', pose: 'catch', x: 105, y: 62, kind: 'out' },
  { id: 'right', label: '우익수', pose: 'throw', x: 175, y: 82, kind: 'out' },
];

// ── 능력치 배분 ─────────────────────────────────────────────────────────
const arg = process.argv[2] ?? '중견수=6,유격수=4';
const bonus = Object.fromEntries(DEFENSE.map((d) => [d.id, 0]));
if (arg !== '기본') {
  for (const pair of arg.split(',')) {
    const [name, mm] = pair.split('=');
    const d = DEFENSE.find((x) => x.label === name || x.id === name);
    if (!d) throw new Error(`그런 수비 자리가 없다: ${name}`);
    bonus[d.id] = Number(mm);
  }
}
const spent = Object.values(bonus).reduce((s, v) => s + v, 0);
if (spent > BUDGET)
  throw new Error(`능력치를 ${spent}mm 썼다 — 예산은 ${BUDGET}mm다`);
for (const d of DEFENSE) {
  const room = REACH[d.kind].max - REACH[d.kind].base;
  if (bonus[d.id] > room)
    throw new Error(
      `${d.label}은 ${room}mm까지만 올릴 수 있다(상한 ${REACH[d.kind].max})`,
    );
}
const reachOf = (d) => REACH[d.kind].base + bonus[d.id];

// ── 면적 — 판정 차례대로 적분한다 ───────────────────────────────────────
const shares = (() => {
  const step = 0.2;
  const z = {};
  let tot = 0;
  const add = (k, a) => (z[k] = (z[k] ?? 0) + a);
  for (let x = step / 2; x < BOARD.w; x += step)
    for (let y = step / 2; y < BOARD.h; y += step) {
      const dx = x - HOME.x;
      const dy = HOME.y - y;
      if (dy <= 0 || Math.abs(dx) > dy) continue; // 파울·홈 뒤
      const r = Math.hypot(dx, dy);
      const b = Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
      const a = step * step;
      tot += a;
      const near = DEFENSE.find(
        (d) => Math.hypot(x - d.x, y - d.y) <= reachOf(d),
      );
      if (r < OUT_R) add('아웃선 안 — 번트 · 약한 땅볼', a);
      else if (near)
        add(
          near.kind === 'in'
            ? '내야 수비 범위 — 땅볼 · 병살'
            : '외야 수비 범위 — 뜬공 아웃',
          a,
        );
      else if (r >= HOMERUN_R) add('홈런', a);
      else if (b >= LINE_DEG && r >= BASE_R)
        add('좌익선상 · 우익선상 2루타', a);
      else if (r >= DOUBLE_R) add('2루타 — 외야 깊은 곳', a);
      else add('안타 — 수비 사이로 빠진 곳', a);
    }
  const rows = Object.entries(z).sort((p, q) => q[1] - p[1]);
  const outMm2 = rows
    .filter(([k]) => k.includes('아웃') || k.includes('병살'))
    .reduce((s, [, v]) => s + v, 0);
  return {
    totalCm2: tot / 100,
    rows: rows.map(([k, v]) => [k, `${((100 * v) / tot).toFixed(1)}%`]),
    outPct: ((100 * outMm2) / tot).toFixed(1),
  };
})();

/** SVG 파일에서 본문만 꺼낸다. */
const innerOf = (file) => {
  const s = readFileSync(file, 'utf8');
  return s
    .slice(s.indexOf('>', s.indexOf('<svg')) + 1, s.lastIndexOf('</svg>'))
    .replace(/<title>[\s\S]*?<\/title>/, '');
};

const field = innerOf(join(art, 'field.svg'));

/** 선상 쐐기 — 베이스 바깥부터 종이 끝까지. */
const wedge = (sign) => {
  const a = sign * LINE_DEG;
  const b = sign * 45;
  const i1 = pt(a, BASE_R);
  const i2 = pt(b, BASE_R);
  const o2 = pt(b, edgeR(45));
  const o1 = pt(a, edgeR(LINE_DEG));
  const sweepIn = sign > 0 ? 1 : 0;
  return (
    `M ${n(i1.x)} ${n(i1.y)} A ${n(BASE_R)} ${n(BASE_R)} 0 0 ${sweepIn} ${n(i2.x)} ${n(i2.y)} ` +
    `L ${n(o2.x)} ${n(o2.y)} L ${n(o1.x)} ${n(o1.y)} Z`
  );
};

/** 수비 범위를 빼내는 마스크 — 겹치면 수비가 이긴다(3루수가 선상 타구를 잡는다). */
const REACH_MASK = [
  '<mask id="reach-out">',
  `<rect x="0" y="0" width="${DOC.w}" height="${DOC.h}" fill="#fff" />`,
  ...DEFENSE.map(
    (d) =>
      `<circle cx="${d.x}" cy="${d.y}" r="${n(reachOf(d))}" fill="#000" />`,
  ),
  '</mask>',
].join('\n');

const zones = [
  ...[1, -1].map(
    (s) =>
      `<path d="${wedge(s)}" fill="${DOUBLE}" fill-opacity="0.14" stroke="${DOUBLE}" stroke-width="0.9" mask="url(#reach-out)" />`,
  ),
  // 상한 — 능력치를 다 부으면 여기까지 커진다
  ...DEFENSE.filter((d) => reachOf(d) < REACH[d.kind].max).map(
    (d) =>
      `<circle cx="${d.x}" cy="${d.y}" r="${REACH[d.kind].max}" fill="none" stroke="${MUTED}" stroke-width="0.4" stroke-dasharray="1 2" />`,
  ),
  // 지금 배분의 수비 범위
  ...DEFENSE.map((d) => {
    const c = d.kind === 'in' ? GROUND : FLY;
    return `<circle cx="${d.x}" cy="${d.y}" r="${n(reachOf(d))}" fill="${c}" fill-opacity="0.13" stroke="${c}" stroke-width="0.8" stroke-dasharray="3 1.6" />`;
  }),
];

/** 수비 마커 그림 — 실제 도안 파일을 그대로 얹는다. */
const markers = DEFENSE.map(
  (d) =>
    `<g transform="translate(${n(d.x - 10)} ${n(d.y - 11)})">${innerOf(join(art, `marker-${d.pose}-outline.svg`))}</g>`,
);

const labels = [
  ...DEFENSE.map((d) => {
    const c = d.kind === 'in' ? GROUND : FLY;
    const what =
      d.kind === 'in' ? (d.dp ? '땅볼 · 병살' : '땅볼 아웃') : '뜬공 아웃';
    // 투수 범위는 아웃선 안과 한 덩어리라 글자를 겹쳐 적지 않는다.
    const say =
      d.id === 'pitcher'
        ? ''
        : `<text x="${d.x}" y="${n(d.y + reachOf(d) - 4.5)}" font-size="3" fill="${c}" text-anchor="middle" font-weight="600">${what}</text>`;
    const mark = bonus[d.id] > 0 ? ` +${bonus[d.id]}` : '';
    return [
      say,
      // 이름표는 마커 머리 위 — 반경이 작으면 아래쪽 판정 글자와 부딪힌다.
      `<text x="${d.x}" y="${n(d.y - 13)}" font-size="2.8" fill="${INK}" text-anchor="middle">${d.label}${mark}</text>`,
    ].join('\n');
  }),
  `<text x="108" y="176" font-size="3.6" fill="${INK}" text-anchor="middle" font-weight="600">빠지면 안타</text>`,
  `<text x="70" y="108" font-size="3.6" fill="${DOUBLE}" text-anchor="middle" font-weight="600">갭 — 2루타</text>`,
  `<text x="140" y="108" font-size="3.6" fill="${DOUBLE}" text-anchor="middle" font-weight="600">갭 — 2루타</text>`,
  ...[1, -1].map((s) => {
    const p = pt(s * 41.5, 122);
    return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="3.4" fill="${DOUBLE}" text-anchor="middle" font-weight="600" transform="rotate(${n(-s * 41.5)} ${n(p.x)} ${n(p.y)})">${s > 0 ? '우익선상' : '좌익선상'} 2루타</text>`;
  }),
  `<text x="${HOME.x}" y="${n(HOME.y - 32)}" font-size="2.8" fill="${GROUND}" text-anchor="middle" font-weight="600">번트 · 약한 땅볼</text>`,
];

// ── 오른쪽 패널 ─────────────────────────────────────────────────────────
const px = BOARD.w + 10;
const pw = 130;
const text = (x, y, s, o = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${o.size ?? 3.4}" fill="${o.fill ?? '#4b5563'}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${s}</text>`;
const rule = (y) =>
  `<line x1="${px}" y1="${y}" x2="${px + pw}" y2="${y}" stroke="#d1d5db" stroke-width="0.4" />`;

const abilityRows = DEFENSE.map((d, i) => {
  const y = 62 + i * 6;
  const r = reachOf(d);
  const full = r >= REACH[d.kind].max;
  return [
    text(px, y, `${d.label}${d.dp ? ' *' : ''}`),
    text(px + 62, y, `${REACH[d.kind].base}`, { anchor: 'end', fill: MUTED }),
    text(px + 84, y, bonus[d.id] ? `+${bonus[d.id]}` : '·', {
      anchor: 'end',
      fill: bonus[d.id] ? INK : MUTED,
    }),
    text(px + pw, y, `${r}mm${full ? ' (상한)' : ''}`, {
      anchor: 'end',
      fill: full ? (d.kind === 'in' ? GROUND : FLY) : INK,
      weight: bonus[d.id] ? '600' : undefined,
    }),
  ].join('\n');
});

const shareRows = shares.rows.map(([k, v], i) => {
  const y = 142 + i * 6;
  return [
    text(px, y, k),
    text(px + pw, y, v, { anchor: 'end', fill: INK }),
  ].join('\n');
});

const panel = [
  text(px, 24, '수비수가 곧 영역이다', { size: 6, fill: INK, weight: '700' }),
  text(px, 32, 'IDE-044 · 목업 2 — 범위는 능력치로 배분한다', {
    fill: '#6b7280',
  }),
  rule(38),
  text(
    px,
    46,
    `팀 능력치 ${BUDGET}mm — ${spent}mm 썼다 · ${BUDGET - spent}mm 남았다`,
    {
      size: 4.2,
      fill: INK,
      weight: '600',
    },
  ),
  text(
    px,
    53,
    `기본 내야 ${REACH.in.base} · 외야 ${REACH.out.base}mm에서 올린다`,
    {
      fill: '#6b7280',
    },
  ),
  text(px + 62, 56, '기본', { anchor: 'end', fill: MUTED, size: 2.8 }),
  text(px + 84, 56, '능력', { anchor: 'end', fill: MUTED, size: 2.8 }),
  text(px + pw, 56, '반경', { anchor: 'end', fill: MUTED, size: 2.8 }),
  ...abilityRows,
  text(
    px,
    116,
    `상한 — 내야 ${REACH.in.max} · 외야 ${REACH.out.max}mm (점선)`,
    {
      size: 2.8,
      fill: MUTED,
    },
  ),
  text(px, 121, '* 유격수 · 2루수 범위는 주자 1루면 병살이다', {
    size: 2.8,
    fill: MUTED,
  }),
  rule(127),
  text(px, 135, `이 배분이 나누는 몫 — 페어 ${shares.totalCm2.toFixed(0)}cm²`, {
    size: 4.2,
    fill: INK,
    weight: '600',
  }),
  ...shareRows,
  rule(192),
  text(px, 200, `아웃이 ${shares.outPct}% — 지금 판은 7.6%다`, {
    size: 3.6,
    fill: INK,
    weight: '600',
  }),
  ...[
    '지금 아웃은 "그림에 맞으면"뿐이라 마커 여덟 장의',
    '넓이(20×22 여덟 = 35cm²)가 전부다. 실제 야구는',
    '인플레이 타구의 일곱에 다섯이 아웃이다.',
  ].map((t, i) => text(px, 208 + i * 5, t)),
  rule(228),
  text(px, 236, '능력치를 어디에 줄 것인가', {
    size: 3.6,
    fill: INK,
    weight: '600',
  }),
  ...[
    '면적만 보면 늘 외야가 이득이다 — 원이 클수록',
    '1mm가 늘리는 넓이가 크다. 내야에 주는 값어치는',
    '넓이가 아니라 자리다: 유격수·2루수 범위는',
    '아웃을 하나가 아니라 둘로 만든다(병살).',
  ].map((t, i) => text(px, 244 + i * 5, t)),
].join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${DOC.w}mm" height="${DOC.h}mm" viewBox="0 0 ${DOC.w} ${DOC.h}" font-family="Noto Sans KR, sans-serif">
<title>IDE-044 · 수비 범위 능력치 배분 목업</title>
<rect x="0" y="0" width="${DOC.w}" height="${DOC.h}" fill="#ffffff" />
<g id="field">${field}</g>
<g id="zones">
${REACH_MASK}
${zones.join('\n')}
</g>
<g id="markers" stroke="${INK}">
${markers.join('\n')}
</g>
<g id="zone-labels">
${labels.join('\n')}
</g>
<rect x="0.25" y="0.25" width="${BOARD.w - 0.5}" height="${BOARD.h - 0.5}" fill="none" stroke="#9ca3af" stroke-width="0.5" stroke-dasharray="3 2" />
<g id="panel">
${panel}
</g>
</svg>
`;

const out = join(here, 'out', 'baseball-defense-zones.svg');
writeFileSync(out, svg, 'utf8');
console.log(`${out}  ${(svg.length / 1024).toFixed(1)}KB`);
console.log(`능력치 ${spent}/${BUDGET}mm · 아웃 ${shares.outPct}%`);
for (const [k, v] of shares.rows) console.log(`  ${k.padEnd(28)} ${v}`);

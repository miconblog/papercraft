// 테스트 도안 정의 (IDE-002)
//
// 도안 좌표는 "배율 100%일 때의 mm"다. 배율은 렌더러가 곱한다.
// 프리미티브는 세 후보(CSS·SVG→PDF·Canvas)가 모두 같은 것을 그리도록 하기 위한
// 최소 공통 집합이다.

export const INK = '#000000';

const rect = (x, y, w, h, o = {}) => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  stroke: INK,
  strokeMm: 0.2,
  ...o,
});
const line = (x1, y1, x2, y2, o = {}) => ({
  kind: 'line',
  x1,
  y1,
  x2,
  y2,
  stroke: INK,
  strokeMm: 0.2,
  ...o,
});
const text = (x, y, s, o = {}) => ({
  kind: 'text',
  x,
  y,
  text: s,
  sizeMm: 3,
  anchor: 'start',
  ...o,
});
const circle = (cx, cy, r, o = {}) => ({
  kind: 'circle',
  cx,
  cy,
  r,
  stroke: INK,
  strokeMm: 0.2,
  fill: 'none',
  ...o,
});

/** 눈금자 — length mm를 1·5·10mm 눈금으로. 방향은 'h' | 'v'. */
export function ruler(x, y, length, dir = 'h', o = {}) {
  const out = [];
  const long = 4,
    mid = 2.5,
    small = 1.5;
  out.push(
    dir === 'h'
      ? line(x, y, x + length, y, { strokeMm: 0.25 })
      : line(x, y, x, y + length, { strokeMm: 0.25 }),
  );
  for (let mm = 0; mm <= length; mm++) {
    const t = mm % 10 === 0 ? long : mm % 5 === 0 ? mid : small;
    const w = mm % 10 === 0 ? 0.25 : 0.12;
    if (dir === 'h') out.push(line(x + mm, y, x + mm, y + t, { strokeMm: w }));
    else out.push(line(x, y + mm, x + t, y + mm, { strokeMm: w }));
    if (mm % 10 === 0) {
      const label = String(mm / 10);
      if (dir === 'h')
        out.push(
          text(x + mm, y + long + 3.2, label, {
            sizeMm: 2.6,
            anchor: 'middle',
          }),
        );
      else
        out.push(
          text(x + long + 1.2, y + mm + 0.9, label, {
            sizeMm: 2.6,
            anchor: 'start',
          }),
        );
    }
  }
  out.push(
    dir === 'h'
      ? text(
          x + length / 2,
          y - 1.8,
          o.caption ?? `도안상 ${length}mm (cm 눈금)`,
          { sizeMm: 2.8, anchor: 'middle' },
        )
      : text(x + 10, y - 2.5, o.caption ?? `도안상 ${length}mm`, {
          sizeMm: 2.8,
          anchor: 'start',
        }),
  );
  return out;
}

/** 등록 십자 — 프로그램·자 양쪽에서 기준점으로 쓴다. */
export function regCross(x, y, size = 6) {
  const h = size / 2;
  return [
    line(x - h, y, x + h, y, { strokeMm: 0.15 }),
    line(x, y - h, x, y + h, { strokeMm: 0.15 }),
  ];
}

/**
 * 측정점 — 프로그램(래스터 무게중심)과 사람(자) 양쪽이 같은 곳을 재게 한다.
 * 주변 ±3mm 안에 다른 도형이 없는 자리를 골랐다. 도안을 고치면 이 여유를
 * `measure.mjs`의 자기검사가 확인한다.
 */
export const BOARD_FIDUCIALS = Object.freeze([
  { id: 'A', x: 30, y: 70 },
  { id: 'B', x: 180, y: 70 },
  { id: 'C', x: 155, y: 55 },
  { id: 'D', x: 155, y: 255 },
]);

export const BOARD_SPANS = Object.freeze([
  { id: 'A-B', from: 'A', to: 'B', axis: 'x', nominal: 150 },
  { id: 'C-D', from: 'C', to: 'D', axis: 'y', nominal: 200 },
]);

const FID = 2; // 측정점 사각형 한 변(mm, 100% 기준)

function fiducialMarks() {
  const items = [];
  for (const f of BOARD_FIDUCIALS) {
    items.push(
      rect(f.x - FID / 2, f.y - FID / 2, FID, FID, { fill: INK, strokeMm: 0 }),
    );
  }
  const [A, B, C, D] = BOARD_FIDUCIALS;
  items.push(
    text(A.x, A.y - 6, 'A', { sizeMm: 2.6, anchor: 'middle', bold: true }),
  );
  items.push(
    text(B.x, B.y - 6, 'B', { sizeMm: 2.6, anchor: 'middle', bold: true }),
  );
  items.push(
    text(C.x - 6, C.y + 1, 'C', { sizeMm: 2.6, anchor: 'end', bold: true }),
  );
  items.push(
    text(D.x - 6, D.y + 1, 'D', { sizeMm: 2.6, anchor: 'end', bold: true }),
  );
  // 사람이 자를 댈 보조선 — 측정점에서 6mm 떨어뜨려 무게중심 계산을 방해하지 않는다
  items.push(line(A.x, A.y + 6, B.x, B.y + 6, { strokeMm: 0.12 }));
  items.push(line(A.x, A.y + 4, A.x, A.y + 8, { strokeMm: 0.12 }));
  items.push(line(B.x, B.y + 4, B.x, B.y + 8, { strokeMm: 0.12 }));
  items.push(
    text((A.x + B.x) / 2, A.y + 10, 'A↔B = 도안상 150mm', {
      sizeMm: 2.8,
      anchor: 'middle',
    }),
  );
  items.push(line(C.x + 6, C.y, D.x + 6, D.y, { strokeMm: 0.12 }));
  items.push(line(C.x + 4, C.y, C.x + 8, C.y, { strokeMm: 0.12 }));
  items.push(line(D.x + 4, D.y, D.x + 8, D.y, { strokeMm: 0.12 }));
  items.push(
    text(C.x + 8, (C.y + D.y) / 2, 'C↔D = 도안상 200mm', {
      sizeMm: 2.8,
      anchor: 'start',
    }),
  );
  return items;
}

/**
 * 보드 시트 검증 도안 — 배율 100%에서 210×297mm.
 * 이음 검증용 가로 중앙선과 빗살이 A4 2장 분할선을 반드시 지나도록 배치했다.
 */
export function boardTestPattern() {
  const W = 210,
    H = 297;
  const cx = W / 2,
    cy = H / 2;
  const items = [];

  items.push(rect(0, 0, W, H, { strokeMm: 0.3 }));
  items.push(rect(5, 5, W - 10, H - 10, { strokeMm: 0.15, dash: [2, 2] }));

  // 자로 재는 기준: 100mm 눈금자 두 개(가로·세로)
  items.push(...ruler(20, 40, 100, 'h'));
  items.push(...ruler(20, 150, 100, 'v'));

  // 프로그램이 무는 기준점 — X 정확히 100mm, Y 정확히 200mm 간격
  items.push(...regCross(20, 20), ...regCross(120, 20));
  items.push(...regCross(190, 40), ...regCross(190, 240));

  // 운동장 흉내 — 이음선을 지나는 요소들
  items.push(line(0, cy, W, cy, { strokeMm: 0.3 })); // 하프라인
  items.push(circle(cx, cy, 25));
  items.push(circle(cx, cy, 1.2, { fill: INK, strokeMm: 0 }));
  items.push(rect(cx - 40, 0, 80, 45, { strokeMm: 0.25 }));
  items.push(rect(cx - 40, H - 45, 80, 45, { strokeMm: 0.25 }));
  items.push(line(0, 0, W, H, { strokeMm: 0.1 })); // 비균일 배율 검출용 대각선

  // 이음 단차 빗살 — 세로선 21개가 이음 구간을 통과한다
  for (let i = 0; i <= 20; i++) {
    const x = 10 + i * 9.5;
    items.push(line(x, cy - 30, x, cy + 30, { strokeMm: 0.15 }));
  }

  // 한글 라벨 — 폰트 임베딩·용량 검증 대상
  items.push(
    text(cx, 20, '인쇄 정확도 검증 도안 · 보드 시트', {
      sizeMm: 4.5,
      anchor: 'middle',
      bold: true,
    }),
  );
  items.push(
    text(cx, 26, '배율 100%에서 이 테두리가 210 × 297 mm 여야 한다', {
      sizeMm: 2.8,
      anchor: 'middle',
    }),
  );
  items.push(
    text(cx, H - 14, '자로 잴 곳 — 가로 눈금자 0↔10, 세로 눈금자 0↔10', {
      sizeMm: 2.8,
      anchor: 'middle',
    }),
  );
  items.push(
    text(
      cx,
      H - 9,
      '빗살 21줄이 이음선에서 끊기거나 어긋나면 타일 규격이 틀린 것이다',
      { sizeMm: 2.8, anchor: 'middle' },
    ),
  );

  items.push(...fiducialMarks());
  return {
    name: 'board',
    w: W,
    h: H,
    items,
    fiducials: BOARD_FIDUCIALS,
    spans: BOARD_SPANS,
  };
}

/** 부속 별지 — 오림선·접는선·풀칠면 표기 규약 검증 */
export function accessoryTestPattern() {
  const W = 210,
    H = 148.5;
  const items = [];
  items.push(
    text(10, 12, '부속 별지 검증 — 오림선 · 접는선 · 풀칠면', {
      sizeMm: 4.5,
      bold: true,
    }),
  );

  // 1) 오림선: 실선. 잘라낼 조각 경계
  items.push(rect(10, 20, 60, 40, { strokeMm: 0.25 }));
  items.push(text(12, 26, '오림선 = 실선 0.25mm', { sizeMm: 2.6 }));
  items.push(text(12, 30, '선 위를 그대로 자른다', { sizeMm: 2.6 }));

  // 2) 골접기: 파선
  items.push(rect(80, 20, 60, 40, { strokeMm: 0.25 }));
  items.push(line(110, 20, 110, 60, { strokeMm: 0.2, dash: [2, 1.5] }));
  items.push(text(82, 26, '골접기 = 파선 (2/1.5mm)', { sizeMm: 2.6 }));

  // 3) 산접기: 일점쇄선
  items.push(rect(10, 70, 60, 40, { strokeMm: 0.25 }));
  items.push(
    line(40, 70, 40, 110, { strokeMm: 0.2, dash: [4, 1.2, 0.6, 1.2] }),
  );
  items.push(text(12, 76, '산접기 = 일점쇄선', { sizeMm: 2.6 }));

  // 4) 풀칠면: 45° 해칭 + 라벨
  items.push(rect(80, 70, 60, 40, { strokeMm: 0.25 }));
  items.push({
    kind: 'hatch',
    x: 80,
    y: 70,
    w: 60,
    h: 40,
    gapMm: 1.5,
    strokeMm: 0.12,
    stroke: INK,
  });
  items.push(text(80, 67, '풀칠면 = 45° 해칭 1.5mm', { sizeMm: 2.6 })); // 해칭 위에 겹치면 안 읽힌다

  // 5) 선 굵기 재현 한계 — 가정용 프린터가 어디까지 찍나
  items.push(text(150, 26, '선 굵기 재현', { sizeMm: 2.8, bold: true }));
  [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4].forEach((w, i) => {
    const y = 32 + i * 5;
    items.push(line(150, y, 195, y, { strokeMm: w }));
    items.push(text(150, y - 1.2, `${w}mm`, { sizeMm: 2.2 }));
  });

  items.push(
    text(10, H - 8, '가위로 실제 잘라 보고, 접는선이 접히는지 확인한다', {
      sizeMm: 2.8,
    }),
  );
  return { name: 'accessory', w: W, h: H, items };
}

/**
 * 인쇄 가능 영역 탐침 — 프린터가 실제로 몇 mm까지 찍는지 사용자가 재는 시트.
 * A4 한 장 그대로(배율 없음)이며 타일 분할하지 않는다.
 */
export function printableAreaProbe() {
  const W = 210;
  const H = 297;
  const items = [];
  const insets = [2, 3, 4, 5, 6, 8, 10, 12];

  // 사각형 여덟 개는 1~2mm 간격이라 각자 옆에 숫자를 쓰면 서로 겹쳐 못 읽는다.
  // 대신 안쪽 한 줄에 숫자를 모으고 지시선으로 제 사각형에 잇는다.
  const LADDER_TOP = 26;
  const LADDER_BOTTOM = H - 26;
  insets.forEach((m, i) => {
    items.push(rect(m, m, W - 2 * m, H - 2 * m, { strokeMm: 0.25 }));
    const x = 24 + i * 23;
    items.push(line(x, m, x, LADDER_TOP - 3.4, { strokeMm: 0.1 }));
    items.push(
      text(x, LADDER_TOP, `${m}`, {
        sizeMm: 3.2,
        anchor: 'middle',
        bold: true,
      }),
    );
    items.push(line(x, H - m, x, LADDER_BOTTOM + 1.2, { strokeMm: 0.1 }));
    items.push(
      text(x, LADDER_BOTTOM, `${m}`, {
        sizeMm: 3.2,
        anchor: 'middle',
        bold: true,
      }),
    );
  });
  items.push(
    text(W / 2, LADDER_TOP - 6, '↑ 위쪽 여백(mm)', {
      sizeMm: 3,
      anchor: 'middle',
    }),
  );
  items.push(
    text(W / 2, LADDER_BOTTOM + 6, '↓ 아래쪽 여백(mm)', {
      sizeMm: 3,
      anchor: 'middle',
    }),
  );

  const cy = H / 2;
  items.push(
    text(W / 2, cy - 14, '인쇄 가능 영역 탐침', {
      sizeMm: 6,
      anchor: 'middle',
      bold: true,
    }),
  );
  items.push(
    text(W / 2, cy - 6, '배율 100% · "용지에 맞춤" 끄고 A4 한 장에 인쇄한다', {
      sizeMm: 3.2,
      anchor: 'middle',
    }),
  );
  items.push(
    text(W / 2, cy + 2, '네 변이 모두 온전히 찍힌 가장 바깥 사각형의 숫자가', {
      sizeMm: 3.2,
      anchor: 'middle',
    }),
  );
  items.push(
    text(W / 2, cy + 8, '이 프린터의 인쇄 불가 여백이다.', {
      sizeMm: 3.2,
      anchor: 'middle',
    }),
  );
  items.push(
    text(
      W / 2,
      cy + 16,
      '변마다 값이 다를 수 있으니 위·아래·좌·우를 각각 본다',
      { sizeMm: 3.2, anchor: 'middle' },
    ),
  );
  items.push(
    text(W / 2, cy + 22, '(아래쪽 여백이 가장 큰 기종이 많다)', {
      sizeMm: 3.2,
      anchor: 'middle',
    }),
  );
  items.push(
    text(
      W / 2,
      cy + 32,
      '잰 값을 spikes/print-pipeline/README.md 1절 표에 적는다',
      { sizeMm: 2.8, anchor: 'middle' },
    ),
  );

  return { name: 'probe', w: W, h: H, items, noScale: true };
}

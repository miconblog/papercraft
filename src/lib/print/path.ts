/**
 * SVG path 데이터 — 파싱 · 정규화 · 변환 (IDE-007)
 *
 * 도안 SVG의 모든 도형(`rect`·`line`·`circle`·`path`)을 여기 정의한 절대 좌표
 * 명령 목록 하나로 모은다. 렌더러가 다루는 도형이 한 종류뿐이라야 배율·타일
 * 변환을 한 곳에서만 옳게 짜면 된다.
 *
 * 좌표계는 도안과 같다 — mm, 원점 좌상단, y 아래로 증가.
 */

export type PathCommand =
  | { readonly c: 'M'; readonly x: number; readonly y: number }
  | { readonly c: 'L'; readonly x: number; readonly y: number }
  | {
      readonly c: 'C';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly c: 'A';
      readonly rx: number;
      readonly ry: number;
      /** 타원의 x축 회전(도). 균등 배율에서는 그대로 남는다. */
      readonly rot: number;
      readonly largeArc: boolean;
      readonly sweep: boolean;
      readonly x: number;
      readonly y: number;
    }
  | { readonly c: 'Z' };

const ARG_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

/** 숫자·명령을 훑는다. `1.5.5`(소수점 두 번)와 `1e-3`, `-`로 붙은 인수를 모두 받는다. */
const tokenize = (d: string): Array<string | number> => {
  const tokens: Array<string | number> = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[1] ?? Number(match[2]));
  }
  return tokens;
};

/**
 * `d` 문자열을 절대 좌표 M·L·C·A·Z로 정규화한다.
 *
 * 상대 명령과 H·V·S·T는 여기서 흡수한다 — 뒤에 오는 변환·렌더 코드가 명령
 * 종류를 다시 나눠 다루지 않게 하려는 것이다.
 */
export function parsePathData(d: string): PathCommand[] {
  const tokens = tokenize(d);
  const out: PathCommand[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // 이전 곡선의 제어점 — S·T가 반사해 쓴다.
  let prevCubicCtrlX = 0;
  let prevCubicCtrlY = 0;
  let prevQuadCtrlX = 0;
  let prevQuadCtrlY = 0;
  let prevCmd = '';

  const num = (): number => {
    const t = tokens[i++];
    if (typeof t !== 'number') {
      throw new Error(`path 데이터가 깨졌다: ${d}`);
    }
    return t;
  };

  const quadToCubic = (qx: number, qy: number, ex: number, ey: number) => {
    const c1x = x + (2 / 3) * (qx - x);
    const c1y = y + (2 / 3) * (qy - y);
    const c2x = ex + (2 / 3) * (qx - ex);
    const c2y = ey + (2 / 3) * (qy - ey);
    out.push({ c: 'C', x1: c1x, y1: c1y, x2: c2x, y2: c2y, x: ex, y: ey });
    prevQuadCtrlX = qx;
    prevQuadCtrlY = qy;
    prevCubicCtrlX = c2x;
    prevCubicCtrlY = c2y;
    x = ex;
    y = ey;
  };

  while (i < tokens.length) {
    const head = tokens[i];
    if (typeof head === 'string') {
      cmd = head;
      i++;
    } else if (cmd === '') {
      throw new Error(`path가 명령으로 시작하지 않는다: ${d}`);
    } else if (cmd === 'M') {
      cmd = 'L'; // 암시 반복: M 뒤의 좌표쌍은 L이다
    } else if (cmd === 'm') {
      cmd = 'l';
    }

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    if (!(upper in ARG_COUNT)) throw new Error(`모르는 path 명령이다: ${cmd}`);

    switch (upper) {
      case 'M': {
        const nx = num();
        const ny = num();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        startX = x;
        startY = y;
        out.push({ c: 'M', x, y });
        break;
      }
      case 'L': {
        const nx = num();
        const ny = num();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        out.push({ c: 'L', x, y });
        break;
      }
      case 'H': {
        const nx = num();
        x = rel ? x + nx : nx;
        out.push({ c: 'L', x, y });
        break;
      }
      case 'V': {
        const ny = num();
        y = rel ? y + ny : ny;
        out.push({ c: 'L', x, y });
        break;
      }
      case 'C': {
        const a = num();
        const b = num();
        const c2 = num();
        const d2 = num();
        const e = num();
        const f = num();
        const x1 = rel ? x + a : a;
        const y1 = rel ? y + b : b;
        const x2 = rel ? x + c2 : c2;
        const y2 = rel ? y + d2 : d2;
        const ex = rel ? x + e : e;
        const ey = rel ? y + f : f;
        out.push({ c: 'C', x1, y1, x2, y2, x: ex, y: ey });
        prevCubicCtrlX = x2;
        prevCubicCtrlY = y2;
        x = ex;
        y = ey;
        break;
      }
      case 'S': {
        const c2 = num();
        const d2 = num();
        const e = num();
        const f = num();
        const smooth = prevCmd === 'C' || prevCmd === 'S';
        const x1 = smooth ? 2 * x - prevCubicCtrlX : x;
        const y1 = smooth ? 2 * y - prevCubicCtrlY : y;
        const x2 = rel ? x + c2 : c2;
        const y2 = rel ? y + d2 : d2;
        const ex = rel ? x + e : e;
        const ey = rel ? y + f : f;
        out.push({ c: 'C', x1, y1, x2, y2, x: ex, y: ey });
        prevCubicCtrlX = x2;
        prevCubicCtrlY = y2;
        x = ex;
        y = ey;
        break;
      }
      case 'Q': {
        const a = num();
        const b = num();
        const e = num();
        const f = num();
        quadToCubic(
          rel ? x + a : a,
          rel ? y + b : b,
          rel ? x + e : e,
          rel ? y + f : f,
        );
        break;
      }
      case 'T': {
        const e = num();
        const f = num();
        const smooth = prevCmd === 'Q' || prevCmd === 'T';
        const qx = smooth ? 2 * x - prevQuadCtrlX : x;
        const qy = smooth ? 2 * y - prevQuadCtrlY : y;
        quadToCubic(qx, qy, rel ? x + e : e, rel ? y + f : f);
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const largeArc = num() !== 0;
        const sweep = num() !== 0;
        const e = num();
        const f = num();
        const ex = rel ? x + e : e;
        const ey = rel ? y + f : f;
        out.push({ c: 'A', rx, ry, rot, largeArc, sweep, x: ex, y: ey });
        x = ex;
        y = ey;
        break;
      }
      case 'Z': {
        out.push({ c: 'Z' });
        x = startX;
        y = startY;
        break;
      }
    }
    prevCmd = upper;
  }
  return out;
}

/**
 * 닮음 변환 — 균등 배율 · 회전 · 평행이동.
 *
 * 축마다 다른 배율은 일부러 없다. 도안이 찌그러지면 치수가 뜻을 잃는다.
 * 회전까지만 허용하므로 원호는 반지름에 배율만 곱하고 x축 회전각에 회전을
 * 더하면 정확히 옮겨진다 — 곡선을 근사할 일이 없다.
 */
export interface Transform {
  readonly scale: number;
  readonly rotationDeg: number;
  readonly txMm: number;
  readonly tyMm: number;
}

export const IDENTITY: Transform = {
  scale: 1,
  rotationDeg: 0,
  txMm: 0,
  tyMm: 0,
};

export const translation = (txMm: number, tyMm: number): Transform => ({
  ...IDENTITY,
  txMm,
  tyMm,
});

const RAD = Math.PI / 180;

export const applyTransform = (
  t: Transform,
  xMm: number,
  yMm: number,
): [number, number] => {
  if (t.rotationDeg === 0) {
    return [t.txMm + t.scale * xMm, t.tyMm + t.scale * yMm];
  }
  const a = t.rotationDeg * RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    t.txMm + t.scale * (cos * xMm - sin * yMm),
    t.tyMm + t.scale * (sin * xMm + cos * yMm),
  ];
};

/** `outer ∘ inner` — 안쪽 변환을 먼저 적용한 것과 같다. */
export const composeTransform = (
  outer: Transform,
  inner: Transform,
): Transform => {
  const [txMm, tyMm] = applyTransform(outer, inner.txMm, inner.tyMm);
  return {
    scale: outer.scale * inner.scale,
    rotationDeg: outer.rotationDeg + inner.rotationDeg,
    txMm,
    tyMm,
  };
};

const fmt = (v: number): string => {
  // 소수 넷째 자리면 600dpi(0.042mm)보다 훨씬 촘촘하다. 그 아래는 파일만 키운다.
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};

/**
 * 변환을 적용해 SVG `d` 문자열로 되돌린다.
 *
 * `unit`은 mm를 최종 단위로 바꾸는 함수다 — PDF면 `mmToPt`, 화면 미리보기면
 * 그대로 둔다.
 */
export function toPathData(
  commands: readonly PathCommand[],
  t: Transform = IDENTITY,
  unit: (mm: number) => number = (mm) => mm,
): string {
  const parts: string[] = [];
  const p = (xMm: number, yMm: number): string => {
    const [px, py] = applyTransform(t, xMm, yMm);
    return `${fmt(unit(px))} ${fmt(unit(py))}`;
  };
  for (const cmd of commands) {
    switch (cmd.c) {
      case 'M':
        parts.push(`M ${p(cmd.x, cmd.y)}`);
        break;
      case 'L':
        parts.push(`L ${p(cmd.x, cmd.y)}`);
        break;
      case 'C':
        parts.push(
          `C ${p(cmd.x1, cmd.y1)} ${p(cmd.x2, cmd.y2)} ${p(cmd.x, cmd.y)}`,
        );
        break;
      case 'A':
        parts.push(
          `A ${fmt(unit(cmd.rx * t.scale))} ${fmt(unit(cmd.ry * t.scale))} ${fmt(cmd.rot + t.rotationDeg)} ${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0} ${p(cmd.x, cmd.y)}`,
        );
        break;
      case 'Z':
        parts.push('Z');
        break;
    }
  }
  return parts.join(' ');
}

/** 사각형 → path. 타일 클립 영역과 `<rect>` 도형이 함께 쓴다. */
export const rectPath = (
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): PathCommand[] => [
  { c: 'M', x: xMm, y: yMm },
  { c: 'L', x: xMm + widthMm, y: yMm },
  { c: 'L', x: xMm + widthMm, y: yMm + heightMm },
  { c: 'L', x: xMm, y: yMm + heightMm },
  { c: 'Z' },
];

export const linePath = (
  x1Mm: number,
  y1Mm: number,
  x2Mm: number,
  y2Mm: number,
): PathCommand[] => [
  { c: 'M', x: x1Mm, y: y1Mm },
  { c: 'L', x: x2Mm, y: y2Mm },
];

/** 원 → 반원 두 개. 원호는 pdf-lib이 그대로 받는다. */
export const circlePath = (
  cxMm: number,
  cyMm: number,
  rMm: number,
): PathCommand[] => [
  { c: 'M', x: cxMm - rMm, y: cyMm },
  {
    c: 'A',
    rx: rMm,
    ry: rMm,
    rot: 0,
    largeArc: false,
    sweep: true,
    x: cxMm + rMm,
    y: cyMm,
  },
  {
    c: 'A',
    rx: rMm,
    ry: rMm,
    rot: 0,
    largeArc: false,
    sweep: true,
    x: cxMm - rMm,
    y: cyMm,
  },
  { c: 'Z' },
];

export const polygonPath = (
  points: ReadonlyArray<readonly [number, number]>,
): PathCommand[] => [
  { c: 'M', x: points[0][0], y: points[0][1] },
  ...points.slice(1).map(([x, y]) => ({ c: 'L', x, y }) as const),
  { c: 'Z' },
];

/**
 * 변환을 좌표에 미리 구워 넣는다.
 *
 * 마커 아트워크를 슬롯 자리로 옮길 때처럼, 나중이 아니라 지금 자리를 정해야
 * 하는 경우에 쓴다. 변환을 `<g>`에 걸어 두는 대신 좌표를 바꿔 두면 클립과
 * 변환이 얽혀 도안이 밀려나는 함정(IDE-002 결정 기록)이 아예 생기지 않는다.
 */
export function transformPath(
  commands: readonly PathCommand[],
  t: Transform,
): PathCommand[] {
  if (t === IDENTITY) return [...commands];
  return commands.map((cmd) => {
    switch (cmd.c) {
      case 'M':
      case 'L': {
        const [x, y] = applyTransform(t, cmd.x, cmd.y);
        return { c: cmd.c, x, y };
      }
      case 'C': {
        const [x1, y1] = applyTransform(t, cmd.x1, cmd.y1);
        const [x2, y2] = applyTransform(t, cmd.x2, cmd.y2);
        const [x, y] = applyTransform(t, cmd.x, cmd.y);
        return { c: 'C', x1, y1, x2, y2, x, y };
      }
      case 'A': {
        const [x, y] = applyTransform(t, cmd.x, cmd.y);
        return {
          c: 'A',
          rx: cmd.rx * t.scale,
          ry: cmd.ry * t.scale,
          rot: cmd.rot + t.rotationDeg,
          largeArc: cmd.largeArc,
          sweep: cmd.sweep,
          x,
          y,
        };
      }
      case 'Z':
        return cmd;
    }
  });
}

/**
 * 경로를 세로 중심선(`x = widthMm / 2`) 기준으로 뒤집는다.
 *
 * 닮음 변환(`transformPath`)과 따로 두는 이유는 거울 반전이 회전 방향을
 * 뒤집기 때문이다 — 원호의 `sweep` 플래그와 x축 회전각의 부호가 함께 바뀐다.
 * 이걸 놓치면 둥근 부분만 반대로 부풀어 도형이 미묘하게 틀어진다.
 */
export function mirrorPathX(
  commands: readonly PathCommand[],
  widthMm: number,
): PathCommand[] {
  const X = (x: number) => widthMm - x;
  return commands.map((cmd) => {
    switch (cmd.c) {
      case 'M':
      case 'L':
        return { c: cmd.c, x: X(cmd.x), y: cmd.y };
      case 'C':
        return {
          c: 'C',
          x1: X(cmd.x1),
          y1: cmd.y1,
          x2: X(cmd.x2),
          y2: cmd.y2,
          x: X(cmd.x),
          y: cmd.y,
        };
      case 'A':
        return {
          c: 'A',
          rx: cmd.rx,
          ry: cmd.ry,
          rot: -cmd.rot,
          largeArc: cmd.largeArc,
          sweep: !cmd.sweep,
          x: X(cmd.x),
          y: cmd.y,
        };
      case 'Z':
        return cmd;
    }
  });
}

/**
 * 도안 SVG를 쓰는 최소한의 도구 (IDE-004)
 *
 * 라이브러리를 들이지 않고 문자열을 짓는다. 도안은 좌표가 전부 mm이고 요소
 * 종류도 몇 개뿐이라, 여기 있는 것보다 큰 도구가 필요하지 않다.
 *
 * **viewBox 한 칸 = 1mm**다. `width`/`height`에 mm를 붙여 두면 브라우저로 열어도
 * 실제 크기로 보이고, 렌더러(IDE-007)는 viewBox 좌표를 그대로 mm로 읽으면 된다.
 */
import { MARK_STYLES, type MarkKind } from '../../../../lib/schema/marks.ts';

/** 좌표 반올림. 소수가 길어지면 파일만 커지고 0.001mm는 인쇄에서 의미가 없다. */
export const num = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export type Attrs = Record<string, string | number | undefined>;

const attrsToString = (attrs: Attrs): string =>
  Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) =>
        ` ${k}="${escapeXml(typeof v === 'number' ? num(v) : String(v))}"`,
    )
    .join('');

export const el = (
  tag: string,
  attrs: Attrs = {},
  children?: string,
): string => {
  const open = `<${tag}${attrsToString(attrs)}`;
  return children === undefined ? `${open} />` : `${open}>${children}</${tag}>`;
};

export const group = (attrs: Attrs, children: readonly string[]): string =>
  el('g', attrs, `\n${children.join('\n')}\n`);

export const rect = (
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  attrs: Attrs = {},
): string =>
  el('rect', { x: xMm, y: yMm, width: widthMm, height: heightMm, ...attrs });

export const line = (
  x1Mm: number,
  y1Mm: number,
  x2Mm: number,
  y2Mm: number,
  attrs: Attrs = {},
): string => el('line', { x1: x1Mm, y1: y1Mm, x2: x2Mm, y2: y2Mm, ...attrs });

export const circle = (
  cxMm: number,
  cyMm: number,
  radiusMm: number,
  attrs: Attrs = {},
): string => el('circle', { cx: cxMm, cy: cyMm, r: radiusMm, ...attrs });

export const path = (d: string, attrs: Attrs = {}): string =>
  el('path', { d, ...attrs });

export type TextAnchor = 'start' | 'middle' | 'end';

export const text = (
  value: string,
  xMm: number,
  yMm: number,
  fontSizeMm: number,
  attrs: Attrs = {},
): string =>
  el(
    'text',
    {
      x: xMm,
      y: yMm,
      'font-size': fontSizeMm,
      // 좌표를 글자 상자의 세로 중심으로 읽는다. 도안 치수를 잴 때 베이스라인보다
      // 중심이 다루기 쉽다.
      'dominant-baseline': 'central',
      ...attrs,
    },
    escapeXml(value),
  );

/**
 * 글자 폭 어림값.
 *
 * 한글은 정사각형에 가까워 글자 크기와 거의 같은 폭을 먹고, 라틴 문자·숫자는
 * 그 절반쯤이다. 줄바꿈 자리를 정하고 "이 텍스트가 칸을 넘는가"를 검사하는 데
 * 쓴다 — 정밀한 조판이 목적이 아니므로 이 정도면 충분하다.
 */
export const estimateTextWidthMm = (
  value: string,
  fontSizeMm: number,
): number => {
  let em = 0;
  for (const ch of value) {
    if (ch === ' ') em += 0.3;
    else if (/[ᄀ-ᇿ㄰-㆏가-힯　-〿]/.test(ch)) em += 1;
    else if (/[—…·–]/.test(ch)) em += 1;
    else em += 0.55;
  }
  return em * fontSizeMm;
};

/** 어절 단위로 끊어 폭에 맞춘다. 한 어절이 폭보다 길면 그 어절은 그대로 둔다. */
export const wrapText = (
  value: string,
  fontSizeMm: number,
  maxWidthMm: number,
): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of value.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (
      current !== '' &&
      estimateTextWidthMm(candidate, fontSizeMm) > maxWidthMm
    ) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
};

/**
 * 표시(오림선·접는선·풀칠면) 레이어.
 *
 * 굵기와 파선은 렌더러가 레이어 id로 찾아 다시 입힌다(`docs/game-authoring.md`).
 * 여기서 넣는 값은 **브라우저로 SVG를 열어 봤을 때의 기본값**일 뿐이라 개별
 * 도형이 아니라 레이어 `<g>`에만 건다 — 렌더러가 이 속성 한 줄만 갈아 끼우면
 * 된다.
 */
export const markLayer = (
  kind: MarkKind,
  children: readonly string[],
): string => {
  const style = MARK_STYLES[kind];
  return group(
    {
      id: style.layerId,
      fill: 'none',
      stroke: style.color,
      'stroke-width': style.strokeMm,
      'stroke-dasharray': style.dashMm?.map(num).join(' '),
      'stroke-linecap': 'butt',
    },
    children,
  );
};

/** 풀칠면 빗금. 45° 평행선을 사각형 안에만 그린다. */
export const glueHatch = (
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  spacingMm = 1.5,
): string[] => {
  const strokes: string[] = [];
  // 45°선 x + y = k. 사각형을 가로지르는 k 범위를 훑는다.
  const kStart = xMm + yMm;
  const kEnd = xMm + widthMm + yMm + heightMm;
  const step = spacingMm * Math.SQRT2;
  for (let k = kStart + step; k < kEnd; k += step) {
    // 선분과 사각형의 교차 구간을 x로 표현하면 [max(x, k-(y+h)), min(x+w, k-y)]
    const x1 = Math.max(xMm, k - (yMm + heightMm));
    const x2 = Math.min(xMm + widthMm, k - yMm);
    if (x2 - x1 <= 0.01) continue;
    strokes.push(line(x1, k - x1, x2, k - x2));
  }
  return strokes;
};

export interface SvgDocumentOptions {
  readonly widthMm: number;
  readonly heightMm: number;
  /** 접근성·검색용 제목. 인쇄에는 나오지 않는다. */
  readonly title: string;
  readonly children: readonly string[];
}

export const svgDocument = ({
  widthMm,
  heightMm,
  title,
  children,
}: SvgDocumentOptions): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- 자동 생성 파일. 고치려면 src/assets/games/soccer/artwork/ 를 고치고 `npm run artwork` 를 돌린다. -->',
    el(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: `${num(widthMm)}mm`,
        height: `${num(heightMm)}mm`,
        viewBox: `0 0 ${num(widthMm)} ${num(heightMm)}`,
        'font-family': 'Noto Sans KR',
      },
      `\n${[el('title', {}, escapeXml(title)), ...children].join('\n')}\n`,
    ),
    '',
  ].join('\n');

/** 도안 본문(표시선이 아닌 그림) 레이어. */
export const ART_LAYER_ID = 'pc-art';

/** 초록 필드 라인. 흑백으로 뽑아도 회색 선으로 남는다. */
export const FIELD_LINE_COLOR = '#2f7d32';
/** 글자와 표 괘선. */
export const INK_COLOR = '#1a1a1a';
export const RULE_COLOR = '#6b7280';

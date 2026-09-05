/**
 * 도안 SVG를 그리기 목록으로 읽는다 (IDE-007)
 *
 * 입력은 `npm run artwork`가 만든 우리 SVG(`public/games/<id>/*.svg`)뿐이다 —
 * 임의의 SVG를 다루는 파서가 아니라, 우리가 쓰는 요소만 정확히 읽고 나머지는
 * **조용히 넘기지 않고 예외로 알린다**. 도안에 새 요소가 생겼는데 인쇄물에서만
 * 빠지는 일이 제일 나쁘다.
 *
 * 변환(`transform`)은 파싱 시점에 좌표로 구워 넣는다. 클립과 변환이 같은 `<g>`에
 * 걸려 잘리는 자리가 밀려나는 함정(IDE-002 결정 기록)이 생길 여지를 없앤다.
 */
import { MARK_STYLES, type MarkKind } from '@/lib/schema';
import { MIN_STROKE_MM } from './geometry';
import {
  BLACK,
  path as pathDraw,
  text as textDraw,
  type Draw,
  type LineCap,
  type TextAnchor,
  type TextBaseline,
} from './draw';
import {
  circlePath,
  composeTransform,
  IDENTITY,
  linePath,
  parsePathData,
  rectPath,
  transformPath,
  type Transform,
} from './path';

export interface Artwork {
  /** viewBox가 정한 도안 크기. 배율 100%에서 종이 위 mm다. */
  readonly widthMm: number;
  readonly heightMm: number;
  readonly items: readonly Draw[];
}

export interface ParseArtworkOptions {
  /** 레이어 id → 색. 커스터마이즈의 `paint` 배치가 여기로 들어온다. */
  readonly paint?: Readonly<Record<string, { fill?: string; stroke?: string }>>;
}

/** 표시 레이어 id → 표시 종류. 렌더러가 굵기·파선을 여기서 다시 입힌다. */
const MARK_BY_LAYER: ReadonlyMap<string, MarkKind> = new Map(
  (
    Object.entries(MARK_STYLES) as Array<
      [MarkKind, (typeof MARK_STYLES)[MarkKind]]
    >
  ).map(([kind, style]) => [style.layerId, kind]),
);

interface Inherited {
  fill: string | null;
  stroke: string | null;
  strokeMm: number;
  dashMm: readonly number[] | null;
  lineCap: LineCap;
  fontSizeMm: number;
  bold: boolean;
  anchor: TextAnchor;
  baseline: TextBaseline;
  transform: Transform;
  mark: MarkKind | null;
}

const ROOT: Inherited = {
  // SVG 기본값과 같다 — 도안이 명시하지 않으면 검은 칠에 선 없음이다.
  fill: BLACK,
  stroke: null,
  strokeMm: 1,
  dashMm: null,
  lineCap: 'butt',
  fontSizeMm: 3,
  bold: false,
  anchor: 'start',
  baseline: 'alphabetic',
  transform: IDENTITY,
  mark: null,
};

const unescapeXml = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/g, '&');

// 속성 이름에는 숫자도 온다(`x1`·`y2`). 첫 글자만 영문으로 제한한다.
const ATTR_RE = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g;

const readAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(raw)) !== null) {
    attrs[match[1]] = unescapeXml(match[2]);
  }
  return attrs;
};

const numbers = (value: string): number[] =>
  value
    .split(/[\s,]+/)
    .filter((s) => s !== '')
    .map(Number);

/** `none`·빈 값은 "칠하지 않는다"다. `currentColor` 같은 간접 색은 도안에 쓰지 않는다. */
const readPaint = (value: string | undefined, fallback: string | null) => {
  if (value === undefined) return fallback;
  const v = value.trim();
  if (v === '' || v === 'none') return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
    throw new Error(`도안 SVG의 색이 #RRGGBB가 아니다: ${value}`);
  }
  return v;
};

const TRANSFORM_RE = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

/** `translate`·`scale`·`rotate`만 받는다. 그 밖은 닮음 변환이 아니라 치수를 깬다. */
function readTransform(value: string): Transform {
  let t = IDENTITY;
  let match: RegExpExecArray | null;
  let consumed = 0;
  TRANSFORM_RE.lastIndex = 0;
  while ((match = TRANSFORM_RE.exec(value)) !== null) {
    const [, name, argsRaw] = match;
    const args = numbers(argsRaw);
    if (name === 'translate') {
      t = composeTransform(t, {
        ...IDENTITY,
        txMm: args[0] ?? 0,
        tyMm: args[1] ?? 0,
      });
    } else if (name === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      if (sx !== sy) {
        throw new Error(`축마다 다른 배율은 쓰지 않는다: scale(${argsRaw})`);
      }
      t = composeTransform(t, { ...IDENTITY, scale: sx });
    } else if (name === 'rotate') {
      if (args.length > 1) {
        // rotate(a cx cy) = translate(cx,cy) rotate(a) translate(-cx,-cy)
        const [a, cx = 0, cy = 0] = args;
        t = composeTransform(t, { ...IDENTITY, txMm: cx, tyMm: cy });
        t = composeTransform(t, { ...IDENTITY, rotationDeg: a });
        t = composeTransform(t, { ...IDENTITY, txMm: -cx, tyMm: -cy });
      } else {
        t = composeTransform(t, { ...IDENTITY, rotationDeg: args[0] ?? 0 });
      }
    } else {
      throw new Error(`도안 SVG에서 지원하지 않는 변환이다: ${name}()`);
    }
    consumed += match[0].length;
  }
  // 읽지 못한 조각이 남으면 조용히 무시하지 않는다.
  if (consumed < value.replace(/[\s,]/g, '').length) {
    throw new Error(`도안 SVG의 변환을 다 읽지 못했다: ${value}`);
  }
  return t;
}

function inherit(
  parent: Inherited,
  attrs: Record<string, string>,
  paint: ParseArtworkOptions['paint'],
): Inherited {
  const layerId = attrs.id;
  const override = layerId ? paint?.[layerId] : undefined;
  const mark =
    (layerId ? MARK_BY_LAYER.get(layerId) : undefined) ?? parent.mark;

  const next: Inherited = {
    ...parent,
    mark,
    fill: readPaint(override?.fill ?? attrs.fill, parent.fill),
    stroke: readPaint(override?.stroke ?? attrs.stroke, parent.stroke),
    strokeMm:
      attrs['stroke-width'] !== undefined
        ? Number(attrs['stroke-width'])
        : parent.strokeMm,
    dashMm:
      attrs['stroke-dasharray'] !== undefined
        ? attrs['stroke-dasharray'] === 'none'
          ? null
          : numbers(attrs['stroke-dasharray'])
        : parent.dashMm,
    lineCap: (attrs['stroke-linecap'] as LineCap) ?? parent.lineCap,
    fontSizeMm:
      attrs['font-size'] !== undefined
        ? Number(attrs['font-size'])
        : parent.fontSizeMm,
    bold:
      attrs['font-weight'] !== undefined
        ? Number(attrs['font-weight']) >= 600 || attrs['font-weight'] === 'bold'
        : parent.bold,
    anchor: (attrs['text-anchor'] as TextAnchor) ?? parent.anchor,
    baseline:
      attrs['dominant-baseline'] === 'central' ||
      attrs['dominant-baseline'] === 'middle'
        ? 'central'
        : attrs['dominant-baseline'] !== undefined
          ? 'alphabetic'
          : parent.baseline,
    transform: attrs.transform
      ? composeTransform(parent.transform, readTransform(attrs.transform))
      : parent.transform,
  };
  return next;
}

/**
 * 표시 레이어 안의 도형은 도안이 적어 둔 굵기·파선을 버리고 규약 값을 쓴다.
 * 도안 SVG의 값은 브라우저로 열어 봤을 때의 기본값일 뿐이다
 * (`docs/game-authoring.md` 표시 규약).
 */
function markStyle(mark: MarkKind) {
  const style = MARK_STYLES[mark];
  return {
    stroke: style.color,
    fill: null,
    strokeMm: Math.max(style.strokeMm, MIN_STROKE_MM),
    dashMm: style.dashMm,
    fixedStroke: true,
    mark,
  } as const;
}

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g;

export function parseArtwork(
  svg: string,
  { paint }: ParseArtworkOptions = {},
): Artwork {
  const items: Draw[] = [];
  const stack: Inherited[] = [];
  let current = ROOT;
  let widthMm = 0;
  let heightMm = 0;
  let seenRoot = false;
  // `<text>`·`<title>`는 내용을 읽어야 해서 열린 태그를 기억해 둔다.
  let capture: {
    tag: string;
    style: Inherited;
    attrs: Record<string, string>;
    from: number;
  } | null = null;

  const emitPath = (
    commands: ReturnType<typeof rectPath>,
    style: Inherited,
    closedShape: boolean,
  ) => {
    const base = style.mark ? markStyle(style.mark) : null;
    const stroke = base ? base.stroke : style.stroke;
    const fill = base ? base.fill : style.fill;
    // SVG의 fill 기본값은 검정이지만, 선만 있는 도형(line·열린 path)에는
    // 칠이 뜻을 갖지 않는다. 도안이 명시한 것만 칠한다.
    if (fill === null && stroke === null) return;
    items.push(
      pathDraw(transformPath(commands, style.transform), {
        fill: closedShape ? fill : null,
        stroke,
        strokeMm:
          (base ? base.strokeMm : style.strokeMm) *
          (base ? 1 : style.transform.scale),
        dashMm: base ? base.dashMm : style.dashMm,
        lineCap: style.lineCap,
        fixedStroke: base?.fixedStroke ?? false,
        mark: style.mark,
      }),
    );
  };

  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(svg)) !== null) {
    const [, closing, tag, rawAttrs, selfClosing] = match;

    if (capture) {
      if (closing && tag === capture.tag) {
        const content = unescapeXml(
          svg.slice(capture.from, match.index).replace(/<[^>]*>/g, ''),
        ).trim();
        if (capture.tag === 'text' && content !== '') {
          const style = capture.style;
          const [xMm, yMm] = [
            Number(capture.attrs.x ?? 0),
            Number(capture.attrs.y ?? 0),
          ];
          const t = style.transform;
          items.push(
            textDraw(
              content,
              t.txMm + t.scale * xMm,
              t.tyMm + t.scale * yMm,
              style.fontSizeMm * t.scale,
              {
                anchor: style.anchor,
                baseline: style.baseline,
                bold: style.bold,
                fill: style.fill ?? BLACK,
                rotationDeg: t.rotationDeg,
              },
            ),
          );
        }
        capture = null;
      }
      continue;
    }

    if (closing) {
      if (tag === 'g') current = stack.pop() ?? ROOT;
      continue;
    }

    const attrs = readAttrs(rawAttrs);

    if (tag === 'svg') {
      if (seenRoot) throw new Error('도안 SVG 안에 <svg>를 중첩하지 않는다');
      seenRoot = true;
      const box = numbers(attrs.viewBox ?? '');
      if (box.length !== 4 || box[0] !== 0 || box[1] !== 0) {
        throw new Error(
          `viewBox는 "0 0 너비 높이"여야 한다: ${attrs.viewBox ?? '(없음)'}`,
        );
      }
      [, , widthMm, heightMm] = box;
      current = inherit(ROOT, attrs, paint);
      continue;
    }

    switch (tag) {
      case 'g': {
        const style = inherit(current, attrs, paint);
        if (!selfClosing) {
          stack.push(current);
          current = style;
        }
        break;
      }
      case 'title':
      case 'desc':
        if (!selfClosing)
          capture = { tag, style: current, attrs, from: TAG_RE.lastIndex };
        break;
      case 'text':
        if (selfClosing) break;
        capture = {
          tag,
          style: inherit(current, attrs, paint),
          attrs,
          from: TAG_RE.lastIndex,
        };
        break;
      case 'rect': {
        const style = inherit(current, attrs, paint);
        emitPath(
          rectPath(
            Number(attrs.x ?? 0),
            Number(attrs.y ?? 0),
            Number(attrs.width),
            Number(attrs.height),
          ),
          style,
          true,
        );
        break;
      }
      case 'line': {
        const style = inherit(current, attrs, paint);
        emitPath(
          linePath(
            Number(attrs.x1 ?? 0),
            Number(attrs.y1 ?? 0),
            Number(attrs.x2 ?? 0),
            Number(attrs.y2 ?? 0),
          ),
          style,
          false,
        );
        break;
      }
      case 'circle': {
        const style = inherit(current, attrs, paint);
        emitPath(
          circlePath(
            Number(attrs.cx ?? 0),
            Number(attrs.cy ?? 0),
            Number(attrs.r),
          ),
          style,
          true,
        );
        break;
      }
      case 'path': {
        const style = inherit(current, attrs, paint);
        const commands = parsePathData(attrs.d ?? '');
        // 닫힌 path만 칠한다 — 열린 path에 칠을 넣으면 SVG와 다르게 보인다.
        emitPath(
          commands,
          style,
          commands.some((c) => c.c === 'Z'),
        );
        break;
      }
      default:
        throw new Error(`도안 SVG에서 지원하지 않는 요소다: <${tag}>`);
    }
  }

  if (!seenRoot) throw new Error('도안 SVG에 <svg> 루트가 없다');
  return { widthMm, heightMm, items };
}

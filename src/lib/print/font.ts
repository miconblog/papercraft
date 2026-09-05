/**
 * 한글 글자를 벡터 윤곽선으로 그린다 (IDE-007)
 *
 * `docs/print-spec.md` §7의 결론을 그대로 따른다 — **폰트를 PDF에 임베딩하지
 * 않는다.** `pdf-lib`의 한글 CID 임베딩은 뷰어마다 다르게 깨지고, 더 나쁘게는
 * 문서에 따라 깨지기도 하고 아니기도 했다(IDE-002 §8.5). 윤곽선으로 그리면
 * 폰트 해석이 개입할 자리가 없다.
 *
 * Node에서만 돈다(`node:fs`). 서버 라우트에서만 부른다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fontkit, { type Font } from '@pdf-lib/fontkit';
import type { TextAnchor, TextBaseline, TextDraw } from './draw';
import { parsePathData, type PathCommand } from './path';

/** 저장소에 둔 폰트. 생성 시점에만 읽고 사용자에게 내려보내지 않는다. */
const FONT_DIR = join(process.cwd(), 'assets', 'fonts');
const FONT_FILES = {
  regular: 'NotoSansKR-Regular.otf',
  bold: 'NotoSansKR-Bold.otf',
} as const;

export type FontWeight = keyof typeof FONT_FILES;

export interface Outliner {
  /** 글자 폭(mm). 줄바꿈·맞춤 계산이 이 값을 쓴다. */
  widthMm(text: string, sizeMm: number): number;
  /**
   * 글자 윤곽선. 원점은 글자의 시작점, y는 아래로 증가하고 **베이스라인이 y=0**이다.
   * 도안 좌표계와 방향이 같아 그대로 옮겨 놓기만 하면 된다.
   */
  outline(text: string, sizeMm: number): PathCommand[];
  /**
   * `dominant-baseline="central"`이 뜻하는 베이스라인 내림폭(em 배수).
   *
   * 글자 상자(ascent~descent)의 세로 가운데를 기준점에 맞추는 값이다.
   * 브라우저 미리보기가 쓰는 계산과 같아야 미리보기와 인쇄물이 어긋나지 않는다.
   */
  readonly centralShiftEm: number;
}

const cache = new Map<FontWeight, Outliner>();

/**
 * 글리프 좌표(폰트 단위, y 위로 증가) → 도안 좌표(mm, y 아래로 증가).
 *
 * 세로를 뒤집으므로 닮음 변환(`transformPath`)으로는 안 된다. 글리프 윤곽선에는
 * 원호가 없어 M·L·C·Z만 다루면 된다.
 */
const flipY = (
  cmd: PathCommand,
  k: number,
  dx: number,
  dy: number,
): PathCommand => {
  const X = (x: number) => dx + k * x;
  const Y = (y: number) => dy - k * y;
  switch (cmd.c) {
    case 'M':
    case 'L':
      return { c: cmd.c, x: X(cmd.x), y: Y(cmd.y) };
    case 'C':
      return {
        c: 'C',
        x1: X(cmd.x1),
        y1: Y(cmd.y1),
        x2: X(cmd.x2),
        y2: Y(cmd.y2),
        x: X(cmd.x),
        y: Y(cmd.y),
      };
    case 'Z':
      return cmd;
    case 'A':
      throw new Error('글리프 윤곽선에 원호가 나왔다 — 폰트 처리를 다시 본다');
  }
};

const createOutliner = (font: Font): Outliner => {
  const upem = font.unitsPerEm;
  // fontkit의 descent는 음수다. (ascent + descent)/2 가 글자 상자의 세로 중심이다.
  const centralShiftEm = (font.ascent + font.descent) / 2 / upem;
  return {
    centralShiftEm,
    widthMm: (text, sizeMm) => (font.layout(text).advanceWidth * sizeMm) / upem,
    outline(text, sizeMm) {
      const run = font.layout(text);
      const k = sizeMm / upem;
      let cursor = 0;
      const commands: PathCommand[] = [];
      run.glyphs.forEach((glyph, i) => {
        const pos = run.positions[i];
        const d = glyph.path.toSVG();
        if (d) {
          const dx = (cursor + (pos.xOffset ?? 0)) * k;
          const dy = -(pos.yOffset ?? 0) * k;
          for (const cmd of parsePathData(d)) {
            commands.push(flipY(cmd, k, dx, dy));
          }
        }
        cursor += pos.xAdvance;
      });
      return commands;
    },
  };
};

export function loadFont(weight: FontWeight): Outliner {
  const cached = cache.get(weight);
  if (cached) return cached;
  const file = join(FONT_DIR, FONT_FILES[weight]);
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    throw new Error(
      `인쇄용 폰트를 찾지 못했다: ${file} — assets/fonts/README.md를 본다`,
    );
  }
  const outliner = createOutliner(fontkit.create(bytes) as Font);
  cache.set(weight, outliner);
  return outliner;
}

export const fontFor = (bold: boolean): Outliner =>
  loadFont(bold ? 'bold' : 'regular');

const anchorShift = (anchor: TextAnchor, widthMm: number): number =>
  anchor === 'middle' ? -widthMm / 2 : anchor === 'end' ? -widthMm : 0;

export interface LaidOutText {
  readonly commands: readonly PathCommand[];
  /** 실제로 쓴 글자 크기. `maxWidthMm`에 맞추느라 줄었을 수 있다. */
  readonly sizeMm: number;
  readonly widthMm: number;
  /** 기준점에서 왼쪽 시작점까지의 이동량. */
  readonly dxMm: number;
  /** 기준점에서 베이스라인까지의 이동량. */
  readonly dyMm: number;
}

/**
 * 글자 하나를 배치한다 — 정렬 · 베이스라인 · `maxWidthMm` 맞춤까지.
 *
 * 좌표는 기준점(`xMm`,`yMm`)을 원점으로 한 로컬 mm다. 회전은 부르는 쪽이
 * 변환으로 얹는다.
 */
export function layoutText(
  item: Pick<
    TextDraw,
    'text' | 'sizeMm' | 'anchor' | 'baseline' | 'bold' | 'maxWidthMm'
  >,
  outliner: Outliner = fontFor(item.bold),
): LaidOutText {
  const natural = outliner.widthMm(item.text, item.sizeMm);
  // 칸을 넘치면 글자를 줄여 맞춘다. 넘친 채로 두면 옆 칸을 침범한다.
  const sizeMm =
    item.maxWidthMm !== null && natural > item.maxWidthMm && natural > 0
      ? (item.sizeMm * item.maxWidthMm) / natural
      : item.sizeMm;
  const widthMm = sizeMm === item.sizeMm ? natural : item.maxWidthMm!;
  const dxMm = anchorShift(item.anchor, widthMm);
  const dyMm = baselineShift(item.baseline, sizeMm, outliner);
  const commands = outliner
    .outline(item.text, sizeMm)
    .map((cmd) => shift(cmd, dxMm, dyMm));
  return { commands, sizeMm, widthMm, dxMm, dyMm };
}

const baselineShift = (
  baseline: TextBaseline,
  sizeMm: number,
  outliner: Outliner,
): number => (baseline === 'central' ? outliner.centralShiftEm * sizeMm : 0);

const shift = (cmd: PathCommand, dx: number, dy: number): PathCommand => {
  switch (cmd.c) {
    case 'M':
    case 'L':
      return { c: cmd.c, x: cmd.x + dx, y: cmd.y + dy };
    case 'C':
      return {
        c: 'C',
        x1: cmd.x1 + dx,
        y1: cmd.y1 + dy,
        x2: cmd.x2 + dx,
        y2: cmd.y2 + dy,
        x: cmd.x + dx,
        y: cmd.y + dy,
      };
    case 'A':
      return { ...cmd, x: cmd.x + dx, y: cmd.y + dy };
    case 'Z':
      return cmd;
  }
};

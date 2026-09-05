/**
 * 조립 안내 시트 (IDE-007)
 *
 * 몇 장이 나오는지 · 어떤 순서로 붙이는지 · 표시가 무엇을 뜻하는지를 한 장에
 * 모은다. 스파이크 범위 밖이라 여기서 새로 만든다(`docs/print-spec.md` §10).
 *
 * 확대해서 뽑으면 A4가 여덟 장 쏟아진다. 번호와 배치도가 없으면 어느 장이
 * 어디였는지 종이를 늘어놓고 맞춰 봐야 한다.
 */
import { MARK_STYLES, type MarkKind } from '@/lib/schema';
import type { GameDefinition } from '@/lib/schema';
import { A4, MIN_STROKE_MM, scaleLabel } from './geometry';
import { BLACK, INK, path, text, type Draw } from './draw';
import { linePath, rectPath } from './path';
import type { ExportPage, PartExportPlan } from './compose';
import type { ExportOptions } from './options';

const MARGIN_MM = 12;
const TITLE_MM = 6.5;
const HEADING_MM = 4.2;
const BODY_MM = 3.2;
const SMALL_MM = 2.8;
const LINE_MM = 4.6;

/** print-spec §9 — 사용자에게 반드시 노출할 인쇄 설정. */
export const PRINT_SETTINGS: readonly string[] = [
  '크기를 “실제 크기(100%)”로 둔다 — “용지에 맞춤”을 끈다',
  '“자동 회전 및 가운데 맞춤”을 끈다',
  '용지는 A4, 프린터의 “테두리 없음(무여백)”을 끈다',
];

export interface AssemblyInput {
  readonly game: GameDefinition;
  readonly parts: readonly PartExportPlan[];
  readonly options: ExportOptions;
}

interface Cursor {
  yMm: number;
  items: Draw[];
}

const rule = (yMm: number, x0: number, x1: number): Draw =>
  path(linePath(x0, yMm, x1, yMm), {
    stroke: '#9ca3af',
    strokeMm: MIN_STROKE_MM,
    fixedStroke: true,
  });

export function assemblyGuidePages({
  game,
  parts,
  options,
}: AssemblyInput): ExportPage[] {
  const pageW = A4.widthMm;
  const pageH = A4.heightMm;
  const left = MARGIN_MM;
  const right = pageW - MARGIN_MM;
  const bottom = pageH - MARGIN_MM;
  const width = right - left;

  const pages: Draw[][] = [];
  let cursor: Cursor = { yMm: MARGIN_MM + TITLE_MM, items: [] };

  const startPage = (continued: boolean) => {
    cursor = { yMm: MARGIN_MM + TITLE_MM, items: [] };
    cursor.items.push(
      text(
        continued
          ? `${game.title} 조립 안내 (이어서)`
          : `${game.title} 조립 안내`,
        left,
        cursor.yMm,
        TITLE_MM,
        { bold: true, fill: INK, maxWidthMm: width },
      ),
    );
    cursor.yMm += TITLE_MM + 2;
    cursor.items.push(rule(cursor.yMm, left, right));
    cursor.yMm += 6;
  };

  const need = (heightMm: number) => {
    if (cursor.yMm + heightMm > bottom) {
      pages.push(cursor.items);
      startPage(true);
    }
  };

  startPage(false);

  // ── 인쇄 설정 ─────────────────────────────────────────────────────────
  cursor.items.push(
    text('먼저 · 인쇄 설정', left, cursor.yMm, HEADING_MM, {
      bold: true,
      fill: INK,
    }),
  );
  cursor.yMm += LINE_MM + 1;
  cursor.items.push(
    text(
      '프린터의 자동 맞춤이 치수를 말없이 바꾼다. 아래를 확인하고 뽑는다.',
      left,
      cursor.yMm,
      BODY_MM,
      { fill: INK, maxWidthMm: width },
    ),
  );
  cursor.yMm += LINE_MM;
  for (const line of PRINT_SETTINGS) {
    cursor.items.push(
      text(`· ${line}`, left + 2, cursor.yMm, BODY_MM, {
        fill: INK,
        maxWidthMm: width - 2,
      }),
    );
    cursor.yMm += LINE_MM;
  }
  cursor.yMm += 3;

  // ── 파트별 배치도 ─────────────────────────────────────────────────────
  cursor.items.push(
    text('이 묶음에 든 것', left, cursor.yMm, HEADING_MM, {
      bold: true,
      fill: INK,
    }),
  );
  cursor.yMm += LINE_MM + 1;

  let sheetNo = 0;
  for (const entry of parts) {
    const diagram = diagramSize(entry);
    need(Math.max(diagram.heightMm, LINE_MM * 3) + 8);

    const top = cursor.yMm;
    cursor.items.push(
      text(entry.part.title, left, top, BODY_MM + 0.4, {
        bold: true,
        fill: INK,
        maxWidthMm: width - diagram.widthMm - 6,
      }),
    );
    const pagesForPart = entry.plan.total * entry.copies;
    const copyText = entry.copies > 1 ? ` · ${entry.copies}벌` : '';
    cursor.items.push(
      text(
        `배율 ${scaleLabel(entry.scale)} · A4 ${entry.plan.total}장${copyText} · 뽑히는 장수 ${pagesForPart}장`,
        left,
        top + LINE_MM,
        SMALL_MM,
        { fill: INK, maxWidthMm: width - diagram.widthMm - 6 },
      ),
    );
    cursor.items.push(
      text(
        `이 묶음의 ${sheetNo + 1}–${sheetNo + pagesForPart}번 장 · ${sizeText(entry)}`,
        left,
        top + LINE_MM * 2,
        SMALL_MM,
        { fill: '#6b7280', maxWidthMm: width - diagram.widthMm - 6 },
      ),
    );
    sheetNo += pagesForPart;

    cursor.items.push(
      ...tileDiagram(entry, right - diagram.widthMm, top - 2, diagram),
    );
    cursor.yMm = top + Math.max(diagram.heightMm, LINE_MM * 3) + 5;
  }

  // ── 붙이는 법 ─────────────────────────────────────────────────────────
  const tiled = parts.filter((p) => p.plan.total > 1);
  if (tiled.length > 0) {
    need(LINE_MM * 6);
    cursor.yMm += 2;
    cursor.items.push(rule(cursor.yMm, left, right));
    cursor.yMm += 6;
    cursor.items.push(
      text('여러 장을 붙이는 법', left, cursor.yMm, HEADING_MM, {
        bold: true,
        fill: INK,
      }),
    );
    cursor.yMm += LINE_MM + 1;
    const overlap = options.overlapMm;
    for (const line of [
      '1. 장마다 아래쪽 띠에 “몇/몇 장 (몇 행 몇 열)”이 적혀 있다. 위 배치도대로 늘어놓는다.',
      '2. 네 귀퉁이의 재단선을 따라 흰 여백을 잘라 낸다.',
      `3. 파선이 겹침 ${overlap}mm 자리다. 옆 장을 파선까지 얹으면 도안이 이어진다.`,
      '4. 겹침 자리의 삼각형 두 개가 정확히 포개지는지 보고 붙인다.',
      '5. 가로줄을 먼저 다 잇고, 줄끼리 위에서 아래로 붙인다.',
    ]) {
      cursor.items.push(
        text(line, left, cursor.yMm, BODY_MM, { fill: INK, maxWidthMm: width }),
      );
      cursor.yMm += LINE_MM;
    }
    cursor.yMm += 3;
  }

  // ── 표시 규약 ─────────────────────────────────────────────────────────
  const marks = usedMarks(parts);
  if (marks.length > 0) {
    need(LINE_MM * (marks.length + 3));
    cursor.items.push(rule(cursor.yMm, left, right));
    cursor.yMm += 6;
    cursor.items.push(
      text('부속의 선이 뜻하는 것', left, cursor.yMm, HEADING_MM, {
        bold: true,
        fill: INK,
      }),
    );
    cursor.yMm += LINE_MM + 2;
    for (const kind of marks) {
      const style = MARK_STYLES[kind];
      cursor.items.push(
        path(linePath(left, cursor.yMm, left + 18, cursor.yMm), {
          stroke: style.color,
          strokeMm: Math.max(style.strokeMm, MIN_STROKE_MM),
          dashMm: style.dashMm,
          fixedStroke: true,
        }),
        text(style.label, left + 21, cursor.yMm, BODY_MM, {
          bold: true,
          fill: INK,
        }),
        text(style.instruction, left + 42, cursor.yMm, BODY_MM, {
          fill: INK,
          maxWidthMm: width - 42,
        }),
      );
      cursor.yMm += LINE_MM + 1;
    }
  }

  pages.push(cursor.items);

  return pages.map((items) => ({
    widthMm: pageW,
    heightMm: pageH,
    clip: null,
    transform: { scale: 1, txMm: 0, tyMm: 0 },
    items: [],
    marks: items,
  }));
}

const sizeText = (entry: PartExportPlan): string =>
  `완성 크기 ${round(entry.part.widthMm * entry.scale)}×${round(entry.part.heightMm * entry.scale)}mm`;

const round = (v: number) => Math.round(v * 10) / 10;

const usedMarks = (parts: readonly PartExportPlan[]): MarkKind[] => {
  const seen = new Set<MarkKind>();
  for (const entry of parts) for (const m of entry.part.marks) seen.add(m);
  return (Object.keys(MARK_STYLES) as MarkKind[]).filter((k) => seen.has(k));
};

interface DiagramSize {
  readonly cellWMm: number;
  readonly cellHMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

/** 장 배치도의 칸 크기. 파트의 가로세로비를 따라가되 너무 커지지 않게 묶는다. */
function diagramSize(entry: PartExportPlan): DiagramSize {
  const { cols, rows, tileWidthMm, tileHeightMm } = entry.plan;
  const aspect = tileHeightMm / tileWidthMm;
  const cellWMm = Math.min(14, 56 / cols, 30 / (rows * aspect));
  const cellHMm = cellWMm * aspect;
  return {
    cellWMm,
    cellHMm,
    widthMm: cellWMm * cols,
    heightMm: cellHMm * rows,
  };
}

/** 장 번호가 든 격자. 뽑기 전에 "이게 몇 장짜리인지"를 눈으로 보게 한다. */
function tileDiagram(
  entry: PartExportPlan,
  xMm: number,
  yMm: number,
  size: DiagramSize,
): Draw[] {
  const items: Draw[] = [];
  for (const tile of entry.plan.tiles) {
    const x = xMm + (tile.col - 1) * size.cellWMm;
    const y = yMm + (tile.row - 1) * size.cellHMm;
    items.push(
      path(rectPath(x, y, size.cellWMm, size.cellHMm), {
        stroke: BLACK,
        fill: null,
        strokeMm: MIN_STROKE_MM,
        fixedStroke: true,
      }),
      text(
        String(tile.index),
        x + size.cellWMm / 2,
        y + size.cellHMm / 2,
        Math.min(3.4, size.cellHMm * 0.5),
        { anchor: 'middle', fill: INK },
      ),
    );
  }
  return items;
}

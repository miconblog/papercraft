/**
 * 부속 파트 — 게임 방법 (IDE-017)
 *
 * 텍스트는 [`../rules.ts`](../rules.ts)에 있고 여기서는 **조판만** 한다. 규칙의
 * 진짜 자리는 여전히 도안 정의의 `rules` 필드이고 소개 페이지가 그것을 그린다 —
 * 이 시트는 같은 값을 종이로 낸 것이라, 규칙을 인쇄 파트에 매지 않는다는 결정
 * (2026-09-05, `docs/game-authoring.md`)과 어긋나지 않는다. 그 문서가 "규칙
 * 카드를 원하는 게임은 이 값을 읽어 부속을 그리면 된다"고 적어 둔 자리다.
 *
 * ## 두 단인 이유
 *
 * 윷놀이는 규칙이 길다 — 지름길이 어디서 갈라지는지, 업은 말을 어떻게 세는지,
 * 백도를 쓸지가 다 적혀야 형제끼리 싸우지 않는다. 한 단으로 흘리면 A4를 넘긴다.
 * 두 단이면 줄 길이도 79mm로 짧아져 눈이 줄을 놓치지 않는다.
 *
 * 덩어리(제목 한 줄, 항목 하나)는 **단을 넘어가지 않는다.** 절 제목은 첫 항목과
 * 붙어 다닌다 — 제목만 단 끝에 남으면 그 아래가 무엇에 대한 규칙인지 알 수 없다.
 *
 * 조판 결과를 `layoutRulesSheet`가 돌려준다. 글이 늘어 시트를 넘치면 테스트가
 * 잡는다 — 넘치면 글자를 줄이는 게 아니라 텍스트를 줄인다(축구 게임판의 옛
 * 규칙 카드와 같은 규약).
 */
import {
  RULES_BOTTOM_LIMIT_MM,
  RULES_COLUMN_WIDTH_MM,
  RULES_LAYOUT,
  RULES_SHEET,
} from '../dimensions.ts';
import { RULES, RULES_TITLE, SHEET_NOTE } from '../rules.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  line,
  markLayer,
  rect,
  svgDocument,
  text,
  wrapText,
} from '../../../shared/svg.ts';

const TYPE = RULES_LAYOUT;

export interface PlacedLine {
  readonly value: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly fontSizeMm: number;
  readonly bold: boolean;
}

/** 단을 넘어가지 않는 조판 단위. 절 제목 하나, 항목 하나가 각각 하나다. */
interface Chunk {
  readonly heading: boolean;
  readonly gapBeforeMm: number;
  readonly gapAfterMm: number;
  readonly lineMm: number;
  readonly lines: ReadonlyArray<{
    readonly value: string;
    readonly indentMm: number;
    readonly fontSizeMm: number;
    readonly bold: boolean;
  }>;
}

const chunkHeightMm = (chunk: Chunk): number =>
  chunk.gapBeforeMm + chunk.lines.length * chunk.lineMm + chunk.gapAfterMm;

/** 규칙 블록을 조판 단위로 바꾼다. 번호는 절이 바뀔 때마다 1부터 다시 센다. */
const toChunks = (): Chunk[] => {
  const chunks: Chunk[] = [];
  let stepIndex = 0;

  for (const block of RULES) {
    if (block.kind === 'heading') {
      stepIndex = 0;
      chunks.push({
        heading: true,
        gapBeforeMm: TYPE.headingGapMm,
        gapAfterMm: 0.6,
        lineMm: TYPE.lineMm,
        lines: [
          {
            value: block.text,
            indentMm: 0,
            fontSizeMm: TYPE.headingFontMm,
            bold: true,
          },
        ],
      });
      continue;
    }

    if (block.kind === 'step') stepIndex += 1;
    const bullet = block.kind === 'step' ? `${stepIndex}.` : '·';
    const wrapped = wrapText(
      block.text,
      TYPE.bodyFontMm,
      RULES_COLUMN_WIDTH_MM - TYPE.bodyIndentMm,
    );
    chunks.push({
      heading: false,
      gapBeforeMm: 0,
      gapAfterMm: TYPE.itemGapMm,
      lineMm: TYPE.lineMm,
      lines: [
        // 글머리는 첫 줄의 왼쪽 끝에 따로 앉는다 — 본문은 들여쓴 자리에서
        // 줄바꿈해야 여러 줄이 되어도 글머리 아래로 파고들지 않는다.
        {
          value: bullet,
          indentMm: 0,
          fontSizeMm: TYPE.bodyFontMm,
          bold: false,
        },
        ...wrapped.map((value) => ({
          value,
          indentMm: TYPE.bodyIndentMm,
          fontSizeMm: TYPE.bodyFontMm,
          bold: false,
        })),
      ],
    });
  }
  return chunks;
};

/** 글머리 줄과 본문 첫 줄은 **같은 줄**이다. 줄 수를 셀 때 하나로 친다. */
const chunkRowCount = (chunk: Chunk): number =>
  chunk.heading ? chunk.lines.length : chunk.lines.length - 1;

const columnLeftMm = (column: number): number =>
  TYPE.textLeftMm + column * (RULES_COLUMN_WIDTH_MM + TYPE.columnGapMm);

export const layoutRulesSheet = (): {
  lines: readonly PlacedLine[];
  /** 단마다 마지막 글자가 앉은 y. */
  columnBottomsMm: readonly number[];
  /** 단이 모자라 흘려보내지 못한 덩어리가 있는가. */
  overflow: boolean;
} => {
  const chunks = toChunks();
  const placed: PlacedLine[] = [];
  const bottoms: number[] = new Array(TYPE.columns).fill(TYPE.topYMm);

  let column = 0;
  let yMm = TYPE.topYMm;
  let overflow = false;

  for (const [i, chunk] of chunks.entries()) {
    // 절 제목은 첫 항목과 붙어 다닌다. 제목만 단 끝에 남으면 그 아래가 무엇에
    // 대한 규칙인지 알 수 없다.
    const glued = chunk.heading && chunks[i + 1] ? chunks[i + 1] : undefined;
    const neededMm = chunkHeightMm(chunk) + (glued ? chunkHeightMm(glued) : 0);

    if (yMm + neededMm > RULES_BOTTOM_LIMIT_MM) {
      if (column + 1 >= TYPE.columns) {
        overflow = true;
      } else {
        column += 1;
        yMm = TYPE.topYMm;
      }
    }

    yMm += chunk.gapBeforeMm;
    const leftMm = columnLeftMm(column);
    let rowYMm = yMm;
    for (const [j, item] of chunk.lines.entries()) {
      placed.push({
        value: item.value,
        xMm: leftMm + item.indentMm,
        yMm: rowYMm,
        fontSizeMm: item.fontSizeMm,
        bold: item.bold,
      });
      // 글머리(첫 줄)와 본문 첫 줄은 같은 y를 쓴다.
      if (chunk.heading || j >= 1) rowYMm += chunk.lineMm;
    }
    yMm += chunkRowCount(chunk) * chunk.lineMm + chunk.gapAfterMm;
    bottoms[column] = yMm;
  }

  return { lines: placed, columnBottomsMm: bottoms, overflow };
};

export const renderRulesSheet = (): string => {
  const { lines } = layoutRulesSheet();
  const inset = TYPE.cutInsetMm;
  const dividerXMm = columnLeftMm(1) - TYPE.columnGapMm / 2;

  return svgDocument({
    widthMm: RULES_SHEET.widthMm,
    heightMm: RULES_SHEET.heightMm,
    title: RULES_TITLE,
    children: [
      markLayer('cut', [
        rect(
          inset,
          inset,
          RULES_SHEET.widthMm - inset * 2,
          RULES_SHEET.heightMm - inset * 2,
        ),
      ]),
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text(RULES_TITLE, TYPE.textLeftMm, TYPE.titleYMm, TYPE.titleFontMm, {
          'text-anchor': 'start',
          'font-weight': 700,
        }),
        text(SHEET_NOTE, TYPE.textLeftMm, TYPE.noteYMm, TYPE.noteFontMm, {
          'text-anchor': 'start',
          fill: RULE_COLOR,
        }),
        // 단 사이 실선. 줄이 어디서 끊기고 어디서 이어지는지 눈이 놓치지 않는다.
        line(dividerXMm, TYPE.topYMm - 4, dividerXMm, RULES_BOTTOM_LIMIT_MM, {
          stroke: RULE_COLOR,
          'stroke-width': 0.2,
          fill: 'none',
        }),
        ...lines.map((placed) =>
          text(placed.value, placed.xMm, placed.yMm, placed.fontSizeMm, {
            'text-anchor': 'start',
            'font-weight': placed.bold ? 700 : undefined,
          }),
        ),
      ]),
    ],
  });
};

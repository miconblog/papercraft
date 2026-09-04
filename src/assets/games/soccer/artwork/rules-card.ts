/**
 * 부속 파트 — 게임 방법 (IDE-004)
 *
 * 규칙을 인쇄물 문구로만 전달하기로 했으므로(2026-09-03 사용자 확인) 이 카드가
 * 규칙의 유일한 전달 수단이다. 텍스트는 `../rules.ts`에 있고 여기서는 조판만
 * 한다.
 *
 * 조판 결과(마지막 줄의 y)를 `layoutRulesCard`가 돌려준다 — 텍스트가 늘어 카드를
 * 넘치는지 테스트가 검사한다. 넘치면 글자를 줄이는 게 아니라 텍스트를 줄인다.
 */
import { SHEETS } from '../dimensions.ts';
import { PAPER_NOTE, RULES, RULES_TITLE } from '../rules.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  markLayer,
  rect,
  svgDocument,
  text,
  wrapText,
} from './svg.ts';

const CUT_INSET_MM = 5;
/** 글자가 시작하는 왼쪽 끝. 오림선 안쪽으로 충분히 들어와야 잘라도 안 잘린다. */
const TEXT_LEFT_MM = 13;
const TEXT_WIDTH_MM = SHEETS.rulesCard.widthMm - TEXT_LEFT_MM * 2;
/** 항목 글머리(`·`, 번호) 뒤에 본문이 시작하는 자리. */
const BODY_INDENT_MM = 4.6;

const TYPE = {
  titleMm: 5,
  headingMm: 3.6,
  bodyMm: 3,
  noteMm: 2.5,
  /** 본문 줄 간격. */
  lineMm: 4.3,
  /** 절 제목 위에 두는 여백. */
  headingGapMm: 3.6,
  /** 항목 사이 여백. */
  itemGapMm: 1,
} as const;

interface PlacedLine {
  readonly value: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly fontSizeMm: number;
  readonly bold: boolean;
}

/**
 * 블록을 위에서 아래로 흘려 놓는다. 되돌아가는 배치가 없으므로 y를 누적하기만
 * 하면 된다.
 */
export const layoutRulesCard = (): {
  lines: readonly PlacedLine[];
  bottomYMm: number;
} => {
  const lines: PlacedLine[] = [];
  let yMm = 17;

  lines.push({
    value: RULES_TITLE,
    xMm: TEXT_LEFT_MM,
    yMm,
    fontSizeMm: TYPE.titleMm,
    bold: true,
  });
  yMm += 7;

  let stepIndex = 0;
  for (const block of RULES) {
    if (block.kind === 'heading') {
      stepIndex = 0;
      yMm += TYPE.headingGapMm;
      lines.push({
        value: block.text,
        xMm: TEXT_LEFT_MM,
        yMm,
        fontSizeMm: TYPE.headingMm,
        bold: true,
      });
      yMm += TYPE.lineMm + 0.6;
      continue;
    }

    if (block.kind === 'step') stepIndex += 1;
    const bullet = block.kind === 'step' ? `${stepIndex}.` : '·';
    const wrapped = wrapText(
      block.text,
      TYPE.bodyMm,
      TEXT_WIDTH_MM - BODY_INDENT_MM,
    );
    wrapped.forEach((value, i) => {
      if (i === 0) {
        lines.push({
          value: bullet,
          xMm: TEXT_LEFT_MM,
          yMm,
          fontSizeMm: TYPE.bodyMm,
          bold: false,
        });
      }
      lines.push({
        value,
        xMm: TEXT_LEFT_MM + BODY_INDENT_MM,
        yMm,
        fontSizeMm: TYPE.bodyMm,
        bold: false,
      });
      yMm += TYPE.lineMm;
    });
    yMm += TYPE.itemGapMm;
  }

  yMm += 2;
  for (const value of wrapText(PAPER_NOTE, TYPE.noteMm, TEXT_WIDTH_MM)) {
    lines.push({
      value,
      xMm: TEXT_LEFT_MM,
      yMm,
      fontSizeMm: TYPE.noteMm,
      bold: false,
    });
    yMm += TYPE.noteMm * 1.4;
  }

  return { lines, bottomYMm: yMm };
};

/** 카드 안에서 글자를 놓을 수 있는 가장 아래. 오림선 안쪽으로 여유를 둔다. */
export const RULES_CARD_TEXT_LIMIT_MM =
  SHEETS.rulesCard.heightMm - CUT_INSET_MM - 4;

export const renderRulesCard = (): string => {
  const { lines } = layoutRulesCard();
  return svgDocument({
    widthMm: SHEETS.rulesCard.widthMm,
    heightMm: SHEETS.rulesCard.heightMm,
    title: '축구 게임판 · 게임 방법',
    children: [
      markLayer('cut', [
        rect(
          CUT_INSET_MM,
          CUT_INSET_MM,
          SHEETS.rulesCard.widthMm - CUT_INSET_MM * 2,
          SHEETS.rulesCard.heightMm - CUT_INSET_MM * 2,
        ),
      ]),
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        ...lines.map((placed) =>
          text(placed.value, placed.xMm, placed.yMm, placed.fontSizeMm, {
            'text-anchor': 'start',
            'font-weight': placed.bold ? 700 : undefined,
            fill: placed.fontSizeMm <= TYPE.noteMm ? RULE_COLOR : undefined,
          }),
        ),
      ]),
    ],
  });
};

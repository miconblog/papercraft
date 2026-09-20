/**
 * 오늘의 라운드 — 음수를 보여 주는 한 장 (IDE-043)
 *
 * 사용자가 아이에게 **음수와 10의 보수**를 손으로 그려 설명한 사진을 주며,
 * 그런 인쇄물을 게임에 넣자고 청했다(2026-09-19).
 *
 * 별지 학습지를 덧붙이는 형태는 피했다. 이 게임은 소개문 스스로 "숫자를 쓰고
 * 더하고 빼는 일이 **놀이 안에** 들어 있다"고 말하는데, 워크시트가 붙으면
 * "게임 + 부록 학습지"로 성격이 갈라진다. 그래서 **라운드의 기록 그 자체가
 * 그래프가 되는** 한 장으로 만든다 — 빈 종이를 채우는 것이 아니라, 홀이 끝날
 * 때마다 점이 하나씩 늘어난다.
 *
 * ## 0을 어디에 두느냐
 *
 * 이 종이의 요점이다. 눈금자가 둘인 것은 같은 값을 두 기준으로 보기 위해서다 —
 * 파와 견주면 0이 왼쪽에 치우치고(어제 아이가 +27, 아빠가 +34였다. 언더파는
 * 실력이 한참 늘기 전까지 안 나온다), 지난번과 견주면 **0이 한가운데**이고
 * 좋아질수록 왼쪽으로 간다. 둘을 나란히 두면 "0은 정해진 자리가 아니라 고르는
 * 자리"라는 것이 눈에 보인다.
 *
 * 그래서 그래프의 0선 아래 열 칸은 **비어 있을 것을 알면서도 둔 자리**다.
 * 0의 아래가 무엇인지 보이는 것이 이 종이의 목적이라서다.
 *
 * ## 점수의 이름을 얹지 않은 까닭
 *
 * −1이 버디, 0이 파인 것은 **홀 하나의 파차**에서만 참이다. 이 종이의 그래프는
 * 누적이고 눈금자는 라운드 합계라, 둘 다 −1이 버디가 아니다. 얹으면 틀린 말이
 * 된다 — 이름은 홀 판의 카드(`termsLine`)에 이미 있고 거기가 맞는 자리다.
 */
import {
  HOLES,
  LAST_ROUND_RULER,
  PAR_RULER,
  ROUND_CHART,
  ROUND_RULERS,
  ROUND_SHEET,
  TEN_PAIRS,
  chartHoleX,
  chartValueY,
  rulerValueX,
  tenPairCenterX,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  line,
  svgDocument,
  text,
} from '../../../shared/svg.ts';
import { SLOT_LAYER_ID } from '../../../../lib/schema/marks.ts';

const LEFT = ROUND_SHEET.marginMm;

/** 값에 부호를 붙여 읽는다 — 이 종이에서는 `+`도 반드시 보여야 한다. */
const signed = (value: number): string =>
  value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';

const caption = (value: string, xMm: number, yMm: number, attrs = {}) =>
  text(value, xMm, yMm, ROUND_SHEET.captionFontMm, {
    fill: RULE_COLOR,
    ...attrs,
  });

const sectionTitle = (value: string, yMm: number) =>
  text(value, LEFT, yMm, ROUND_SHEET.sectionFontMm, {
    'text-anchor': 'start',
    'font-weight': 'bold',
  });

/** 제목과, 아이가 직접 쓰는 이름·날짜 줄. */
function renderHead(): string[] {
  const fieldY = ROUND_SHEET.fieldYMm;
  const ruleY = fieldY + 2;
  const field = (label: string, xMm: number) => [
    text(label, xMm, fieldY, ROUND_SHEET.fieldFontMm, {
      fill: RULE_COLOR,
      'text-anchor': 'start',
    }),
    line(xMm + 9, ruleY, xMm + 9 + ROUND_SHEET.fieldRuleMm, ruleY, {
      stroke: RULE_COLOR,
      'stroke-width': 0.3,
    }),
  ];

  return [
    text('오늘의 라운드', LEFT, ROUND_SHEET.titleYMm, ROUND_SHEET.titleFontMm, {
      'text-anchor': 'start',
      'font-weight': 'bold',
    }),
    ...field('이름', 113),
    ...field('날짜', 158),
    text(
      '홀이 끝날 때마다 점을 찍고 이어 보자. 라운드가 끝나면 아래 눈금자에 오늘 성적을 찍는다.',
      LEFT,
      ROUND_SHEET.leadYMm,
      ROUND_SHEET.leadFontMm,
      { fill: RULE_COLOR, 'text-anchor': 'start' },
    ),
  ];
}

/** 누적 파차 꺾은선 — 홀이 끝날 때마다 점 하나. */
function renderChart(): string[] {
  const { xMm: x, yMm: y, widthMm: w, heightMm: h } = ROUND_CHART;
  const right = x + w;
  const bottom = y + h;
  const zeroY = chartValueY(0);

  const values: number[] = [];
  for (
    let v = ROUND_CHART.bottomValue;
    v <= ROUND_CHART.topValue;
    v += ROUND_CHART.stepValue
  )
    values.push(v);

  return [
    caption('누적 파차 — 여기까지 파보다 몇 타 많은가', x, y - 4.5, {
      'text-anchor': 'start',
    }),

    // 가로선. 0선만 먹빛으로 굵게 — 이 종이에서 가장 중요한 선이다.
    group({ fill: 'none' }, [
      ...values.map((v) =>
        line(x, chartValueY(v), right, chartValueY(v), {
          stroke: RULE_COLOR,
          'stroke-width': 0.2,
          opacity: v % ROUND_CHART.labelStepValue === 0 ? 0.55 : 0.3,
        }),
      ),
      // 홀마다 세로 안내선. 점을 어디에 찍는지 세로로도 짚어 준다.
      ...HOLES.map((hole) =>
        line(chartHoleX(hole.number), y, chartHoleX(hole.number), bottom, {
          stroke: RULE_COLOR,
          'stroke-width': 0.2,
          opacity: 0.22,
        }),
      ),
      line(x, zeroY, right, zeroY, {
        stroke: INK_COLOR,
        'stroke-width': 0.6,
      }),
      line(x, y, x, bottom, { stroke: RULE_COLOR, 'stroke-width': 0.3 }),
    ]),

    // 세로 눈금 글자.
    ...values
      .filter((v) => v % ROUND_CHART.labelStepValue === 0)
      .map((v) =>
        text(signed(v), x - 2, chartValueY(v), ROUND_SHEET.noteFontMm, {
          fill: v === 0 ? INK_COLOR : RULE_COLOR,
          'font-weight': v === 0 ? 'bold' : undefined,
          'text-anchor': 'end',
        }),
      ),

    // 홀 번호.
    ...HOLES.map((hole) =>
      text(
        String(hole.number),
        chartHoleX(hole.number),
        bottom + 5,
        ROUND_SHEET.noteFontMm,
        { fill: RULE_COLOR, 'text-anchor': 'middle' },
      ),
    ),
    caption('홀', right + 3, bottom + 5, { 'text-anchor': 'start' }),

    // 0선이 무엇인지, 그 아래가 무엇인지 말로 적는다.
    caption('0 = 이븐파', right - 1, zeroY - 3, {
      'text-anchor': 'end',
      fill: INK_COLOR,
    }),
    caption('이 아래로 내려가면 언더파', right - 1, zeroY + 5, {
      'text-anchor': 'end',
    }),
  ];
}

/** 눈금자 한 줄. 계산한 값에 점을 찍는 자리다. */
function renderRuler(
  ruler: typeof PAR_RULER | typeof LAST_ROUND_RULER,
  title: string,
  leftNote: string,
  rightNote: string,
  zeroNote: string,
): string[] {
  const y = ruler.axisYMm;
  const values: number[] = [];
  for (let v = ruler.min; v <= ruler.max; v += ruler.stepValue) values.push(v);

  return [
    sectionTitle(title, ruler.titleYMm),

    group({ fill: 'none', stroke: RULE_COLOR }, [
      line(ROUND_RULERS.xMm, y, ROUND_RULERS.xMm + ROUND_RULERS.widthMm, y, {
        stroke: INK_COLOR,
        'stroke-width': 0.5,
      }),
      ...values.map((v) => {
        const half =
          (v === 0 ? ROUND_RULERS.zeroTickMm : ROUND_RULERS.tickMm) / 2;
        return line(
          rulerValueX(v, ruler),
          y - half,
          rulerValueX(v, ruler),
          y + half,
          {
            stroke: v === 0 ? INK_COLOR : RULE_COLOR,
            'stroke-width': v === 0 ? 0.6 : 0.3,
          },
        );
      }),
    ]),

    ...values
      .filter((v) => v % ruler.labelStepValue === 0)
      .map((v) =>
        text(
          signed(v),
          rulerValueX(v, ruler),
          y + ROUND_RULERS.labelDyMm,
          ROUND_SHEET.noteFontMm,
          {
            fill: v === 0 ? INK_COLOR : RULE_COLOR,
            'font-weight': v === 0 ? 'bold' : undefined,
            'text-anchor': 'middle',
          },
        ),
      ),
    caption(zeroNote, rulerValueX(0, ruler), y + ROUND_RULERS.zeroNoteDyMm, {
      'text-anchor': 'middle',
      fill: INK_COLOR,
    }),

    // 양쪽 끝의 뜻은 **말로** 적는다. 화살표만으로는 어느 쪽이 좋은 것인지 모른다.
    caption(leftNote, ROUND_RULERS.xMm, y + ROUND_RULERS.endNoteDyMm, {
      'text-anchor': 'start',
    }),
    caption(
      rightNote,
      ROUND_RULERS.xMm + ROUND_RULERS.widthMm,
      y + ROUND_RULERS.endNoteDyMm,
      { 'text-anchor': 'end' },
    ),
  ];
}

/** 10이 되는 짝 — 위 줄 1~9, 아래 줄 9~1. 사진의 그림 그대로다. */
function renderTenPairs(): string[] {
  const indexes = Array.from({ length: TEN_PAIRS.count }, (_, i) => i);

  return [
    sectionTitle('10이 되는 짝', TEN_PAIRS.titleYMm),
    text(
      '아홉 칸을 더할 때 10이 되는 짝부터 동그라미로 묶어라. 남은 수만 더하면 된다.',
      LEFT,
      TEN_PAIRS.howToYMm,
      ROUND_SHEET.captionFontMm,
      { fill: INK_COLOR, 'text-anchor': 'start' },
    ),

    ...indexes.map((i) =>
      circle(tenPairCenterX(i), TEN_PAIRS.circleCyMm, TEN_PAIRS.circleRMm, {
        fill: 'none',
        stroke: RULE_COLOR,
        'stroke-width': 0.3,
      }),
    ),
    ...indexes.flatMap((i) => [
      text(
        String(i + 1),
        tenPairCenterX(i),
        TEN_PAIRS.topRowYMm,
        TEN_PAIRS.numberFontMm,
        { 'text-anchor': 'middle' },
      ),
      text(
        String(TEN_PAIRS.count - i),
        tenPairCenterX(i),
        TEN_PAIRS.bottomRowYMm,
        TEN_PAIRS.numberFontMm,
        { 'text-anchor': 'middle' },
      ),
    ]),

    caption(
      // "보기"로 시작하지 않는다 — 골프에서 보기는 파보다 한 타 많은 것이라,
      // 이 종이에서 그 말을 예시라는 뜻으로 쓰면 아이가 헷갈린다.
      '이렇게 — 6 5 5 9 6 4 10 4 4 에서 (6+4) (6+4) (5+5) 를 묶으면 10 + 10 + 10 + 9 + 4 = 53',
      LEFT,
      TEN_PAIRS.exampleYMm,
      { 'text-anchor': 'start' },
    ),
  ];
}

export const renderRoundSheet = (): string =>
  svgDocument({
    widthMm: ROUND_SHEET.widthMm,
    heightMm: ROUND_SHEET.heightMm,
    title: '골프 게임판 · 오늘의 라운드',
    children: [
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        ...renderHead(),
        ...renderChart(),
        ...renderRuler(
          PAR_RULER,
          '오늘 성적 — 총타수 − 72',
          '← 언더파 · 파보다 적게 쳤다',
          '오버파 · 파보다 많이 쳤다 →',
          '이븐파',
        ),
        ...renderRuler(
          LAST_ROUND_RULER,
          '지난번과 견주기 — 총타수 − 지난 라운드',
          '← 줄었다 · 지난번보다 잘 쳤다',
          '늘었다 · 지난번보다 많이 쳤다 →',
          '지난번과 똑같다',
        ),
        ...renderTenPairs(),
      ]),
      `<g id="${SLOT_LAYER_ID}" />`,
    ],
  });

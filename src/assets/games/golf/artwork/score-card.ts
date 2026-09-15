/**
 * 기록표 — 이 게임에서 아이가 가장 오래 붙들고 있는 종이 (IDE-030)
 *
 * 사용자가 이 게임을 청하며 함께 청한 것이 **덧셈**이다(2026-09-15 —
 * "기록표에 직접 기록해서 숫자쓰기와 합산을 통해 덧셈도 같이 공부했으면").
 * 그래서 이 종이는 점수를 남기는 자리가 아니라 **셈이 일어나는 자리**다.
 *
 * 셈이 세 번 일어난다. 전반 아홉 홀을 더해 OUT, 후반 아홉 홀을 더해 IN,
 * 둘을 더해 총타수. 거기서 코스 파(72)를 빼면 오늘의 성적이다. 표를 둘로 나눈
 * 것도, 합산 칸에 `+`와 `=`를 미리 찍어 둔 것도 그 셈이 눈에 보이게 하기
 * 위해서다 — 빈칸 셋이 나란히 있으면 아이는 그것이 덧셈인 줄 모른다.
 *
 * 표 안은 **파와 거리만 인쇄되어 있고 나머지는 비어 있다.** 이름도 타수도
 * 아이가 쓴다(축구 게임판의 점수 기록칸과 같은 규칙, 2026-09-08).
 */
import {
  COURSE_PAR,
  IN_HOLES,
  OUT_HOLES,
  PLAYER_COUNT,
  SCORE_CARD,
  SCORE_TABLE_WIDTH_MM,
  playerRowCenterY,
  scoreColumnEdges,
  scoreRowEdges,
  sumColumnEdges,
  sumPar,
  sumRowCenterY,
  sumYards,
  type HoleSpec,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  line,
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';
import { SLOT_LAYER_ID } from '../../../../lib/schema/marks.ts';

// 열과 행의 경계는 `dimensions.ts`가 계산한다 — 도안 정의도 같은 값을 읽어
// 이름 슬롯을 칸 한가운데 앉힌다. 여기서는 칸 안에 글자를 놓는 데 쓰는 것만
// 꺼내 둔다.
const { tableXMm: X, headerRowMm, parRowMm, yardRowMm } = SCORE_CARD;

const columnCenter = (edges: readonly number[], index: number): number =>
  (edges[index] + edges[index + 1]) / 2;

/** 표 한 벌. `holes`가 아홉이고 `totalLabel`이 OUT이거나 IN이다. */
function renderTable(
  topMm: number,
  holes: readonly HoleSpec[],
  totalLabel: string,
): string[] {
  const cols = scoreColumnEdges();
  const rows = scoreRowEdges(topMm);
  const bottom = rows[rows.length - 1];
  const bodyTop = rows[3];

  const cell = (
    value: string,
    colIndex: number,
    y: number,
    fontMm: number,
    attrs: Record<string, string | number | undefined> = {},
  ) =>
    text(value, columnCenter(cols, colIndex), y, fontMm, {
      'text-anchor': 'middle',
      ...attrs,
    });

  return [
    // 괘선. 머리 세 줄과 사람 칸 사이만 굵게 해 표가 두 덩이로 읽힌다.
    group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
      ...cols.map((x) => line(x, topMm, x, bottom)),
      ...rows.map((y) => line(X, y, X + SCORE_TABLE_WIDTH_MM, y)),
      line(X, bodyTop, X + SCORE_TABLE_WIDTH_MM, bodyTop, {
        stroke: INK_COLOR,
        'stroke-width': 0.5,
      }),
      // 합계 열은 아이가 아홉 칸을 더해 적는 자리다 — 왼쪽 경계를 굵게 그어
      // "여기부터는 더한 값"이라는 것을 선이 말해 준다.
      line(cols[10], topMm, cols[10], bottom, {
        stroke: INK_COLOR,
        'stroke-width': 0.5,
      }),
    ]),

    // 머리 세 줄.
    cell('홀', 0, topMm + headerRowMm / 2, SCORE_CARD.labelFontMm, {
      fill: RULE_COLOR,
    }),
    ...holes.map((hole, i) =>
      cell(
        String(hole.number),
        i + 1,
        topMm + headerRowMm / 2,
        SCORE_CARD.headerFontMm,
        {
          'font-weight': 'bold',
        },
      ),
    ),
    cell(totalLabel, 10, topMm + headerRowMm / 2, SCORE_CARD.headerFontMm, {
      'font-weight': 'bold',
    }),

    cell('파', 0, rows[1] + parRowMm / 2, SCORE_CARD.labelFontMm, {
      fill: RULE_COLOR,
    }),
    ...holes.map((hole, i) =>
      cell(
        String(hole.par),
        i + 1,
        rows[1] + parRowMm / 2,
        SCORE_CARD.parFontMm,
      ),
    ),
    cell(
      String(sumPar(holes)),
      10,
      rows[1] + parRowMm / 2,
      SCORE_CARD.parFontMm,
      {
        'font-weight': 'bold',
      },
    ),

    cell('거리(야드)', 0, rows[2] + yardRowMm / 2, SCORE_CARD.yardFontMm, {
      fill: RULE_COLOR,
    }),
    ...holes.map((hole, i) =>
      cell(
        String(hole.yards),
        i + 1,
        rows[2] + yardRowMm / 2,
        SCORE_CARD.yardFontMm,
        {
          fill: RULE_COLOR,
        },
      ),
    ),
    cell(
      String(sumYards(holes)),
      10,
      rows[2] + yardRowMm / 2,
      SCORE_CARD.yardFontMm,
      {
        fill: RULE_COLOR,
      },
    ),

    // 사람 네 줄 — 왼쪽 끝의 작은 번호만 인쇄한다. 세 표에서 같은 번호가 같은
    // 사람이라, 이름을 안 써도 자기 줄을 찾을 수 있다.
    ...Array.from({ length: PLAYER_COUNT }, (_, i) =>
      text(
        String(i + 1),
        X + 3.5,
        playerRowCenterY(topMm, i),
        SCORE_CARD.labelFontMm,
        {
          fill: RULE_COLOR,
          'text-anchor': 'middle',
        },
      ),
    ),
  ];
}

/** 합산 칸 — 전반 + 후반 = 총타수, 그리고 파와의 차이. */
function renderSumBox(): string[] {
  const cols = sumColumnEdges();
  const top = SCORE_CARD.sumBoxYMm;
  const bottom =
    top + SCORE_CARD.sumHeaderRowMm + SCORE_CARD.sumRowMm * PLAYER_COUNT;
  const headers = [
    '이름',
    '전반(OUT)',
    '',
    '후반(IN)',
    '',
    '총타수',
    `파 ${COURSE_PAR}와 견주기`,
  ];

  return [
    group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
      ...cols.map((x) => line(x, top, x, bottom)),
      line(X, top, X + SCORE_TABLE_WIDTH_MM, top),
      line(X, bottom, X + SCORE_TABLE_WIDTH_MM, bottom),
      ...Array.from({ length: PLAYER_COUNT }, (_, i) => {
        const y = top + SCORE_CARD.sumHeaderRowMm + SCORE_CARD.sumRowMm * i;
        return line(X, y, X + SCORE_TABLE_WIDTH_MM, y, {
          stroke: i === 0 ? INK_COLOR : RULE_COLOR,
          'stroke-width': i === 0 ? 0.5 : 0.3,
        });
      }),
    ]),

    ...headers.flatMap((label, i) =>
      label === ''
        ? []
        : text(
            label,
            columnCenter(cols, i),
            top + SCORE_CARD.sumHeaderRowMm / 2,
            SCORE_CARD.sumFontMm,
            { fill: RULE_COLOR, 'text-anchor': 'middle' },
          ),
    ),

    // 부호는 **미리 인쇄한다**. 빈칸 셋만 있으면 아이는 그것이 덧셈인 줄 모른다.
    ...Array.from({ length: PLAYER_COUNT }, (_, i) => {
      const y = sumRowCenterY(i);
      return [
        text(String(i + 1), X + 3.5, y, SCORE_CARD.labelFontMm, {
          fill: RULE_COLOR,
          'text-anchor': 'middle',
        }),
        text('+', columnCenter(cols, 2), y, SCORE_CARD.sumSignFontMm, {
          fill: INK_COLOR,
          'text-anchor': 'middle',
        }),
        text('=', columnCenter(cols, 4), y, SCORE_CARD.sumSignFontMm, {
          fill: INK_COLOR,
          'text-anchor': 'middle',
        }),
        text(`− ${COURSE_PAR} =`, cols[6] + 14, y, SCORE_CARD.sumFontMm, {
          fill: RULE_COLOR,
          'text-anchor': 'middle',
        }),
      ].join('\n');
    }),
  ];
}

export const renderScoreCard = (): string =>
  svgDocument({
    widthMm: SCORE_CARD.widthMm,
    heightMm: SCORE_CARD.heightMm,
    title: '골프 게임판 · 기록표',
    children: [
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text(
          '골프 기록표',
          SCORE_CARD.titleXMm,
          SCORE_CARD.titleYMm,
          SCORE_CARD.titleFontMm,
          {
            'text-anchor': 'start',
            'font-weight': 'bold',
          },
        ),
        rect(SCORE_CARD.titleXMm + 46, SCORE_CARD.titleYMm + 3.5, 100, 0.3, {
          fill: RULE_COLOR,
          stroke: 'none',
        }),

        ...renderTable(SCORE_CARD.outTableYMm, OUT_HOLES, 'OUT'),
        ...renderTable(SCORE_CARD.inTableYMm, IN_HOLES, 'IN'),
        ...renderSumBox(),

        text(
          '홀마다 친 횟수를 적는다. 아홉 칸을 더해 OUT과 IN을 내고, 둘을 더하면 총타수다. ' +
            `총타수에서 ${COURSE_PAR}를 빼면 오늘의 성적 — 적을수록 잘 친 것이다.`,
          SCORE_CARD.widthMm / 2,
          SCORE_CARD.footerYMm,
          SCORE_CARD.footerFontMm,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
      ]),

      // 이름과 코스 이름이 앉을 자리. 아트워크는 값을 그리지 않는다.
      `<g id="${SLOT_LAYER_ID}" />`,
    ],
  });

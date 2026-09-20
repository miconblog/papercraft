/**
 * 기록표 — 이 게임에서 아이가 가장 오래 붙들고 있는 종이 (IDE-030)
 *
 * 사용자가 이 게임을 청하며 함께 청한 것이 **덧셈**이다(2026-09-15 —
 * "기록표에 직접 기록해서 숫자쓰기와 합산을 통해 덧셈도 같이 공부했으면").
 * 그래서 이 종이는 점수를 남기는 자리가 아니라 **셈이 일어나는 자리**다.
 *
 * 셈이 네 번 일어난다. 전반 아홉 홀을 더해 OUT, 후반 아홉 홀을 더해 IN,
 * 둘을 더해 총타수. 거기서 코스 파(72)를 빼면 오늘의 성적이고, 지난 라운드의
 * 총타수를 빼면 지난번보다 나아진 만큼이다. 표를 둘로 나눈 것도, 합산 칸에
 * `+`와 `=`를 미리 찍어 둔 것도 그 셈이 눈에 보이게 하기 위해서다 — 빈칸 셋이
 * 나란히 있으면 아이는 그것이 덧셈인 줄 모른다.
 *
 * ## 부호 방향을 종이가 말한다 (IDE-042)
 *
 * 사용자가 아이와 한 라운드 치고 온 기록표에서 **합산 칸의 부호가 뒤집혀
 * 있었다**(2026-09-19). `36 − 61 = −25` — 파에서 타수를 뺀 것이다. 숫자 크기는
 * 다 맞았으니 셈을 못 한 것이 아니라, **종이가 방향을 말해 주지 않은 것**이다.
 * 규칙문은 "0보다 작으면 언더파"라고 하는데 정작 그 뺄셈이 일어나는 자리에는
 * 그 말이 없었다. 그래서 머리 칸에 한 줄을 적는다 — 치는 도중에 읽는 글은
 * 종이 위에 있어야 한다는 `IDE-032`의 판단이 여기서도 그대로다.
 *
 * 「지난 라운드」와 「지난번과 견주기」가 붙은 까닭은 `dimensions.ts`의
 * `SUM_COLUMNS_MM`에 적혀 있다 — **파 72로는 음수를 볼 수 없기 때문**이다.
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
  estimateTextWidthMm,
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

/**
 * 견주기 칸 안의 조각 — 손으로 쓰는 네모이거나, 인쇄된 부호다.
 *
 * 칸 안에서 **식이 완결된다**: `▢ − 72 = ▢`. 총타수를 한 번 더 옮겨 적게 되지만,
 * 옮겨 적는 동안 "무엇에서 72를 빼는가"가 손에 남는다(2026-09-20 사용자 요청 —
 * "이곳에 숫자를 써야한다는걸 알려주면 좋겠어").
 */
export type Piece = { kind: 'box' } | { kind: 'sign'; value: string };

const BOX: Piece = { kind: 'box' };
const sign = (value: string): Piece => ({ kind: 'sign', value });

/** 조각 사이의 틈. */
const PIECE_GAP_MM = 2;

export const pieceWidth = (piece: Piece): number =>
  piece.kind === 'box'
    ? SCORE_CARD.writeBoxWidthMm
    : estimateTextWidthMm(piece.value, SCORE_CARD.sumFontMm);

/**
 * 조각들을 칸 가운데에 가로로 늘어놓고 저마다의 중심 x를 돌려준다.
 *
 * 머리 칸의 안내 글자도 이 자리를 읽는다 — **네모와 그 위의 말이 한 곳에서
 * 나와야** 열 폭을 고쳤을 때 둘이 따로 놀지 않는다.
 */
export function pieceCenters(
  leftMm: number,
  rightMm: number,
  pieces: readonly Piece[],
): number[] {
  const total =
    pieces.reduce((sum, piece) => sum + pieceWidth(piece), 0) +
    PIECE_GAP_MM * (pieces.length - 1);
  let x = (leftMm + rightMm - total) / 2;
  return pieces.map((piece) => {
    const center = x + pieceWidth(piece) / 2;
    x += pieceWidth(piece) + PIECE_GAP_MM;
    return center;
  });
}

/**
 * 견주기 두 칸 — 파와 견주기, 지난번과 견주기.
 *
 * `labels`는 조각과 같은 차례다. 네모 위에 그 네모가 무엇인지 적는다 —
 * **부호 방향도 답 네모 위에 적힌다**(IDE-042). 사용자가 `36 − 61 = −25`로
 * 적어 온 것은 셈을 못 해서가 아니라 종이가 방향을 말해 주지 않아서였다.
 */
export const COMPARE_CELLS: readonly {
  columnIndex: number;
  header: string;
  pieces: readonly Piece[];
  labels: readonly (string | null)[];
}[] = [
  {
    columnIndex: 6,
    header: `파 ${COURSE_PAR}와 견주기`,
    pieces: [BOX, sign(`− ${COURSE_PAR} =`), BOX],
    labels: ['총타수', null, '+ 오버파 − 언더파'],
  },
  {
    columnIndex: 7,
    header: '지난번과 견주기',
    pieces: [BOX, sign('−'), BOX, sign('='), BOX],
    labels: ['총타수', null, '지난 라운드', null, '−면 잘 쳤다'],
  },
];

/** 합산 칸 — 전반 + 후반 = 총타수, 그리고 두 번의 견주기. */
function renderSumBox(): string[] {
  const cols = sumColumnEdges();
  const top = SCORE_CARD.sumBoxYMm;
  const bottom =
    top + SCORE_CARD.sumHeaderRowMm + SCORE_CARD.sumRowMm * PLAYER_COUNT;

  /** 더하는 칸의 머리글. 여기엔 틀릴 방향이 없어 안내가 붙지 않는다. */
  const plainHeaders = ['이름', '전반(OUT)', '', '후반(IN)', '', '총타수'];

  // 머리 두 줄의 세로 자리. 윗줄은 칸마다 같은 높이에 앉는다 — 한 줄짜리 칸을
  // 가운데에 두면 이름줄이 들쭉날쭉해져 표로 안 읽힌다.
  const labelY = top + 4.2;
  const subY = top + 8.2;

  const centersOf = (cell: (typeof COMPARE_CELLS)[number]) =>
    pieceCenters(
      cols[cell.columnIndex],
      cols[cell.columnIndex + 1],
      cell.pieces,
    );

  return [
    group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 }, [
      ...cols.map((x) => line(x, top, x, bottom)),
      line(X, top, X + SCORE_TABLE_WIDTH_MM, top),
      line(X, bottom, X + SCORE_TABLE_WIDTH_MM, bottom),
      // 여기부터는 빼기다 — 표의 합계 열과 같은 굵은 선이 그 경계를 말한다.
      line(
        cols[COMPARE_CELLS[0].columnIndex],
        top,
        cols[COMPARE_CELLS[0].columnIndex],
        bottom,
        {
          stroke: INK_COLOR,
          'stroke-width': 0.5,
        },
      ),
      ...Array.from({ length: PLAYER_COUNT }, (_, i) => {
        const y = top + SCORE_CARD.sumHeaderRowMm + SCORE_CARD.sumRowMm * i;
        return line(X, y, X + SCORE_TABLE_WIDTH_MM, y, {
          stroke: i === 0 ? INK_COLOR : RULE_COLOR,
          'stroke-width': i === 0 ? 0.5 : 0.3,
        });
      }),
    ]),

    ...plainHeaders.flatMap((label, i) =>
      label === ''
        ? []
        : text(label, columnCenter(cols, i), labelY, SCORE_CARD.sumFontMm, {
            fill: RULE_COLOR,
            'text-anchor': 'middle',
          }),
    ),

    ...COMPARE_CELLS.flatMap((cell) => {
      const centers = centersOf(cell);
      return [
        text(
          cell.header,
          columnCenter(cols, cell.columnIndex),
          labelY,
          SCORE_CARD.sumFontMm,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
        ...cell.labels.flatMap((label, i) =>
          label === null
            ? []
            : text(label, centers[i], subY, SCORE_CARD.sumSubFontMm, {
                fill: INK_COLOR,
                'text-anchor': 'middle',
              }),
        ),
      ];
    }),

    // 부호는 **미리 인쇄한다**. 빈칸 셋만 있으면 아이는 그것이 덧셈인 줄 모른다.
    // 견주기 칸은 거기에 네모까지 그린다 — 식과 빈 자리가 섞여 있어, 비어 있기만
    // 해서는 어디에 쓰는지 알 수 없다.
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
        ...COMPARE_CELLS.flatMap((cell) => {
          const centers = centersOf(cell);
          return cell.pieces.map((piece, index) =>
            piece.kind === 'box'
              ? rect(
                  centers[index] - SCORE_CARD.writeBoxWidthMm / 2,
                  y - SCORE_CARD.writeBoxHeightMm / 2,
                  SCORE_CARD.writeBoxWidthMm,
                  SCORE_CARD.writeBoxHeightMm,
                  {
                    fill: 'none',
                    stroke: RULE_COLOR,
                    'stroke-width': 0.3,
                    rx: 1,
                  },
                )
              : text(piece.value, centers[index], y, SCORE_CARD.sumFontMm, {
                  fill: INK_COLOR,
                  'text-anchor': 'middle',
                }),
          );
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
        ...renderTable(SCORE_CARD.outTableYMm, OUT_HOLES, 'OUT'),
        ...renderTable(SCORE_CARD.inTableYMm, IN_HOLES, 'IN'),
        ...renderSumBox(),

        text(
          '홀마다 친 횟수를 적는다. 아홉 칸을 더해 OUT과 IN을 내고, 둘을 더하면 총타수다. ' +
            `거기서 ${COURSE_PAR}를 빼면 오늘의 성적이고, 지난 라운드를 빼면 지난번보다 나아진 만큼이다.`,
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

/**
 * 보드 파트 — 야구장 (IDE-014)
 *
 * 배율 100%에서 210×297mm(A4 세로). 홈플레이트가 아래 한가운데이고 부채꼴이
 * 위로 펼쳐진다. **부채꼴이 종이보다 크다** — 내야 다이아몬드를 정규 규격
 * (90°)으로 크게 그리고, 담장 쪽 귀퉁이는 종이 밖으로 내보낸다(2026-09-08
 * 사용자 요청). 종이 밖으로 나간 공은 파울이다.
 *
 * ## 선 넷이 규칙을 대신한다
 *
 * 옛 인쇄본 〈별나라 BASEBALL〉이 그랬듯 판정을 **그려진 선**으로 끝낸다
 * (`../rules.ts`). 선마다 **색이 다르다** — 같은 색이면 어느 호가 어느 선인지
 * 이름표를 읽어야 알 수 있는데, 공이 멈춘 순간 아이가 보는 것은 이름표가 아니라
 * 색이다(같은 날 사용자 요청).
 *
 * | 선                       | 색             | 넘으면                 |
 * | ------------------------ | -------------- | ---------------------- |
 * | 파울라인                 | 초록 (필드)    | 파울                   |
 * | 아웃선 (내야, 마운드 앞) | 빨강           | 못 넘으면 아웃         |
 * | 2루타선 (외야)           | 파랑           | 2루타 (안이면 안타)    |
 * | 홈런선                   | 초록 (필드)    | 홈런                   |
 *
 * 내야 다이아몬드는 **흙색 띠**다. 옛 인쇄본이 그렇게 그렸고, 판정선과 색도
 * 굵기도 달라 "여기까지가 내야"라는 것이 한눈에 읽힌다.
 *
 * 필드를 초록으로 **칠하지 않는다.** 축구 운동장과 같은 이유다 — 잉크를 크게
 * 먹고, 공이 미끄러지는 면이라 잉크가 두꺼우면 연필 자국도 더 남는다.
 *
 * ## 판 위에 남는 것 — S·B·O 카운터 하나
 *
 * 타순표와 아웃·주자 표시칸을 파울 지역에 두었다가 뺐고(2026-09-08 사용자
 * 요청 — "일단 없애고"), 그 대신 왼쪽 아래에 **스트라이크·볼·아웃 카운터**를
 * 넣었다(같은 날 요청). 주자는 베이스 위에 동전을 얹어 표시한다(`../rules.ts`).
 * 스코어보드는 처음부터 별지다. 홈플레이트는 종이 아래 끝에 최대한 붙였다 —
 * 그만큼 담장이 멀어진다.
 */
import {
  BASES,
  BOARD,
  COUNT_PANEL,
  FIELD_MARKS,
  FOUL_LINE_EDGE_Y_MM,
  HOME,
  LINES,
  edgeCrossingYMm,
  fieldPoint,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  FIELD_LINE_COLOR,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  line,
  num,
  path,
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const {
  judgeLineWidthMm,
  diamondLineWidthMm,
  lineWidthMm,
  baseSizeMm,
  homePlateWidthMm,
  moundRadiusMm,
  moundDistanceMm,
  rubberWidthMm,
  rubberHeightMm,
  batterBoxWidthMm,
  batterBoxHeightMm,
  batterBoxGapMm,
  catcherBoxWidthMm,
  catcherBoxHeightMm,
  backstopRadiusMm,
} = FIELD_MARKS;

/**
 * 선 색.
 *
 * 흑백으로 뽑으면 셋이 회색 농도로만 갈리므로 이름표를 같은 색으로 붙여 둔다 —
 * 색이 사라져도 글자는 남는다. 팀 색 기본값(파랑·빨강)과 겹치지만 마커는 사람
 * 모양이고 선은 종이를 가로지르는 호라 헷갈릴 자리가 없다.
 */
export const DIRT_COLOR = '#b45309';
export const OUT_LINE_COLOR = '#dc2626';
export const DOUBLE_LINE_COLOR = '#1d4ed8';
/** 흰 종이 위에 흰 채움 — 베이스·홈플레이트가 다이아몬드 띠를 덮는다. */
const PAPER = '#ffffff';

type Pt = { readonly xMm: number; readonly yMm: number };

/**
 * 홈을 중심으로 한 원호. 종이보다 크면 좌우 끝에서 잘린 점 사이만, 작으면
 * 파울라인(±45°) 사이만 그린다 — 인쇄 렌더러가 클립을 받지 않아 호가 종이
 * 밖으로 나가면 안 된다.
 *
 * `sweep=1`은 화면상 시계 방향이다 — 왼쪽 점에서 꼭대기를 거쳐 오른쪽 점으로
 * 간다.
 */
const homeArc = (radiusMm: number): string => {
  const edgeYMm = edgeCrossingYMm(radiusMm);
  const [left, right]: [Pt, Pt] =
    edgeYMm === null
      ? [fieldPoint(-45, radiusMm), fieldPoint(45, radiusMm)]
      : [
          { xMm: 0, yMm: edgeYMm },
          { xMm: BOARD.widthMm, yMm: edgeYMm },
        ];
  return path(
    `M ${num(left.xMm)} ${num(left.yMm)} ` +
      `A ${num(radiusMm)} ${num(radiusMm)} 0 0 1 ` +
      `${num(right.xMm)} ${num(right.yMm)}`,
  );
};

/**
 * 베이스 — 바로 선 정사각형. 흰 채움으로 다이아몬드 띠를 덮어 모서리가
 * 베이스로 읽힌다(옛 인쇄본도 이렇게 그렸다).
 */
const baseSquare = (at: Pt): string =>
  rect(
    at.xMm - baseSizeMm / 2,
    at.yMm - baseSizeMm / 2,
    baseSizeMm,
    baseSizeMm,
    {
      fill: PAPER,
    },
  );

/** 홈플레이트 — 오각형. 뾰족한 쪽이 포수를 본다. */
const homePlate = (): string => {
  const h = homePlateWidthMm / 2;
  return path(
    `M ${num(HOME.xMm - h)} ${num(HOME.yMm - h)} ` +
      `L ${num(HOME.xMm + h)} ${num(HOME.yMm - h)} ` +
      `L ${num(HOME.xMm + h)} ${num(HOME.yMm + h * 0.15)} ` +
      `L ${num(HOME.xMm)} ${num(HOME.yMm + h * 1.15)} ` +
      `L ${num(HOME.xMm - h)} ${num(HOME.yMm + h * 0.15)} Z`,
    { fill: PAPER },
  );
};

/** 백네트 — 홈 뒤로 빠진 공의 경계. 아래로 볼록한 반원이다. */
const backstop = (): string =>
  path(
    `M ${num(HOME.xMm - backstopRadiusMm)} ${num(HOME.yMm)} ` +
      `A ${num(backstopRadiusMm)} ${num(backstopRadiusMm)} 0 0 0 ` +
      `${num(HOME.xMm + backstopRadiusMm)} ${num(HOME.yMm)}`,
  );

const moundYMm = HOME.yMm - moundDistanceMm;

/**
 * 내야 — 흙색 띠의 다이아몬드, 네 베이스, 마운드.
 *
 * 홈–1루·홈–3루 변은 파울라인과 같은 자리다. 파울라인은 **베이스에서 종이
 * 끝까지만** 초록으로 긋고(`foulLines`), 홈에서 베이스까지는 이 띠가 파울
 * 경계를 겸한다 — 같은 자리에 두 선을 겹쳐 긋지 않는다.
 */
const infield = (): string[] => [
  group(
    {
      stroke: DIRT_COLOR,
      'stroke-width': diamondLineWidthMm,
      'stroke-linejoin': 'round',
    },
    [
      path(
        `M ${num(BASES.home.xMm)} ${num(BASES.home.yMm)} ` +
          `L ${num(BASES.first.xMm)} ${num(BASES.first.yMm)} ` +
          `L ${num(BASES.second.xMm)} ${num(BASES.second.yMm)} ` +
          `L ${num(BASES.third.xMm)} ${num(BASES.third.yMm)} Z`,
      ),
      circle(HOME.xMm, moundYMm, moundRadiusMm, {
        'stroke-width': judgeLineWidthMm,
      }),
    ],
  ),
  group({ stroke: DIRT_COLOR, 'stroke-width': lineWidthMm }, [
    baseSquare(BASES.first),
    baseSquare(BASES.second),
    baseSquare(BASES.third),
    rect(
      HOME.xMm - rubberWidthMm / 2,
      moundYMm - rubberHeightMm / 2,
      rubberWidthMm,
      rubberHeightMm,
      { fill: DIRT_COLOR },
    ),
  ]),
];

/**
 * 파울라인 — 1·3루 베이스에서 종이 좌우 끝까지. 45°라 홈에서 반폭만큼 올라간
 * 높이에서 종이를 벗어난다.
 */
const foulLines = (): string[] => [
  line(BASES.third.xMm, BASES.third.yMm, 0, FOUL_LINE_EDGE_Y_MM),
  line(BASES.first.xMm, BASES.first.yMm, BOARD.widthMm, FOUL_LINE_EDGE_Y_MM),
];

/** 홈 주변 — 타석 둘, 포수 자리, 백네트, 홈플레이트. */
const homeArea = (): string[] => [
  rect(
    HOME.xMm - batterBoxGapMm - batterBoxWidthMm,
    HOME.yMm - batterBoxHeightMm / 2,
    batterBoxWidthMm,
    batterBoxHeightMm,
  ),
  rect(
    HOME.xMm + batterBoxGapMm,
    HOME.yMm - batterBoxHeightMm / 2,
    batterBoxWidthMm,
    batterBoxHeightMm,
  ),
  rect(
    HOME.xMm - catcherBoxWidthMm / 2,
    HOME.yMm + 4,
    catcherBoxWidthMm,
    catcherBoxHeightMm,
  ),
  backstop(),
  homePlate(),
];

const label = (value: string, at: Pt, fontMm: number, color: string): string =>
  text(value, at.xMm, at.yMm, fontMm, {
    'text-anchor': 'middle',
    fill: color,
    stroke: 'none',
  });

/**
 * 판정선 이름표 — 선과 같은 색으로, 선 **바깥쪽**(홈에서 먼 쪽)에 붙인다.
 *
 * 어느 시프트에서도 마커가 서지 않는 자리다. 홈런선 위 띠에는 아무도 서지
 * 않고, 2루타선 왼쪽 끝 위는 좌익수보다 낮고 파울라인보다 안쪽이며, 아웃선
 * 아래는 투수와 타자 사이다.
 */
const lineLabels = (): string[] => [
  label('홈런선', { xMm: HOME.xMm, yMm: 19 }, 4.6, FIELD_LINE_COLOR),
  label(
    '2루타선',
    fieldPoint(-28.5, LINES.doubleMm + 5),
    3.8,
    DOUBLE_LINE_COLOR,
  ),
  label(
    '아웃선',
    { xMm: HOME.xMm, yMm: HOME.yMm - LINES.outMm + 8 },
    3.8,
    OUT_LINE_COLOR,
  ),
  // 파울 지역에도 이름을 붙인다 — 파울라인 바깥 삼각형이 비어 있다.
  label('파울', { xMm: 22, yMm: HOME.yMm - 72 }, 3.6, RULE_COLOR),
  label(
    '파울',
    { xMm: BOARD.widthMm - 22, yMm: HOME.yMm - 72 },
    3.6,
    RULE_COLOR,
  ),
];

/** 베이스 이름표. 파울 지역 쪽으로 비켜 두어 수비 마커에 가리지 않는다. */
const baseLabels = (): string[] => [
  label(
    '1루',
    { xMm: BASES.first.xMm + 6, yMm: BASES.first.yMm + 9 },
    3.4,
    DIRT_COLOR,
  ),
  label(
    '2루',
    { xMm: BASES.second.xMm + 11, yMm: BASES.second.yMm - 5 },
    3.4,
    DIRT_COLOR,
  ),
  label(
    '3루',
    { xMm: BASES.third.xMm - 6, yMm: BASES.third.yMm + 9 },
    3.4,
    DIRT_COLOR,
  ),
];

/**
 * 스트라이크·볼·아웃 카운터 — 왼쪽 아래 파울 지역.
 *
 * 줄마다 글자 하나와 동그라미 몇 개다(S 둘 · B 넷 · O 셋, 사용자가 적어 준
 * 그대로). 동전을 얹어 센다. 글자는 먹, 동그라미는 표 색(회색)이다 — 판정선과
 * 같은 색을 쓰면 선이 하나 더 있는 것처럼 보인다.
 */
const countPanel = (): string[] => {
  const {
    letterXMm,
    firstDotXMm,
    dotGapMm,
    dotRadiusMm,
    firstRowYMm,
    rowGapMm,
  } = COUNT_PANEL;
  return COUNT_PANEL.rows.flatMap((row, i) => {
    const yMm = firstRowYMm + rowGapMm * i;
    return [
      label(row.letter, { xMm: letterXMm, yMm }, 5, INK_COLOR),
      group({ fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.4 }, [
        ...Array.from({ length: row.dots }, (_, j) =>
          circle(firstDotXMm + dotGapMm * j, yMm, dotRadiusMm),
        ),
      ]),
    ];
  });
};

export const renderField = (): string =>
  svgDocument({
    widthMm: BOARD.widthMm,
    heightMm: BOARD.heightMm,
    title: '야구 게임판 · 야구장',
    children: [
      group(
        {
          id: ART_LAYER_ID,
          fill: 'none',
          stroke: FIELD_LINE_COLOR,
          'stroke-width': lineWidthMm,
        },
        [
          // 판정선 넷 — 색이 저마다 다르다. 굵기는 같다.
          group({ 'stroke-width': judgeLineWidthMm }, [
            ...foulLines(),
            homeArc(LINES.homeRunMm),
            group({ stroke: DOUBLE_LINE_COLOR }, [homeArc(LINES.doubleMm)]),
            group({ stroke: OUT_LINE_COLOR }, [homeArc(LINES.outMm)]),
          ]),

          ...infield(),
          ...homeArea(),
          ...lineLabels(),
          ...baseLabels(),
        ],
      ),

      // S·B·O 카운터. 경기장 선과 섞이지 않게 레이어를 따로 둔다.
      group({ id: 'pc-count', fill: 'none', stroke: 'none' }, countPanel()),

      // 선수 마커가 놓이는 자리. 값은 렌더러가 그린다 — 아트워크가 직접 그려
      // 넣으면 커스터마이즈가 먹지 않는다.
      '<g id="pc-slot" />',
    ],
  });

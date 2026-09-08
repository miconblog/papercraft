/**
 * 윷놀이 도안 실측 치수 (IDE-017)
 *
 * 여기 있는 값이 **배율 100%에서 종이 위 mm**다. 도안 정의(`./index.ts`)와
 * 아트워크 생성기(`./artwork/`)가 같은 상수를 읽는다 — 한쪽만 고치면 슬롯
 * 좌표와 그림이 어긋나므로 치수는 이 파일 하나에만 둔다.
 *
 * 좌표계는 `docs/game-authoring.md`를 따른다: 파트 로컬 mm, 원점 좌상단,
 * y는 아래로 증가한다. **출발점(참먹이)이 오른쪽 아래**이고 진행은 반시계다.
 *
 * 작도 근거는 [docs/yut-nori-artwork.md](../../../../docs/yut-nori-artwork.md)에 있다.
 */

/**
 * 말판 파트 — **정사각**이다.
 *
 * 축구는 A4 가로(285×198), 야구는 A4 세로(210×297)였고 윷판은 정사각이다.
 * 198mm는 A4 세로의 폭(210) 안에 들어가면서 축구 운동장의 짧은 변(198)과 같다 —
 * 100%로 뽑으면 두 게임의 밭·선이 같은 굵기로 읽힌다.
 *
 * 파트 검증이 `widthMm >= heightMm`를 `landscape`로 읽으므로(`lib/schema/parts.ts`)
 * **정사각 보드는 `landscape`로 선언해야 통과한다.** 규칙이 이미 그렇게 정해져
 * 있었고 이 게임이 처음 밟는다.
 */
export const BOARD = { widthMm: 198, heightMm: 198 } as const;

/** 판 한가운데 — 방(중앙 밭)이 앉는 자리이자 지름길 넷이 만나는 점. */
export const CENTER = {
  xMm: BOARD.widthMm / 2,
  yMm: BOARD.heightMm / 2,
} as const;

/**
 * 바깥 밭 스물의 격자.
 *
 * **5칸 × 5칸이 아니라 6점 × 6점이다.** 각 변에 여섯 점씩, 모서리를 공유해
 * `6 × 4 − 4 = 20`밭이다. 격자 한 칸(`stepMm`)이 32mm인 것은 큰 밭(지름 30)과
 * 작은 밭(지름 22)이 이웃해도 6mm가 남기 때문이다 — 밭이 서로 닿으면 말을
 * 어느 밭에 세운 것인지 다투게 된다.
 *
 * 가장자리 여백 19mm는 큰 밭 반지름(15)에 4mm를 남긴 값이다. 종이 끝에서 4mm면
 * 가정용 프린터의 인쇄 불가 영역(보통 3mm대)을 넘긴다.
 */
export const FIELD_MARGIN_MM = 19;
export const OUTER_SIDE_MM = BOARD.widthMm - FIELD_MARGIN_MM * 2; // 160
export const OUTER_STEP_MM = OUTER_SIDE_MM / 5; // 32

/**
 * 밭 그리기 치수.
 *
 * **큰 밭 다섯**(네 모서리와 방)이 나머지보다 크다. 전통 윷판이 이 다섯을 크게
 * 그리는데, 지름길이 갈라지는 자리가 곧 큰 밭이라 **크기가 규칙을 말해 준다** —
 * 밭 이름을 적지 않기로 한 이 도안에서 그 역할이 더 크다.
 */
export const FIELD = {
  bigRadiusMm: 15,
  smallRadiusMm: 11,
  /** 큰 밭의 안쪽 겹원. 바깥 원에서 이만큼 안이다. */
  innerRingGapMm: 2.8,
  lineWidthMm: 0.7,
  /** 지름길 선. 밭 아래 깔리고 바깥 밭에는 잇는 선이 없어 이 넷만 선으로 보인다. */
  shortcutLineWidthMm: 1.2,
  /** 진행 화살표 — 밭과 밭 사이 빈자리에 앉는 작은 세모. */
  arrowLengthMm: 5.4,
  arrowWidthMm: 4.2,
  /** 출발점 큰 밭 안에 적는 '출발'·'도착' 글자. */
  startLabelFontMm: 3.4,
  startLabelOffsetMm: 8.6,
} as const;

/**
 * 밭의 종류. 그림을 그릴 때만 쓰는 구분이고 경로는 `edges`가 정한다.
 * - `corner` — 네 모서리. 큰 밭이고 지름길이 여기서 갈라진다.
 * - `bang` — 방(중앙). 큰 밭이다.
 */
export type FieldKind = 'outer' | 'corner' | 'bang' | 'shortcut';

/**
 * 밭에서 나가는 길.
 *
 * - `next` — 늘 쓰는 기본 진행. 밭마다 하나씩 있다.
 * - `shortcut` — 모서리 밭에 **정확히 멈췄을 때만** 타는 지름길.
 * - `through` — 방을 **지나칠 뿐일 때** 곧게 건너가는 길.
 *
 * 경로가 한 줄이 아니라 갈라지므로 순환 목록으로는 적을 수 없다(`IDE-017` 배경).
 * 갈라지는 자리마다 간선이 둘이고, 어느 쪽을 타는지는 "정확히 멈췄는가"가
 * 정한다 — 그 판단은 놀이하는 사람이 하고 도안은 길만 그린다.
 */
export type EdgeKind = 'next' | 'shortcut' | 'through';

export interface FieldEdge {
  readonly to: string;
  readonly kind: EdgeKind;
}

export interface YutField {
  readonly id: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly kind: FieldKind;
  /** 큰 밭 다섯(모서리 넷 + 방)인가. */
  readonly big: boolean;
  readonly edges: readonly FieldEdge[];
}

/** 출발점이자 도착점. 오른쪽 아래 모서리다 — 전통 윷판의 참먹이. */
export const START_FIELD_ID = 'o0';
/** 방 — 판 한가운데의 큰 밭. */
export const BANG_FIELD_ID = 'bang';

/** 바깥 밭 수. 모서리를 공유하므로 `6 × 4 − 4`다. */
export const OUTER_COUNT = 20;
/** 지름길 한 갈래에 놓이는 작은 밭 수. 네 갈래라 여덟이다. */
export const SHORTCUT_STEPS = 2;

/**
 * 네 모서리 — **진행 차례대로**다. 오른쪽 아래(출발) → 오른쪽 위 → 왼쪽 위 →
 * 왼쪽 아래. y가 아래로 증가하는 좌표계에서 이 차례가 반시계다.
 */
const CORNERS: ReadonlyArray<readonly [number, number]> = [
  [FIELD_MARGIN_MM + OUTER_SIDE_MM, FIELD_MARGIN_MM + OUTER_SIDE_MM],
  [FIELD_MARGIN_MM + OUTER_SIDE_MM, FIELD_MARGIN_MM],
  [FIELD_MARGIN_MM, FIELD_MARGIN_MM],
  [FIELD_MARGIN_MM, FIELD_MARGIN_MM + OUTER_SIDE_MM],
];

/** 바깥 밭의 id. `o0`이 출발점이고 번호가 진행 차례다. */
export const outerFieldId = (index: number): string => `o${index}`;

/**
 * 모서리에 붙은 지름길 밭의 id. `sK-1`이 모서리에 가깝고 `sK-2`가 방에 가깝다
 * (`K`는 그 모서리의 바깥 번호). 네 갈래가 같은 규칙을 쓰므로 방향과 무관하게
 * "모서리에서 몇 번째"로 읽힌다.
 */
export const shortcutFieldId = (cornerIndex: number, step: number): string =>
  `s${cornerIndex}-${step}`;

/** 바깥 밭 좌표. 모서리 사이를 다섯 등분한 자리다. */
export const outerPoint = (index: number): { xMm: number; yMm: number } => {
  const corner = Math.floor(index / 5);
  const t = (index % 5) / 5;
  const [x0, y0] = CORNERS[corner];
  const [x1, y1] = CORNERS[(corner + 1) % 4];
  return { xMm: x0 + (x1 - x0) * t, yMm: y0 + (y1 - y0) * t };
};

/** 지름길 밭 좌표. 모서리에서 방까지를 세 등분한 자리다. */
export const shortcutPoint = (
  cornerIndex: number,
  step: number,
): { xMm: number; yMm: number } => {
  const from = outerPoint(cornerIndex);
  const t = step / (SHORTCUT_STEPS + 1);
  return {
    xMm: from.xMm + (CENTER.xMm - from.xMm) * t,
    yMm: from.yMm + (CENTER.yMm - from.yMm) * t,
  };
};

/**
 * 지름길이 **갈라지는** 모서리 둘.
 *
 * 오른쪽 위(`o5`)와 왼쪽 위(`o10`)다. 왼쪽 아래(`o15`)에는 지름길이 없다 —
 * 그쪽 대각선은 방에서 **나오는** 길이라, 거기서 들어가면 바깥으로 도는 것보다
 * 오히려 한 칸이 더 걸린다(6칸 대 5칸). 전통 윷판이 그 모서리를 지름길 입구로
 * 삼지 않는 것이 그래서다.
 */
export const SHORTCUT_ENTRIES = [5, 10] as const;
/** 방에서 나가는 대각선이 닿는 모서리 둘. 방에 멈추면 `0`(참먹이) 쪽으로 나온다. */
export const SHORTCUT_EXITS = [0, 15] as const;

const buildFields = (): YutField[] => {
  const fields: YutField[] = [];

  for (let i = 0; i < OUTER_COUNT; i += 1) {
    const isCorner = i % 5 === 0;
    const entry = (SHORTCUT_ENTRIES as readonly number[]).includes(i);
    fields.push({
      id: outerFieldId(i),
      ...outerPoint(i),
      kind: isCorner ? 'corner' : 'outer',
      big: isCorner,
      edges: [
        { to: outerFieldId((i + 1) % OUTER_COUNT), kind: 'next' },
        ...(entry
          ? [{ to: shortcutFieldId(i, 1), kind: 'shortcut' as const }]
          : []),
      ],
    });
  }

  // 들어가는 갈래 — 모서리에서 방으로. `s5-1 → s5-2 → bang`.
  for (const corner of SHORTCUT_ENTRIES) {
    for (let step = 1; step <= SHORTCUT_STEPS; step += 1) {
      fields.push({
        id: shortcutFieldId(corner, step),
        ...shortcutPoint(corner, step),
        kind: 'shortcut',
        big: false,
        edges: [
          {
            to:
              step === SHORTCUT_STEPS
                ? BANG_FIELD_ID
                : shortcutFieldId(corner, step + 1),
            kind: 'next',
          },
        ],
      });
    }
  }

  // 나오는 갈래 — 방에서 모서리로. 방 쪽(`s0-2`)이 먼저다.
  for (const corner of SHORTCUT_EXITS) {
    for (let step = 1; step <= SHORTCUT_STEPS; step += 1) {
      fields.push({
        id: shortcutFieldId(corner, step),
        ...shortcutPoint(corner, step),
        kind: 'shortcut',
        big: false,
        edges: [
          {
            to:
              step === 1
                ? outerFieldId(corner)
                : shortcutFieldId(corner, step - 1),
            kind: 'next',
          },
        ],
      });
    }
  }

  fields.push({
    id: BANG_FIELD_ID,
    xMm: CENTER.xMm,
    yMm: CENTER.yMm,
    kind: 'bang',
    big: true,
    edges: [
      // 방에 멈추면 참먹이 쪽으로 질러 나온다 — 가장 짧은 길이다.
      { to: shortcutFieldId(SHORTCUT_EXITS[0], SHORTCUT_STEPS), kind: 'next' },
      // 지나칠 뿐이면 들어온 대각선을 그대로 건너 반대편 모서리로 나간다.
      {
        to: shortcutFieldId(SHORTCUT_EXITS[1], SHORTCUT_STEPS),
        kind: 'through',
      },
    ],
  });

  return fields;
};

/** 29밭 — 바깥 20 · 지름길 8 · 방 1. 좌표는 전부 격자에서 계산해 뽑았다. */
export const FIELDS: readonly YutField[] = buildFields();

export const FIELD_BY_ID: ReadonlyMap<string, YutField> = new Map(
  FIELDS.map((field) => [field.id, field]),
);

export const fieldRadiusMm = (field: YutField): number =>
  field.big ? FIELD.bigRadiusMm : FIELD.smallRadiusMm;

/** 지름길 선 — 마주 보는 모서리를 방을 지나 잇는 대각선 둘. */
export const SHORTCUT_LINES: ReadonlyArray<readonly [number, number]> = [
  [5, 15],
  [10, 0],
];

export interface RouteOptions {
  /** 지름길을 타는 모서리. 주지 않으면 바깥으로만 돈다. */
  readonly shortcutAt?: (typeof SHORTCUT_ENTRIES)[number];
  /**
   * 방을 지나칠 뿐인가. 참이면 들어온 대각선을 곧게 건너 반대편 모서리로
   * 나간다. **첫 모서리(`5`)로 들어왔을 때만 길이 달라진다** — 두 번째
   * 모서리(`10`)의 대각선은 곧게 건너면 그대로 참먹이 쪽이라 방에 멈춘 것과
   * 같은 길이다.
   */
  readonly throughBang?: boolean;
}

/**
 * 출발점에서 도착점까지 밟는 밭 차례. 처음과 끝이 모두 출발점(`o0`)이다.
 *
 * 갈래가 넷뿐이라 함수 하나로 전부 낸다 — 바깥길(20칸) · 첫 모서리에서 방에
 * 멈춤(11칸) · 첫 모서리에서 방을 지나침(16칸) · 두 번째 모서리(16칸). 이 넷을
 * 합치면 29밭이 빠짐없이 나온다는 것을 도안 테스트가 확인한다.
 */
export const routeFields = (options: RouteOptions = {}): string[] => {
  const path = [START_FIELD_ID];
  let id = START_FIELD_ID;
  // 가장 긴 길(바깥길)이 20칸이라 넉넉히 잡아도 40이면 반드시 끝난다.
  for (let step = 0; step < 40; step += 1) {
    const field = FIELD_BY_ID.get(id);
    if (!field) throw new Error(`없는 밭을 가리킨다: ${id}`);
    const goesStraight =
      options.throughBang === true &&
      options.shortcutAt === SHORTCUT_ENTRIES[0];
    const wanted: EdgeKind =
      options.shortcutAt !== undefined &&
      id === outerFieldId(options.shortcutAt)
        ? 'shortcut'
        : id === BANG_FIELD_ID && goesStraight
          ? 'through'
          : 'next';
    const edge = field.edges.find((e) => e.kind === wanted) ?? field.edges[0];
    path.push(edge.to);
    if (edge.to === START_FIELD_ID) return path;
    id = edge.to;
  }
  throw new Error('경로가 도착점으로 돌아오지 않는다');
};

/**
 * 편(팀)의 기본 색과 그림.
 *
 * **색과 그림 양쪽으로** 가른다. 색만으로 가르면 흑백 출력에서 누구 말인지
 * 알 수 없다(`IDE-009`가 축구 팀 색에서 확인한 것). 색은 사용자가 고치고
 * 그림은 고정이다 — 고칠 수 있게 하면 두 편이 같은 그림을 고를 수 있다.
 */
export const SIDES = [
  { id: 1, label: '동그라미', shape: 'circle', color: '#dc2626' },
  { id: 2, label: '세모', shape: 'triangle', color: '#1d4ed8' },
  { id: 3, label: '네모', shape: 'square', color: '#15803d' },
  { id: 4, label: '별', shape: 'star', color: '#7e22ce' },
] as const;

export type SideShape = (typeof SIDES)[number]['shape'];

/** 편 하나가 갖는 말 수. 윷놀이는 넷이다. */
export const TOKENS_PER_SIDE = 4;

/**
 * 말 한 장.
 *
 * **텐트형**이다 — 카드 한가운데를 산접기로 접으면 두 면이 마주 보며 ∧ 로 선다
 * (야구 선수 스탠드와 같은 수법, `IDE-014`). 풀도 탭도 없다.
 *
 * 카드 폭 20mm는 작은 밭(지름 22mm) 안에 서는 크기다. 밭보다 넓으면 이웃 밭을
 * 가려 어느 밭에 선 말인지 다투게 된다.
 *
 * **업힌 수는 밑동의 숫자로 센다.** 같은 편 말이 한 밭에서 만나면 업어 한 몸이
 * 되는데, 텐트형 말을 그냥 포개면 옆에서 몇이 업혔는지 보이지 않는다. 그래서
 * 말 넷 가운데 셋의 밑동에 `2`·`3`·`4`를 적어 두고, 업으면 그 수의 말 하나로
 * 바꿔 세운다. 말이 따로 서 있을 때는 숫자를 보지 않는다 — 어느 말이든 한
 * 마리다. 실물로 놀아 보고 정할 자리라 이슈에 미완으로 남겼다.
 */
export const TOKEN = {
  cardWidthMm: 20,
  /** 한 면의 높이. 카드 전체 높이는 이것의 두 배다. */
  faceHeightMm: 26,
  /** 한 줄이 한 편이다 — 4편 × 말 4. */
  columns: TOKENS_PER_SIDE,
  rows: SIDES.length,
  /** 카드 사이 간격 — 가위가 지나갈 폭이다. */
  gapMm: 4,
  headerHeightMm: 20,
  /**
   * 접는선에서 각 요소의 중심까지. 두 면이 이 값을 대칭으로 나눠 쓰므로,
   * 접었을 때 앞뒤 그림이 같은 높이에서 만난다. 한 면(26mm) 안에서 그림 →
   * 색 띠 → 편 이름 → 업기 숫자 차례로 내려간다.
   */
  iconOffsetMm: 8,
  iconSizeMm: 9.5,
  /** 그림 아래 색 띠. 그림과 함께 편 색을 받는다 — 작은 그림 하나보다 눈에 띈다. */
  bandOffsetMm: 14.9,
  bandHeightMm: 1.4,
  bandInsetMm: 3,
  nameOffsetMm: 18.5,
  nameFontMm: 2.8,
  nameMaxWidthMm: 17,
  /** 업기 숫자 — 카드 밑동이다. 접어 세우면 바닥 가까이 온다. */
  carryOffsetMm: 23,
  carryFontMm: 3.6,
} as const;

export const TOKEN_CARD_HEIGHT_MM = TOKEN.faceHeightMm * 2;

export const TOKEN_GRID = {
  widthMm:
    TOKEN.columns * TOKEN.cardWidthMm + (TOKEN.columns - 1) * TOKEN.gapMm,
  heightMm: TOKEN.rows * TOKEN_CARD_HEIGHT_MM + (TOKEN.rows - 1) * TOKEN.gapMm,
} as const;

/**
 * 말 시트. 격자(92×220)에 제목 띠와 여백을 더한 크기다.
 *
 * A4를 채우지 않는다 — 카드가 커질 수 없기 때문이다(밭 지름이 상한이다). 시트를
 * A4로 늘리면 남는 것은 빈 종이뿐이라 종이를 아끼는 쪽을 골랐다(야구 선수
 * 스탠드와 같은 판단).
 */
export const TOKEN_SHEET = { widthMm: 112, heightMm: 252 } as const;

export const TOKEN_GRID_ORIGIN = {
  xMm: (TOKEN_SHEET.widthMm - TOKEN_GRID.widthMm) / 2,
  yMm:
    TOKEN.headerHeightMm +
    (TOKEN_SHEET.heightMm - TOKEN.headerHeightMm - TOKEN_GRID.heightMm) / 2,
} as const;

/** 편 `sideIndex`(0부터)의 `tokenIndex`(0부터)번 말 카드의 좌상단. */
export const tokenCardOrigin = (
  sideIndex: number,
  tokenIndex: number,
): { xMm: number; yMm: number } => ({
  xMm: TOKEN_GRID_ORIGIN.xMm + tokenIndex * (TOKEN.cardWidthMm + TOKEN.gapMm),
  yMm: TOKEN_GRID_ORIGIN.yMm + sideIndex * (TOKEN_CARD_HEIGHT_MM + TOKEN.gapMm),
});

/** 카드의 접는선 y. 카드 한가운데다. */
export const tokenFoldYMm = (sideIndex: number): number =>
  tokenCardOrigin(sideIndex, 0).yMm + TOKEN.faceHeightMm;

/** 카드 가로 중심. */
export const tokenCenterXMm = (tokenIndex: number): number =>
  tokenCardOrigin(0, tokenIndex).xMm + TOKEN.cardWidthMm / 2;

/** 편 n의 색을 받는 레이어 id. 렌더러가 `paint` 배치로 여기 색을 칠한다. */
export const sideLayerId = (n: number): string => `pc-side-${n}`;

/**
 * 업기 숫자. 첫 말은 비워 둔다 — 말 하나는 한 마리라 셀 것이 없다.
 * 나머지 셋이 업힌 수 `2`·`3`·`4`를 맡는다.
 */
export const carryLabel = (tokenIndex: number): string =>
  tokenIndex === 0 ? '' : String(tokenIndex + 1);

/**
 * 게임 방법 부속.
 *
 * 규칙은 도안 정의의 `rules` 필드가 진짜 자리이고 소개 페이지가 그린다
 * (`docs/game-authoring.md`). 여기 부속은 그 값을 읽어 **판 옆에 두고 보는 종이**
 * 로 조판한 것이다 — 축구 게임판이 `rules-card`를 뺀 것은 규칙을 인쇄 파트에
 * 매지 않기 위해서였고, 값에서 그리는 이 시트는 그 결정과 어긋나지 않는다.
 *
 * 윷놀이는 규칙이 길다(지름길·업기·잡기·백도). 한 단으로 흘리면 A4를 넘겨
 * 두 단으로 나눈다. 높이 240mm는 **두 단이 고르게 차는 값**이다 — 더 길면
 * 첫 단만 꽉 차고 둘째 단 아래가 비고, 더 짧으면 둘째 단이 넘친다.
 */
export const RULES_SHEET = { widthMm: 190, heightMm: 240 } as const;

export const RULES_LAYOUT = {
  cutInsetMm: 5,
  /** 글자가 시작하는 왼쪽 끝. 오림선 안쪽으로 충분히 들어와야 잘라도 안 잘린다. */
  textLeftMm: 12,
  columns: 2,
  columnGapMm: 8,
  /** 제목과 안내 줄. */
  titleYMm: 16,
  noteYMm: 23,
  /** 본문 첫 줄. */
  topYMm: 32,
  titleFontMm: 5.5,
  headingFontMm: 3.6,
  bodyFontMm: 2.9,
  noteFontMm: 2.4,
  /** 본문 줄 간격. */
  lineMm: 4.2,
  /** 절 제목 위에 두는 여백. */
  headingGapMm: 3.4,
  /** 항목 사이 여백. */
  itemGapMm: 1,
  /** 항목 글머리(`·`, 번호) 뒤에 본문이 시작하는 자리. */
  bodyIndentMm: 4.4,
} as const;

export const RULES_COLUMN_WIDTH_MM =
  (RULES_SHEET.widthMm -
    RULES_LAYOUT.textLeftMm * 2 -
    RULES_LAYOUT.columnGapMm) /
  RULES_LAYOUT.columns; // 79

/** 단 안에서 글자를 놓을 수 있는 가장 아래. 오림선 안쪽으로 여유를 둔다. */
export const RULES_BOTTOM_LIMIT_MM =
  RULES_SHEET.heightMm - RULES_LAYOUT.cutInsetMm - 6;

/**
 * 파트 id에 대응하는 정적 자산 경로.
 *
 * 도안 정의가 여기서 경로를 받는다 — 아트워크 생성기(`./artwork/`)에서 받아 오면
 * SVG를 짓는 코드가 통째로 앱 번들에 딸려 들어간다.
 */
export const artworkPath = (partId: string): string =>
  `/games/yut-nori/${partId}.svg`;

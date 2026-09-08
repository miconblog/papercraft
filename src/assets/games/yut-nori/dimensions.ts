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
 * 두 단으로 나눈다. 높이는 **두 단이 고르게 차는 값**이다 — 더 길면
 * 첫 단만 꽉 차고 둘째 단 아래가 비고, 더 짧으면 둘째 단이 넘친다.
 *
 * 240 → **266mm**(IDE-018). 윷가락 접는 법 네 줄이 들어오면서 240에서는 둘째 단이
 * 넘쳤다. 넘칠 때 글자를 줄이지 않는다는 규약은 그대로이고, 여기서는 글도 줄일
 * 수 없었다 — 조립 순서라 한 줄만 빠져도 못 접는다. 폭 190은 그대로라 **인쇄
 * 여백 10mm까지 A4 한 장**인 것도 그대로다(폭이 한계다).
 */
export const RULES_SHEET = { widthMm: 190, heightMm: 266 } as const;

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

/**
 * 윷가락 — 반육각기둥 (IDE-018)
 *
 * 실제 윷은 통나무를 반으로 쪼갠 반원기둥이라 평평한 배와 둥근 등이 있다. 종이로
 * 곡면을 감으면 눌리므로 **정육각형의 아래 절반**으로 근사한다(2026-09-08 결정) —
 * 배 한 면과 등 세 면이고 접는 선이 전부 직선이다.
 *
 * ```
 *      ___ 등·마루 ___          배 폭 W = 16
 *     /              \         등 세 면 각 W/2 = 8
 *    /                \        높이 √(8² − 4²) = 6.93
 *   /_______ 배 _______\
 * ```
 *
 * ## 왜 이 값인가
 *
 * `bellyMm`이 **하나뿐인 조절 나사**다. 배가 넓을수록 배를 깔고 눕기 쉬우므로
 * 배가 위로 오는 비율이 떨어진다. 100번 던져 본 결과가 40~60%를 벗어나면 여기를
 * 고친다 — 배가 덜 나오면 줄이고, 지나치게 나오면 늘린다. 등 세 면의 폭
 * (`backFaceMm`)은 고정이고, 두 값에서 높이와 기울기가 따라 나온다
 * (`stickHeightMm`). 전개도는 폭만 이어 붙인 띠라 각도를 쓰는 곳이 마구리뿐이다.
 *
 * `W = 2 × 8`이 곧 정육각형의 절반이다. 이 관계가 깨져도 도안은 그려지지만 그때는
 * 더 이상 "반으로 쪼갠 윷"이 아니므로, 고칠 때는 문서의 근거도 함께 고쳐야 한다.
 */
const STICK_BACK_FACE_MM = 8;

export const STICK = {
  /** 배(평평한 면)의 폭. 배가 나오는 비율을 맞추는 유일한 나사다. */
  bellyMm: STICK_BACK_FACE_MM * 2,
  /** 등 세 면 각각의 폭. 셋이 같아야 굴러 멈추는 자리가 고르다. */
  backFaceMm: STICK_BACK_FACE_MM,
  /**
   * 가락 길이.
   *
   * 단면 폭의 약 7배다. 실제 장작윷(길이 20cm대, 지름 3cm대)과 같은 가늘기이면서,
   * 말판(198mm) 옆 상 위에서 던지기에 알맞다. 더 길면 던져서 굴러가는 거리가
   * 늘어 상 밖으로 나가고, 짧으면 손에서 회전이 덜 걸려 던진 대로 떨어진다.
   */
  lengthMm: 110,
  /**
   * 속대의 끝이 등3 안쪽으로 넘어가는 길이 — **갈고리**다.
   *
   * 속대가 등1·등2를 지나 여기서 모서리 하나를 더 넘는다. 넘어간 종이는 120°로
   * 꺾여 있어 빼내려면 펴야 하므로, 풀 없이도 속대가 관 안에 갇힌다. 5mm는 손톱
   * 으로 눌러 넣을 수 있는 최소값이다 — 더 길면 마구리 탭이 들어갈 자리를 먹는다.
   */
  linerHookMm: 5,
  /**
   * 마구리 높이를 단면 높이에서 이만큼 뺀다.
   *
   * 마구리가 서는 자리에는 속대가 이미 한 겹 깔려 있다. 종이 두께(0.2mm대)에
   * 끼워 넣을 여유를 더한 값이고, 0으로 두면 마구리가 끝까지 안 들어가 불룩해진다.
   */
  capClearanceMm: 0.4,
  /** 마구리 위에서 축 방향으로 접혀 속대 밑으로 들어가는 **탭**의 길이. */
  capTabMm: 6,
  /** 탭 폭. 마루(8mm)보다 좁아야 속대와 등 사이로 들어간다. */
  capTabWidthMm: STICK_BACK_FACE_MM - 1,
  /** 탭 끝을 좁히는 빗변. 좁혀 두어야 속대 밑으로 첫 밀어 넣기가 걸리지 않는다. */
  capTabTaperMm: 0.8,

  /** 시트 위 가락 사이 간격 — 가위가 지나갈 폭이다. */
  gapMm: 4,
  headerHeightMm: 22,
  /** 면 이름 글자. 최소 배율 0.9에서 2.34mm다. */
  labelFontMm: 2.6,
  /** 맞물리는 세 면의 번호. 골대와 같이 이름보다 크게 잡는다. */
  numberFontMm: 3.6,
  /** 등 면에 치는 나뭇결 — 배(민짜)와 한눈에 갈리게 하는 것이 전부다. */
  grainLines: 3,
  grainInsetMm: 9,
} as const;

/**
 * 맞물리는 세 면의 **번호**. 무는 차례 그대로다 — 골대가 탭·귀·겹을 번호로 부르는
 * 것과 같은 약속이다(`soccer/artwork/goals.ts`의 `FACE_NUMBERS`).
 *
 * 이름 대신 번호를 쓰는 것은 셋이 사슬처럼 물리는 구조에서 **"무엇이 무엇을 먼저
 * 무는가"가 이름보다 중요하기** 때문이다. 좁은 면(마구리는 폭 6.5mm)에도 크게
 * 넣을 수 있어 오히려 잘 보인다. 번호와 이름의 대응은 시트 머리글과 규칙문에 있다.
 */
export const STICK_FACE_NUMBERS = {
  liner: '1',
  cap: '2',
  tab: '3',
} as const;

/** 가락 넷. 그 가운데 하나가 백도 가락이다. */
export const STICK_COUNT = 4;
/** 백도 표식이 들어가는 가락(0부터). 마지막 줄이라 시트에서 바로 눈에 띈다. */
export const BAEKDO_STICK_INDEX = 3;

/**
 * 단면 높이 = √(등면² − ((배 − 마루)/2)²).
 *
 * 삼각함수를 쓰지 않는다 — 배와 등면 두 값에서 피타고라스로 바로 나오고, 정육각형
 * 절반(배 = 등면 × 2)이면 (√3/4)·배 = 6.93mm다.
 */
export const STICK_SLANT_RUN_MM = (STICK.bellyMm - STICK.backFaceMm) / 2;
export const STICK_HEIGHT_MM = Math.sqrt(
  STICK.backFaceMm ** 2 - STICK_SLANT_RUN_MM ** 2,
);

/** 마구리(사다리꼴)의 높이. 속대 두께만큼 낮다. */
export const STICK_CAP_HEIGHT_MM = STICK_HEIGHT_MM - STICK.capClearanceMm;
/**
 * 마구리 윗변. 마루보다 조금 넓다 — 마루보다 낮은 자리에서 자른 단면이라 그렇고,
 * 이 값이 마루와 같으면 마구리가 헐거워 관이 찌그러진다.
 */
export const STICK_CAP_TOP_WIDTH_MM =
  STICK.bellyMm -
  (2 * STICK_CAP_HEIGHT_MM * STICK_SLANT_RUN_MM) / STICK_HEIGHT_MM;

/**
 * 전개도의 띠 일곱. **왼쪽에서 오른쪽으로 감는 차례 그대로**다.
 *
 * 등1 → 등2 → 등3 → 배까지가 관 바깥이고, 배에서 모서리를 한 번 더 돌면 종이가
 * **안으로** 들어가 속대가 된다. 나선이라 접는 방향이 여섯 줄 모두 같다 —
 * "전부 같은 쪽으로 감는다" 한 줄로 설명이 끝나는 것이 이 차례를 고른 이유다.
 *
 * 이음매는 배–등1 모서리다. 등1의 자유변이 거기서 맞대어지고 **속대1이 그 밑을
 * 받친다** — 이음매를 종이 한 장이 가로지르므로 벌어지지 않는다.
 *
 * 속대를 배가 아니라 **등 쪽에** 넣은 것이 이 도안의 핵심이다(`stickBalance`).
 * 배에 넣으면 무게중심이 내려가 배를 깔고 눕기만 하고, 등에 넣으면 올라가 배가
 * 위로 오는 쪽이 그만큼 는다. 겹은 강성만이 아니라 **무게중심을 옮기는 장치**다.
 */
export interface StickPanel {
  readonly id: string;
  readonly label: string;
  /** 관 바깥면인가, 안으로 접혀 들어가는 속대인가. */
  readonly outer: boolean;
  readonly widthMm: number;
  /** 접었을 때 이 띠가 놓이는 단면의 면. 무게중심 계산이 이것을 읽는다. */
  readonly face: 'belly' | 'back-1' | 'back-2' | 'back-3';
}

export const STICK_PANELS: readonly StickPanel[] = [
  {
    id: 'back-1',
    label: '등',
    outer: true,
    widthMm: STICK.backFaceMm,
    face: 'back-1',
  },
  {
    id: 'back-2',
    label: '등 · 마루',
    outer: true,
    widthMm: STICK.backFaceMm,
    face: 'back-2',
  },
  {
    id: 'back-3',
    label: '등',
    outer: true,
    widthMm: STICK.backFaceMm,
    face: 'back-3',
  },
  {
    id: 'belly',
    label: '배',
    outer: true,
    widthMm: STICK.bellyMm,
    face: 'belly',
  },
  {
    id: 'liner-1',
    label: '속대',
    outer: false,
    widthMm: STICK.backFaceMm,
    face: 'back-1',
  },
  {
    id: 'liner-2',
    label: '속대',
    outer: false,
    widthMm: STICK.backFaceMm,
    face: 'back-2',
  },
  {
    id: 'liner-hook',
    label: '갈고리',
    outer: false,
    widthMm: STICK.linerHookMm,
    face: 'back-3',
  },
];

/** 띠 `id`의 위쪽 끝이 전개도 맨 위에서 얼마나 내려와 있는가. */
export const stickPanelTopMm = (id: string): number => {
  let top = 0;
  for (const panel of STICK_PANELS) {
    if (panel.id === id) return top;
    top += panel.widthMm;
  }
  throw new Error(`없는 띠다: ${id}`);
};

export const stickPanel = (id: string): StickPanel => {
  const found = STICK_PANELS.find((p) => p.id === id);
  if (!found) throw new Error(`없는 띠다: ${id}`);
  return found;
};

/** 전개도 한 벌의 띠 블록 크기. 마구리는 이 밖으로 뻗는다. */
export const STICK_NET = {
  widthMm: STICK.lengthMm,
  heightMm: STICK_PANELS.reduce((sum, p) => sum + p.widthMm, 0),
} as const;

/** 마구리와 탭이 띠 블록 밖으로 뻗는 길이. 양 끝에 하나씩이다. */
export const STICK_CAP_REACH_MM = STICK_CAP_HEIGHT_MM + STICK.capTabMm;

/**
 * 윷가락 시트 — A4 세로 한 장.
 *
 * 넉 장을 **나란히가 아니라 눕혀 넉 줄로** 앉힌다. 속대가 붙으면서 전개도 폭이
 * 40mm에서 61mm로 늘어(`STICK_PANELS`) 네 벌을 세워 늘어놓으면 244mm라 A4 폭을
 * 넘기 때문이다. 눕히면 한 벌이 110mm뿐이라 오른쪽에 도해를 놓을 단이 남는다 —
 * 골대가 전개도 아래에 도해를 깐 것과 같은 자리 배분이다.
 *
 * 194×281은 **여백 8mm까지 한 장을 지키는** 크기다(골대 시트와 같은 기준,
 * `soccer/dimensions.ts`의 `SHEETS.goals`). 인쇄 여백은 사용자가 고르는 값이라
 * A4 그대로(210×297) 잡으면 여백을 조금만 줘도 두 장으로 쪼개지는데, **조립물이
 * 두 장으로 쪼개지면 이어 붙인 자리에서 전개도가 어긋난다.**
 */
export const STICK_SHEET = { widthMm: 194, heightMm: 281 } as const;

/** 띠 블록의 좌상단. 마구리가 왼쪽으로 `STICK_CAP_REACH_MM`만큼 더 나간다. */
export const STICK_ORIGIN = { xMm: 16, yMm: STICK.headerHeightMm } as const;

/** 가락 `index`(0부터) 전개도의 띠 블록 좌상단 y. */
export const stickNetTopMm = (index: number): number =>
  STICK_ORIGIN.yMm + index * (STICK_NET.heightMm + STICK.gapMm);

/** 조립 도해가 앉는 오른쪽 단. */
export const STICK_DIAGRAM = {
  leftMm: 144,
  widthMm: 48,
  topMm: STICK.headerHeightMm + 2,
  heightMm: 56,
  gapMm: 8,
} as const;

/**
 * 전개도 바깥 윤곽 — 한 붓으로 두르는 닫힌 다각형.
 *
 * 띠 블록(직사각형)에 배 띠 양 끝의 **마구리 사다리꼴**과 그 위의 **탭**이 붙는다.
 * 마구리의 빗변은 단면의 빗면과 같은 기울기라, 세우면 등1·등3 안쪽에 딱 맞아
 * 관이 찌그러지지 않는다.
 *
 * 골대와 달리 **홈을 파지 않는다.** 마구리는 배 띠의 끝에만 붙어 있고 이웃한
 * 등1·등3의 끝과는 꼭짓점 하나로만 만나므로, 접을 때 서로를 잡아당길 변이 없다.
 *
 * 도안 테스트가 접는선이 이 다각형 안에 있는지를 이 좌표로 확인한다 — 그리는
 * 코드와 검사하는 코드가 같은 값을 읽어야 어긋나지 않는다.
 */
export const stickNetOutline = (
  originXMm: number,
  originYMm: number,
): ReadonlyArray<readonly [number, number]> => {
  const x0 = originXMm;
  const x1 = originXMm + STICK_NET.widthMm;
  const y0 = originYMm;
  const y1 = originYMm + STICK_NET.heightMm;
  const bellyTop = y0 + stickPanelTopMm('belly');
  const bellyBottom = bellyTop + STICK.bellyMm;
  const cy = (bellyTop + bellyBottom) / 2;

  const ch = STICK_CAP_HEIGHT_MM;
  const ct = STICK.capTabMm;
  const capHalf = STICK_CAP_TOP_WIDTH_MM / 2;
  const tabHalf = STICK.capTabWidthMm / 2;
  const taper = STICK.capTabTaperMm;

  return [
    [x0, y0],
    [x1, y0],
    // 오른쪽 마구리 — 빗면 → 탭 → 빗면
    [x1, bellyTop],
    [x1 + ch, cy - capHalf],
    [x1 + ch, cy - tabHalf],
    [x1 + ch + ct, cy - tabHalf + taper],
    [x1 + ch + ct, cy + tabHalf - taper],
    [x1 + ch, cy + tabHalf],
    [x1 + ch, cy + capHalf],
    [x1, bellyBottom],
    [x1, y1],
    [x0, y1],
    // 왼쪽 마구리
    [x0, bellyBottom],
    [x0 - ch, cy + capHalf],
    [x0 - ch, cy + tabHalf],
    [x0 - ch - ct, cy + tabHalf - taper],
    [x0 - ch - ct, cy - tabHalf + taper],
    [x0 - ch, cy - tabHalf],
    [x0 - ch, cy - capHalf],
    [x0, bellyTop],
  ];
};

export interface StickFold {
  readonly kind: 'fold-mountain' | 'fold-valley';
  readonly fromMm: readonly [number, number];
  readonly toMm: readonly [number, number];
  readonly label: string;
}

/**
 * 접는선 열 줄.
 *
 * - **산접기 여섯** — 띠와 띠 사이. 인쇄면이 바깥으로 오게 같은 쪽으로만 감으면
 *   관이 되고 종이가 그대로 안으로 들어가 속대가 된다.
 * - **산접기 둘** — 마구리 밑동. 관 안쪽으로 세우는 것이라 방향이 위와 같다.
 * - **골접기 둘** — 탭 밑동. 이 도안에서 **유일하게 반대로 접는 자리**다. 탭은
 *   마구리의 인쇄면 쪽으로 꺾여 축을 따라 들어가야 속대 밑으로 들어간다.
 */
export const stickFolds = (
  originXMm: number,
  originYMm: number,
): readonly StickFold[] => {
  const x0 = originXMm;
  const x1 = originXMm + STICK_NET.widthMm;
  const bellyTop = originYMm + stickPanelTopMm('belly');
  const bellyBottom = bellyTop + STICK.bellyMm;
  const cy = (bellyTop + bellyBottom) / 2;
  const ch = STICK_CAP_HEIGHT_MM;
  const tabHalf = STICK.capTabWidthMm / 2;

  const folds: StickFold[] = [];
  let top = 0;
  for (const panel of STICK_PANELS.slice(0, -1)) {
    top += panel.widthMm;
    folds.push({
      kind: 'fold-mountain',
      fromMm: [x0, originYMm + top],
      toMm: [x1, originYMm + top],
      label: `${panel.id} 다음`,
    });
  }
  for (const [x, side] of [
    [x0, '왼쪽'],
    [x1, '오른쪽'],
  ] as const) {
    folds.push({
      kind: 'fold-mountain',
      fromMm: [x, bellyTop],
      toMm: [x, bellyBottom],
      label: `${side} 마구리 밑동`,
    });
  }
  for (const [x, side] of [
    [x0 - ch, '왼쪽'],
    [x1 + ch, '오른쪽'],
  ] as const) {
    folds.push({
      kind: 'fold-valley',
      fromMm: [x, cy - tabHalf],
      toMm: [x, cy + tabHalf],
      label: `${side} 탭 밑동`,
    });
  }
  return folds;
};

/**
 * 단면의 꼭짓점 넷. 배를 바닥에 깔았을 때(`y`는 위로 증가)의 좌표다.
 *
 * 배가 아래(`y = 0`), 마루가 위(`y = 높이`)다. 배 쪽 두 모서리가 60°로 날카롭고
 * 등 쪽 두 모서리가 120°다 — 정육각형을 가로로 자른 자리가 날카로운 쪽이다.
 */
export const stickSectionPoints = (): ReadonlyArray<
  readonly [number, number]
> => [
  [STICK.bellyMm / 2, 0],
  [STICK.backFaceMm / 2, STICK_HEIGHT_MM],
  [-STICK.backFaceMm / 2, STICK_HEIGHT_MM],
  [-STICK.bellyMm / 2, 0],
];

export interface StickBalance {
  /** 배 면에서 잰 무게중심 높이. 종이는 껍데기라 **면의 넓이**로만 잡는다. */
  readonly centroidYMm: number;
  /** 속대를 빼고 관 바깥면만 있을 때의 무게중심. 속대가 얼마나 올렸는지 보는 값. */
  readonly shellOnlyCentroidYMm: number;
  /** 무게중심에서 각 면이 차지하는 각도. 넷을 더하면 360°다. */
  readonly wedgeDeg: Readonly<
    Record<'belly' | 'back-1' | 'back-2' | 'back-3', number>
  >;
  /** 빗면에 얹혔을 때 마루 쪽으로 넘어가는가. 참이면 모서리로 서지 않는다. */
  readonly slantTipsToCrest: boolean;
  /** 빗면 위 무게중심이 마루 쪽 끝에서 떨어진 거리. 작을수록 잘 넘어간다. */
  readonly slantMarginMm: number;
  /** 배가 위로 올 몫의 **아래끝** — 마루로 곧장 눕는 것만 센다. */
  readonly crestOnlyShare: number;
  /** 배가 위로 올 몫의 **위끝** — 빗면에 얹힌 것이 모두 마루로 넘어온다고 본다. */
  readonly bellyUpShare: number;
}

/**
 * 던지기 전에 종이 위에서 따져 볼 수 있는 만큼 (IDE-018)
 *
 * **실물을 던져 보는 것을 대신하지 않는다.** 튐·구름·손버릇이 다 빠진 정적
 * 모형이고, 여기서 하는 일은 하나다 — 치수를 고쳤을 때 **누가 봐도 한쪽으로
 * 쏠리는 단면**을 도안 테스트가 미리 잡아 주는 것.
 *
 * 두 가지를 센다.
 *
 * 1. **무게중심.** 종이는 속이 빈 껍데기라 무게가 면을 따라 붙는다. 띠 폭을
 *    그 띠가 놓이는 자리에 얹어 평균한다. 속대를 등 쪽에 넣었으므로 무게중심이
 *    배에서 멀어진다 — `shellOnlyCentroidYMm`과 견주면 얼마나 올랐는지 보인다.
 * 2. **면이 차지하는 각도.** 무게중심에서 각 면의 양 끝을 본 각이다. 넷을 더하면
 *    360°이고, 넓은 각을 가진 면으로 눕기 쉽다 — 주사위의 공평함을 재는 것과
 *    같은 어림이다.
 *
 * 빗면 둘은 **얹히기는 해도 버티지 못한다.** 무게중심이 빗면 위에서 마루 쪽 끝에
 * 바짝 붙어 있어(`slantMarginMm`), 조금만 흔들려도 마루 쪽으로 넘어간다 — 이것이
 * "모서리로 서지 않는다"의 종이 위 근거다.
 *
 * 그 빗면의 몫이 어디로 가는지는 던져 봐야 알기 때문에 **한 값이 아니라 구간**을
 * 낸다. 하나도 안 넘어오면 `crestOnlyShare`, 다 넘어오면 `bellyUpShare`이고,
 * 실제는 그 사이 어딘가다. 지금 단면은 이 구간이 **0.5를 품는다** — 종이 위에서
 * 확인할 수 있는 것은 거기까지이고, 40~60%인지는 100번 던져야 정해진다.
 */
export const stickBalance = (): StickBalance => {
  const h = STICK_HEIGHT_MM;
  const [vBellyRight, vCrestRight, vCrestLeft, vBellyLeft] =
    stickSectionPoints();

  /** 각 면의 한가운데. 띠 하나가 그 면에 얹히면 무게가 여기에 붙는다. */
  const faceCenter = {
    belly: [0, 0] as const,
    'back-1': [
      (vBellyRight[0] + vCrestRight[0]) / 2,
      (vBellyRight[1] + vCrestRight[1]) / 2,
    ] as const,
    'back-2': [0, h] as const,
    'back-3': [
      (vCrestLeft[0] + vBellyLeft[0]) / 2,
      (vCrestLeft[1] + vBellyLeft[1]) / 2,
    ] as const,
  };

  const centroidOf = (panels: readonly StickPanel[]): number => {
    let mass = 0;
    let moment = 0;
    for (const panel of panels) {
      // 갈고리는 등3 면 전체가 아니라 마루 쪽 끝 일부만 덮는다.
      const y =
        panel.id === 'liner-hook'
          ? h - (h * (panel.widthMm / 2)) / STICK.backFaceMm
          : faceCenter[panel.face][1];
      mass += panel.widthMm;
      moment += panel.widthMm * y;
    }
    return moment / mass;
  };

  const centroidYMm = centroidOf(STICK_PANELS);
  const shellOnlyCentroidYMm = centroidOf(STICK_PANELS.filter((p) => p.outer));

  const angleTo = ([x, y]: readonly [number, number]): number =>
    Math.atan2(y - centroidYMm, x);
  const spanDeg = (
    from: readonly [number, number],
    to: readonly [number, number],
  ): number => {
    const diff = angleTo(to) - angleTo(from);
    const wrapped = ((diff % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return (wrapped * 180) / Math.PI;
  };

  const wedgeDeg = {
    'back-1': spanDeg(vBellyRight, vCrestRight),
    'back-2': spanDeg(vCrestRight, vCrestLeft),
    'back-3': spanDeg(vCrestLeft, vBellyLeft),
    belly: spanDeg(vBellyLeft, vBellyRight),
  };

  // 빗면(등1) 위에서 무게중심이 어디에 내려앉는가 — 마루 쪽 끝에 가까울수록
  // 그쪽으로 넘어간다.
  const edge: readonly [number, number] = [
    vCrestRight[0] - vBellyRight[0],
    vCrestRight[1] - vBellyRight[1],
  ];
  const along =
    ((0 - vBellyRight[0]) * edge[0] +
      (centroidYMm - vBellyRight[1]) * edge[1]) /
    STICK.backFaceMm;
  const slantMarginMm = STICK.backFaceMm - along;

  return {
    centroidYMm,
    shellOnlyCentroidYMm,
    wedgeDeg,
    slantTipsToCrest: along > STICK.backFaceMm / 2,
    slantMarginMm,
    crestOnlyShare: wedgeDeg['back-2'] / 360,
    bellyUpShare:
      (wedgeDeg['back-1'] + wedgeDeg['back-2'] + wedgeDeg['back-3']) / 360,
  };
};

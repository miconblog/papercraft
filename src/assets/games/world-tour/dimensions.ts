/**
 * 세계일주 게임판 실측 치수 (IDE-015)
 *
 * 여기 있는 값이 **배율 100%에서 종이 위 mm**다. 도안 정의(`./index.ts`)와
 * 아트워크 생성기(`./artwork/`)가 같은 상수를 읽는다.
 *
 * 좌표계는 `docs/game-authoring.md`를 따른다: 파트 로컬 mm, 원점 좌상단, y는
 * 아래로. 작도 근거는 [docs/world-tour-artwork.md](../../../../docs/world-tour-artwork.md).
 */
/**
 * 판 크기는 도시 수를 따라 커진다(2026-09-08 사용자 제안).
 *
 * 칸·말·이름 글자는 **실물 치수**라 판이 커져도 그대로다. 지도만 커지므로 같은
 * 유럽 땅에 칸이 들어갈 자리가 두 배·네 배가 되고, 칸이 실제 위치 가까이
 * 앉는다. 배율을 올려 뽑는 것과 다른 점이 이것이다 — 배율은 A4에서 이미 밀려난
 * 배치를 그대로 키울 뿐이다.
 *
 * A3는 A4의 √2배, A2는 2배라 **판의 틀(띠·지도)은 A4 도안을 그대로 배율만
 * 올린 것**이다. 인쇄 파이프라인이 A4 여러 장으로 나눠 준다(`IDE-007`).
 */
export const PAPER_STEPS = [
  { maxCities: 50, widthMm: 297, heightMm: 210, sheets: 1, label: 'A4' },
  { maxCities: 70, widthMm: 420, heightMm: 297, sheets: 2, label: 'A3' },
  // 마지막 단계는 그 위의 어떤 수도 받는다 — 풀 113개를 다 켜도 A2다.
  { maxCities: 100, widthMm: 594, heightMm: 420, sheets: 4, label: 'A2' },
] as const;

export type PaperStep = (typeof PAPER_STEPS)[number];

/** 도시 수에 맞는 종이. 100을 넘으면 마지막 단계다. */
export const paperFor = (cityCount: number): PaperStep =>
  PAPER_STEPS.find((step) => cityCount <= step.maxCities) ??
  PAPER_STEPS[PAPER_STEPS.length - 1];

/** 기본 판(도시 50개) — A4 가로. 도안 정의가 가리키는 파트 치수다. */
export const BOARD = { widthMm: 297, heightMm: 210 } as const;

/**
 * A4 기준 틀. 판을 세 띠로 나눈다: 제목·범례(위) · 지도(가운데) · 놀이 안내(아래).
 *
 * 지도는 종이 폭을 다 쓴다. 로빈슨 세계 전도의 가로세로비가 약 1.97:1이라
 * 폭 297mm면 높이가 150.62mm다 — A4 가로(1.41:1)에 놓으면 위아래 59mm가 남고,
 * 그 자리가 옛 인쇄본이 제목 띠와 설명문을 두었던 곳이다.
 *
 * 높이는 `./projection.ts`의 `ROBINSON_ASPECT`에서 나온 값을 **상수로 적었다**.
 * 이 파일은 앱 번들에 들어가므로 아무것도 import하지 않는다(야구 게임판과
 * 같은 규약). 둘이 어긋나면 테스트가 잡는다.
 */
const A4_TITLE_HEIGHT_MM = 25;
const A4_MAP_HEIGHT_MM = 150.62;

export interface Frame {
  /** A4 대비 배율. A4 1 · A3 √2 · A2 2. */
  readonly k: number;
  readonly paper: PaperStep;
  readonly board: { readonly widthMm: number; readonly heightMm: number };
  readonly titleBand: { readonly yMm: number; readonly heightMm: number };
  readonly map: {
    readonly xMm: number;
    readonly yMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
  };
  readonly noteBand: { readonly yMm: number; readonly heightMm: number };
}

/** 도시 수에 맞는 판의 틀. 띠와 지도가 종이에 비례해 커진다. */
/** 종이 단계의 지도 높이. 로빈슨 비율을 A4 폭에 맞춘 값에 배율을 곱한다. */
export const mapHeightFor = (paper: PaperStep): number =>
  Math.round(A4_MAP_HEIGHT_MM * (paper.widthMm / BOARD.widthMm) * 100) / 100;

/**
 * 도시 수에 맞는 판의 틀. 띠와 지도가 종이에 비례해 커진다.
 *
 * `mapOnly`면 제목·안내 띠 없이 **지도만** 낸다(2026-09-08 사용자 요청) — 판은
 * 지도 상자 그대로이고 높이가 지도 높이다. 규칙과 범례는 소개 페이지에 있다.
 */
export const frameFor = (cityCount: number, mapOnly = false): Frame => {
  const paper = paperFor(cityCount);
  const k = paper.widthMm / BOARD.widthMm;
  const mapHeight = mapHeightFor(paper);
  if (mapOnly) {
    return {
      k,
      paper,
      board: { widthMm: paper.widthMm, heightMm: mapHeight },
      titleBand: { yMm: 0, heightMm: 0 },
      map: { xMm: 0, yMm: 0, widthMm: paper.widthMm, heightMm: mapHeight },
      noteBand: { yMm: mapHeight, heightMm: 0 },
    };
  }
  const titleHeight = A4_TITLE_HEIGHT_MM * k;
  return {
    k,
    paper,
    board: { widthMm: paper.widthMm, heightMm: paper.heightMm },
    titleBand: { yMm: 0, heightMm: titleHeight },
    map: {
      xMm: 0,
      yMm: titleHeight,
      widthMm: paper.widthMm,
      heightMm: mapHeight,
    },
    noteBand: {
      yMm: titleHeight + mapHeight,
      heightMm: paper.heightMm - titleHeight - mapHeight,
    },
  };
};

/**
 * 동적 파트의 크기 단계 — 도안 정의(`../index.ts`)가 스키마의 `dynamic.sizeSteps`에
 * 그대로 넣는다. 렌더러(`frameFor`)와 같은 표에서 나오므로 어긋나지 않는다.
 */
export const DYNAMIC_SIZE_STEPS = PAPER_STEPS.map((paper) => ({
  maxItems: paper.maxCities,
  widthMm: paper.widthMm,
  heightMm: paper.heightMm,
  mapHeightMm: mapHeightFor(paper),
}));

const A4_FRAME = frameFor(50);
export const TITLE_BAND = A4_FRAME.titleBand;
export const MAP = A4_FRAME.map;
export const NOTE_BAND = A4_FRAME.noteBand;

/**
 * 도시 칸.
 *
 * 흰 원에 번호, 원 아래 도시 이름이다. 반지름 3.3mm면 지름 6.6 — 원 안에 두
 * 자리 번호(3mm)가 들어가고 말(지름 13mm)이 위에 서면 원이 가려져도 이름이
 * 남는다. 출발지 서울은 조금 크다.
 *
 * 이름 글자 2.3mm는 배율 100%에서 읽히는 하한 근처다. 80개 프리셋에서 이보다
 * 키우면 유럽에서 이름끼리 겹친다.
 */
export const CITY_MARKER = {
  radiusMm: 3.3,
  startRadiusMm: 4.6,
  strokeMm: 0.45,
  numberFontMm: 3,
  labelFontMm: 2.3,
  /** 원 아래 끝에서 이름 글자 중심까지. */
  labelGapMm: 0.7,
  /**
   * 실제 위치 표시점 — 이것이 지리다. 번호 원은 언제나 이 점에서 떨어져
   * 바다에 앉고, 가는 선이 둘을 잇는다(2026-09-08 사용자 지적 — 원이 도시
   * 자리를 가리면 안 된다). 흰 테를 둘러 땅색 위에서도 도드라진다.
   */
  anchorDotRadiusMm: 0.9,
  anchorHaloMm: 0.5,
  anchorLineMm: 0.3,
} as const;

/**
 * 특수칸 표식 — 원 오른쪽 위에 붙는 색 상자. 글자가 뜻을 말하고 색은 거든다
 * (흑백으로 뽑아도 읽힌다).
 */
export const SPECIAL_CHIP = {
  heightMm: 4.2,
  paddingMm: 0.8,
  fontMm: 2.3,
  /** 원 오른쪽 가장자리에서 상자 왼쪽까지. */
  gapMm: 0.3,
  strokeMm: 0.3,
} as const;

/** 칸과 칸을 잇는 화살표. 옛 인쇄본처럼 빨강이다. */
export const ROUTE_LINE = {
  strokeMm: 0.7,
  arrowLengthMm: 2.4,
  arrowHalfWidthMm: 1.1,
  /** 원 가장자리에서 선이 시작·끝나기까지 띄우는 거리. */
  clearanceMm: 0.3,
} as const;

/**
 * 칸 배치 여유. 칸의 발자국(원 + 이름 + 표식)끼리 이만큼 떨어뜨린다.
 * 배치 계산은 `./artwork/layout.ts`가 한다.
 */
export const LAYOUT = {
  marginMm: 0.9,
  /** 지도 가장자리에서 칸 발자국까지. */
  edgeInsetMm: 0.8,
  maxIterations: 600,
  /** 실제 위치 점 둘레에 원이 들어오지 못하는 여유. */
  anchorClearanceMm: 1.2,
  /**
   * 원이 "바다에 있다"고 치는 기준 — 반지름의 이 비율 안이 바다면 된다. 원
   * 전체를 요구하면 A4에서 지중해·발트해·홍해가 전부 탈락해 로마가 발트해로
   * 밀려난다. 원이 해안을 조금 물고 앉는 것은 옛 인쇄본도 그랬다.
   */
  seaCoreFraction: 0.55,
  /** 실제 위치에서 바다를 찾아 나가는 한계. 이보다 멀면 내륙으로 보고 땅에 앉힌다. */
  seaSearchMm: 22,
  /** 땅이어도 좋으니 자리를 찾는 한계. */
  landSearchMm: 30,
  /** 자리 값에서 "앞 칸까지의 거리"의 무게. 실제 위치까지의 거리는 1이다. */
  routeWeight: 0.4,
  /** 바다 자리가 땅 자리보다 이만큼(값 기준)까지 멀어도 바다를 고른다. */
  seaBonusMm: 5,
} as const;

/**
 * 말 시트 — A7 가로. 여섯 개가 3×2로 앉는다.
 *
 * 말은 **평평한 원판**이다. 지름 13mm면 칸(6.6mm)을 덮고도 이름 글자가 밑으로
 * 보이고, 두꺼운 종이에 뽑아 오리면 손가락으로 집힌다. 세우는 말(텐트형)은
 * 칸 간격 8mm 안에서 이웃 칸을 가리므로 쓰지 않는다.
 */
export const TOKEN_SHEET = { widthMm: 105, heightMm: 74 } as const;

export const TOKEN = {
  radiusMm: 6.5,
  count: 6,
  columns: 3,
  /** 원판 중심 사이 간격. */
  pitchMm: 24,
  /** 첫 원판 중심. 아래 다섯은 `pitchMm`로 늘어선다. */
  firstCenter: { xMm: 28.5, yMm: 34 },
  /** 색 테. 원판 가장자리 안쪽에 두르고, 사용자가 색을 고른다. */
  ringWidthMm: 1.6,
  /** 그림(모양)이 앉는 위쪽 상자의 중심 — 원판 중심에서 위로. */
  iconOffsetMm: 1.9,
  iconSizeMm: 4.2,
  /** 이름 글자 — 원판 중심 아래. */
  nameOffsetMm: 3.6,
  nameFontMm: 2,
  nameMaxWidthMm: 9.5,
  numberFontMm: 1.8,
} as const;

/**
 * 말 여섯의 기본 색과 모양. 색만으로 가르면 흑백에서 누구 말인지 알 수 없어
 * 모양을 함께 둔다(`IDE-009`가 축구 팀 색에서 확인한 것).
 */
export const TOKEN_STYLES = [
  { id: 1, color: '#dc2626', shape: 'circle', label: '동그라미' },
  { id: 2, color: '#1d4ed8', shape: 'triangle', label: '세모' },
  { id: 3, color: '#15803d', shape: 'square', label: '네모' },
  { id: 4, color: '#d97706', shape: 'star', label: '별' },
  { id: 5, color: '#7e22ce', shape: 'heart', label: '하트' },
  { id: 6, color: '#0f766e', shape: 'diamond', label: '마름모' },
] as const;

export type TokenShape = (typeof TOKEN_STYLES)[number]['shape'];

/** 말 n(1–6)의 원판 중심. */
export const tokenCenter = (n: number): { xMm: number; yMm: number } => {
  const i = n - 1;
  return {
    xMm: TOKEN.firstCenter.xMm + (i % TOKEN.columns) * TOKEN.pitchMm,
    yMm: TOKEN.firstCenter.yMm + Math.floor(i / TOKEN.columns) * TOKEN.pitchMm,
  };
};

/** 말 n의 색을 받는 레이어 id. 렌더러가 `paint` 배치로 여기 색을 칠한다. */
export const tokenLayerId = (n: number): string => `pc-token-${n}`;

/**
 * 종이 주사위 전개도 시트.
 *
 * 한 변 22mm. 옛 인쇄본의 주사위가 이만했고, 이보다 작으면 여섯 살 손으로
 * 접기 어렵다. 십자 전개도에 풀칠면 일곱이다.
 */
export const DICE_SHEET = { widthMm: 120, heightMm: 100 } as const;

export const DICE = {
  faceMm: 22,
  /** 풀칠면 깊이와 사다리꼴 빗변의 들여쓰기. */
  tabDepthMm: 6,
  tabInsetMm: 2,
  /** 전개도 왼쪽 위(첫 면 A의 좌상단) — 시트 안에서 가운데다. */
  originXMm: (120 - (4 * 22 + 6)) / 2, // 13
  originYMm: 14 + (100 - 14 - (3 * 22 + 2 * 6)) / 2, // 18
  pipRadiusMm: 2,
  headerHeightMm: 14,
} as const;

/**
 * 골프 게임판 실측 치수와 18홀 코스 (IDE-030)
 *
 * 여기 있는 값이 **배율 100%에서 종이 위 mm**다. 도안 정의(`./index.ts`)와
 * 아트워크 생성기(`./artwork/`)가 같은 상수를 읽는다.
 *
 * 좌표계는 `docs/game-authoring.md`를 따른다: 파트 로컬 mm, 원점 좌상단,
 * y는 아래로 증가한다. **티가 아래, 그린이 위**다 — 연필을 쥔 손이 종이 앞쪽
 * 책상에 놓이고 공은 위로 나아간다. 앞선 게임들과 같은 방향이다(야구의 홈이
 * 아래인 것과 같은 이유).
 *
 * 작도 근거는 [docs/golf-artwork.md](../../../../docs/golf-artwork.md)에 있다.
 */

/**
 * 홀 판 — **A4 세로 한 장이 홀 하나**다(2026-09-15 사용자 요청).
 *
 * 열여덟 장이 다 인쇄돼야 한 라운드가 된다. 그래서 이 게임은 판이 열여덟
 * 장이고, 규격에 `sheet` 파트 종류가 생겼다(`lib/schema/parts.ts`) — 보드는
 * 정확히 1개라 나머지 열일곱을 담을 자리가 없었다.
 */
export const BOARD = { widthMm: 210, heightMm: 297 } as const;

/**
 * 코스가 그려지는 영역 — 이 사각형 **밖은 전부 OB**다.
 *
 * 위는 머리띠(홀 번호·파·거리) 아래, 아래는 바닥 한 줄 위다. 경계선이 곧 OB
 * 선이라 아이가 "여기를 넘으면 벌타"를 눈으로 안다.
 */
export const COURSE_AREA = {
  xMm: 10,
  yMm: 46,
  widthMm: 190,
  heightMm: 240,
} as const;

/**
 * 티의 y — **열여덟 홀이 모두 같다.**
 *
 * 홀마다 다르게 두었더니 판을 넘길 때 공 놓는 자리가 위아래로 튀었다. 같은
 * 자리면 아이가 판만 갈아 놓고 바로 친다. 이 값이 코스 영역 아래 끝에서
 * 페어웨이 반폭만큼 떨어져 있어야 페어웨이 끝이 O.B. 선을 넘지 않는다.
 */
export const TEE_Y_MM = 258;

/** 홀 판 위 글자 조판. */
export const TYPE = {
  /** 왼쪽 위 큰 홀 번호. */
  holeNumberXMm: 16,
  holeNumberYMm: 20,
  holeNumberFontMm: 15,
  /** 홀 번호 아래 "번 홀". */
  holeUnitYMm: 31,
  holeUnitFontMm: 4,
  /** 홀 이름 — 번호 오른쪽. */
  holeNameXMm: 34,
  holeNameYMm: 17,
  holeNameFontMm: 7,
  holeNameMaxWidthMm: 96,
  /** 코스 이름 슬롯이 앉는 자리. 홀 이름 아래 작게. */
  courseNameXMm: 34,
  courseNameYMm: 27,
  courseNameFontMm: 3.6,
  courseNameMaxWidthMm: 96,
  /** 오른쪽 위 파·거리 상자. */
  statBoxXMm: 138,
  statBoxYMm: 8,
  statBoxWidthMm: 56,
  statBoxHeightMm: 28,
  statLabelFontMm: 3.2,
  statValueFontMm: 8,
  /** 머리띠 아래 가로줄. */
  headerRuleYMm: 40,
  /** 바닥 한 줄 — 이번 홀에서 적을 것을 알려 준다. */
  footerYMm: 290,
  footerFontMm: 3.2,
  /** 코스 위 작은 표식 글자(티·그린·OB·물). */
  markerFontMm: 3,
} as const;

/** 코스 요소의 크기와 농도. */
export const COURSE = {
  /** 홀 원 — 공(지름 12mm)이 걸쳐 멈추면 홀아웃이다. */
  cupRadiusMm: 8,
  /** 홀 원 안의 검은 점. 멀리서도 홀이 어디인지 보인다. */
  cupDotRadiusMm: 2.4,
  /** 깃대 — 홀에서 위로 뻗는 선과 삼각 깃발. 그림일 뿐 부속과는 다른 것이다. */
  flagPoleHeightMm: 16,
  flagWidthMm: 9,
  flagHeightMm: 6,
  /** 티잉 그라운드 사각형. */
  teeWidthMm: 26,
  teeHeightMm: 13,
  /** 티 표시 점 두 개의 간격. */
  teeMarkerGapMm: 16,
  teeMarkerRadiusMm: 1.4,
  /** 나무 한 그루의 기본 반지름. 숲은 이 값 언저리로 흩어진다. */
  treeRadiusMm: 4.2,
  treeRadiusJitterMm: 1.4,
  /** 나무끼리 이만큼은 떨어진다. */
  treeSpacingMm: 7.5,
  /** 페어웨이·그린에서 이만큼 안쪽에는 나무를 심지 않는다. */
  treeClearanceMm: 6,
  /**
   * 그린을 두르는 칼라(프린지)의 폭. 페어웨이 색으로 그린보다 먼저 깔린다.
   *
   * 그린이 러프 한가운데 떠 있으면 종이 위에서 과녁처럼만 보인다. 실제 코스도
   * 그린 둘레는 짧게 깎은 띠다.
   */
  greenCollarMm: 4.5,
} as const;

/** 선과 채움 — 흑백으로 뽑아도 요소가 구분되도록 농도를 벌려 두었다. */
export const INK = {
  /**
   * 러프 — 코스 영역 전체를 덮는 바닥색이다. 가장 옅다.
   *
   * 처음에는 흰 종이로 두었는데, 뽑아 보니 페어웨이 혼자 떠 있어 골프장이
   * 아니라 그림 하나가 되었다. 바닥을 한 겹 깔면 **OB 선 안쪽이 코스**라는
   * 것이 색으로 읽힌다.
   */
  roughFill: '#f4f9f1',
  /** 페어웨이 — 러프보다 한 단계 진하다. 공이 지나갈 면이라 잉크를 아낀다. */
  fairwayFill: '#ddefd8',
  fairwayStroke: '#4f9d54',
  /** 그린 — 페어웨이보다 한 단계 진하다. */
  greenFill: '#bfe2bb',
  greenStroke: '#2f7d32',
  /** 벙커 — 모래. */
  bunkerFill: '#f6efdb',
  bunkerStroke: '#c0a05a',
  /** 물. */
  waterFill: '#e3eefb',
  waterStroke: '#3d7ab8',
  /** 나무. */
  treeFill: '#e4f0df',
  treeStroke: '#3f7c43',
  /** OB 경계. */
  obStroke: '#9aa3ad',
} as const;

/** 코스 좌표는 짝으로 적는다 — 열여덟 홀을 객체로 적으면 파일이 두 배가 된다. */
export type Xy = readonly [number, number];

/** 벙커·연못처럼 타원 하나로 되는 것. `rotDeg`는 시계 방향이다. */
export interface EllipseSpec {
  readonly xMm: number;
  readonly yMm: number;
  readonly rxMm: number;
  readonly ryMm: number;
  readonly rotDeg?: number;
}

/** 페어웨이를 가로지르는 개울. 중심선과 폭으로 적고 페어웨이와 같은 방법으로 부풀린다. */
export interface StreamSpec {
  readonly points: readonly Xy[];
  readonly widthMm: number;
}

/**
 * 숲 — 나무를 한 그루씩 적지 않고 **상자와 그루 수**로 적는다.
 *
 * 열여덟 홀에 나무가 백쉰 그루쯤 들어가는데 좌표를 손으로 적으면 이 파일이
 * 코스가 아니라 좌표표가 된다. 자리는 홀 번호를 씨앗으로 한 난수가 정하고
 * (`plantForest`), 씨앗이 같으면 언제 돌려도 같은 숲이 나온다 — 커밋된 SVG와
 * 생성기가 어긋나지 않아야 하기 때문이다.
 */
export interface ForestSpec {
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly count: number;
}

/**
 * 홀 하나.
 *
 * `spine`의 **첫 점이 티, 마지막 점이 그린 중심**이다. 페어웨이는 이 선을
 * 좌우로 부풀려 만들고(`fairwayWidthMm`), 그래서 선 하나만 고치면 페어웨이·
 * 티·그린이 함께 따라온다 — 셋을 따로 적으면 어긋난다.
 */
export interface HoleSpec {
  readonly number: number;
  readonly par: number;
  readonly name: string;
  /** 가상 거리. 판 위 mm와 비례하지는 않지만 파와는 어울린다(테스트가 본다). */
  readonly yards: number;
  readonly spine: readonly Xy[];
  readonly fairwayWidthMm: number;
  readonly green: { readonly rxMm: number; readonly ryMm: number };
  /** 그린 중심에서 홀 원까지의 치우침. 홀이 그린 한가운데만 있으면 심심하다. */
  readonly cup: Xy;
  readonly bunkers: readonly EllipseSpec[];
  readonly ponds: readonly EllipseSpec[];
  readonly streams: readonly StreamSpec[];
  readonly forests: readonly ForestSpec[];
}

const NO_PONDS: readonly EllipseSpec[] = [];
const NO_STREAMS: readonly StreamSpec[] = [];

/**
 * 열여덟 홀 — **파 72**다(전반 36 · 후반 36).
 *
 * 파3 넷 · 파4 열 · 파5 넷으로 정규 코스의 구성을 그대로 따랐다. 아이가
 * 기록표에서 "파 72"를 기준으로 더하고 빼기 때문에 이 합이 곧 학습의 기준선이다.
 *
 * 홀마다 성격을 하나씩 준다 — 물을 건너는 홀, 모래가 많은 홀, 두 번 굽는 홀.
 * 열여덟 장이 다 비슷하면 판을 바꿔 놓는 재미가 없다.
 */
export const HOLES: readonly HoleSpec[] = [
  {
    number: 1,
    par: 4,
    name: '첫걸음',
    yards: 380,
    spine: [
      [105, TEE_Y_MM],
      [103, 205],
      [95, 150],
      [86, 105],
    ],
    fairwayWidthMm: 50,
    green: { rxMm: 28, ryMm: 24 },
    cup: [0, -4],
    bunkers: [
      { xMm: 58, yMm: 122, rxMm: 12, ryMm: 7, rotDeg: -25 },
      { xMm: 114, yMm: 96, rxMm: 11, ryMm: 7, rotDeg: 20 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 146, yMm: 132, widthMm: 50, heightMm: 96, count: 14 }],
  },
  {
    number: 2,
    par: 5,
    name: '긴 오르막',
    yards: 510,
    spine: [
      [70, TEE_Y_MM],
      [78, 215],
      [108, 170],
      [140, 125],
      [150, 88],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 26, ryMm: 22 },
    cup: [4, -3],
    bunkers: [
      { xMm: 120, yMm: 152, rxMm: 12, ryMm: 7, rotDeg: 35 },
      { xMm: 176, yMm: 110, rxMm: 10, ryMm: 7, rotDeg: -30 },
      { xMm: 126, yMm: 94, rxMm: 11, ryMm: 6, rotDeg: 10 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 14, yMm: 120, widthMm: 42, heightMm: 96, count: 15 }],
  },
  {
    number: 3,
    par: 3,
    name: '연못 건너',
    yards: 150,
    spine: [
      [105, TEE_Y_MM],
      [105, 214],
      [105, 174],
    ],
    fairwayWidthMm: 40,
    green: { rxMm: 28, ryMm: 23 },
    cup: [0, -5],
    bunkers: [
      { xMm: 72, yMm: 166, rxMm: 10, ryMm: 6, rotDeg: -15 },
      { xMm: 138, yMm: 166, rxMm: 10, ryMm: 6, rotDeg: 15 },
    ],
    ponds: [{ xMm: 105, yMm: 222, rxMm: 40, ryMm: 15 }],
    streams: NO_STREAMS,
    forests: [
      { xMm: 14, yMm: 60, widthMm: 78, heightMm: 78, count: 15 },
      { xMm: 120, yMm: 60, widthMm: 76, heightMm: 78, count: 15 },
    ],
  },
  {
    number: 4,
    par: 4,
    name: '굽은 길',
    yards: 365,
    spine: [
      [70, TEE_Y_MM],
      [74, 210],
      [100, 168],
      [138, 132],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 27, ryMm: 23 },
    cup: [3, -4],
    bunkers: [
      { xMm: 100, yMm: 198, rxMm: 11, ryMm: 7, rotDeg: 10 },
      { xMm: 166, yMm: 152, rxMm: 10, ryMm: 6, rotDeg: -40 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 14, yMm: 108, widthMm: 44, heightMm: 96, count: 15 }],
  },
  {
    number: 5,
    par: 4,
    name: '모래 언덕',
    yards: 400,
    spine: [
      [140, TEE_Y_MM],
      [136, 206],
      [110, 160],
      [72, 118],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 26, ryMm: 22 },
    cup: [-3, -4],
    bunkers: [
      { xMm: 120, yMm: 192, rxMm: 12, ryMm: 7, rotDeg: -10 },
      { xMm: 96, yMm: 140, rxMm: 11, ryMm: 6, rotDeg: -35 },
      { xMm: 42, yMm: 142, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 100, yMm: 108, rxMm: 9, ryMm: 6, rotDeg: 0 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 152, yMm: 96, widthMm: 44, heightMm: 84, count: 14 }],
  },
  {
    number: 6,
    par: 3,
    name: '작은 섬',
    yards: 135,
    spine: [
      [105, TEE_Y_MM],
      [105, 214],
      [105, 180],
    ],
    fairwayWidthMm: 38,
    green: { rxMm: 24, ryMm: 21 },
    cup: [0, -3],
    bunkers: [],
    ponds: [{ xMm: 105, yMm: 180, rxMm: 46, ryMm: 38 }],
    streams: NO_STREAMS,
    forests: [
      { xMm: 14, yMm: 58, widthMm: 56, heightMm: 78, count: 14 },
      { xMm: 142, yMm: 58, widthMm: 54, heightMm: 78, count: 14 },
    ],
  },
  {
    number: 7,
    par: 5,
    name: '세 번 굽이',
    yards: 525,
    spine: [
      [60, TEE_Y_MM],
      [68, 222],
      [102, 190],
      [142, 158],
      [150, 110],
    ],
    fairwayWidthMm: 46,
    green: { rxMm: 26, ryMm: 22 },
    cup: [2, -5],
    bunkers: [
      { xMm: 92, yMm: 214, rxMm: 11, ryMm: 6, rotDeg: 25 },
      { xMm: 130, yMm: 180, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 178, yMm: 140, rxMm: 9, ryMm: 6, rotDeg: -20 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 14, yMm: 92, widthMm: 46, heightMm: 112, count: 18 }],
  },
  {
    number: 8,
    par: 4,
    name: '좁은 문',
    yards: 340,
    spine: [
      [105, TEE_Y_MM],
      [104, 204],
      [100, 152],
      [96, 108],
    ],
    fairwayWidthMm: 38,
    green: { rxMm: 25, ryMm: 21 },
    cup: [0, -4],
    bunkers: [
      { xMm: 70, yMm: 162, rxMm: 9, ryMm: 6, rotDeg: -10 },
      { xMm: 130, yMm: 162, rxMm: 9, ryMm: 6, rotDeg: 10 },
      { xMm: 66, yMm: 98, rxMm: 9, ryMm: 6, rotDeg: 0 },
      { xMm: 126, yMm: 98, rxMm: 9, ryMm: 6, rotDeg: 0 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 14, yMm: 74, widthMm: 36, heightMm: 120, count: 15 },
      { xMm: 160, yMm: 74, widthMm: 36, heightMm: 120, count: 15 },
    ],
  },
  {
    number: 9,
    par: 4,
    name: '집으로',
    yards: 395,
    spine: [
      [140, TEE_Y_MM],
      [134, 208],
      [112, 158],
      [92, 112],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 27, ryMm: 22 },
    cup: [2, -4],
    bunkers: [{ xMm: 152, yMm: 152, rxMm: 10, ryMm: 6, rotDeg: -30 }],
    ponds: [{ xMm: 92, yMm: 148, rxMm: 32, ryMm: 12 }],
    streams: NO_STREAMS,
    forests: [{ xMm: 152, yMm: 84, widthMm: 44, heightMm: 78, count: 12 }],
  },
  {
    number: 10,
    par: 4,
    name: '후반 시작',
    yards: 375,
    spine: [
      [105, TEE_Y_MM],
      [108, 206],
      [122, 156],
      [130, 108],
    ],
    fairwayWidthMm: 50,
    green: { rxMm: 27, ryMm: 23 },
    cup: [-2, -4],
    bunkers: [
      { xMm: 90, yMm: 182, rxMm: 11, ryMm: 7, rotDeg: -20 },
      { xMm: 164, yMm: 126, rxMm: 10, ryMm: 6, rotDeg: 25 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 14, yMm: 84, widthMm: 46, heightMm: 108, count: 17 }],
  },
  {
    number: 11,
    par: 3,
    name: '소나무 곁',
    yards: 160,
    spine: [
      [105, TEE_Y_MM],
      [102, 210],
      [98, 168],
    ],
    fairwayWidthMm: 40,
    green: { rxMm: 26, ryMm: 22 },
    cup: [0, -4],
    bunkers: [
      { xMm: 62, yMm: 158, rxMm: 10, ryMm: 6, rotDeg: -20 },
      { xMm: 134, yMm: 184, rxMm: 9, ryMm: 6, rotDeg: 20 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 134, yMm: 58, widthMm: 62, heightMm: 92, count: 18 },
      { xMm: 14, yMm: 58, widthMm: 46, heightMm: 70, count: 12 },
    ],
  },
  {
    number: 12,
    par: 5,
    name: '큰 강',
    yards: 540,
    spine: [
      [72, TEE_Y_MM],
      [82, 220],
      [116, 180],
      [146, 140],
      [152, 96],
    ],
    fairwayWidthMm: 46,
    green: { rxMm: 24, ryMm: 20 },
    cup: [2, -4],
    bunkers: [
      { xMm: 124, yMm: 158, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 178, yMm: 122, rxMm: 9, ryMm: 6, rotDeg: -25 },
    ],
    ponds: NO_PONDS,
    streams: [
      {
        // 양 끝은 O.B. 선에서 몇 mm 안쪽에서 끝난다 — 띠를 부풀리면 끝이
        // 법선 방향으로 밀려, 선 위에 딱 맞추면 코스 밖으로 새어 나간다.
        points: [
          [14, 207],
          [58, 198],
          [110, 210],
          [160, 196],
          [196, 202],
        ],
        widthMm: 15,
      },
    ],
    forests: [{ xMm: 14, yMm: 80, widthMm: 44, heightMm: 84, count: 14 }],
  },
  {
    number: 13,
    par: 4,
    name: '언덕 너머',
    yards: 410,
    spine: [
      [140, TEE_Y_MM],
      [132, 204],
      [104, 156],
      [78, 110],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 26, ryMm: 22 },
    cup: [-2, -4],
    bunkers: [
      { xMm: 114, yMm: 194, rxMm: 11, ryMm: 7, rotDeg: -15 },
      { xMm: 44, yMm: 140, rxMm: 10, ryMm: 6, rotDeg: 35 },
      { xMm: 110, yMm: 98, rxMm: 9, ryMm: 6, rotDeg: 5 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 152, yMm: 84, widthMm: 44, heightMm: 88, count: 14 }],
  },
  {
    number: 14,
    par: 4,
    name: '바람길',
    yards: 355,
    spine: [
      [105, TEE_Y_MM],
      [108, 204],
      [104, 152],
      [100, 110],
    ],
    fairwayWidthMm: 50,
    green: { rxMm: 28, ryMm: 23 },
    cup: [3, -4],
    bunkers: [
      { xMm: 72, yMm: 222, rxMm: 9, ryMm: 6, rotDeg: 0 },
      { xMm: 140, yMm: 182, rxMm: 10, ryMm: 6, rotDeg: 15 },
      { xMm: 62, yMm: 132, rxMm: 10, ryMm: 6, rotDeg: -25 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 152, yMm: 92, widthMm: 44, heightMm: 96, count: 14 }],
  },
  {
    number: 15,
    par: 3,
    name: '짧고 야무지게',
    yards: 145,
    spine: [
      [105, TEE_Y_MM],
      [108, 214],
      [110, 176],
    ],
    fairwayWidthMm: 38,
    green: { rxMm: 25, ryMm: 21 },
    cup: [0, -4],
    bunkers: [
      { xMm: 78, yMm: 172, rxMm: 10, ryMm: 6, rotDeg: -15 },
      { xMm: 142, yMm: 168, rxMm: 9, ryMm: 6, rotDeg: 20 },
      { xMm: 110, yMm: 146, rxMm: 10, ryMm: 6, rotDeg: 0 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 14, yMm: 58, widthMm: 52, heightMm: 96, count: 15 },
      { xMm: 146, yMm: 58, widthMm: 50, heightMm: 96, count: 15 },
    ],
  },
  {
    number: 16,
    par: 4,
    name: '모래밭 셋',
    yards: 390,
    spine: [
      [70, TEE_Y_MM],
      [76, 206],
      [104, 158],
      [136, 114],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 26, ryMm: 22 },
    cup: [2, -4],
    bunkers: [
      { xMm: 94, yMm: 192, rxMm: 12, ryMm: 7, rotDeg: 20 },
      { xMm: 122, yMm: 144, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 168, yMm: 128, rxMm: 9, ryMm: 6, rotDeg: -30 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 14, yMm: 100, widthMm: 40, heightMm: 92, count: 14 }],
  },
  {
    number: 17,
    par: 5,
    name: '마지막 긴 홀',
    yards: 505,
    spine: [
      [105, TEE_Y_MM],
      [100, 220],
      [78, 180],
      [82, 136],
      [108, 96],
    ],
    fairwayWidthMm: 46,
    green: { rxMm: 26, ryMm: 22 },
    cup: [0, -4],
    bunkers: [
      { xMm: 52, yMm: 202, rxMm: 10, ryMm: 6, rotDeg: -30 },
      { xMm: 58, yMm: 124, rxMm: 9, ryMm: 6, rotDeg: 20 },
    ],
    ponds: [{ xMm: 152, yMm: 152, rxMm: 26, ryMm: 20 }],
    streams: NO_STREAMS,
    forests: [{ xMm: 150, yMm: 66, widthMm: 46, heightMm: 48, count: 9 }],
  },
  {
    number: 18,
    par: 4,
    name: '챔피언',
    yards: 420,
    spine: [
      [70, TEE_Y_MM],
      [78, 208],
      [106, 160],
      [128, 112],
    ],
    fairwayWidthMm: 48,
    green: { rxMm: 27, ryMm: 23 },
    cup: [-2, -5],
    bunkers: [
      { xMm: 162, yMm: 138, rxMm: 10, ryMm: 6, rotDeg: -25 },
      { xMm: 106, yMm: 88, rxMm: 10, ryMm: 6, rotDeg: 0 },
    ],
    ponds: [{ xMm: 96, yMm: 142, rxMm: 25, ryMm: 13 }],
    streams: NO_STREAMS,
    forests: [{ xMm: 14, yMm: 96, widthMm: 42, heightMm: 92, count: 14 }],
  },
] as const;

/** 전반 아홉 홀(OUT) · 후반 아홉 홀(IN). 기록표가 이 단위로 합을 낸다. */
export const OUT_HOLES = HOLES.slice(0, 9);
export const IN_HOLES = HOLES.slice(9);

export const sumPar = (holes: readonly HoleSpec[]): number =>
  holes.reduce((total, hole) => total + hole.par, 0);
export const sumYards = (holes: readonly HoleSpec[]): number =>
  holes.reduce((total, hole) => total + hole.yards, 0);

/** 코스 전체의 파. 기록표의 기준선이고 아이가 빼기를 하는 상대다. */
export const COURSE_PAR = sumPar(HOLES);

export const teePoint = (hole: HoleSpec): Xy => hole.spine[0];
export const greenCenter = (hole: HoleSpec): Xy =>
  hole.spine[hole.spine.length - 1];
export const cupPoint = (hole: HoleSpec): Xy => {
  const [gx, gy] = greenCenter(hole);
  return [gx + hole.cup[0], gy + hole.cup[1]];
};

export const holePartId = (holeNumber: number): string => `hole-${holeNumber}`;

export const artworkPath = (partId: string): string =>
  `/games/golf/${partId}.svg`;

/**
 * 기록표에 자리를 잡아 두는 사람 수.
 *
 * 골프는 혼자도 넷도 친다. 넷으로 잡은 것은 **A4 가로 한 장에 칸이 읽히는
 * 한계**이고, 셋이 놀면 한 줄이 빈다 — 빈 줄은 다음 라운드에 쓰면 된다.
 */
export const PLAYER_COUNT = 4;

/**
 * 기록표 — **A4 가로 한 장**이다.
 *
 * 이 게임에서 아이가 가장 오래 붙들고 있는 종이다(2026-09-15 사용자 요청 —
 * "기록표에 직접 기록해서 숫자쓰기와 합산을 통해 덧셈도 같이 공부했으면").
 * 그래서 칸이 크다 — 홀 한 칸이 23mm고, 연필을 처음 쥔 아이가 두 자리 수를
 * 적어도 칸을 넘지 않는다.
 *
 * 표가 둘인 것은 **전반과 후반을 따로 더하기 때문**이다. 열여덟 칸을 한 줄로
 * 늘어놓으면 칸이 12mm로 좁아지고, 무엇보다 아홉씩 끊어 더하는 골프의 셈이
 * 사라진다. 두 표의 합(OUT·IN)을 아래 합산 칸에서 한 번 더 더해 총타수가
 * 나오고, 거기서 코스 파(72)를 빼면 오늘의 성적이 된다 — 덧셈 한 번, 뺄셈
 * 한 번이 종이 위에 그대로 남는다.
 */
export const SCORE_CARD = {
  widthMm: 297,
  heightMm: 210,

  titleXMm: 15,
  titleYMm: 13,
  titleFontMm: 6.5,
  /** 코스 이름 슬롯. 제목 오른쪽 끝에 붙는다. */
  courseNameXMm: 282,
  courseNameYMm: 13,
  courseNameFontMm: 4.4,
  courseNameMaxWidthMm: 110,

  tableXMm: 15,
  /** 왼쪽 항목 열 — "홀 / 파 / 거리"와 사람 이름이 앉는다. */
  labelColumnMm: 36,
  holeColumnMm: 23,
  /** 맨 오른쪽 합계 열(OUT·IN). */
  totalColumnMm: 24,

  headerRowMm: 7,
  parRowMm: 6.5,
  yardRowMm: 6,
  playerRowMm: 11,

  outTableYMm: 24,
  inTableYMm: 92,

  labelFontMm: 3.4,
  headerFontMm: 4.2,
  parFontMm: 3.8,
  yardFontMm: 3,

  /** 합산 칸 — 전반 + 후반 = 총타수, 총타수 − 파 = 성적. */
  sumBoxYMm: 162,
  sumHeaderRowMm: 8,
  sumRowMm: 8.5,
  sumFontMm: 3.4,
  sumSignFontMm: 5,

  footerYMm: 207.5,
  footerFontMm: 2.8,
} as const;

/** 기록표 표 한 벌의 전체 폭. 두 표와 합산 칸이 같은 폭을 쓴다. */
export const SCORE_TABLE_WIDTH_MM =
  SCORE_CARD.labelColumnMm +
  SCORE_CARD.holeColumnMm * 9 +
  SCORE_CARD.totalColumnMm;

/** 표 한 벌의 높이 — 머리 세 줄 + 사람 네 줄. */
export const SCORE_TABLE_HEIGHT_MM =
  SCORE_CARD.headerRowMm +
  SCORE_CARD.parRowMm +
  SCORE_CARD.yardRowMm +
  SCORE_CARD.playerRowMm * PLAYER_COUNT;

/**
 * 합산 칸의 세로 경계 — [이름][전반][+][후반][=][총타수][파와의 차이].
 *
 * 부호 칸(`+`·`=`)을 따로 둔 것은 **식으로 읽히게** 하기 위해서다. 칸 사이에
 * 부호가 인쇄되어 있으면 아이가 빈칸 셋을 채우는 동안 그것이 덧셈이라는 것을
 * 잊지 않는다.
 */
export const SUM_COLUMNS_MM: readonly number[] = [56, 34, 12, 34, 12, 38, 81];

/** 에디터의 이름 칸에 붙는 말. 기록표에는 이 말이 아니라 숫자 1~4만 인쇄된다. */
export const PLAYER_LABELS: readonly string[] = [
  '1번 선수',
  '2번 선수',
  '3번 선수',
  '4번 선수',
];

/**
 * 표 한 벌의 열 경계 x — 라벨 열 + 홀 아홉 + 합계 열.
 *
 * 아트워크가 괘선을 긋고 도안 정의가 이름 슬롯을 앉히는 데 **같은 값**을 쓴다.
 * 두 곳에서 따로 계산하면 이름이 칸 밖에 찍히고, 그 어긋남은 종이에 뽑기
 * 전까지 보이지 않는다.
 */
export const scoreColumnEdges = (): number[] => {
  const edges: number[] = [
    SCORE_CARD.tableXMm,
    SCORE_CARD.tableXMm + SCORE_CARD.labelColumnMm,
  ];
  for (let i = 0; i < 9; i++) {
    edges.push(
      SCORE_CARD.tableXMm +
        SCORE_CARD.labelColumnMm +
        SCORE_CARD.holeColumnMm * (i + 1),
    );
  }
  edges.push(SCORE_CARD.tableXMm + SCORE_TABLE_WIDTH_MM);
  return edges;
};

/** 표 한 벌의 행 경계 y. 머리 세 줄 다음이 사람 네 줄이다. */
export const scoreRowEdges = (topMm: number): number[] => {
  const head: number[] = [topMm, topMm + SCORE_CARD.headerRowMm];
  head.push(head[1] + SCORE_CARD.parRowMm);
  const body = head[2] + SCORE_CARD.yardRowMm;
  head.push(body);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    head.push(body + SCORE_CARD.playerRowMm * (i + 1));
  }
  return head;
};

/** 사람 한 줄의 세로 중심. */
export const playerRowCenterY = (topMm: number, index: number): number =>
  topMm +
  SCORE_CARD.headerRowMm +
  SCORE_CARD.parRowMm +
  SCORE_CARD.yardRowMm +
  SCORE_CARD.playerRowMm * (index + 0.5);

/** 합산 칸의 열 경계 x. */
export const sumColumnEdges = (): number[] => {
  const edges: number[] = [SCORE_CARD.tableXMm];
  for (const width of SUM_COLUMNS_MM)
    edges.push(edges[edges.length - 1] + width);
  return edges;
};

export const sumRowCenterY = (index: number): number =>
  SCORE_CARD.sumBoxYMm +
  SCORE_CARD.sumHeaderRowMm +
  SCORE_CARD.sumRowMm * (index + 0.5);

/** 이름이 앉는 칸의 가로 중심 — 왼쪽 끝의 번호를 비켜 오른쪽으로 치우친다. */
export const NAME_NUMBER_INSET_MM = 7;

/**
 * 깃대와 공 — **A5 가로 한 장**이다.
 *
 * 깃대는 A자로 세우는 종이 텐트다. 홀 **뒤쪽**에 세워 과녁이 되고, 공이 홀에
 * 들어가는 길은 막지 않는다. 두 벌을 넣은 것은 잃어버리기 때문이고, 그래서
 * 이 파트만 기본 벌 수가 2다.
 *
 * 공은 지름 12mm 원판 열두 개다. 두꺼운 종이에 뽑아 오리면 연필로 튕겼을 때
 * 미끄러지고, 홀 원(반지름 8mm)에 걸쳐 멈추면 홀아웃이다. 넷이 쳐도 잃어버릴
 * 몫이 남아야 해서 사람 수의 세 배를 넣었다.
 */
export const FLAG_SHEET = {
  widthMm: 210,
  heightMm: 148,
  cutInsetMm: 4,

  titleXMm: 12,
  titleYMm: 12,
  titleFontMm: 4.6,
  noteFontMm: 2.8,

  /** 깃대 텐트 한 벌 — 몸통 폭 × 한 면 높이. 꼭대기가 산접기다. */
  poleWidthMm: 15,
  poleHeightMm: 46,
  /** 바닥 탭. 바깥으로 꺾어 눕히면 텐트가 선다. */
  poleTabMm: 11,
  /** 깃발 — 몸통 옆으로 튀어나온 삼각형. 실루엣째로 오린다. */
  flagWidthMm: 17,
  flagHeightMm: 11,
  /** 깃발 위 여백(몸통 꼭대기에서 깃발 아래까지). */
  flagInsetMm: 5,
  /** 깃대 두 벌의 왼쪽 x. */
  poleXsMm: [24, 76] as const,
  /**
   * 텐트 꼭대기 접는선의 y. 위아래로 한 면씩 펼쳐진다.
   *
   * 전개도 위 끝(꼭대기 − 면 높이 − 탭)이 제목 줄 아래로 내려오는 값이어야
   * 한다. 74였을 때 오림선이 안내 글자를 뚫고 올라갔다.
   */
  poleFoldYMm: 80,

  /** 공 원판. */
  ballRadiusMm: 6,
  ballGapMm: 4,
  ballOriginXMm: 132,
  ballOriginYMm: 46,
  ballColumns: 4,
  ballRows: 3,
} as const;

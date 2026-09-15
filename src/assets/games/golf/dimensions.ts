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
 * **종이 전체가 골프장이다**(2026-09-15 사용자 요청 — "A4 용지를 최대한 활용해서
 * 골프장을 만들고 싶거든"). 처음에는 위에 머리띠(홀 번호·파·거리)를, 아래에
 * 안내 한 줄을 두고 그 사이를 코스로 썼는데, 그 띠 둘이 세로 50mm를 먹었다.
 * 지금은 판 가장자리에서 6mm만 남기고 전부 코스이고, 홀 정보는 코스 안의 빈
 * 자리에 카드로 얹힌다(`PANEL` · 홀마다 `panel` 좌표).
 *
 * 남긴 6mm는 O.B. 선이 종이 끝에 닿지 않게 하는 여백이다 — 선이 재단선처럼
 * 보이면 아이가 오려야 하는 줄 안다.
 */
export const COURSE_AREA = {
  xMm: 6,
  yMm: 6,
  widthMm: 198,
  heightMm: 285,
} as const;

/**
 * 티의 y — **열여덟 홀이 모두 같다.**
 *
 * 홀마다 다르게 두었더니 판을 넘길 때 공 놓는 자리가 위아래로 튀었다. 같은
 * 자리면 아이가 판만 갈아 놓고 바로 친다. 이 값이 코스 영역 아래 끝(291)에서
 * 페어웨이 반폭(가장 넓은 홀이 27)만큼 떨어져 있어야 페어웨이 끝의 둥근 캡이
 * O.B. 선을 넘지 않는다.
 */
export const TEE_Y_MM = 262;

/**
 * 코스 위에 직접 찍히는 글자 — 티 표시와 O.B.뿐이다.
 *
 * 홀 번호·이름·파·거리·타수 이름은 모두 홀 정보 카드(`PANEL`)로 옮겨 갔다
 * (2026-09-15). 판 위아래의 띠를 없애고 종이 전체를 골프장으로 쓰기 위해서다.
 */
export const TYPE = {
  markerFontMm: 3,
} as const;

/**
 * 홀 정보 카드 — **코스 안 빈 자리에 얹히는 종이 한 장**이다.
 *
 * 옛 판은 위에 머리띠(홀 번호·이름·파·거리), 아래에 안내 한 줄을 두고 그 사이만
 * 코스로 썼다. 그 띠 둘이 세로 50mm를 먹었고, 사용자가 그것을 코스 안으로
 * 들이라고 했다(2026-09-15) — "골프장 밖에 표현하는 모든것들을 골프장 안에
 * 있는 빈 공간으로 이동".
 *
 * 그래서 크기가 **작고 정사각에 가깝다**. 길쭉하면 들어갈 빈자리가 홀마다
 * 없어진다. 타수 이름을 두 열로 접은 것도 같은 이유다 — 한 줄로 늘어놓으면
 * 파5에서 157mm라 어느 홀에도 들어가지 않는다.
 *
 * 앉는 자리는 홀마다 데이터로 적는다(`HoleSpec.panel`). 그림을 보고 정하는
 * 값이고, 코스 요소와 겹치지 않는지는 테스트가 본다.
 */
export const PANEL = {
  widthMm: 52,
  heightMm: 52,
  /** 모서리 둥글기. 코스 위에 얹힌 종이처럼 보이게 한다. */
  cornerMm: 2.5,
  /** 코스 요소에서 이만큼은 떨어져 앉는다. */
  clearanceMm: 4,

  /** 큰 홀 번호 — 열여덟 장을 넘길 때 이 숫자만 보고 고른다. */
  numberXMm: 10,
  numberYMm: 14,
  numberFontMm: 12,
  unitYMm: 21.5,
  unitFontMm: 2.6,

  nameXMm: 19,
  nameYMm: 11,
  nameFontMm: 4.6,
  nameMaxWidthMm: 29,
  statYMm: 18.5,
  statFontMm: 3.2,

  ruleTopYMm: 24,
  ruleBottomYMm: 45,
  ruleInsetMm: 4,

  /** 타수 이름 — 두 열 세 행. */
  termColumnsXMm: [6, 28] as const,
  termRowsYMm: [29.5, 35.5, 41.5] as const,
  termFontMm: 3,

  /** 코스 이름 슬롯이 앉는 자리와 그 밑줄. */
  courseNameYMm: 49,
  courseNameFontMm: 3.2,
  courseNameMaxWidthMm: 40,
  courseRuleYMm: 51,
  courseRuleInsetMm: 8,
} as const;

/**
 * 공의 지름 — **인쇄물이 아니라 준비물**이다 (IDE-032).
 *
 * 공 시트도 뺐다(2026-09-15 사용자 요청 — "공도 필요없어"). 집에 있는 작고
 * 납작한 것으로 치면 되고, 두꺼운 종이를 동그랗게 오려 써도 된다. 축구
 * 게임판이 공을 준비물로 돌린 것과 같은 처분이다.
 *
 * 값이 남아 있는 것은 **홀 원이 이보다 커야** 하기 때문이다 — 준비물 안내와
 * 홀 크기가 같은 수를 읽어야 "닿아 멈추면 들어간 것"이 성립한다.
 */
export const BALL_DIAMETER_MM = 12;

/** 코스 요소의 크기와 농도. */
export const COURSE = {
  /** 홀 원 — 공(지름 12mm)이 걸쳐 멈추면 홀아웃이다. */
  cupRadiusMm: 8,
  /** 홀 원 안의 검은 점. 멀리서도 홀이 어디인지 보인다. */
  cupDotRadiusMm: 2.4,
  /**
   * 깃대 — 홀에서 위로 뻗는 선과 삼각 깃발.
   *
   * **판에 그린 표식이다.** 세워 만드는 종이 깃대는 뺐지만(2026-09-15 사용자
   * 요청) 이 그림은 남는다 — 멀리서 홀이 어디인지 알리는 일은 그림이 한다.
   */
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
  /**
   * 숲 밖에 흩는 나무 — **남는 러프를 메우는 몫**이다.
   *
   * 종이 전체가 코스가 되면서(2026-09-15) 페어웨이 반대편이 넓게 비었다. 숲
   * 상자를 홀마다 더 적을 수도 있었지만, 빈 자리는 코스 모양에서 나오는
   * 것이라 데이터로 따라 적으면 홀을 고칠 때마다 함께 고쳐야 한다. 그래서
   * **코스 영역 전체에 성기게 흩는다** — 간격이 숲의 두 배 반이라 덤불이
   * 아니라 드문드문 선 나무로 보인다.
   */
  scatterCount: 14,
  scatterSpacingMm: 19,
  /** 페어웨이·그린에서 이만큼 안쪽에는 나무를 심지 않는다. */
  treeClearanceMm: 6,

  /**
   * 땅 위에 적는 처분의 글자 크기 (IDE-032).
   *
   * 치는 도중에 읽는 글이라 판 위에서 가장 작은 글자보다 크다. 배율 100%에서
   * 2.3mm는 아이가 읽는 하한에 가깝지만, 아랫줄은 "무엇을 하라"가 아니라
   * "어디서 다시"라 한 번 읽고 나면 안 봐도 된다.
   */
  penaltyFontMm: 3,
  penaltyNoteFontMm: 2.3,
  /**
   * 물결이 글자를 피해 가는 여유.
   *
   * 두 줄짜리 글의 **아랫줄까지** 덮어야 한다 — 3.5mm였을 때 "앞자리에서 다시"가
   * 물결에 걸려 흐렸다.
   */
  penaltyClearMm: 6,
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
  /**
   * 처분 글자의 색 — 땅 색보다 진하다.
   *
   * 모래와 물의 테두리 색을 그대로 쓰면 제 바탕 위에서 묻힌다. 흑백으로 뽑아도
   * 글자가 바탕보다 어두워야 읽힌다.
   */
  bunkerInk: '#8a6a28',
  waterInk: '#2f6ba5',
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
  /**
   * 홀 정보 카드의 좌상단. 코스 안의 **빈 자리**를 가리킨다.
   *
   * 홀마다 비는 곳이 다르다 — 곧은 홀은 옆이, 굽은 홀은 굽이 안쪽이, 파3는
   * 그린 위가 빈다. 그래서 자리를 계산하지 않고 홀마다 적는다. 코스 요소와
   * 겹치지 않는지는 테스트가 본다.
   */
  readonly panel: Xy;
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
      [102.9, 195.8],
      [94.6, 127],
      [85.2, 70.8],
    ],
    fairwayWidthMm: 54,
    green: { rxMm: 28, ryMm: 24 },
    cup: [0, -5],
    bunkers: [
      { xMm: 56, yMm: 92, rxMm: 12, ryMm: 7, rotDeg: -25 },
      { xMm: 114.4, yMm: 59.5, rxMm: 11, ryMm: 7, rotDeg: 20 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 147.7, yMm: 104.5, widthMm: 52.1, heightMm: 120, count: 14 },
    ],
    panel: [141, 9],
  },
  {
    number: 2,
    par: 5,
    name: '긴 오르막',
    yards: 510,
    spine: [
      [68.5, TEE_Y_MM],
      [76.9, 208.3],
      [108.1, 152],
      [141.5, 95.8],
      [151.9, 49.5],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 26, ryMm: 22 },
    cup: [4.2, -3.7],
    bunkers: [
      { xMm: 120.6, yMm: 129.5, rxMm: 12, ryMm: 7, rotDeg: 35 },
      { xMm: 179, yMm: 77, rxMm: 10, ryMm: 7, rotDeg: -30 },
      { xMm: 126.9, yMm: 57, rxMm: 11, ryMm: 6, rotDeg: 10 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 89.5, widthMm: 43.8, heightMm: 120, count: 15 },
    ],
    panel: [9, 9],
  },
  {
    number: 3,
    par: 3,
    name: '연못 건너',
    yards: 150,
    spine: [
      [105, TEE_Y_MM],
      [105, 207],
      [105, 157],
    ],
    fairwayWidthMm: 44,
    green: { rxMm: 28, ryMm: 23 },
    cup: [0, -6.2],
    bunkers: [
      { xMm: 70.6, yMm: 147, rxMm: 10, ryMm: 6, rotDeg: -15 },
      { xMm: 139.4, yMm: 147, rxMm: 10, ryMm: 6, rotDeg: 15 },
    ],
    ponds: [{ xMm: 105, yMm: 217, rxMm: 40, ryMm: 15 }],
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 14.5, widthMm: 81.3, heightMm: 97.5, count: 15 },
      { xMm: 120.6, yMm: 14.5, widthMm: 79.2, heightMm: 97.5, count: 15 },
    ],
    panel: [9, 9],
  },
  {
    number: 4,
    par: 4,
    name: '굽은 길',
    yards: 365,
    spine: [
      [68.5, TEE_Y_MM],
      [72.7, 202],
      [99.8, 149.5],
      [139.4, 104.5],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 27, ryMm: 23 },
    cup: [3.1, -5],
    bunkers: [
      { xMm: 99.8, yMm: 187, rxMm: 11, ryMm: 7, rotDeg: 10 },
      { xMm: 168.6, yMm: 129.5, rxMm: 10, ryMm: 6, rotDeg: -40 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 74.5, widthMm: 45.9, heightMm: 120, count: 15 },
    ],
    panel: [9, 9],
  },
  {
    number: 5,
    par: 4,
    name: '모래 언덕',
    yards: 400,
    spine: [
      [141.5, TEE_Y_MM],
      [137.3, 197],
      [110.2, 139.5],
      [70.6, 87],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 26, ryMm: 22 },
    cup: [-3.1, -5],
    bunkers: [
      { xMm: 120.6, yMm: 179.5, rxMm: 12, ryMm: 7, rotDeg: -10 },
      { xMm: 95.6, yMm: 114.5, rxMm: 11, ryMm: 6, rotDeg: -35 },
      { xMm: 39.3, yMm: 117, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 99.8, yMm: 74.5, rxMm: 9, ryMm: 6, rotDeg: 0 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 154, yMm: 59.5, widthMm: 45.9, heightMm: 105, count: 14 }],
    panel: [93, 9],
  },
  {
    number: 6,
    par: 3,
    name: '작은 섬',
    yards: 135,
    spine: [
      [105, TEE_Y_MM],
      [105, 207],
      [105, 164.5],
    ],
    fairwayWidthMm: 42,
    green: { rxMm: 24, ryMm: 21 },
    cup: [0, -3.7],
    bunkers: [],
    ponds: [{ xMm: 105, yMm: 164.5, rxMm: 46, ryMm: 38 }],
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 12, widthMm: 58.4, heightMm: 97.5, count: 14 },
      { xMm: 143.6, yMm: 12, widthMm: 56.3, heightMm: 97.5, count: 14 },
    ],
    panel: [9, 9],
  },
  {
    number: 7,
    par: 5,
    name: '세 번 굽이',
    yards: 525,
    spine: [
      [58.1, TEE_Y_MM],
      [66.4, 217],
      [101.9, 177],
      [143.6, 137],
      [151.9, 77],
    ],
    fairwayWidthMm: 50,
    green: { rxMm: 26, ryMm: 22 },
    cup: [2.1, -6.2],
    bunkers: [
      { xMm: 91.5, yMm: 207, rxMm: 11, ryMm: 6, rotDeg: 25 },
      { xMm: 131.1, yMm: 164.5, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 181.1, yMm: 114.5, rxMm: 9, ryMm: 6, rotDeg: -20 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 54.5, widthMm: 47.9, heightMm: 140, count: 18 },
    ],
    panel: [9, 9],
  },
  {
    number: 8,
    par: 4,
    name: '좁은 문',
    yards: 340,
    spine: [
      [105, TEE_Y_MM],
      [104, 194.5],
      [99.8, 129.5],
      [95.6, 74.5],
    ],
    fairwayWidthMm: 42,
    green: { rxMm: 25, ryMm: 21 },
    cup: [0, -5],
    bunkers: [
      { xMm: 68.5, yMm: 142, rxMm: 9, ryMm: 6, rotDeg: -10 },
      { xMm: 131.1, yMm: 142, rxMm: 9, ryMm: 6, rotDeg: 10 },
      { xMm: 64.4, yMm: 62, rxMm: 9, ryMm: 6, rotDeg: 0 },
      { xMm: 126.9, yMm: 62, rxMm: 9, ryMm: 6, rotDeg: 0 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 32, widthMm: 37.5, heightMm: 150, count: 15 },
      { xMm: 162.3, yMm: 32, widthMm: 37.5, heightMm: 150, count: 15 },
    ],
    panel: [145, 9],
  },
  {
    number: 9,
    par: 4,
    name: '집으로',
    yards: 395,
    spine: [
      [141.5, TEE_Y_MM],
      [135.2, 199.5],
      [112.3, 137],
      [91.5, 79.5],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 27, ryMm: 22 },
    cup: [2.1, -5],
    bunkers: [{ xMm: 154, yMm: 129.5, rxMm: 10, ryMm: 6, rotDeg: -30 }],
    ponds: [{ xMm: 91.5, yMm: 124.5, rxMm: 32, ryMm: 12 }],
    streams: NO_STREAMS,
    forests: [
      { xMm: 154, yMm: 44.5, widthMm: 45.9, heightMm: 97.5, count: 12 },
    ],
    panel: [9, 9],
  },
  {
    number: 10,
    par: 4,
    name: '후반 시작',
    yards: 375,
    spine: [
      [105, TEE_Y_MM],
      [108.1, 197],
      [122.7, 134.5],
      [131.1, 74.5],
    ],
    fairwayWidthMm: 54,
    green: { rxMm: 27, ryMm: 23 },
    cup: [-2.1, -5],
    bunkers: [
      { xMm: 89.4, yMm: 167, rxMm: 11, ryMm: 7, rotDeg: -20 },
      { xMm: 166.5, yMm: 97, rxMm: 10, ryMm: 6, rotDeg: 25 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 44.5, widthMm: 47.9, heightMm: 135, count: 17 },
    ],
    panel: [9, 9],
  },
  {
    number: 11,
    par: 3,
    name: '소나무 곁',
    yards: 160,
    spine: [
      [105, TEE_Y_MM],
      [101.9, 202],
      [97.7, 149.5],
    ],
    fairwayWidthMm: 44,
    green: { rxMm: 26, ryMm: 22 },
    cup: [0, -5],
    bunkers: [
      { xMm: 60.2, yMm: 137, rxMm: 10, ryMm: 6, rotDeg: -20 },
      { xMm: 135.2, yMm: 169.5, rxMm: 9, ryMm: 6, rotDeg: 20 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 135.2, yMm: 12, widthMm: 64.6, heightMm: 115, count: 18 },
      { xMm: 10.2, yMm: 12, widthMm: 47.9, heightMm: 87.5, count: 12 },
    ],
    panel: [9, 9],
  },
  {
    number: 12,
    par: 5,
    name: '큰 강',
    yards: 540,
    spine: [
      [70.6, TEE_Y_MM],
      [81, 214.5],
      [116.5, 164.5],
      [147.7, 114.5],
      [154, 59.5],
    ],
    fairwayWidthMm: 50,
    green: { rxMm: 24, ryMm: 20 },
    cup: [2.1, -5],
    bunkers: [
      { xMm: 124.8, yMm: 137, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 181.1, yMm: 92, rxMm: 9, ryMm: 6, rotDeg: -25 },
    ],
    ponds: NO_PONDS,
    streams: [
      {
        // 양 끝은 O.B. 선에서 몇 mm 안쪽에서 끝난다 — 띠를 부풀리면 끝이
        // 법선 방향으로 밀려, 선 위에 딱 맞추면 코스 밖으로 새어 나간다.
        points: [
          [10.2, 198.3],
          [56, 187],
          [110.2, 202],
          [162.3, 184.5],
          [199.8, 192],
        ],
        widthMm: 15,
      },
    ],
    forests: [
      { xMm: 10.2, yMm: 39.5, widthMm: 45.9, heightMm: 105, count: 14 },
    ],
    panel: [9, 9],
  },
  {
    number: 13,
    par: 4,
    name: '언덕 너머',
    yards: 410,
    spine: [
      [141.5, TEE_Y_MM],
      [133.1, 194.5],
      [104, 134.5],
      [76.9, 77],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 26, ryMm: 22 },
    cup: [-2.1, -5],
    bunkers: [
      { xMm: 114.4, yMm: 182, rxMm: 11, ryMm: 7, rotDeg: -15 },
      { xMm: 41.4, yMm: 114.5, rxMm: 10, ryMm: 6, rotDeg: 35 },
      { xMm: 110.2, yMm: 62, rxMm: 9, ryMm: 6, rotDeg: 5 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 154, yMm: 44.5, widthMm: 45.9, heightMm: 110, count: 14 }],
    panel: [127, 9],
  },
  {
    number: 14,
    par: 4,
    name: '바람길',
    yards: 355,
    spine: [
      [105, TEE_Y_MM],
      [108.1, 194.5],
      [104, 129.5],
      [99.8, 77],
    ],
    fairwayWidthMm: 54,
    green: { rxMm: 28, ryMm: 23 },
    cup: [3.1, -5],
    bunkers: [
      { xMm: 70.6, yMm: 217, rxMm: 9, ryMm: 6, rotDeg: 0 },
      { xMm: 141.5, yMm: 167, rxMm: 10, ryMm: 6, rotDeg: 15 },
      { xMm: 60.2, yMm: 104.5, rxMm: 10, ryMm: 6, rotDeg: -25 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [{ xMm: 154, yMm: 54.5, widthMm: 45.9, heightMm: 120, count: 14 }],
    panel: [9, 9],
  },
  {
    number: 15,
    par: 3,
    name: '짧고 야무지게',
    yards: 145,
    spine: [
      [105, TEE_Y_MM],
      [108.1, 207],
      [110.2, 159.5],
    ],
    fairwayWidthMm: 42,
    green: { rxMm: 25, ryMm: 21 },
    cup: [0, -5],
    bunkers: [
      { xMm: 76.9, yMm: 154.5, rxMm: 10, ryMm: 6, rotDeg: -15 },
      { xMm: 143.6, yMm: 149.5, rxMm: 9, ryMm: 6, rotDeg: 20 },
      { xMm: 110.2, yMm: 122, rxMm: 10, ryMm: 6, rotDeg: 0 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 12, widthMm: 54.2, heightMm: 120, count: 15 },
      { xMm: 147.7, yMm: 12, widthMm: 52.1, heightMm: 120, count: 15 },
    ],
    panel: [9, 9],
  },
  {
    number: 16,
    par: 4,
    name: '모래밭 셋',
    yards: 390,
    spine: [
      [68.5, TEE_Y_MM],
      [74.8, 197],
      [104, 137],
      [137.3, 82],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 26, ryMm: 22 },
    cup: [2.1, -5],
    bunkers: [
      { xMm: 93.5, yMm: 179.5, rxMm: 12, ryMm: 7, rotDeg: 20 },
      { xMm: 122.7, yMm: 119.5, rxMm: 10, ryMm: 6, rotDeg: 30 },
      { xMm: 170.7, yMm: 99.5, rxMm: 9, ryMm: 6, rotDeg: -30 },
    ],
    ponds: NO_PONDS,
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 64.5, widthMm: 41.7, heightMm: 115, count: 14 },
    ],
    panel: [9, 9],
  },
  {
    number: 17,
    par: 5,
    name: '마지막 긴 홀',
    yards: 505,
    spine: [
      [105, TEE_Y_MM],
      [99.8, 214.5],
      [76.9, 164.5],
      [81, 109.5],
      [108.1, 59.5],
    ],
    fairwayWidthMm: 50,
    green: { rxMm: 26, ryMm: 22 },
    cup: [0, -5],
    bunkers: [
      { xMm: 49.8, yMm: 192, rxMm: 10, ryMm: 6, rotDeg: -30 },
      { xMm: 56, yMm: 94.5, rxMm: 9, ryMm: 6, rotDeg: 20 },
    ],
    ponds: [{ xMm: 154, yMm: 129.5, rxMm: 26, ryMm: 20 }],
    streams: NO_STREAMS,
    forests: [{ xMm: 151.9, yMm: 22, widthMm: 47.9, heightMm: 60, count: 9 }],
    panel: [9, 9],
  },
  {
    number: 18,
    par: 4,
    name: '챔피언',
    yards: 420,
    spine: [
      [68.5, TEE_Y_MM],
      [76.9, 199.5],
      [106, 139.5],
      [129, 79.5],
    ],
    fairwayWidthMm: 52,
    green: { rxMm: 27, ryMm: 23 },
    cup: [-2.1, -6.2],
    bunkers: [
      { xMm: 164.4, yMm: 112, rxMm: 10, ryMm: 6, rotDeg: -25 },
      { xMm: 106, yMm: 49.5, rxMm: 10, ryMm: 6, rotDeg: 0 },
    ],
    ponds: [{ xMm: 95.6, yMm: 117, rxMm: 25, ryMm: 13 }],
    streams: NO_STREAMS,
    forests: [
      { xMm: 10.2, yMm: 59.5, widthMm: 43.8, heightMm: 115, count: 14 },
    ],
    panel: [9, 9],
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
 * 나만의 홀 — **판 위에서 끌어 짓는 홀** (IDE-031)
 *
 * 사용자가 청했다(2026-09-15) — "커스텀으로 홀을 직접 구성할수있게 해줘."
 * 미리 그려 둔 열여덟 홀 옆에 빈 홀 한 장을 두고, 티·그린·굽이·벙커·연못·
 * 카드 자리를 손잡이로 끌어 제 홀을 만든다.
 *
 * 값이 사람 손에서 나오므로 **상자가 규칙을 대신한다.** 티를 종이 아래 끝까지
 * 끌면 페어웨이의 둥근 끝이 O.B. 선을 넘고, 그린을 위 끝까지 끌면 그린이
 * 잘린다. 그래서 점마다 앉을 수 있는 상자를 달리 두었다 — 중심선은 좁고
 * (페어웨이 반폭만큼 안쪽), 해저드는 넓고, 카드는 제 크기만큼 안쪽이다.
 */
export const CUSTOM_HOLE = {
  partId: 'custom-hole',

  /**
   * 중심선(티·굽이·그린 중심)이 앉는 상자.
   *
   * 가장 넓은 페어웨이(60mm)의 반폭 30mm를 코스 영역 사방에서 뺀 자리다 —
   * 어느 점을 어디로 끌어도 페어웨이가 O.B. 선을 넘지 않는다.
   */
  pathBox: { xMm: 36, yMm: 38, widthMm: 138, heightMm: 223 },
  /** 벙커·연못이 앉는 상자. 코스 안쪽 14mm — 나머지는 렌더러가 마저 붙든다. */
  hazardBox: { xMm: 20, yMm: 20, widthMm: 170, heightMm: 257 },
  /** 홀 정보 카드의 **좌상단**이 앉는 상자. 카드 크기만큼 안쪽에서 끝난다. */
  cardBox: {
    xMm: COURSE_AREA.xMm,
    yMm: COURSE_AREA.yMm,
    widthMm: COURSE_AREA.widthMm - PANEL.widthMm,
    heightMm: COURSE_AREA.heightMm - PANEL.heightMm,
  },

  /** 그린과 홀은 크기를 고르게 하지 않는다 — 고를 것이 많으면 짓기가 일이 된다. */
  green: { rxMm: 26, ryMm: 22 },
  cup: [0, -4] as Xy,

  /** 페어웨이 폭의 범위. 가장 넓은 값이 중심선 상자를 정한다. */
  widthRangeMm: { min: 34, max: 60 },

  /**
   * 판 위 1mm가 몇 야드인가.
   *
   * 열여덟 홀에서 잰 어림이다 — 파4가 판 위 155mm에 380야드쯤이었다. 커스텀
   * 홀은 거리를 사람이 적지 않고 **중심선 길이에서 낸다.** 길을 늘리면 거리가
   * 따라 늘어야 두 값이 어긋나지 않는다.
   */
  yardsPerMm: 2.45,
} as const;

/** 나만의 홀의 첫 화면 — 곧게 뻗은 파4 하나. 빈 판을 내밀지 않는다. */
export const CUSTOM_HOLE_DEFAULTS = {
  number: 1,
  name: '나만의 홀',
  par: 4,
  fairwayWidthMm: 48,
  /**
   * 티 · 굽이 · 그린 중심.
   *
   * 티가 열여덟 홀(262)보다 2mm 높다 — 중심선 상자의 아래 끝이 261이기
   * 때문이다. 페어웨이를 가장 넓게(60mm) 벌려도 둥근 끝이 O.B. 선을 넘지
   * 않는 자리가 거기까지다.
   */
  path: [105, 260, 100, 186, 96, 104] as number[],
  bunkers: [64, 128, 132, 92] as number[],
  ponds: [] as number[],
  card: [9, 9] as number[],
} as const;

/** 중심선 길이(mm) → 거리(야드). 10야드 단위로 끊는다. */
export const yardsForLength = (lengthMm: number): number =>
  Math.max(10, Math.round((lengthMm * CUSTOM_HOLE.yardsPerMm) / 10) * 10);

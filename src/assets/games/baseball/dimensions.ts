/**
 * 야구 게임판 실측 치수 (IDE-014)
 *
 * 여기 있는 값이 **배율 100%에서 종이 위 mm**다. 도안 정의(`./index.ts`)와
 * 아트워크 생성기(`./artwork/`)가 같은 상수를 읽는다 — 한쪽만 고치면 슬롯
 * 좌표와 그림이 어긋나므로 치수는 이 파일 하나에만 둔다.
 *
 * 좌표계는 `docs/game-authoring.md`를 따른다: 파트 로컬 mm, 원점 좌상단,
 * y는 아래로 증가한다. **홈플레이트가 아래 한가운데**이고 외야가 위다.
 *
 * 작도 근거는 [docs/baseball-artwork.md](../../../../docs/baseball-artwork.md)에 있다.
 */

/**
 * 보드(야구장) 파트 — **A4 세로**다(2026-09-08 사용자 요청).
 *
 * 축구 운동장과 달리 가로가 아니다. 야구장은 홈을 꼭짓점으로 위로 펼쳐지는
 * 부채꼴이라 세로가 길수록 담장까지가 멀어지고, 공을 튕겨 날려 보내는 거리가
 * 곧 게임이 되는 판에서는 그 길이가 재미의 크기다. 옛 인쇄본도 세로 포스터였다.
 *
 * **부채꼴이 종이보다 크다.** 내야를 정규 규격으로 크게 그리면 담장 쪽 귀퉁이가
 * 종이를 넘는데, 그래도 된다고 정했다(같은 날 사용자 요청) — 종이 밖으로 나간
 * 공은 파울이다. 종이 위에 남는 것은 내야 전체와 외야의 가운데 띠다.
 */
export const BOARD = { widthMm: 210, heightMm: 297 } as const;

/**
 * 홈플레이트 — 모든 선의 중심. **종이 아래 끝에 최대한 붙인다**(2026-09-08
 * 사용자 요청).
 *
 * 남긴 23mm는 포수가 서는 자리다 — 홈 뒤 11mm에 선 포수 마커(22mm)의 발끝이
 * 종이 끝(297mm)에 닿는다. 더 내리면 포수가 잘린다. 연필 쥔 손은 종이 밖
 * 책상 위에 놓이면 되고, 그 대신 담장까지가 그만큼 멀어진다.
 */
export const HOME = { xMm: BOARD.widthMm / 2, yMm: 274 } as const;

/**
 * 내야 한 변(홈–1루). **정규 규격의 정사각형**이다 — 파울라인이 ±45°다.
 *
 * 앞선 판은 부채꼴을 종이 안에 다 넣으려고 파울 각을 ±36°로 눌렀는데, 사용자가
 * 되돌렸다(2026-09-08): "홈플레이트와 1·2·3루의 내야 다이아몬드가 경기장
 * 규격대로 충분히 표현되고, 확장되는 나머지는 A4를 벗어나도 된다." 그래서
 * 내야는 규격대로 90°로 크게 그리고, 담장 쪽 부채꼴 귀퉁이는 종이 밖으로
 * 내보낸다 — 종이 밖으로 나간 공은 판정할 수 없으니 **파울**이다(`./rules.ts`).
 *
 * 95mm면 다이아몬드 폭이 134mm로 종이 폭의 64%다. 옛 인쇄본 〈별나라 BASEBALL〉
 * 에서 잰 비율(61%)과 같은 크기이고, 2루가 홈에서 134mm 떨어져 내야 여섯 명이
 * 겹치지 않는다.
 */
export const BASE_PATH_MM = 95;

/** 45° 방향이라 x·y 성분이 같다. */
const BASE_LEG_MM = BASE_PATH_MM / Math.SQRT2; // 67.18

export const BASES = {
  home: HOME,
  first: { xMm: HOME.xMm + BASE_LEG_MM, yMm: HOME.yMm - BASE_LEG_MM },
  second: { xMm: HOME.xMm, yMm: HOME.yMm - 2 * BASE_LEG_MM },
  third: { xMm: HOME.xMm - BASE_LEG_MM, yMm: HOME.yMm - BASE_LEG_MM },
} as const;

/**
 * 판정선 셋 — 전부 **홈을 중심으로 한 원호**의 반지름이다.
 *
 * 내야가 정규 규격이 되면서 담장도 실제처럼 홈에서 같은 거리에 두는 것이
 * 맞다. 앞선 판의 타원은 종이에 부채꼴을 욱여넣으려던 것이었고, 종이를 벗어나도
 * 된다고 정한 지금은 원이 정직하다.
 *
 * - `outMm` — **아웃선**. 옛 인쇄본 〈별나라 BASEBALL〉의 규칙 4번 "아웃선을
 *   못 나갈 경우 아웃"에서 왔다. 마운드 바로 앞을 지나는 호라, 힘없이 구른
 *   공은 내야 땅볼 아웃이 된다. 다이아몬드 안에서만 그린다.
 * - `doubleMm` — **2루타선**. 2루 베이스(134mm)보다 41mm 바깥이라 2루수·유격수가
 *   베이스 뒤에 설 자리가 있다.
 * - `homeRunMm` — **홈런선**. 종이 위 끝에서 25mm 아래를 지난다. 그 위 띠가
 *   홈런이 멈출 자리다 — 종이 밖으로 나가면 파울이므로 담장 너머가 종이 안에
 *   있어야 홈런이 나온다. 홈을 종이 끝까지 내리면서 얻은 24mm는 전부 여기
 *   외야 쪽에 얹었다.
 *
 * 2루타선과 홈런선은 종이 좌우를 벗어난다. 좌우 끝에서 잘린 채로 그린다.
 */
export const LINES = {
  outMm: 48,
  doubleMm: 175,
  homeRunMm: 249,
} as const;

/**
 * 홈 기준 극좌표 → 파트 좌표.
 *
 * `bearingDeg`는 **중앙 담장이 0°, 1루 쪽이 +**다(파울라인이 ±45°).
 * `distanceMm`는 홈에서의 거리다. 수비 위치와 이름표 자리를 이 두 값으로
 * 적어 두면 "외야수가 홈에서 195mm 떨어져 있다"는 뜻이 좌표와 무관하게 남는다.
 */
export const fieldPoint = (
  bearingDeg: number,
  distanceMm: number,
): { xMm: number; yMm: number } => {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    xMm: HOME.xMm + distanceMm * Math.sin(rad),
    yMm: HOME.yMm - distanceMm * Math.cos(rad),
  };
};

/**
 * 홈 중심 반지름 `radiusMm`인 원이 종이 좌우 끝과 만나는 y.
 *
 * 2루타선·홈런선은 종이보다 커서 좌우가 잘린다 — 인쇄 렌더러가 클립을 받지
 * 않으므로 호를 **잘리는 점에서 시작해 잘리는 점에서 끝내야** 한다. 반지름이
 * 종이 반폭보다 작으면 잘리지 않으므로 `null`이다.
 */
export const edgeCrossingYMm = (radiusMm: number): number | null => {
  const halfMm = BOARD.widthMm / 2;
  if (radiusMm <= halfMm) return null;
  return HOME.yMm - Math.sqrt(radiusMm ** 2 - halfMm ** 2);
};

/** 파울라인이 종이 좌우 끝과 만나는 y. 45°라 홈에서 반폭만큼 올라간 곳이다. */
export const FOUL_LINE_EDGE_Y_MM = HOME.yMm - BOARD.widthMm / 2; // 169

/** 내야·홈 주변 표식. 눈으로 맞춘 값이고, 실제 야구장 비율을 대충 따른다. */
export const FIELD_MARKS = {
  /**
   * 판정선 굵기 — 아웃선 · 2루타선 · 홈런선 · 파울라인.
   *
   * 나머지 선보다 굵다. 이 넷이 곧 규칙이고(`../rules.ts`) 공이 어디 멈췄는지를
   * 아이가 눈으로 갈라야 하므로, 타석 같은 장식선과 무게가 같으면 판이 선
   * 무더기로 보인다.
   */
  judgeLineWidthMm: 0.9,
  /**
   * 내야 다이아몬드 굵기. 판정선보다 굵다 — 옛 인쇄본이 흙색 띠로 그린 것을
   * 따라 선이 아니라 **띠**로 읽히게 한다.
   */
  diamondLineWidthMm: 1.6,
  /** 타석·백네트 등 나머지 선. */
  lineWidthMm: 0.5,
  /** 1·2·3루 베이스 한 변. 바로 선 정사각형으로 그린다. */
  baseSizeMm: 7,
  /** 홈플레이트 폭(오각형의 밑변). */
  homePlateWidthMm: 8,
  /** 투수 마운드 반지름. 홈에서 이만큼 떨어진 곳이 중심이다(실제 비율 0.672). */
  moundRadiusMm: 10,
  moundDistanceMm: 64,
  /** 투수판. 마운드 한가운데에 가로로 눕는다. */
  rubberWidthMm: 5,
  rubberHeightMm: 1.2,
  /** 타석 — 홈 좌우에 하나씩. 타자 마커가 이 안에 선다. */
  batterBoxWidthMm: 7,
  batterBoxHeightMm: 13,
  batterBoxGapMm: 6,
  /** 포수 자리. 홈 뒤에 붙는다. */
  catcherBoxWidthMm: 11,
  catcherBoxHeightMm: 9,
  /** 백네트 — 홈 뒤로 빠진 공의 경계. 홈 중심 원호다. */
  backstopRadiusMm: 19,
} as const;

/**
 * 필드 안에서 마커가 움직일 수 있는 범위.
 *
 * 종이 거의 전부다 — 부채꼴이 종이보다 커서 종이 위 대부분이 경기장이다. 영역은
 * `rect`뿐이라(`lib/schema/parts.ts`) 아래쪽 파울 지역도 딸려 들어온다. 수비를
 * 파울 지역에 세우는 것은 규칙이 막을 일이지 도안이 막을 일이 아니라고 보고
 * 그대로 둔다.
 *
 * 아래 끝(286mm)은 **포수가 서는 자리**가 정한다. 마커 절반(11mm)을 더하면
 * 정확히 종이 끝(297mm)이다.
 */
export const PLAY_AREA = {
  xMm: 10,
  yMm: 6,
  widthMm: 190,
  heightMm: 280,
} as const;

/** 타자가 설 수 있는 범위 — 두 타석과 그 사이를 덮는다. */
export const BATTING_AREA = {
  xMm: HOME.xMm - 22,
  yMm: HOME.yMm - 9,
  widthMm: 44,
  heightMm: 23,
} as const;

/**
 * 스트라이크·볼·아웃 카운터 — 왼쪽 아래 파울 지역(2026-09-08 사용자 요청).
 *
 * 동그라미 수는 요청 그대로다: S 둘 · B 넷 · O 셋. 동전을 얹어 세고 타자가
 * 바뀌면 S·B를, 공수가 바뀌면 셋 다 치운다(`./rules.ts`). 인쇄물이 상태를
 * 기억하지 못하므로 **놓고 치우는 자리**만 그린다.
 *
 * 자리는 파울라인(y = x + 169) 아래다. 오른쪽 위 모서리(48.5, 255)가 선에서
 * 37mm 떨어져 있고, 타자 마커(x ≥ 85)와 백네트(x ≥ 86)에 닿지 않는다.
 */
export const COUNT_PANEL = {
  /** 글자(S·B·O) 열의 x. */
  letterXMm: 10,
  /** 첫 동그라미 중심 x. 다음 동그라미는 `dotGapMm`씩 오른쪽이다. */
  firstDotXMm: 20,
  dotGapMm: 8.5,
  dotRadiusMm: 3.2,
  /** 첫 줄(S)의 중심 y. 줄은 `rowGapMm`씩 아래로 내려간다. */
  firstRowYMm: 258,
  rowGapMm: 11,
  rows: [
    { letter: 'S', dots: 2 },
    { letter: 'B', dots: 4 },
    { letter: 'O', dots: 3 },
  ],
} as const;

/**
 * 마커 상자.
 *
 * 축구(18×22)보다 폭이 2mm 넓다 — 배트를 든 타자와 팔을 뻗은 야수가 옆으로
 * 더 나간다. 겹침 판정은 세트에서 가장 큰 변형을 쓰므로(`styleSetBounds`)
 * 실제 판정 상자는 **20×22**다.
 */
export const PLAYER_MARKER = {
  circle: { widthMm: 20, heightMm: 20, valueFontSizeMm: 7 },
  illustration: { widthMm: 20, heightMm: 22, valueFontSizeMm: 7 },
} as const;

/**
 * 자세 목록.
 *
 * 축구와 같은 규약이다 — **자세 하나가 스타일 세트 하나**이고, 슬롯에 역할로
 * 배정된다(`./index.ts`의 `DEFENSE_POSITIONS`). 사용자가 고르는 것은 자세가
 * 아니라 모양(빈 원·그림·색칠용)이다.
 *
 * 여기에는 id와 이름만 둔다 — 관절 각도는 아트워크 생성기가 갖는다
 * (`./artwork/player-markers.ts`의 `POSE_ANGLES`). 그림 그리는 코드가 앱
 * 번들에 딸려 들어가지 않게 하려는 것이다(`artworkPath`와 같은 이유다).
 */
export const FIELDER_POSES = [
  { id: 'pitch', label: '투구' },
  { id: 'crouch', label: '포수' },
  { id: 'field', label: '땅볼 수비' },
  { id: 'throw', label: '송구' },
  { id: 'catch', label: '뜬공' },
  { id: 'run', label: '달리기' },
] as const;

/** 타자 자세. 수비와 세트를 따로 쓰므로 목록에서 뺐다. */
export const BATTER_POSE = { id: 'bat', label: '타격' } as const;

/**
 * 수비 아홉 자리. **순서가 곧 야구의 수비 번호**다(1 투수 … 9 우익수) —
 * 스코어북과 같은 차례라 아이가 옮겨 적을 때 헷갈리지 않는다.
 *
 * 자세는 자리에 붙는다. 같은 자세를 두 자리가 나눠 쓰기도 하지만(1·3루수는
 * 땅볼 수비, 좌익수·유격수는 달리기) 이웃끼리는 엇갈리게 두어 판이 반복돼
 * 보이지 않게 했다 — 축구 게임판이 자세를 배정한 것과 같은 기준이다.
 */
export const DEFENSE_POSITIONS = [
  { id: 'pitcher', label: '투수', poseId: 'pitch' },
  { id: 'catcher', label: '포수', poseId: 'crouch' },
  { id: 'first', label: '1루수', poseId: 'field' },
  { id: 'second', label: '2루수', poseId: 'throw' },
  { id: 'third', label: '3루수', poseId: 'field' },
  { id: 'shortstop', label: '유격수', poseId: 'run' },
  { id: 'left', label: '좌익수', poseId: 'run' },
  { id: 'center', label: '중견수', poseId: 'catch' },
  { id: 'right', label: '우익수', poseId: 'throw' },
] as const;

/** 타석에 서는 한 명. 공격 그룹의 유일한 마커다. */
export const BATTER_POSITION = {
  id: 'batter',
  label: '타자',
  poseId: BATTER_POSE.id,
} as const;

/** 자세가 쓰는 마커 스타일 세트 id. */
export const poseStyleSetId = (poseId: string): string => `marker-${poseId}`;

/** 스타일 세트 × 변형 → 아트워크 파일 id. 생성기와 도안 정의가 같이 읽는다. */
export const markerArtworkId = (poseId: string, variantId: string): string =>
  `${poseStyleSetId(poseId)}-${variantId}`;

/**
 * 빈 원 변형이 쓰는 아트워크 id.
 *
 * 원은 자세와 무관해 **자세 세트 전부가 파일 하나를 나눠 쓴다**. 다만 수비와
 * 타자는 갈라 둔다 — 타자 원에는 안쪽 테가 하나 더 있어 흑백으로 뽑아도
 * 공격·수비가 구분된다(축구 골키퍼 원과 같은 수법).
 */
export const FIELDER_CIRCLE_ARTWORK_ID = 'marker-circle';
export const BATTER_CIRCLE_ARTWORK_ID = 'batter-circle';

/** 부속 시트 치수. */
export const SHEETS = {
  /** 스코어보드 — A5 가로. 한 장에 두 경기가 든다. */
  scoreSheet: { widthMm: 210, heightMm: 148.5 },
  /**
   * 선수 스탠드 전개도.
   *
   * 카드 열 장이 들어갈 만큼만 잡았다. 축구 골대 시트처럼 A4를 꽉 채우지
   * 않는 것은 **스탠드가 커질 수 없기 때문이다** — 판 위 마커 자리에 서는
   * 물건이라 카드 폭이 마커 폭(20mm)에서 크게 벗어나면 내야에 여섯 명이
   * 서지 못한다. 시트를 A4로 늘리면 남는 것은 빈 종이뿐이라, 종이를 아끼는
   * 쪽을 골랐다.
   */
  stands: { widthMm: 160, heightMm: 150 },
} as const;

/** 스코어보드 표 한 벌. */
export const SCORE_TABLE = {
  cutInsetMm: 5,
  xMm: 10,
  /** 표 두 벌의 머리글 y. 한 장에 두 경기를 적는다. */
  topYMm: [30, 84] as readonly number[],
  rowHeightMm: 11,
  /** 팀 이름 열. 아이가 직접 쓴다. */
  teamColumnMm: 34,
  inningColumnMm: 14,
  innings: 9,
  /** 득점(R)·안타(H) 합계 열. */
  totalColumnMm: 15,
} as const;

export const SCORE_TABLE_WIDTH_MM =
  SCORE_TABLE.teamColumnMm +
  SCORE_TABLE.inningColumnMm * SCORE_TABLE.innings +
  SCORE_TABLE.totalColumnMm * 2; // 190

/**
 * 선수 스탠드 한 장.
 *
 * **텐트형**이다 — 카드 한가운데를 산접기로 접으면 두 면이 마주 보며 ∧ 로 선다.
 * 축구 골대와 달리 풀도 탭도 없다. 앞뒤 두 면에 같은 그림을 넣되 위쪽 면은
 * 180° 돌려 그린다(`./artwork/stands.ts`) — 접어 세웠을 때 뒤쪽에서도 바로
 * 보이게 하려는 것이다.
 *
 * 열 개는 수비 아홉 + 타자 하나다. 그림이 카드마다 다르므로 어느 것이 어느
 * 포지션인지는 그림과 이름표가 말한다.
 */
export const STAND = {
  cardWidthMm: 26,
  /** 한 면의 높이. 카드 전체 높이는 이것의 두 배다. */
  faceHeightMm: 30,
  columns: 5,
  rows: 2,
  /** 카드 사이 간격 — 가위가 지나갈 폭이다. */
  gapMm: 3,
  /** 격자 위에 붙는 제목 띠의 높이. */
  headerHeightMm: 20,
  /** 그림을 앉히는 상자. 카드보다 작아 이름표와 접는선을 피한다. */
  figureWidthMm: 20,
  figureHeightMm: 22,
  /** 접는선에서 그림 중심까지. 두 면이 이 값을 대칭으로 나눠 쓴다. */
  figureOffsetMm: 13,
  /** 포지션 이름표 글자 크기와 카드 아래 끝에서의 거리. */
  labelFontMm: 3,
  labelBaselineMm: 4,
} as const;

/** 격자 전체 크기 — 시트 안에서 가운데로 맞추는 데 쓴다. */
export const STAND_GRID = {
  widthMm:
    STAND.columns * STAND.cardWidthMm + (STAND.columns - 1) * STAND.gapMm,
  heightMm:
    STAND.rows * STAND.faceHeightMm * 2 + (STAND.rows - 1) * STAND.gapMm,
} as const;

/**
 * 파트 id에 대응하는 정적 자산 경로.
 *
 * 도안 정의가 여기서 경로를 받는다 — 아트워크 생성기(`./artwork/`)에서 받아 오면
 * SVG를 짓는 코드가 통째로 앱 번들에 딸려 들어간다.
 */
export const artworkPath = (partId: string): string =>
  `/games/baseball/${partId}.svg`;

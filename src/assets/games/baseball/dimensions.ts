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
 * 남긴 23mm는 **백네트 자리**다 — 홈 중심 반지름 19mm인 호가 293mm까지
 * 내려오고 종이 끝(297mm)까지 4mm가 남는다. 더 내리면 백네트가 잘린다.
 * (처음에는 이 자리를 포수 마커가 정했는데, 포수를 판에서 빼면서 백네트가
 * 하한을 물려받았다 — 2026-09-08.) 연필 쥔 손은 종이 밖 책상 위에 놓이면
 * 되고, 그 대신 담장까지가 그만큼 멀어진다.
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
  /**
   * 포수 자리. 홈 뒤에 붙는다.
   *
   * 포수 마커를 뺀 뒤에도 **선은 남긴다**(2026-09-08) — 실제 야구장에 그어진
   * 선이고, 홈 뒤가 비어 보이면 판이 야구장으로 읽히지 않는다.
   */
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
 * 아래 끝(286mm)은 홈 뒤 백네트까지 열어 둔 자리다. 포수를 뺀 뒤로 여기에
 * 세울 선수는 없지만(2026-09-08) 범위를 좁히지는 않았다 — 홈플레이트 언저리에
 * 수비를 세우면 연필이 걸린다는 것은 위와 같은 이유로 규칙이 말할 일이다.
 */
export const PLAY_AREA = {
  xMm: 10,
  yMm: 6,
  widthMm: 190,
  heightMm: 280,
} as const;

/**
 * 스트라이크·아웃 카운터 — 왼쪽 아래 파울 지역(2026-09-08 사용자 요청).
 *
 * 처음에는 S 둘 · B 넷 · O 셋이었는데, **실제로 해 보고 줄였다**(같은 날 사용자
 * 확인): "B는 필요없고, S와 O만 있으면 되고 카운트도 2개씩만 있으면 되더라."
 * 볼은 기본 규칙에 투구가 없어 셀 일이 없었고, 남은 둘은 **마지막 하나를 셀
 * 필요가 없다** — 스트라이크 셋째는 아웃이고 아웃 셋째는 공수 교대라, 그 순간
 * 칸이 통째로 비워진다. 그러니 동그라미는 둘이면 족하다.
 *
 * 동전을 얹어 세고 타자가 바뀌면 S를, 공수가 바뀌면 둘 다 치운다(`./rules.ts`).
 * 인쇄물이 상태를 기억하지 못하므로 **놓고 치우는 자리**만 그린다.
 *
 * 자리는 파울라인(y = x + 169) 아래다. 오른쪽 위 모서리(31.7, 255)가 그 선보다
 * 54mm 아래이고, 홈 뒤 백네트(x ≥ 86)에 닿지 않는다.
 */
export const COUNT_PANEL = {
  /** 글자(S·O) 열의 x. */
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
    { letter: 'O', dots: 2 },
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
  { id: 'field', label: '땅볼 수비' },
  { id: 'throw', label: '송구' },
  { id: 'catch', label: '뜬공' },
  { id: 'run', label: '달리기' },
] as const;

/**
 * 판에 서는 수비 여덟 자리.
 *
 * **포수와 타자는 판에 세우지 않는다**(2026-09-08 사용자 요청). 둘이 서는 자리가
 * 곧 홈플레이트 언저리인데, 거기는 공을 놓고 연필로 튕기는 자리다 — 포수를
 * 세우면 힘없이 구른 공이 매번 포수에 맞아 아웃이 되고(`./rules.ts`의 판정),
 * 타자를 세우면 튕기는 손이 걸린다. 그래서 그라운드에서 뺐다. 홈 뒤에 그어진
 * 포수 자리 선과 타석 선은 그대로 남는다 — 그림은 야구장이고, 사람만 없다.
 *
 * `number`는 **야구의 수비 번호**다(1 투수 … 9 우익수). 포수(2번)가 빠져 자리
 * 순서와 번호가 어긋나므로 번호를 따로 적는다 — 스코어북과 같은 번호라야 아이가
 * 옮겨 적을 때 헷갈리지 않는다.
 *
 * 자세는 자리에 붙는다. 같은 자세를 두 자리가 나눠 쓰기도 하지만(1·3루수는
 * 땅볼 수비, 좌익수·유격수는 달리기) 이웃끼리는 엇갈리게 두어 판이 반복돼
 * 보이지 않게 했다 — 축구 게임판이 자세를 배정한 것과 같은 기준이다.
 */
export const DEFENSE_POSITIONS = [
  { id: 'pitcher', number: 1, label: '투수', poseId: 'pitch' },
  { id: 'first', number: 3, label: '1루수', poseId: 'field' },
  { id: 'second', number: 4, label: '2루수', poseId: 'throw' },
  { id: 'third', number: 5, label: '3루수', poseId: 'field' },
  { id: 'shortstop', number: 6, label: '유격수', poseId: 'run' },
  { id: 'left', number: 7, label: '좌익수', poseId: 'run' },
  { id: 'center', number: 8, label: '중견수', poseId: 'catch' },
  { id: 'right', number: 9, label: '우익수', poseId: 'throw' },
] as const;

/**
 * 타격 자세 열 — **스탠드 카드 뒷면**이 하나씩 나눠 쓴다(2026-09-08 사용자 요청).
 *
 * 카드 뒷면이 서로 다른 타격 자세여야 한다는 요청이다. 뒤집어 세우면 한 줄이
 * 그대로 타순이 되는데, 같은 자세가 둘이면 누가 몇 번인지 그림으로 갈리지
 * 않는다. 앞 다섯은 한 스윙을 시간 순으로 자른 것이고(대기 → 준비 → 스윙 →
 * 임팩트 → 팔로스루) 나머지 다섯은 그 밖의 순간이다.
 *
 * **개수는 카드 수와 같다**(`STAND_CARDS`) — 지명타자가 늘면서 아홉에서 열이
 * 됐다. 지명타자 카드의 앞면이 쓰는 자세(`DH_CARD.poseId`)는 여기 없다. 그쪽은
 * 뒷면 목록이 아니다.
 *
 * 이 자세들은 **판 마커가 되지 않는다** — 타자는 그라운드에 없다. 그래서
 * `FIELDER_POSES`와 갈라 두었고, 스타일 세트도 아트워크 파일도 만들지 않는다.
 */
export const BATTER_POSES = [
  { id: 'bat-ready', label: '대기' },
  { id: 'bat-load', label: '준비' },
  { id: 'bat-swing', label: '스윙' },
  { id: 'bat-impact', label: '임팩트' },
  { id: 'bat-follow', label: '팔로스루' },
  { id: 'bat-bunt', label: '번트' },
  { id: 'bat-upper', label: '퍼올리기' },
  { id: 'bat-wait', label: '기다리기' },
  { id: 'bat-point', label: '겨누기' },
  { id: 'bat-dash', label: '뛰어나가기' },
] as const;

/**
 * 포수 — **스탠드에만 있는 한 명**이다.
 *
 * 판에서는 뺐지만(`DEFENSE_POSITIONS`) 스탠드는 한 팀 아홉을 다 낸다(2026-09-08
 * 사용자 요청). 뒷면이 타자라 아홉 장이 곧 타순 아홉이기도 해서, 포수가 빠지면
 * 타순이 여덟이 된다.
 */
export const CATCHER_CARD = {
  id: 'catcher',
  number: 2,
  label: '포수',
  poseId: 'crouch',
} as const;

/**
 * 지명타자 — **수비를 나가지 않는 열 번째 카드**(2026-09-08 사용자 요청,
 * "포수 오른쪽에 지명타자도 추가해서 총 10명").
 *
 * 앞면 자세가 수비가 아니라 **타격**인 유일한 카드다. 이름표가 붙는 면인데
 * 지명타자에게는 수비 자세랄 것이 없어, 배트를 어깨에 걸치고 차례를 기다리는
 * 모습을 앞면에 둔다. 뒤집으면 치는 자세가 나오니 양면이 다 타자다.
 *
 * `number` 10은 수비 번호가 아니다 — 수비 번호는 아홉까지이고, 스코어북이
 * 지명타자를 그 다음 번호로 적는 관례를 따랐다.
 */
export const DH_CARD = {
  id: 'dh',
  number: 10,
  label: '지명타자',
  poseId: 'bat-shoulder',
} as const;

/**
 * 스탠드 카드 열 = 한 팀 한 벌.
 *
 * 순서는 사용자가 적어 준 그대로다 — 투수부터 야수 여덟, 포수, 그 오른쪽이
 * 지명타자다. **앞면은 그 자리의 자세, 뒷면은 타격 자세**이고 카드마다 뒷면이
 * 다르다.
 *
 * 타순은 이 중 아홉이다. 지명타자가 **투수 대신** 치므로 투수 카드를 빼고 짠다
 * (`./rules.ts`) — 지명타자가 있는 이유가 그것이다.
 */
export const STAND_CARDS = [...DEFENSE_POSITIONS, CATCHER_CARD, DH_CARD].map(
  (position, i) => ({
    ...position,
    /** 뒷면 자세. 카드 열이 타격 자세 열을 하나씩 나눠 갖는다. */
    batterPoseId: BATTER_POSES[i].id,
  }),
);

/**
 * 판 마커가 되지 않고 **스탠드에만 쓰이는 자세** — 포수와 타격 아홉.
 *
 * 아트워크 생성기가 자세 그림을 만들 목록(`FIELDER_POSES`)과 갈라 둔다. 그림
 * 엔진은 둘 다 알아야 하지만(`./artwork/player-markers.ts`의 `POSE_BY_ID`),
 * 마커 파일이 나오는 것은 앞의 것뿐이다.
 */
export const STAND_ONLY_POSES = [
  { id: CATCHER_CARD.poseId, label: CATCHER_CARD.label },
  { id: DH_CARD.poseId, label: '어깨에 걸치기' },
  ...BATTER_POSES,
] as const;

/** 자세가 쓰는 마커 스타일 세트 id. */
export const poseStyleSetId = (poseId: string): string => `marker-${poseId}`;

/** 스타일 세트 × 변형 → 아트워크 파일 id. 생성기와 도안 정의가 같이 읽는다. */
export const markerArtworkId = (poseId: string, variantId: string): string =>
  `${poseStyleSetId(poseId)}-${variantId}`;

/**
 * 빈 원 변형이 쓰는 아트워크 id.
 *
 * 원은 자세와 무관해 **자세 세트 전부가 파일 하나를 나눠 쓴다**. 타자 원을
 * 따로 두었다가 타자가 판에서 빠지면서 같이 없앴다(2026-09-08) — 판 위에 서는
 * 것이 수비뿐이라 흑백에서 공수를 가를 표식이 필요 없어졌다.
 */
export const FIELDER_CIRCLE_ARTWORK_ID = 'marker-circle';

/** 부속 시트 치수. */
export const SHEETS = {
  /**
   * 스코어보드 — **A4 세로. 한 장에 다섯 경기가 든다**(2026-09-08 사용자 요청).
   *
   * A5 가로에 표 두 벌이었는데, A4에 얹으면 아래 절반이 통째로 남았다. 표는
   * 폭이 190mm로 고정이라(9이닝 + 합계 둘) 옆으로 늘릴 수 없고, 세로로만
   * 늘어난다 — 그래서 남는 자리에 표를 세 벌 더 얹었다. 한 벌이 33mm이고
   * 52mm 간격이라 다섯 벌이 30–271mm를 쓴다.
   */
  scoreSheet: { widthMm: 210, heightMm: 297 },
  /**
   * 선수 스탠드 전개도 — **A4 가로 한 장에 두 팀 스무 명**(2026-09-08 사용자 요청).
   *
   * 앞서는 열 장짜리 160×150 시트를 두 벌 뽑게 했는데, A4에 얹으면 종이가
   * 절반 넘게 남았다. **카드는 커질 수 없다** — 판 위 마커 자리에 서는 물건이라
   * 카드 폭이 마커 폭(20mm)에서 크게 벗어나면 내야에 여섯 명이 서지 못한다.
   * 그래서 남는 자리를 키우기가 아니라 **두 번째 팀**으로 채운다: 한 줄에 한 팀씩
   * 늘어서고 두 줄이 두 팀이라, 뽑는 장수가 두 장에서 한 장으로 준다.
   *
   * 한 줄은 **열 명**이다(`STAND_CARDS`) — 판에 서는 수비 여덟에 포수와
   * 지명타자를 더한 한 팀 전부이고, 뒷면이 모두 타자다.
   *
   * 287×200은 A4 가로(297×210)에 5mm를 남기고 앉는 크기다 — 인쇄 여백을
   * 5mm까지 올려도 타일이 갈라지지 않는다. 카드 격자는 155mm까지만 쓰고,
   * **남는 아래 띠에 보관함 전개도**가 앉는다(`STAND_BOX`, 2026-09-12 사용자
   * 요청 — 오려 놓은 선수가 온 집에 흩어진다). 전에는 165였고 그 아래 45mm가
   * 빈 종이로 나왔다.
   */
  stands: { widthMm: 287, heightMm: 200 },
  /**
   * 선수 로스터 기록 용지 — **A4 세로. 한 장에 두 팀**이다(2026-09-12 사용자 요청).
   *
   * 스코어보드가 "이닝마다 몇 점"이라면 이쪽은 "누가 몇 번 쳐서 몇 번 살았나"다.
   * 표 한 벌이 한 팀의 타순 아홉이고, 한 경기에 두 팀이 필요하므로 한 장에 두
   * 벌을 얹는다.
   */
  roster: { widthMm: 210, heightMm: 297 },
} as const;

/** 스코어보드 표 한 벌. */
export const SCORE_TABLE = {
  cutInsetMm: 5,
  xMm: 10,
  /**
   * 표 다섯 벌의 머리글 y. 한 장에 다섯 경기를 적는다.
   *
   * 간격 52mm는 표 한 벌(3줄 × 11 = 33mm)에 19mm를 띄운 값이다 — 그 사이에
   * 다음 표의 "n번째 판" 이름표가 앉는다.
   */
  topYMm: [30, 82, 134, 186, 238] as readonly number[],
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
 * 선수 로스터 기록 용지 (2026-09-12 사용자 요청)
 *
 * "1번부터 9번까지 선수 기록을 적을 수 있는 기록용 용지가 있으면 좋겠어.
 * 선수이름과 각 타석수만큼 기록칸이 있으면 좋겠고, 최종적으로 타율도 계산해서
 * 넣어보면 좋겠어."
 *
 * 표 한 벌 = 한 팀이다. 줄은 타순 아홉, 열은 **타순 · 이름 · 자리 · 타석 다섯 ·
 * 타수 · 안타 · 타율**이다. 폭 190mm는 스코어보드 표와 같다 — 두 용지를 나란히
 * 놓았을 때 같은 물건으로 보이라고 맞췄다.
 *
 * **타석 칸이 다섯**인 것은 9이닝에 타순 아홉이면 한 사람이 네 번에서 다섯 번
 * 서기 때문이다. 여섯 칸을 두면 열이 좁아져 여섯 살 글씨가 들어가지 않는다.
 *
 * **타율은 나눗셈이다.** 아이가 못 하는 계산을 종이가 대신하도록 용지 아래에
 * 조견표를 둔다(`ROSTER_GUIDE`) — 타수와 안타가 만나는 칸에 값이 적혀 있다.
 */
export const ROSTER = {
  cutInsetMm: 5,
  xMm: 10,
  titleYMm: 16,
  /** 표 두 벌의 위쪽 끝 — 한 벌이 한 팀이다. */
  blockTopYMm: [24, 138] as readonly number[],
  /** 표 위의 팀 이름 줄 높이. */
  teamLineHeightMm: 7,
  headerHeightMm: 9,
  rowHeightMm: 10,
  /** 타순 아홉. */
  rows: 9,
  orderColumnMm: 10,
  nameColumnMm: 36,
  positionColumnMm: 18,
  /** 타석 칸 하나의 폭과 개수. */
  atBatColumnMm: 17,
  atBats: 5,
  /** 타수·안타 열. */
  countColumnMm: 12,
  averageColumnMm: 17,
  headerFontMm: 3.2,
  orderFontMm: 3.6,
  noteFontMm: 2.8,
} as const;

export const ROSTER_TABLE_WIDTH_MM =
  ROSTER.orderColumnMm +
  ROSTER.nameColumnMm +
  ROSTER.positionColumnMm +
  ROSTER.atBatColumnMm * ROSTER.atBats +
  ROSTER.countColumnMm * 2 +
  ROSTER.averageColumnMm; // 190

/** 표 한 벌의 높이 — 팀 이름 줄 + 머리글 + 아홉 줄. */
export const ROSTER_BLOCK_HEIGHT_MM =
  ROSTER.teamLineHeightMm +
  ROSTER.headerHeightMm +
  ROSTER.rowHeightMm * ROSTER.rows;

/**
 * 타율 조견표 — 나눗셈을 못 해도 값을 찾는다.
 *
 * 가로가 안타, 세로가 타수다. 타석 칸이 다섯이라 타수도 다섯까지면 된다.
 */
export const ROSTER_GUIDE = {
  topYMm: 252,
  labelColumnMm: 16,
  cellWidthMm: 14,
  cellHeightMm: 6.5,
  maxAtBats: 5,
  fontMm: 2.6,
} as const;

/**
 * 타율 — 안타 ÷ 타수를 소수 셋째 자리까지, 앞의 0을 떼고 적는다(야구 관례).
 * 타수가 0이면 계산할 것이 없다.
 */
export const battingAverage = (hits: number, atBats: number): string => {
  if (atBats <= 0 || hits > atBats) return '—';
  const value = Math.round((hits / atBats) * 1000) / 1000;
  if (value >= 1) return '1.000';
  return `.${String(Math.round(value * 1000)).padStart(3, '0')}`;
};

/**
 * 선수 스탠드 한 장.
 *
 * **텐트형**이다 — 카드 한가운데를 산접기로 접으면 두 면이 마주 보며 ∧ 로 선다.
 * 축구 골대와 달리 풀도 탭도 없다. 앞뒤 두 면에 같은 그림을 넣되 위쪽 면은
 * 180° 돌려 그린다(`./artwork/stands.ts`) — 접어 세웠을 때 뒤쪽에서도 바로
 * 보이게 하려는 것이다.
 *
 * 격자는 **7열 × 3행**이다(2026-09-12). 오른쪽 세로 칸을 보관함 전개도에
 * 내주면서 열이 열 개에서 일곱 개로 줄었고, 스무 장이 7·7·6으로 흐른다. 한 줄이
 * 곧 한 팀이던 시절은 끝났지만 **팀은 여전히 이어 붙는다** — 첫 팀 열 장이 먼저,
 * 두 번째 팀 열 장이 그 뒤다. 팀이 바뀌는 자리마다 이름 띠가 붙어 어디까지가
 * 누구 것인지는 종이 위에 남는다.
 *
 * **두 면이 서로 다른 그림이다**(2026-09-08 사용자 요청) — 아래 면은 수비 자세와
 * 포지션 이름표, 위 면은 타격 자세다. 접어 세우면 한쪽에서는 야수가, 반대쪽에서는
 * 타자가 보인다.
 *
 * 카드 폭 25mm는 **판 위 마커 자리에 서는 물건**이라 줄일 수 없다 — 그림
 * 상자(20mm) 양옆에 2.5mm씩 남아 이름표가 잘리지 않는다. 높이는 30 → 27로
 * 줄였다(2026-09-12 사용자 허락 — "필요하다면 선수들의 크기를 조금 줄여도
 * 좋아"): 세 줄이 보관함과 같은 높이(183mm)로 떨어져 종이에 빈자리가 남지 않고,
 * 상자 벽(28mm)이 접은 선수(27mm)보다 높아 **다 들어간다.**
 */
export const STAND = {
  cardWidthMm: 25,
  /** 한 면의 높이. 카드 전체 높이는 이것의 두 배다. 접어 세운 키이기도 하다. */
  faceHeightMm: 27,
  /** 오른쪽 보관함 칸을 빼고 남는 폭에 들어가는 열 수. 스무 장이 7·7·6이다. */
  columns: 7,
  rows: 3,
  /** 카드 사이 간격 — 가위가 지나갈 폭이다. */
  gapMm: 3,
  /** 격자 위에 붙는 제목 띠의 높이. 제목 한 줄과 안내 한 줄이 들어간다. */
  headerHeightMm: 13,
  /** 카드 위에 붙는 팀 이름 띠. 팀이 바뀌는 자리마다 하나씩이다. */
  teamBandHeightMm: 5,
  teamFontMm: 3.2,
  /** 그림을 앉히는 상자. 카드보다 작아 이름표와 접는선을 피한다. */
  figureWidthMm: 20,
  figureHeightMm: 19.5,
  /** 접는선에서 그림 중심까지. 두 면이 이 값을 대칭으로 나눠 쓴다. */
  figureOffsetMm: 11.7,
  /** 포지션 이름표 글자 크기와 카드 아래 끝에서의 거리. */
  labelFontMm: 3,
  labelBaselineMm: 3.5,
  /** 시트 가장자리 여백. 격자와 보관함이 이 안에 든다. */
  sheetMarginMm: 3,
} as const;

/**
 * 줄 이름.
 *
 * 게임 그룹 이름(수비 팀·공격 팀)을 쓰지 않는다 — 그쪽은 공수에 따라 매 이닝
 * 바뀌는 **역할**이고, 여기 두 줄은 경기 내내 같은 아이가 갖는 **한 벌**이다.
 */
export const STAND_TEAMS = ['첫 번째 팀', '두 번째 팀'] as const;

/** 줄 한 칸 — 이름 띠와 그 아래 카드 한 장. */
export const STAND_ROW_HEIGHT_MM =
  STAND.teamBandHeightMm + STAND.faceHeightMm * 2;

/** 격자 전체 크기 — 시트 안에서 가운데로 맞추는 데 쓴다. */
export const STAND_GRID = {
  widthMm:
    STAND.columns * STAND.cardWidthMm + (STAND.columns - 1) * STAND.gapMm,
  heightMm: STAND.rows * STAND_ROW_HEIGHT_MM + (STAND.rows - 1) * STAND.gapMm,
} as const;

/**
 * 선수 보관함 (2026-09-12 사용자 요청)
 *
 * "실제 플레이해보니까 선수들을 오려놓고 이곳저곳으로 흩어져서 게임을 안할 때
 * 정리해둘 상자가 필요하다." 같은 종이에서 나와야 상자만 따로 잃어버리지 않으므로
 * 선수 스탠드 시트에 함께 그린다.
 *
 * **뚜껑은 없다**(같은 날 사용자 결정). 대신 상자를 **축구 골대 전개도만큼 크게**
 * 키웠다 — 전개도가 84 × 156mm로 골대 한 벌(135 × 116)과 거의 같은 넓이다.
 * 뚜껑에 쓰던 자리를 깊이로 돌린 셈이다.
 *
 * 담는 방법이 달라졌다. 눕혀 쌓는 대신 **접은 채로 세워 일렬로** 꽂는다(사용자
 * 요청). 그래서 벽이 접은 선수의 키(27mm)보다 높아야 하고(28), 안쪽 폭이 카드
 * 폭(25)보다 조금 넓어야 하며(28), 안쪽 길이 100mm가 스무 명이 늘어서는 자리다 —
 * 접은 카드 스무 장이 30mm쯤이라 공과 동전까지 들어간다. 눕혀 담아도 된다
 * (편 카드 25 × 54가 100 × 28 안에 든다).
 *
 * 전개도는 **시트 오른쪽 세로 칸**에 선다. 가로로 누이면 폭 156mm가 카드 격자를
 * 밀어내 스무 장이 들어가지 않는다.
 *
 * 풀을 쓴다. 카드는 접기만 하지만 상자는 네 귀를 붙이지 않으면 벽이 서지 않는다.
 */
export const STAND_BOX = {
  tray: {
    label: '선수 보관함',
    innerLengthMm: 100,
    innerWidthMm: 28,
    depthMm: 28,
  },
  /** 격자와 보관함 칸 사이. 가위가 지나갈 자리다. */
  gapMm: 4,
  /** 귀의 바깥 모서리를 들여 사다리꼴로 만든다 — 모서리가 걸리지 않게. */
  tabInsetMm: 2,
  noteFontMm: 2.6,
  noteLeadingMm: 4.6,
} as const;

/** 전개도 한 벌의 치수. */
export interface StandTray {
  readonly label: string;
  readonly innerLengthMm: number;
  readonly innerWidthMm: number;
  readonly depthMm: number;
}

/**
 * 전개도가 차지하는 사각형 — 바닥에 벽 넷과 귀 넷이 붙은 크기다.
 *
 * 시트에서는 **세워서** 쓴다: 폭이 `innerWidth + 2 × depth`, 높이가
 * `innerLength + 2 × depth`다.
 */
export const trayNetMm = (
  tray: StandTray,
): { widthMm: number; heightMm: number } => ({
  widthMm: tray.innerWidthMm + 2 * tray.depthMm,
  heightMm: tray.innerLengthMm + 2 * tray.depthMm,
});

export const STAND_BOX_NET_MM = trayNetMm(STAND_BOX.tray);

/**
 * 파트 id에 대응하는 정적 자산 경로.
 *
 * 도안 정의가 여기서 경로를 받는다 — 아트워크 생성기(`./artwork/`)에서 받아 오면
 * SVG를 짓는 코드가 통째로 앱 번들에 딸려 들어간다.
 */
export const artworkPath = (partId: string): string =>
  `/games/baseball/${partId}.svg`;

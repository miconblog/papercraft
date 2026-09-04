/**
 * 축구 게임판 실측 치수 (IDE-004)
 *
 * 여기 있는 값이 **배율 100%에서 종이 위 mm**다. 도안 정의(`./index.ts`)와
 * 아트워크 생성기(`./artwork/`)가 같은 상수를 읽는다 — 한쪽만 고치면 슬롯
 * 좌표와 그림이 어긋나므로 치수는 이 파일 하나에만 둔다.
 *
 * 좌표계는 `docs/game-authoring.md`를 따른다: 파트 로컬 mm, 원점 좌상단,
 * y는 아래로 증가한다.
 */

/** 보드(운동장) 파트. 배율 100%에서 A4를 가로로 놓은 크기다(IDE-002). */
export const BOARD = { widthMm: 297, heightMm: 210 } as const;

/**
 * 터치라인 사각형 = 실제로 공을 튕기는 면.
 *
 * 위아래 15mm는 팀 이름(위)과 제목·인쇄 안내(아래)가 쓰는 띠다. 좌우 8mm는
 * 골라인 바깥 여백 — 골대는 필드 **안쪽**에 세우므로(아래 `GOAL` 참고) 이
 * 여백에 조립물이 놓이지는 않는다.
 *
 * 281×180은 가로세로비 1.561로, 실제 축구장 105×68m(1.544)에 가깝다.
 */
export const FIELD = {
  xMm: 8,
  yMm: 15,
  widthMm: 281,
  heightMm: 180,
} as const;

export const FIELD_RIGHT_MM = FIELD.xMm + FIELD.widthMm; // 289
export const FIELD_BOTTOM_MM = FIELD.yMm + FIELD.heightMm; // 195
export const FIELD_CENTER_X_MM = FIELD.xMm + FIELD.widthMm / 2; // 148.5
export const FIELD_CENTER_Y_MM = FIELD.yMm + FIELD.heightMm / 2; // 105

/**
 * 필드 안 표시. 실제 축구장 치수를 약 2.66mm/m로 줄인 값이되, 좌표가 소수로
 * 흩어지지 않게 정수로 맞췄다.
 */
export const FIELD_MARKS = {
  /** 센터서클 반지름 (실제 9.15m). */
  centerCircleRadiusMm: 24,
  /** 센터 스팟·페널티 스팟 지름. */
  spotDiameterMm: 1.6,
  /** 페널티 에어리어 — 골라인에서의 깊이와 폭 (실제 16.5m × 40.32m). */
  penaltyAreaDepthMm: 44,
  penaltyAreaWidthMm: 108,
  /** 골 에어리어 (실제 5.5m × 18.32m). 골대 자리를 여유 있게 감싸도록 조금 깊다. */
  goalAreaDepthMm: 20,
  goalAreaWidthMm: 48,
  /** 페널티 스팟까지의 거리 (실제 11m). */
  penaltySpotDistanceMm: 29,
  /** 코너 아크 반지름 (실제 1m). */
  cornerArcRadiusMm: 3,
  /** 필드 라인 굵기. 표시선(오림·접기)과 달리 배율을 같이 먹는다. */
  lineWidthMm: 0.5,
} as const;

/**
 * 종이 골대 — 오려 접어 세우는 조립물.
 *
 * **바닥면이 없다.** 공이 종이 위를 미끄러져 들어와야 하는데 바닥을 깔면 종이
 * 두께만큼 턱이 생겨 공이 걸린다. 대신 양옆 벽 아래에 바깥으로 접히는 발
 * (`footDepthMm`)을 달아 세운다 — 발이 골대 바깥으로 눕기 때문에 공이 지나갈
 * 입구를 막지 않는다.
 *
 * 골대는 골라인 **안쪽**에 놓는다. 골라인 바깥 여백은 8mm뿐이라 뒤로 나갈
 * 자리가 없고, 종이 밖 책상 위에 두면 종이 가장자리 턱을 공이 넘어야 한다.
 */
export const GOAL = {
  /** 입구 폭 = 뒷벽 폭. 공 지름의 3배 이상으로 잡아 넣을 만하게 했다. */
  mouthWidthMm: 40,
  /** 입구 높이 = 벽 높이. */
  mouthHeightMm: 14,
  /** 골라인에서 안쪽으로 들어오는 깊이 = 옆벽·지붕의 깊이. */
  depthMm: 16,
  /** 옆벽 아래에서 바깥으로 접히는 발의 너비. */
  footDepthMm: 8,
  /** 지붕 좌우에서 아래로 접어 옆벽 안쪽에 붙이는 풀칠탭의 길이. */
  glueTabMm: 6,
} as const;

/** 전개도 한 벌의 외곽 크기. `artwork/goals.ts`가 이 값으로 배치한다. */
export const GOAL_NET_SIZE = {
  widthMm: GOAL.depthMm * 2 + GOAL.mouthWidthMm, // 72
  heightMm: GOAL.depthMm + GOAL.mouthHeightMm + GOAL.footDepthMm, // 38
} as const;

/** 공 마커 — 연필로 튕기는 납작한 원. */
export const BALL = {
  /** 오림선 지름. 오리기 쉽고 튕기기 좋은 크기로 잡았다(⚠︎ 종이 실측 대기). */
  diameterMm: 12,
  /** 시트에 배치할 때의 중심 간격. 가위가 지나갈 여유를 포함한다. */
  pitchMm: 16,
  columns: 6,
  rows: 4,
} as const;

/** 공 마커 시트 한 장에 들어가는 개수. */
export const BALL_COUNT = BALL.columns * BALL.rows;

/** 부속 파트 크기. */
export const SHEETS = {
  /** 점수 기록칸 — A5 가로. */
  scoreSheet: { widthMm: 210, heightMm: 148.5 },
  /** 게임 방법 — A5 세로. */
  rulesCard: { widthMm: 148.5, heightMm: 210 },
  /** 골대 전개도 2벌 + 조립 안내 — A5 가로. */
  goals: { widthMm: 210, heightMm: 148.5 },
  /** 공 마커 24개. */
  ballMarkers: { widthMm: 105, heightMm: 85 },
} as const;

/** 점수 기록칸 표 배치. 슬롯 좌표(`./index.ts`)가 이 값에서 나온다. */
export const SCORE_TABLE = {
  /** 오림선을 시트 가장자리에서 얼마나 안쪽에 두는지. */
  cutInsetMm: 5,
  xMm: 15,
  headerYMm: 26,
  headerHeightMm: 12,
  rowHeightMm: 8,
  rows: 12,
  /** 판 번호 열 너비. 나머지를 두 팀이 반씩 나눈다. */
  indexColumnMm: 30,
  teamColumnMm: 75,
  /** 헤더 위쪽에 얹는 팀 색 막대의 높이. */
  colorBarHeightMm: 2.5,
} as const;

export const SCORE_TABLE_WIDTH_MM =
  SCORE_TABLE.indexColumnMm + SCORE_TABLE.teamColumnMm * 2; // 180

/** 홈·원정 팀 열의 가운데 x. 팀 이름 슬롯이 여기 놓인다. */
export const scoreTeamColumnCenterXMm = (index: 0 | 1): number =>
  SCORE_TABLE.xMm +
  SCORE_TABLE.indexColumnMm +
  SCORE_TABLE.teamColumnMm * (index + 0.5);

/** 헤더 행에서 팀 이름 글자의 세로 중심. 색 막대 아래 남는 칸의 가운데다. */
export const SCORE_TEAM_NAME_Y_MM =
  SCORE_TABLE.headerYMm +
  SCORE_TABLE.colorBarHeightMm +
  (SCORE_TABLE.headerHeightMm - SCORE_TABLE.colorBarHeightMm) / 2;

/** 보드 위쪽 띠에 놓이는 팀 이름. 각 팀 진영의 가운데 위다. */
export const BOARD_TEAM_NAME = {
  yMm: FIELD.yMm / 2, // 7.5
  fontSizeMm: 7,
  maxWidthMm: 110,
} as const;

export const boardTeamNameXMm = (index: 0 | 1): number =>
  FIELD.xMm + (FIELD.widthMm / 4) * (index * 2 + 1); // 78.25 / 218.75

/**
 * 파트 id에 대응하는 정적 자산 경로.
 *
 * 도안 정의가 여기서 경로를 받는다 — 아트워크 생성기(`./artwork/`)에서 받아 오면
 * SVG를 짓는 코드가 통째로 앱 번들에 딸려 들어간다.
 */
export const artworkPath = (partId: string): string =>
  `/games/soccer/${partId}.svg`;

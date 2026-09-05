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
 * **보드를 거의 다 쓴다.** 사방 6mm만 남기는데, 재단 오차에도 라인이 잘리지
 * 않을 만큼이다. 예전에는 위아래 15mm를 띠로 떼어 팀 이름과 제목을 넣었지만
 * 그 글자들은 운동장에서 뺐다(2026-09-05) — 놀 면을 좁히면서까지 종이에 남길
 * 이유가 없었다. 팀 이름은 점수 기록칸에 남는다.
 *
 * 285×198은 가로세로비 1.439로 실제 축구장 100×69.5m에 해당한다. 국제 규정이
 * 정한 범위(길이 90–120m · 폭 45–90m) 안이면서, 보드(297×210, 비율 1.414)를
 * 가장 꽉 채우는 비율이다.
 */
export const FIELD = {
  xMm: 6,
  yMm: 6,
  widthMm: 285,
  heightMm: 198,
} as const;

export const FIELD_RIGHT_MM = FIELD.xMm + FIELD.widthMm; // 289
export const FIELD_BOTTOM_MM = FIELD.yMm + FIELD.heightMm; // 195
export const FIELD_CENTER_X_MM = FIELD.xMm + FIELD.widthMm / 2; // 148.5
export const FIELD_CENTER_Y_MM = FIELD.yMm + FIELD.heightMm / 2; // 105

/**
 * 필드 안 표시. 실제 축구장 치수를 약 **2.85mm/m**로 줄인 값이되, 좌표가 소수로
 * 흩어지지 않게 정수로 맞췄다(필드 285mm = 100m 기준).
 */
export const FIELD_MARKS = {
  /** 센터서클 반지름 (실제 9.15m). */
  centerCircleRadiusMm: 26,
  /** 센터 스팟·페널티 스팟 지름. */
  spotDiameterMm: 1.6,
  /** 페널티 에어리어 — 골라인에서의 깊이와 폭 (실제 16.5m × 40.32m). */
  penaltyAreaDepthMm: 47,
  penaltyAreaWidthMm: 115,
  /**
   * 골 에어리어 = **골키퍼가 서는 자리**. 실제(5.5×18.32m)보다 크게 잡았다.
   *
   * 골키퍼 마커가 이 안에 들어가야 하는데, 골대가 골라인 안쪽으로
   * `GOAL.depthMm`(16mm)를 차지하므로 마커는 그 앞에 선다. 마커 폭이 13mm라
   * 깊이가 최소 16 + 13 = 29mm는 되어야 마커가 골 에어리어를 벗어나지 않는다.
   * 32mm는 거기에 여유를 조금 더한 값이다(`__tests__/formations.test.ts`가 지킨다).
   *
   * 폭은 깊이에 맞춰 늘려 페널티 에어리어와 비슷한 인상(1:2.5)을 유지한다.
   */
  goalAreaDepthMm: 32,
  goalAreaWidthMm: 80,
  /** 페널티 스팟까지의 거리 (실제 11m). */
  penaltySpotDistanceMm: 31,
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

/**
 * 선수 마커 (IDE-010) — 원 + 등번호 / 일러스트 + 등번호 두 벌.
 *
 * 기준점은 두 벌 다 **마커 중심**이라 바꿔 끼워도 슬롯 좌표가 어긋나지 않는다.
 * 골키퍼는 같은 크기의 별도 스타일 세트(`goalkeeper-marker`)를 쓴다 — 크기는
 * 필드 선수와 같게 두어 겹침 판정과 프리셋 좌표가 그대로 통한다.
 *
 * 등번호 글자 크기는 두 벌을 같게 뒀다. 일러스트가 원보다 작으면 6절 가독성
 * 하한(2.5mm)을 필드의 minScale(0.5)에서 못 채운다 — 5mm × 0.5 = 2.5mm가
 * 정확히 하한이라 여유가 없다.
 */
export const PLAYER_MARKER = {
  circle: { widthMm: 12, heightMm: 12, valueFontSizeMm: 5 },
  illustration: { widthMm: 13, heightMm: 16, valueFontSizeMm: 5 },
} as const;

/**
 * 전술 대형이 쓰는 x 레인 (IDE-010).
 *
 * **두 팀은 필드 전체에 섞여 선다.** 각 팀이 자기 진영 절반만 차지하면 경기가
 * 성립하지 않는다 — 규칙상 패스는 자기 팀 선수에게만 닿고 슛도 공이 자기 팀
 * 선수 위에 있을 때만 되는데, 상대 골대 쪽에 자기 팀 선수가 하나도 없으면
 * 공을 앞으로 보낼 방법이 없다. 선수 마커는 운동장에 인쇄되어 움직이지 않으므로
 * 이 배치가 곧 경기 가능 여부다.
 *
 * 홈은 여기 적힌 x를, 원정은 `BOARD.widthMm - x`를 쓴다(`mirrorPositions`).
 * 그래서 두 팀이 쓰는 레인이 아래처럼 번갈아 놓인다:
 *
 *     홈    30    60           135         200 220
 *     원정          77    97          162        237 267
 *
 * **레인이 섞이되 서로 겹치지 않는다는 것이 이 값들의 존재 이유다.** 두 팀이
 * 서로 다른 대형을 골라도(4-4-2 대 3-5-2 등) 마커가 부딪히지 않는 근거가
 * "모든 대형이 이 다섯 레인만 쓴다"이기 때문이다. 값을 고칠 때는
 * `__tests__/formations.test.ts`가 지키는 최소 간격을 함께 본다.
 */
export const FORMATION_LANES = {
  /** 골키퍼. 종이 골대 바로 앞이면서 골 에어리어 안이다. */
  goalkeeper: 30,
  /** 수비 — 자기 진영(첫째 1/3). */
  defence: 60,
  /** 중원(둘째 1/3). 4-4-2·3-5-2·4-3-3의 미드필더가 여기 선다. */
  midfield: 135,
  /**
   * 공격형 미드필더 — **상대 진영(셋째 1/3)**이다. 4-2-3-1만 쓴다.
   *
   * 이름과 달리 중원이 아닌 이유는, 이 레인이 중원에 있으면 4-2-3-1이
   * 상대 진영에 공격수 한 명만 남겨 다른 대형(4-4-2는 2명, 4-3-3은 3명)보다
   * 앞이 헐거워지기 때문이다. 종이 위 선수는 움직이지 않으므로 각 1/3에
   * 사람이 있어야 그 구역에서 패스를 이어 갈 수 있다.
   */
  attackingMidfield: 200,
  /** 공격 — 상대 진영. 여기 선수가 있어야 슛 사거리가 나온다. */
  forward: 220,
} as const;

/** 원정 팀이 쓰는 레인. 홈 레인을 세로 중심선 기준으로 뒤집은 값이다. */
export const awayLaneXMm = (homeLaneXMm: number): number =>
  BOARD.widthMm - homeLaneXMm;

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

/**
 * 파트 id에 대응하는 정적 자산 경로.
 *
 * 도안 정의가 여기서 경로를 받는다 — 아트워크 생성기(`./artwork/`)에서 받아 오면
 * SVG를 짓는 코드가 통째로 앱 번들에 딸려 들어간다.
 */
export const artworkPath = (partId: string): string =>
  `/games/soccer/${partId}.svg`;

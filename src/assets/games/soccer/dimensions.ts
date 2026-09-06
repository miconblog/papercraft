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
 * 종이 골대 — 오려 접어 **골라인 바깥에** 세우는 바닥 없는 상자.
 *
 * 구조가 두 번 바뀌었다. 어느 쪽도 그냥 취향이 아니라 놀아 보고 나온 문제를
 * 고친 것이다:
 *
 * 1. 처음(2026-09-04)에는 골라인 **안쪽**에 서는 터널이었다. 골 판정 평면이
 *    골라인보다 16mm 안쪽에 생기고, 골대가 깔고 앉은 자리를 피하느라 골
 *    에어리어를 실제의 2배로 늘려야 했다.
 * 2. 그래서 깊이를 없애고 골라인 위에 서는 평면 ⊓ 프레임으로 바꿨는데
 *    (2026-09-05), 이번엔 **공이 골문을 순식간에 지나가 버려 골인지 아닌지
 *    보이지 않았다**(사용자 지적). 프레임은 공을 세워 주지 못한다.
 * 3. 지금은 다시 **바닥 없는 상자**다. 다만 골라인 **바깥**에 세워 필드 안
 *    공간을 쓰지 않는다 — 1번의 왜곡 없이 2번의 문제를 푼다. 골문을 지난
 *    공이 뒷벽에 막혀 상자 안에 멈추므로 득점이 눈에 남는다.
 *
 * 구조는 3번에서 멈췄고, 대신 **크기가 한 번 커졌다**(2026-09-06). 아이와 실제로
 * 뽑아 만들어 보니 골문이 너무 작아 골이 안 들어갔다(사용자 지적). 아래 각 값의
 * 주석에 어디서 그 크기가 나왔는지 적었다 — 요지는 **실제 골대 비율이 아니라 공
 * 지름**을 기준으로 다시 잡았다는 것이다.
 *
 * 바닥이 없는 이유는 그대로다. 바닥을 깔면 종이 두께만큼 턱이 생겨 미끄러져
 * 오는 공이 골문에서 걸린다. 상자가 종이 가장자리를 넘어가는 부분은 **내려가는**
 * 단차라 공이 걸리지 않는다.
 */
export const GOAL = {
  /**
   * 골문 폭. 실제 7.32m는 이 축척(2.85mm/m)으로 20.9mm지만, 지름 12mm 공이
   * 지나가야 해서 과장했다 — **공 지름의 4배**를 테스트가 지킨다.
   */
  mouthWidthMm: 52,
  /**
   * 크로스바 아래 높이 = **공 지름의 2배**.
   *
   * 39×13이던 때는 실제 골대(7.32×2.44m)의 3:1을 그대로 옮긴 값이었다. 그러면
   * 크로스바가 지름 12mm 공 **바로 1mm 위**에 걸린다 — 종이로 뽑아 놀아 보니
   * 공이 골문 앞에서 튕겨 나와 골이 안 들어갔다(2026-09-06 사용자 지적).
   *
   * 실제 비율은 공까지 같은 축척일 때만 뜻이 있는데, 이 공은 축척(0.6mm)보다
   * 19배 크다. 그러니 기준은 실제 골대가 아니라 **공**이어야 한다. 높이를 공
   * 지름의 2배로 두면 크로스바 아래로 공 하나가 통째로 더 지나갈 여유가 생긴다.
   * 폭 52 : 높이 26 = 2:1로, 정면에서 여전히 골대로 읽힌다.
   */
  mouthHeightMm: 26,
  /**
   * 골라인에서 뒤로 나가는 깊이 = 옆벽·지붕의 깊이.
   *
   * 지름 12mm 공이 온전히 들어가고도 남아야 "골대 안에 멈췄다"가 한눈에
   * 보인다. 골문이 커지면서 18mm로 같이 늘렸다 — 얕은 상자는 들어온 공을 도로
   * 뱉는다. 골라인 바깥 여백은 `FIELD.xMm`(6mm)뿐이라 나머지 12mm는 종이 밖
   * 책상 위에 놓이는데, 종이 → 책상은 내려가는 단차라 공이 걸리지 않는다.
   */
  depthMm: 18,
  /**
   * 옆벽 아래에서 바깥으로 접히는 발의 너비. 안쪽으로 접으면 턱이 생긴다.
   *
   * 벽이 13 → 26mm로 높아져 넘어지기 쉬워진 만큼 발도 8mm로 넓혔다.
   */
  footDepthMm: 8,
  /** 지붕 좌우에서 아래로 접어 옆벽 안쪽에 붙이는 풀칠탭의 길이. */
  glueTabMm: 6,
} as const;

/**
 * 지붕에 뚫는 창 — **위에서 공이 보이게 하는 구멍**이다.
 *
 * 지붕을 통째로 덮으면 공이 상자에 들어가도 내려다보는 사람 눈에는 안 보인다.
 * 그렇다고 지붕을 없애면 크로스바가 사라져 골대로 보이지 않고, 옆벽 둘을
 * 붙들어 줄 것도 없어진다. 그래서 테두리만 남기고 가운데를 오려냈다.
 *
 * 앞 테두리가 곧 **크로스바**라 다른 변보다 굵다. 전개도에서 지붕은 뒷벽 위에
 * 붙어 앞으로 접히므로, 여기서 "앞"은 전개도의 **위쪽**(뒷벽에서 먼 쪽) 변이다.
 */
export const GOAL_ROOF_WINDOW = {
  frontBarMm: 4,
  backBarMm: 3,
  sideBarMm: 4,
} as const;

export const GOAL_ROOF_WINDOW_SIZE = {
  widthMm: GOAL.mouthWidthMm - GOAL_ROOF_WINDOW.sideBarMm * 2, // 44
  depthMm:
    GOAL.depthMm - GOAL_ROOF_WINDOW.frontBarMm - GOAL_ROOF_WINDOW.backBarMm, // 11
} as const;

/** 전개도 한 벌의 외곽 크기. `artwork/goals.ts`가 이 값으로 배치한다. */
export const GOAL_NET_SIZE = {
  widthMm: GOAL.depthMm * 2 + GOAL.mouthWidthMm, // 88
  heightMm: GOAL.depthMm + GOAL.mouthHeightMm + GOAL.footDepthMm, // 52
} as const;

/**
 * 운동장에 찍는 **골대 자리 가이드** (2026-09-05 사용자 요청).
 *
 * 골대가 골라인 바깥에 서므로 종이 위에 놓을 자리가 보이지 않는다. 눈대중으로는
 * 가운데 맞추기가 어렵다 — 그래서 골포스트가 설 두 지점과 골문 한가운데를
 * 골라인에 걸친 짧은 눈금으로 찍는다.
 *
 * **눈금이 전부다.** 골대 바닥 넓이를 파선 상자로 그리던 때는 골 에어리어 안에
 * 사각형이 하나 더 겹쳐 골라인 근처가 삼중선이 됐다. 맞출 것은 앞면 좌우
 * 끝뿐이고, 뒤로 얼마나 나가는지는 맞출 필요가 없다.
 */
export const GOAL_GUIDE = {
  /** 눈금이 필드 **안쪽**으로 들어오는 길이. 놀 면을 어지럽히지 않을 만큼만. */
  insideMm: 2,
  /** 눈금이 골라인 **바깥**으로 나가는 길이. 종이 끝(6mm)에서 2mm 남긴다. */
  outsideMm: 4,
  /** 골문 한가운데 표시. 좌우 눈금보다 짧게 두어 골포스트와 헷갈리지 않는다. */
  centerInsideMm: 2.5,
} as const;

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
   * 골 에어리어 = **골키퍼가 서는 자리**. 깊이는 실제 5.5m 그대로다.
   *
   * 골대가 골라인 안쪽을 16mm 깔고 앉던 때는 골키퍼 마커가 그 앞에 서야 해서
   * 깊이를 32mm로 늘렸었다 — 실제의 2배다. 골대를 골라인 위로 옮겨 필드 안
   * 공간을 비우면서 실제 축척(5.5m ≈ 16mm)으로 되돌렸다(2026-09-05).
   *
   * 폭은 실제 정의(골포스트에서 좌우로 깊이만큼)를 그대로 따른다. 골문 폭이
   * 공 크기 때문에 과장되어 있으므로 실제 18.32m가 아니라 **지금 골문 폭**을
   * 기준으로 잡아야 골대와 선이 맞물려 보인다.
   */
  goalAreaDepthMm: 26,
  goalAreaWidthMm: 78,
  /** 페널티 스팟까지의 거리 (실제 11m). */
  penaltySpotDistanceMm: 31,
  /** 코너 아크 반지름 (실제 1m). */
  cornerArcRadiusMm: 3,
  /** 필드 라인 굵기. 표시선(오림·접기)과 달리 배율을 같이 먹는다. */
  lineWidthMm: 0.5,
} as const;

/**
 * 선수 마커 (IDE-010) — 빈 원 / 일러스트 두 벌.
 *
 * 기준점은 두 벌 다 **마커 중심**이라 바꿔 끼워도 슬롯 좌표가 어긋나지 않는다.
 * 골키퍼는 같은 크기의 별도 스타일 세트(`goalkeeper-marker`)를 쓴다 — 크기는
 * 필드 선수와 같게 두어 겹침 판정과 프리셋 좌표가 그대로 통한다.
 *
 * ## 크기를 20mm로 잡은 근거 (2026-09-05)
 *
 * 12 → 15 → 24 → **20mm**. 24mm는 사용자가 어릴 때 가지고 놀던 종이 축구판
 * 사진에서 잰 값이었는데(선수 그림이 필드 짧은 변의 약 1/8), 실제로 그려 놓고
 * 보니 커서 20mm로 되돌렸다(사용자 요청).
 *
 * 6–7세 아이가 원 안에 번호를 쓰고 색칠하는 판이라(사용자 요청) 손이 들어갈
 * 만해야 한다는 요구는 그대로다.
 *
 * 20mm는 **상한이 아니라 취향에 맞춘 값**이다. 지금 배치가 허용하는 상한은
 * 24mm이고, 그 여유는 두 곳에 남아 있다:
 *
 * - 레인 사이 최소 간격이 **26mm**다. 24mm를 담으려고 벌려 놓은 값이라 20mm에는
 *   6mm가 남는다. 되돌리지 않은 것은 마커 사이가 넉넉한 편이 아이 손에 낫기
 *   때문이다.
 * - 골 에어리어 깊이가 **26mm**다. 골키퍼 레인 x=19에서 `19 + 10 = 29`이므로
 *   3mm가 남는다.
 *
 * 일러스트는 18×22다. 원보다 조금 작게 둔다 — 두 변형은 같은 슬롯에 바꿔 끼우는
 * 것이라 크기가 비슷해야 배치 인상이 유지되고, 그림이 세로로 길어 원과 폭을
 * 맞추면 세로가 먼저 필드를 벗어난다. 겹침 판정은 둘 중 큰 쪽(원 20mm)이다.
 */
export const PLAYER_MARKER = {
  circle: { widthMm: 20, heightMm: 20, valueFontSizeMm: 7 },
  illustration: { widthMm: 18, heightMm: 22, valueFontSizeMm: 7 },
} as const;

/**
 * 선수 그림의 자세 (2026-09-06)
 *
 * 옛 인쇄본처럼 선수마다 다른 자세로 서게 한다 — 한 그림을 스물두 번 찍으면
 * 판이 심심하다(사용자 요청). 자세는 사용자가 고르는 값이 **아니고** 슬롯에
 * 역할로 배정된다(`./index.ts`의 `POSE_BY_PLAYER`).
 *
 * 여기에는 id와 이름만 둔다 — 관절 각도는 아트워크 생성기가 갖는다
 * (`./artwork/player-markers.ts`의 `POSE_ANGLES`). 도안 정의는 스타일 세트
 * id와 파일 이름을 지으려고 이 목록만 읽으면 되고, 그림 그리는 코드가 앱
 * 번들에 딸려 들어가지 않는다(`artworkPath`와 같은 이유다).
 */
export const MARKER_POSES = [
  { id: 'run', label: '달리기' },
  { id: 'sprint', label: '질주' },
  { id: 'strike', label: '슛' },
  { id: 'pass', label: '패스' },
  { id: 'header', label: '헤딩' },
  { id: 'block', label: '수비' },
] as const;

/** 골키퍼 자세. 필드 선수와 세트를 따로 쓰므로 목록에서 뺐다. */
export const GOALKEEPER_POSE = { id: 'save', label: '세이브' } as const;

/**
 * 자세가 쓰는 마커 스타일 세트 id.
 *
 * 마커 아트워크는 변형에, 변형은 세트에 붙는다. 그래서 슬롯마다 다른 그림을
 * 쓰려면 **자세마다 세트를 나누는 수밖에 없다**(`docs/game-authoring.md`).
 * 세트가 달라도 변형 id·크기는 같아 슬롯끼리 바꿔 끼워도 배치가 어긋나지 않는다.
 */
export const poseStyleSetId = (poseId: string): string =>
  poseId === GOALKEEPER_POSE.id
    ? 'goalkeeper-marker'
    : `player-marker-${poseId}`;

/** 스타일 세트 × 변형 → 아트워크 파일 id. 생성기와 도안 정의가 같이 읽는다. */
export const markerArtworkId = (poseId: string, variantId: string): string =>
  `${poseStyleSetId(poseId)}-${variantId}`;

/**
 * 전술 대형이 쓰는 x 레인 (IDE-010).
 *
 * **골키퍼를 뺀 열 명이 자기 진영에 다섯, 상대 진영에 다섯 선다**(2026-09-06
 * 사용자 요청). 그래서 필드를 반으로 가르면 어느 쪽이든 홈 다섯 · 원정 다섯 ·
 * 골키퍼 하나가 있다. 홈은 여기 적힌 x를, 원정은 `BOARD.widthMm - x`를 쓴다
 * (`mirrorPositions`).
 *
 * 레인은 열둘이고 홈·원정이 번갈아 쓴다. 홈은 여섯 쌍(a, 297−a)에서 하나씩
 * 골랐다 — 자기 진영에 골키퍼·수비·수비형 중원, 상대 진영에 중원·공격형
 * 중원·공격:
 *
 *     홈    19  45        114       160       206  229
 *     원정        68  91       137       183       252  278
 *                              ↑ 하프라인 148.5
 *
 * 이웃 레인은 23mm 떨어진다(양 끝만 26). 마커 폭 20mm보다 넓어 두 팀의 y가
 * 같아도 겹치지 않는다 — 이것이 "어떤 대형 조합을 골라도 겹치지 않는다"의
 * 근거이고 `__tests__/formations.test.ts`가 지킨다. 더 벌리고 싶어도 자리가
 * 없다: 골키퍼 사이 259mm에 레인 열둘이 들어가야 해서 간격 23이 상한이다.
 * 마커를 키우면(2026-09-05에 24mm까지 갔었다) 이 배치는 깨진다.
 *
 * 자기 진영 레인 둘 중 안쪽(수비형 중원)의 마커 오른쪽 끝이 124, 상대 진영
 * 첫 레인(중원)의 왼쪽 끝이 150이라 어느 마커도 하프라인을 물지 않는다.
 */
export const FORMATION_LANES = {
  /**
   * 골키퍼. 골문 바로 앞이면서 골 에어리어(깊이 26mm) 안이다 —
   * `19 + 10 = 29`가 골 에어리어 끝(32) 안이다.
   */
  goalkeeper: 19,
  /** 수비 — 자기 진영. */
  defence: 45,
  /** 수비형 중원 — 자기 진영. 대형마다 자기 진영 다섯을 채우는 한둘이 선다. */
  defensiveMidfield: 114,
  /** 중원 — 상대 진영 첫 레인. */
  midfield: 160,
  /** 공격형 중원 — 4-2-3-1의 3. */
  attackingMidfield: 206,
  /** 공격. */
  forward: 229,
} as const;

/** 원정 팀이 쓰는 레인. 홈 레인을 세로 중심선 기준으로 뒤집은 값이다. */
export const awayLaneXMm = (homeLaneXMm: number): number =>
  BOARD.widthMm - homeLaneXMm;

/**
 * 공 — 연필로 튕기는 납작한 원.
 *
 * 예전에는 24개짜리 **공 마커 시트**를 함께 뽑았지만 그 파트를 출력물에서 뺐다
 * (2026-09-05 사용자 요청). 지름은 남는다 — 골문 크기를 정한 근거가 이 값이고
 * (`지름 × 2 < 골문 폭`), 준비물 안내에도 "지름 12mm쯤"으로 나간다.
 */
export const BALL = {
  /** 오리기 쉽고 튕기기 좋은 크기로 잡았다(⚠︎ 종이 실측 대기). */
  diameterMm: 12,
} as const;

/** 부속 파트 크기. */
export const SHEETS = {
  /** 점수 기록칸 — A5 가로. */
  scoreSheet: { widthMm: 210, heightMm: 148.5 },
  /** 골대 전개도 2벌 + 조립 안내 — A5 가로. */
  goals: { widthMm: 210, heightMm: 148.5 },
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

/**
 * 헤더 행 글자의 세로 중심. 색 막대 아래 남는 칸의 가운데다.
 *
 * 팀 칸에는 글자를 찍지 않는다 — 팀 이름 슬롯을 뺐고(2026-09-06) 그 자리는
 * 아이가 직접 쓴다. 지금 이 y를 쓰는 글자는 왼쪽 "판" 머리글뿐이다.
 */
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

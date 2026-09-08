/**
 * 선수 마커 아트워크 — 빈 원 · 선수 그림(실루엣 · 윤곽선) (IDE-010)
 *
 * 마커 하나 = 스타일 세트 × 변형 조합이다. 세트는 **자세**를 고르고
 * (`player-marker-run` · `player-marker-strike` … · `goalkeeper-marker`),
 * 변형은 **모양**을 고른다(`circle` · `illustration` · `outline`). 세트가 달라도
 * 크기는 같다 — 슬롯끼리 자세를 바꿔도 겹침 판정과 프리셋 좌표가 그대로 통한다.
 *
 * ## 자세를 여러 개 두는 이유 (2026-09-06)
 *
 * 처음에는 달리는 그림 한 벌로 스물두 명을 다 찍었다. 옛 인쇄본(1절 ①)은
 * 선수마다 자세가 달라 판이 살아 보였는데 우리 판은 같은 그림이 줄지어 서
 * 심심했다(사용자 요청). 그래서 자세를 **뼈대에서 짓는다** — 아래
 * `POSES`가 관절 각도만 적고, `figureShapes`가 그 각도로 도형을 낸다. 자세를
 * 더할 때 도형을 새로 그리지 않고 각도 몇 개만 적으면 된다.
 *
 * 자세는 슬롯에 **역할로 배정한다**(`../index.ts`의 `POSE_BY_PLAYER`) — 사용자가
 * 고르는 값이 아니다. 골키퍼는 세이브, 수비는 낮은 자세, 공격은 슛이다.
 *
 * ## 실루엣과 윤곽선, 두 벌을 내는 이유
 *
 * 실루엣(`illustration`)은 팀 색으로 꽉 채운 그림이라 바로 쓴다. 윤곽선
 * (`outline`)은 같은 도형을 **속이 빈 채로** 낸다 — 6–7세 아이가 색칠하는
 * 판이라(사용자 요청) 그림도 칠할 수 있어야 한다는 요청이 있었다. 빈 원
 * 변형과 같은 규약이다: 테두리가 팀 색을 받고 속은 흰 종이로 남는다.
 *
 * 몸 부위를 **부위마다 닫힌 도형**으로 내는 것이 두 벌을 한 뼈대로 뽑는 열쇠다.
 * 실루엣에서는 색이 같아 이음매가 안 보이고, 윤곽선에서는 그 경계가 그대로
 * 팔·다리·유니폼 선이 된다(옛 인쇄본의 인물 그림도 이렇게 부위가 갈려 있다).
 * 뒤쪽 팔다리 → 몸통 → 앞쪽 팔다리 → 머리 차례로 그려, 흰 채움이 뒤 도형의
 * 안쪽 선을 덮는다.
 *
 * ## 흑백에서 팀과 골키퍼를 구분하는 법
 *
 * 팀 색이 명도가 비슷하면 흑백에서 구분되지 않는다. 그래서 색에 기대지 않는
 * 표식을 아트워크에 박아 둔다:
 *
 * - **팀** — 마커가 공격 방향을 본다. 홈은 그대로, 원정은 세로 중심선 기준으로
 *   **좌우 반전**해 쓴다(`group.mirrorMarkers` → 렌더러). 빈 원은 대칭이라
 *   방향을 실을 데가 없어 오른쪽에 화살촉을 붙이고, 선수 그림은 **자세 자체가
 *   비대칭**이라 화살촉 없이 몸이 방향을 말한다 — 발끝·머리·팔이 다 같은 쪽을
 *   가리킨다. 작은 삼각형을 발밑에 하나 더 붙여 봤지만 몸이 가리키는 방향과
 *   경쟁해 오히려 방향이 흐려졌다(2026-09-06).
 * - **골키퍼** — 빈 원은 안쪽에 테를 하나 더 둘러 과녁 모양을 만들고, 선수
 *   그림은 장갑 낀 손과 세이브 자세로 필드 선수와 다른 실루엣이 된다.
 *
 * 등번호는 여기서 그리지 않는다. 슬롯 값이라 렌더러가 `valueFontSizeMm` 크기로
 * 얹는다(`docs/game-authoring.md` — "아트워크가 값을 직접 그려 넣지 않는다").
 * 기본값이 비어 있어 평소에는 아무것도 얹히지 않는다.
 */
import {
  GOALKEEPER_POSE as GOALKEEPER_POSE_META,
  MARKER_POSES,
  markerArtworkId,
  PLAYER_MARKER,
  poseStyleSetId,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  circle,
  group,
  num,
  path,
  svgDocument,
} from '../../../shared/svg.ts';
import {
  MARKER_TEAM_LAYER_ID,
  PAPER,
  TEAM_COLOR_PLACEHOLDER,
  drawShape,
  figureModeAttrs,
  fitToBox,
  limbShape,
  mittShape,
  normal,
  off,
  rotateAbout,
  shoeShape,
  step,
  tubeShape,
  type FigureMode,
  type Limb,
  type Pt,
  type Shape,
} from '../../../shared/figure.ts';

/**
 * 빈 원의 테두리 굵기. 아이가 원 안을 색칠할 때 경계가 남을 만큼 굵게 잡았다 —
 * 예전 채워진 마커는 0.4mm였다.
 */
const OUTLINE_MM = 0.7;

/**
 * 선수 그림 윤곽선의 굵기. 원보다 가늘다 — 손·양말·앞머리처럼 1mm 안팎의
 * 부위가 있어 0.7mm를 두르면 그 부위가 선으로 메워진다. 필드 최소 배율(0.5)에서
 * 0.23mm로 인쇄 하한(`MIN_STROKE_MM` 0.12)보다 넉넉히 위다.
 */
const FIGURE_OUTLINE_MM = 0.45;

/**
 * 화살촉이 원 밖으로 나가는 길이.
 *
 * 원이 12mm에서 15mm로 커지면서(2026-09-05) 예전 값 1.1mm는 상대적으로 작아져
 * 방향이 눈에 안 들어왔다. 빈 원은 채움도 자세도 없어 팀을 알려 주는 것이
 * **이 화살촉뿐**이라 같이 키웠다. 원 반지름 + 이 값 = 마커 폭의 절반이다.
 */
const WEDGE_REACH_MM = 1.5;

const CIRCLE = PLAYER_MARKER.circle;
const ILLUSTRATION = PLAYER_MARKER.illustration;

const point = (
  cxMm: number,
  cyMm: number,
  rMm: number,
  angleDeg: number,
): readonly [number, number] => {
  const rad = (angleDeg * Math.PI) / 180;
  return [cxMm + rMm * Math.cos(rad), cyMm + rMm * Math.sin(rad)];
};

/**
 * 공격 방향 화살촉의 세 꼭짓점 — 밑변 둘은 원 위, 꼭지점은 그보다 살짝
 * 바깥이다. 마커 폭 안(20mm)에 들어가도록 반지름을 눌러 잡았다. 각도를 ±26°로
 * 벌려 밑변을 넓혔다 — 빈 원에서는 이 삼각형이 팀을 알려 주는 유일한 표식이라
 * 작으면 방향이 안 읽힌다.
 *
 * 테스트가 이 좌표로 "화살촉이 세로 중심선 기준 비대칭인가"를 확인한다 —
 * 대칭이면 좌우 반전해도 원정 마커가 홈과 똑같이 보여 팀이 구분되지 않는다.
 */
export const attackWedgePoints = (
  cxMm: number,
  cyMm: number,
  circleRadiusMm: number,
): ReadonlyArray<readonly [number, number]> => [
  point(cxMm, cyMm, circleRadiusMm, -26),
  point(cxMm, cyMm, circleRadiusMm + WEDGE_REACH_MM, 0),
  point(cxMm, cyMm, circleRadiusMm, 26),
];

/** 화살촉. 부모 레이어의 팀 색 채움을 물려받는 면이다. */
const wedgePath = (
  cxMm: number,
  cyMm: number,
  circleRadiusMm: number,
): string => {
  const [a, b, c] = attackWedgePoints(cxMm, cyMm, circleRadiusMm);
  return path(
    `M ${num(a[0])} ${num(a[1])} L ${num(b[0])} ${num(b[1])} L ${num(c[0])} ${num(c[1])} Z`,
    { stroke: 'none' },
  );
};

/**
 * 원 반지름. 화살촉이 그만큼 더 나가므로 `반지름 + WEDGE_REACH_MM = 폭/2`다 —
 * 마커 상자를 꽉 채우면서 화살촉이 잘리지 않는 값이다.
 */
const CIRCLE_RADIUS_MM = CIRCLE.widthMm / 2 - WEDGE_REACH_MM;

/**
 * 원형 변형 하나를 짓는다. `ringRadiusMm`이 있으면 안쪽에 테를 더해 골키퍼로
 * 만든다.
 *
 * 채움은 **흰색**이다. `none`으로 두면 밑에 깔린 운동장 라인이 원을 가로질러
 * 비쳐 아이가 색칠할 면이 지저분해진다.
 */
const renderCircleVariant = (title: string, ringRadiusMm?: number): string => {
  const cxMm = CIRCLE.widthMm / 2;
  const cyMm = CIRCLE.heightMm / 2;

  return svgDocument({
    widthMm: CIRCLE.widthMm,
    heightMm: CIRCLE.heightMm,
    title,
    children: [
      group({ id: ART_LAYER_ID }, [
        // 테두리·안쪽 테·화살촉이 한 레이어다 — 셋 다 팀 색을 받아야
        // 마커 하나가 한 팀으로 읽힌다. 채움은 흰색으로 못 박아 둔다.
        group(
          {
            id: MARKER_TEAM_LAYER_ID,
            stroke: TEAM_COLOR_PLACEHOLDER,
            fill: TEAM_COLOR_PLACEHOLDER,
          },
          [
            // 속은 **흰색으로 못 박는다** — 레이어의 채움을 물려받으면 아이가
            // 칠할 면이 팀 색으로 메워진다.
            circle(cxMm, cyMm, CIRCLE_RADIUS_MM, {
              fill: PAPER,
              'stroke-width': OUTLINE_MM,
            }),
            ...(ringRadiusMm
              ? [
                  circle(cxMm, cyMm, ringRadiusMm, {
                    fill: 'none',
                    'stroke-width': OUTLINE_MM * 0.7,
                  }),
                ]
              : []),
            // 화살촉은 면이라 레이어의 채움을 그대로 물려받는다.
            wedgePath(cxMm, cyMm, CIRCLE_RADIUS_MM),
          ],
        ),
      ]),
    ],
  });
};

export const renderPlayerMarkerCircle = (): string =>
  renderCircleVariant('축구 게임판 · 선수 마커 · 빈 원');

/** 골키퍼는 안쪽 테로 구분한다. 아이가 칠할 면은 두 테 사이에 남는다. */
export const renderGoalkeeperMarkerCircle = (): string =>
  renderCircleVariant(
    '축구 게임판 · 골키퍼 마커 · 빈 원',
    CIRCLE_RADIUS_MM * 0.6,
  );

/* ------------------------------------------------------------------ *
 * 선수 그림 — 뼈대에서 짓는다
 * ------------------------------------------------------------------ */

/**
 * 몸 비율. 전부 마커 상자(18×22mm) 안의 mm다 — 다만 상자에 넣는 것은
 * `fitToBox`가 하므로 여기 값은 **서로의 비율**로만 뜻이 있다.
 *
 * 옛 인쇄본(`docs/soccer-artwork.md` 1절 ①)의 아이들처럼 머리가 크고 팔다리가
 * 짧은 비율이다(2026-09-06 사용자 요청 — "좀더 양질의 퀄러티로"). 머리 지름이
 * 키의 1/4쯤이라 5mm 남짓한 그림에서도 사람으로 읽힌다.
 */
const BODY = {
  headRadiusMm: 2.55,
  /** 머리카락은 머리보다 조금 크게 덮는다 — 실루엣에서는 머리가 살짝 커지고, 윤곽선에서는 헤어라인이 생긴다. */
  hairRadiusMm: 2.85,
  /** 목 폭. 길이는 머리와 어깨 사이를 채우는 만큼이다. */
  neckWidthMm: 1.35,
  /** 어깨선 y. 기울기(`leanDeg`)는 엉덩이를 축으로 이 선을 돌린다. */
  shoulderYMm: 7.2,
  hipYMm: 12.1,
  shoulderHalfMm: 2.55,
  /** 셔츠 밑단 반폭. 어깨보다 좁아 허리가 생긴다. */
  hemHalfMm: 2.15,
  hipHalfMm: 1.7,
  upperArmMm: 2.9,
  forearmMm: 2.7,
  /** 팔은 어깨에서 손목으로 가늘어진다. */
  armRootMm: 1.45,
  armTipMm: 1.1,
  handMm: 0.78,
  /** 반팔 소매 — 위팔 위에 얹는 짧은 통. 윤곽선에서 소매선이 된다. */
  sleeveMm: 1.6,
  sleeveExtraMm: 0.5,
  thighMm: 3.5,
  shinMm: 3.4,
  legRootMm: 2.05,
  legTipMm: 1.5,
  /** 반바지가 허벅지를 덮는 비율. */
  shortsRatio: 0.55,
  shortsExtraMm: 0.55,
  /** 양말이 정강이를 덮는 비율(발목에서부터). */
  sockRatio: 0.48,
  sockExtraMm: 0.18,
  shoeLengthMm: 2.35,
  shoeHeelMm: 0.6,
  shoeHeightMm: 1.15,
  /** 골키퍼 장갑 한 변. 손보다 커서 필드 선수와 실루엣이 갈린다. */
  gloveMm: 2,
} as const;

/**
 * 자세 하나. 이름은 `../dimensions.ts`의 목록에서 오고, 여기 있는 각도가 그림을
 * 만든다.
 */
interface Pose {
  readonly id: string;
  readonly label: string;
  /** 상체 기울기. 양수면 앞(공격 방향)으로 숙인다. */
  readonly leanDeg: number;
  /** 뒤쪽(공격 방향 반대편) 팔다리 — 먼저 그려 몸통 뒤로 들어간다. */
  readonly backArm: Limb;
  readonly backLeg: Limb;
  readonly frontArm: Limb;
  readonly frontLeg: Limb;
  /** 손끝에 장갑을 얹는다. 골키퍼 전용이다. */
  readonly gloves?: boolean;
}

type PoseAngles = Omit<Pose, 'id' | 'label'>;

/**
 * 자세별 관절 각도.
 *
 * 눈으로 맞춘 값이다 — 뽑아 보고 고칠 때는 자세 하나의 숫자만 건드리면 되고
 * 도형 코드는 그대로다. 어느 자세든 **발끝·머리·팔이 공격 방향(오른쪽)을
 * 향하는 것**이 규칙이다. 이걸 어기면 흑백에서 팀이 뒤집혀 읽힌다 — 두 팀을
 * 가르는 것이 좌우 반전뿐이기 때문이다.
 */
const POSE_ANGLES: Readonly<Record<string, PoseAngles>> = {
  /** 달리기 — 팔다리를 엇갈려 흔든다. 가장 무난해 중원에 많이 쓴다. */
  run: {
    leanDeg: 8,
    backArm: { upperDeg: 122, lowerDeg: 168 },
    backLeg: { upperDeg: 118, lowerDeg: 152 },
    frontArm: { upperDeg: 58, lowerDeg: 2 },
    frontLeg: { upperDeg: 52, lowerDeg: 96 },
  },
  /** 질주 — 보폭과 상체 기울기를 키운 달리기다. */
  sprint: {
    leanDeg: 18,
    backArm: { upperDeg: 134, lowerDeg: 170 },
    backLeg: { upperDeg: 132, lowerDeg: 150 },
    frontArm: { upperDeg: 44, lowerDeg: -18 },
    frontLeg: { upperDeg: 44, lowerDeg: 34 },
  },
  /** 슛 — 차는 다리를 앞으로 크게 뻗고 상체는 뒤로 젖힌다. */
  strike: {
    leanDeg: -8,
    backArm: { upperDeg: 152, lowerDeg: 188 },
    backLeg: { upperDeg: 100, lowerDeg: 94 },
    frontArm: { upperDeg: 16, lowerDeg: -30 },
    frontLeg: { upperDeg: 36, lowerDeg: 16 },
  },
  /** 패스 — 디딤발을 세우고 반대 발을 앞으로 낮게 내민다. */
  pass: {
    leanDeg: 5,
    backArm: { upperDeg: 142, lowerDeg: 152 },
    backLeg: { upperDeg: 96, lowerDeg: 90 },
    frontArm: { upperDeg: 48, lowerDeg: 28 },
    frontLeg: { upperDeg: 60, lowerDeg: 52 },
  },
  /** 헤딩 — 다리를 뒤로 접어 뛰어오른 모습이다. 팔은 위로 벌린다. */
  header: {
    leanDeg: -10,
    backArm: { upperDeg: 214, lowerDeg: 242 },
    backLeg: { upperDeg: 126, lowerDeg: 158 },
    frontArm: { upperDeg: -32, lowerDeg: -58 },
    frontLeg: { upperDeg: 104, lowerDeg: 138 },
  },
  /** 수비 — 무릎을 굽혀 낮게 벌려 선다. 팔은 균형을 잡느라 벌어진다. */
  block: {
    leanDeg: 14,
    backArm: { upperDeg: 152, lowerDeg: 118 },
    backLeg: { upperDeg: 128, lowerDeg: 86 },
    frontArm: { upperDeg: 34, lowerDeg: 66 },
    frontLeg: { upperDeg: 56, lowerDeg: 100 },
  },
  /** 세이브 — 골키퍼. 한 팔은 위로, 한 팔은 옆으로 뻗고 장갑을 낀다. */
  save: {
    leanDeg: 6,
    backArm: { upperDeg: 156, lowerDeg: 178 },
    backLeg: { upperDeg: 124, lowerDeg: 88 },
    frontArm: { upperDeg: -34, lowerDeg: -56 },
    frontLeg: { upperDeg: 58, lowerDeg: 100 },
    gloves: true,
  },
};

const poseOf = (meta: {
  readonly id: string;
  readonly label: string;
}): Pose => {
  const angles = POSE_ANGLES[meta.id];
  if (!angles) throw new Error(`자세 각도가 없다: ${meta.id}`);
  return { ...meta, ...angles };
};

/** 필드 선수 자세. 슬롯 배정은 `../index.ts`가 한다. */
export const PLAYER_POSES: readonly Pose[] = MARKER_POSES.map(poseOf);

/** 골키퍼 자세. */
export const GOALKEEPER_POSE: Pose = poseOf(GOALKEEPER_POSE_META);

/**
 * 머리카락. 머리 위를 덮는 반달에 앞머리 두 갈래를 냈다.
 *
 * 실루엣에서는 머리와 한 덩어리라 머리가 위로 조금 커질 뿐이고, 윤곽선에서는
 * 헤어라인이 드러나 얼굴이 생긴다 — 눈·입은 5mm 머리에 0.45mm 선으로 찍으면
 * 얼룩이 되므로 그리지 않는다. 앞머리가 오른쪽(보는 쪽)에 있다.
 */
const hairShape = (head: Pt): Shape => {
  const r = BODY.headRadiusMm;
  const R = BODY.hairRadiusMm;
  const c: Pt = [head[0] + 0.1, head[1] - 0.15];
  const arc: Pt[] = [];
  for (let deg = 196; deg <= 344; deg += 18.5) {
    arc.push(step(c, deg, R));
  }
  return {
    kind: 'poly',
    points: [
      ...arc,
      // 앞머리 — 이마를 두 갈래로 덮는다.
      [head[0] + r * 0.72, head[1] + r * 0.02],
      [head[0] + r * 0.32, head[1] - r * 0.4],
      [head[0] - r * 0.05, head[1] - r * 0.08],
      [head[0] - r * 0.45, head[1] - r * 0.42],
      [head[0] - r * 0.82, head[1] - r * 0.12],
    ],
    roundMm: 0.3,
  };
};

/**
 * 자세 하나의 도형들 — **뒤에서 앞으로** 차례대로다.
 *
 * 윤곽선 변형에서는 나중 도형의 흰 채움이 앞 도형의 안쪽 선을 덮으므로, 이
 * 차례가 곧 "무엇이 무엇 위에 있는가"다: 뒤쪽 팔다리 → 앞쪽 다리 → 반바지 →
 * 목 → 셔츠 → 앞쪽 팔 → 머리 → 머리카락. 옷(소매·반바지·양말)은 살 위에 얹혀
 * 옷 경계선이 되고, 실루엣에서는 색이 같아 전부 한 덩어리로 녹는다.
 */
const figureShapes = (pose: Pose): Shape[] => {
  const cxMm = ILLUSTRATION.widthMm / 2;
  const hip: Pt = [cxMm, BODY.hipYMm];
  const lean = (p: Pt): Pt => rotateAbout(p, hip, pose.leanDeg);

  const backShoulder = lean([cxMm - BODY.shoulderHalfMm, BODY.shoulderYMm]);
  const frontShoulder = lean([cxMm + BODY.shoulderHalfMm, BODY.shoulderYMm]);
  const neckBase = lean([cxMm, BODY.shoulderYMm]);
  const head = lean([cxMm, BODY.shoulderYMm - BODY.headRadiusMm - 0.35]);
  const backHip: Pt = [cxMm - BODY.hipHalfMm, hip[1]];
  const frontHip: Pt = [cxMm + BODY.hipHalfMm, hip[1]];

  const arm = (root: Pt, limb: Limb) =>
    limbShape(
      root,
      limb,
      BODY.upperArmMm,
      BODY.forearmMm,
      BODY.armRootMm,
      BODY.armTipMm,
    );
  const leg = (root: Pt, limb: Limb) =>
    limbShape(
      root,
      limb,
      BODY.thighMm,
      BODY.shinMm,
      BODY.legRootMm,
      BODY.legTipMm,
    );

  const backArm = arm(backShoulder, pose.backArm);
  const frontArm = arm(frontShoulder, pose.frontArm);
  const backLeg = leg(backHip, pose.backLeg);
  const frontLeg = leg(frontHip, pose.frontLeg);

  const sleeve = (root: Pt, limb: Limb): Shape =>
    tubeShape(
      step(root, limb.upperDeg, -0.35),
      limb.upperDeg,
      BODY.sleeveMm,
      BODY.armRootMm + BODY.sleeveExtraMm,
      0.5,
    );
  const hand = (l: { readonly tip: Pt }): Shape =>
    pose.gloves
      ? mittShape(l.tip, BODY.gloveMm)
      : { kind: 'disc', center: l.tip, radiusMm: BODY.handMm };
  const sock = (l: { readonly tip: Pt }, limb: Limb): Shape =>
    tubeShape(
      l.tip,
      limb.lowerDeg + 180,
      BODY.shinMm * BODY.sockRatio,
      BODY.legTipMm + BODY.sockExtraMm,
      0.4,
    );

  // 반바지 — 허리 판에 가랑이 둘을 한 도형으로 이었다. 허벅지가 어느 쪽으로
  // 뻗든 바깥선이 허리에서 가랑이 끝까지 이어진다.
  const shortsLeg = (root: Pt, limb: Limb): readonly [Pt, Pt] => {
    const end = step(root, limb.upperDeg, BODY.thighMm * BODY.shortsRatio);
    const n = normal(root, end);
    const half = (BODY.legRootMm + BODY.shortsExtraMm) / 2;
    const a = off(end, n, half);
    const b = off(end, n, -half);
    // [바깥쪽, 안쪽] — 앞다리는 x가 큰 쪽이 바깥, 뒷다리는 작은 쪽이 바깥이다.
    return root[0] >= cxMm
      ? a[0] >= b[0]
        ? [a, b]
        : [b, a]
      : a[0] <= b[0]
        ? [a, b]
        : [b, a];
  };
  const [frontOuter, frontInner] = shortsLeg(frontHip, pose.frontLeg);
  const [backOuter, backInner] = shortsLeg(backHip, pose.backLeg);
  const waistHalf = BODY.hipHalfMm + BODY.shortsExtraMm * 0.7;
  const shorts: Shape = {
    kind: 'poly',
    points: [
      [cxMm - waistHalf, hip[1] - 0.8],
      [cxMm + waistHalf, hip[1] - 0.8],
      frontOuter,
      frontInner,
      [cxMm, hip[1] + 0.9],
      backInner,
      backOuter,
    ],
    roundMm: 0.35,
  };

  // 셔츠 — 어깨가 넓고 밑단이 좁은 사다리꼴. 어깨선만 기울어 상체가 숙는다.
  // 밑단은 반바지 위로 살짝 내려온다.
  const shirt: Shape = {
    kind: 'poly',
    points: [
      backShoulder,
      frontShoulder,
      [cxMm + BODY.hemHalfMm, hip[1] + 0.35],
      [cxMm - BODY.hemHalfMm, hip[1] + 0.35],
    ],
    roundMm: 0.75,
  };

  const neck: Shape = {
    kind: 'poly',
    points: (() => {
      const n = normal(neckBase, head);
      const half = BODY.neckWidthMm / 2;
      return [
        off(neckBase, n, half),
        off(head, n, half),
        off(head, n, -half),
        off(neckBase, n, -half),
      ];
    })(),
    roundMm: 0,
  };

  return [
    backArm.shape,
    sleeve(backShoulder, pose.backArm),
    hand(backArm),
    backLeg.shape,
    sock(backLeg, pose.backLeg),
    shoeShape(backLeg.tip, pose.backLeg.lowerDeg, BODY),
    frontLeg.shape,
    sock(frontLeg, pose.frontLeg),
    shoeShape(frontLeg.tip, pose.frontLeg.lowerDeg, BODY),
    shorts,
    neck,
    shirt,
    frontArm.shape,
    sleeve(frontShoulder, pose.frontArm),
    hand(frontArm),
    { kind: 'disc', center: head, radiusMm: BODY.headRadiusMm },
    hairShape(head),
  ];
};

/**
 * 그림 모양. 값이 곧 변형 id다(`../index.ts`의 스타일 세트) — 파일 이름도
 * 여기서 나오므로 셋이 어긋날 자리가 없다. 실제 정의는 공용 엔진에 있다.
 */
export type { FigureMode };

/**
 * 선수 그림 한 벌. 실루엣은 채움으로, 윤곽선은 테두리로 팀 색을 받는다 —
 * 레이어 하나가 `fill`과 `stroke`를 둘 다 받으므로 두 변형이 같은 규약을 쓴다.
 */
const renderFigureVariant = (
  pose: Pose,
  mode: FigureMode,
  title: string,
): string =>
  svgDocument({
    widthMm: ILLUSTRATION.widthMm,
    heightMm: ILLUSTRATION.heightMm,
    title,
    children: [
      group({ id: ART_LAYER_ID }, [
        group(
          {
            id: MARKER_TEAM_LAYER_ID,
            fill: TEAM_COLOR_PLACEHOLDER,
            stroke: mode === 'illustration' ? 'none' : TEAM_COLOR_PLACEHOLDER,
          },
          fitToBox(figureShapes(pose), ILLUSTRATION, FIGURE_OUTLINE_MM).map(
            (shape) =>
              drawShape(shape, figureModeAttrs(mode, FIGURE_OUTLINE_MM)),
          ),
        ),
      ]),
    ],
  });

/** 자세 id → 자세. 골키퍼도 여기 들어간다. */
export const POSE_BY_ID: ReadonlyMap<string, Pose> = new Map(
  [...PLAYER_POSES, GOALKEEPER_POSE].map((p) => [p.id, p]),
);

/**
 * 자세 하나를 두 모양으로 낸다. 아트워크 등록(`./index.ts`)과 도안 정의
 * (`../index.ts`)가 같은 함수를 보고 파일 이름을 맞춘다.
 */
export const renderFigure = (poseId: string, mode: FigureMode): string => {
  const pose = POSE_BY_ID.get(poseId);
  if (!pose) throw new Error(`없는 자세다: ${poseId}`);
  const shape = mode === 'illustration' ? '실루엣' : '윤곽선';
  const who = pose.gloves ? '골키퍼' : '선수';
  return renderFigureVariant(
    pose,
    mode,
    `축구 게임판 · ${who} 마커 · ${pose.label} · ${shape}`,
  );
};

/** 스타일 세트 × 변형 → 아트워크 id. 치수 파일이 정한 이름을 그대로 쓴다. */
export const figureArtworkId = (poseId: string, mode: FigureMode): string =>
  markerArtworkId(poseId, mode);

export { poseStyleSetId };

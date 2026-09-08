/**
 * 선수 마커 아트워크 — 빈 원 · 선수 그림(실루엣 · 윤곽선) (IDE-014)
 *
 * 축구 게임판이 쓰던 뼈대 엔진(`assets/shared/figure.ts`)을 그대로 쓴다. 관절
 * 각도만 적으면 도형이 나오므로, 야구가 새로 낸 것은 **각도표와 야구 소품**
 * 뿐이다 — 모자·글러브·긴 바지가 그것이고, 이 셋이 같은 뼈대를 축구 선수가
 * 아닌 야구 선수로 보이게 한다. 배트를 든 타자 자세도 있었으나 타자를
 * 그라운드에서 빼면서 같이 걷어 냈다(2026-09-08 사용자 요청).
 *
 * ## 자세가 곧 포지션이다
 *
 * 마커 하나 = 스타일 세트 × 변형이다. 세트는 **자세**를 고르고(`marker-pitch` ·
 * `marker-run` …), 변형은 **모양**을 고른다(`circle` · `illustration` ·
 * `outline`). 자세는 슬롯에 역할로 배정된다(`../index.ts`의 `DEFENSE_POSITIONS`) —
 * 투수는 투구, 유격수는 달리기, 중견수는 뜬공을 쫓는다. 사용자가 고르는 것은
 * 모양뿐이라 선택 슬롯 하나가 여덟 자리를 동시에 바꾼다.
 *
 * ## 편은 판이 아니라 스탠드에서 갈린다
 *
 * 판에 서는 것은 **수비 여덟뿐**이다(2026-09-08 포수·타자를 그라운드에서 뺐다).
 * 그래서 축구처럼 좌우 반전으로 편을 가를 일도, 흑백에서 공수를 가를 표식도
 * 필요 없다 — 손에 든 것은 전부 글러브이고, 빈 원도 한 가지뿐이다. 두 팀이
 * 색으로 갈리는 자리는 오려 세우는 선수 스탠드다(`./stands.ts`).
 *
 * 등번호는 여기서 그리지 않는다. 슬롯 값이라 렌더러가 `valueFontSizeMm` 크기로
 * 얹는다(`docs/game-authoring.md` — "아트워크가 값을 직접 그려 넣지 않는다").
 * 기본값이 비어 있어 평소에는 아무것도 얹히지 않는다.
 */
import {
  FIELDER_POSES,
  STAND_ONLY_POSES,
  markerArtworkId,
  PLAYER_MARKER,
  poseStyleSetId,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  circle,
  group,
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

/** 빈 원의 테두리 굵기. 축구 게임판과 같은 값이라 두 판의 마커가 같은 무게로 찍힌다. */
const OUTLINE_MM = 0.7;

/** 선수 그림 윤곽선의 굵기. 손·양말처럼 1mm 안팎의 부위가 메워지지 않는 선이다. */
const FIGURE_OUTLINE_MM = 0.45;

const CIRCLE = PLAYER_MARKER.circle;
const ILLUSTRATION = PLAYER_MARKER.illustration;

/**
 * 원 반지름. 야구 원에는 방향을 가리키는 화살촉이 없어(편이 위치로 갈리지
 * 않는다) 상자를 꽉 채운다 — 테두리가 잘리지 않을 만큼만 안으로 물린다.
 */
const CIRCLE_RADIUS_MM = CIRCLE.widthMm / 2 - OUTLINE_MM;

/**
 * 원형 변형 하나. `ringRadiusMm`이 있으면 안쪽에 테를 더해 타자로 만든다.
 *
 * 채움은 **흰색**이다. `none`으로 두면 밑에 깔린 야구장 라인이 원을 가로질러
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
          ],
        ),
      ]),
    ],
  });
};

export const renderFielderMarkerCircle = (): string =>
  renderCircleVariant('야구 게임판 · 수비 마커 · 빈 원');

/* ------------------------------------------------------------------ *
 * 선수 그림 — 뼈대에서 짓는다
 * ------------------------------------------------------------------ */

/**
 * 몸 비율. 전부 마커 상자(20×22mm) 안의 mm다 — 다만 상자에 넣는 것은
 * `fitToBox`가 하므로 여기 값은 **서로의 비율**로만 뜻이 있다.
 *
 * 축구 선수와 같은 머리 큰 비율을 쓴다(옛 인쇄본의 아이 그림). 다른 것은
 * 아래 넷이고, 그 넷이 야구 유니폼을 만든다:
 *
 * - `pantsRatio` 0.92 — 무릎 아래까지 오는 반바지(니커보커스). 축구는 0.55다.
 * - `sockRatio` 0.9 — 바지가 끝나는 곳부터 발목까지 스타킹이 덮는다.
 * - `capRadiusMm` — 머리카락 대신 모자. 챙이 보는 쪽으로 뻗는다.
 * - `gloveMm` — 축구 골키퍼 장갑(2mm)보다 크다. 야구 글러브는 손보다 훨씬 크고,
 *   그 크기가 흑백에서 수비를 알아보게 하는 표식이다.
 */
const BODY = {
  headRadiusMm: 2.55,
  neckWidthMm: 1.35,
  shoulderYMm: 7.2,
  hipYMm: 12.1,
  shoulderHalfMm: 2.55,
  hemHalfMm: 2.15,
  hipHalfMm: 1.7,
  upperArmMm: 2.9,
  forearmMm: 2.7,
  armRootMm: 1.45,
  armTipMm: 1.1,
  handMm: 0.78,
  sleeveMm: 1.6,
  sleeveExtraMm: 0.5,
  thighMm: 3.5,
  shinMm: 3.4,
  legRootMm: 2.05,
  legTipMm: 1.5,
  /** 바지가 허벅지를 덮는 비율. 야구 바지는 무릎 아래에서 끝난다. */
  pantsRatio: 0.92,
  pantsExtraMm: 0.6,
  /** 스타킹이 정강이를 덮는 비율(발목에서부터). */
  sockRatio: 0.9,
  sockExtraMm: 0.18,
  shoeLengthMm: 2.35,
  shoeHeelMm: 0.6,
  shoeHeightMm: 1.15,
  /** 모자 돔 반지름. 머리보다 조금 커서 눌러쓴 모양이 된다. */
  capRadiusMm: 2.9,
  /** 챙이 머리 밖으로 뻗는 길이. */
  capBrimMm: 1.9,
  capBrimThickMm: 0.75,
  /** 글러브 한 변. */
  gloveMm: 2.9,
  /** 글러브를 손끝에서 손목 쪽으로 물리는 길이. */
  gloveGripMm: 0.5,
  /**
   * 포수 보호 장비(2026-09-08 사용자 요청). 정면으로 앉은 포수만 쓴다.
   *
   * `maskRadiusMm`는 머리(2.55)보다 커서 머리를 덮는 헬멧이 되고, 그 위에 얹는
   * 그물(`cage*`)이 얼굴 자리를 가린다 — 얼굴을 그리지 않는 이 그림에서 포수를
   * 포수로 만드는 것은 **그물과 보호대의 실루엣**뿐이다.
   */
  maskRadiusMm: 3.05,
  cageHalfWidthMm: 2.05,
  cageTopMm: -0.65,
  cageBottomMm: 2.45,
  cageBarMm: 0.42,
  /** 가슴 보호대 — 어깨에서 배까지 덮는다. 어깨선 밖으로 조금 나간다. */
  chestExtraMm: 0.6,
  chestDropMm: 1.0,
  chestSeamMm: 0.45,
  /** 정강이 보호대 — 무릎 덮개와 정강이 통. */
  shinGuardWidthMm: 2.9,
  kneeCapMm: 1.3,
  /** 배트 — 손잡이에서 배럴로 굵어진다. */
  batLengthMm: 10.5,
  batKnobMm: 1.1,
  batGripMm: 0.85,
  batBarrelMm: 1.75,
} as const;

/** 손에 든 것. 글러브면 야수, 배트면 타자다. */
type Held = 'glove' | 'bat' | 'none';

/**
 * 자세 하나. 이름은 `../dimensions.ts`의 목록에서 오고, 여기 있는 각도가 그림을
 * 만든다.
 */
interface Pose {
  readonly id: string;
  readonly label: string;
  /** 상체 기울기. 양수면 앞(보는 쪽)으로 숙인다. */
  readonly leanDeg: number;
  /** 뒤쪽 팔다리 — 먼저 그려 몸통 뒤로 들어간다. */
  readonly backArm: Limb;
  readonly backLeg: Limb;
  readonly frontArm: Limb;
  readonly frontLeg: Limb;
  /** 앞손·뒷손에 든 것. 배트는 두 손으로 잡으므로 앞손에만 적는다. */
  readonly frontHand: Held;
  readonly backHand: Held;
  /**
   * 배트가 뻗는 방향. 팔 각도에서 유도하지 않고 **자세가 직접 적는다** — 유도한
   * 값은 어깨 위로 세운 배트가 머리를 가로질러 얼굴을 지웠다. 타격 자세 아홉이
   * 서로 달라 보이는 것도 대부분 이 값의 차이다.
   */
  readonly batDeg?: number;
  /**
   * 보호 장비. `'catcher'`면 **정면으로 앉은 포수**로 그린다 — 모자 대신 마스크,
   * 셔츠 위에 가슴 보호대, 정강이에 보호대가 붙고 두 발이 바깥을 본다.
   *
   * 나머지 자세는 옆을 보고 서지만(위 주석) 포수만 정면이다. 다리·팔 각도를
   * 좌우 대칭으로(θ와 180-θ) 적으면 같은 관절 계산이 그대로 정면 그림이 된다.
   */
  readonly gear?: 'catcher';
}

type PoseAngles = Omit<Pose, 'id' | 'label'>;

/**
 * 자세별 관절 각도.
 *
 * 각도는 **0°가 오른쪽, 90°가 아래**다. 눈으로 맞춘 값이라 뽑아 보고 고칠 때는
 * 자세 하나의 숫자만 건드리면 되고 도형 코드는 그대로다.
 *
 * 축구와 다른 규칙이 하나 있다. 축구는 "발끝·머리·팔이 모두 공격 방향을 향한다"를
 * 지켜야 했다 — 좌우 반전이 두 팀을 가르는 유일한 수단이었기 때문이다. 야구는
 * 반전을 쓰지 않으므로(`../index.ts`의 그룹에 `mirrorMarkers`가 없다) 자세가
 * 자유롭다. 대신 **어느 자세든 오른쪽을 보고 선다** — 판 위에서 마커를 돌려
 * 놓는 것은 사용자 몫이다(`rotationDeg`).
 */
const POSE_ANGLES: Readonly<Record<string, PoseAngles>> = {
  /** 투구 — 앞다리를 높이 들고 글러브 낀 손을 앞으로, 공 쥔 손을 뒤로 젖힌다. */
  pitch: {
    leanDeg: -6,
    backArm: { upperDeg: 208, lowerDeg: 246 },
    backLeg: { upperDeg: 96, lowerDeg: 92 },
    frontArm: { upperDeg: -18, lowerDeg: -44 },
    frontLeg: { upperDeg: 8, lowerDeg: 72 },
    frontHand: 'glove',
    backHand: 'none',
  },
  /**
   * 포수 — **정면으로 바르게 앉는다**(2026-09-08 사용자 요청).
   *
   * 다른 자세는 모두 오른쪽을 보고 서지만 포수만 정면이다. 옆에서 본 쪼그린
   * 자세로는 "웅크린 야수"와 구분되지 않았는데, 정면으로 앉히고 마스크와 보호대를
   * 씌우니 한눈에 포수가 된다 — 아이가 카드를 집어 들 때 그림만 보고 고른다.
   *
   * 각도는 **좌우 대칭**이다(θ와 180-θ). 허벅지가 양옆으로 벌어지고 정강이가
   * 곧게 내려가 앉은 모양이 되며, 상체는 세운다("바른자세"라 `leanDeg`가 0이다).
   * 미트 낀 앞팔만 올려 공 받을 자리를 만들고, 반대 팔은 무릎 쪽으로 내린다.
   *
   * 판 위 마커에는 쓰지 않는다(포수는 그라운드에 없다). **스탠드 카드에만**
   * 남은 자세다 — 한 팀을 세는 데 포수가 빠질 수 없어서다.
   */
  crouch: {
    leanDeg: 0,
    backArm: { upperDeg: 152, lowerDeg: 146 },
    backLeg: { upperDeg: 152, lowerDeg: 94 },
    frontArm: { upperDeg: 26, lowerDeg: -26 },
    frontLeg: { upperDeg: 28, lowerDeg: 86 },
    frontHand: 'glove',
    backHand: 'none',
    gear: 'catcher',
  },
  /** 땅볼 수비 — 무릎을 굽혀 몸을 낮추고 글러브를 땅에 붙인다. */
  field: {
    leanDeg: 28,
    backArm: { upperDeg: 124, lowerDeg: 108 },
    backLeg: { upperDeg: 122, lowerDeg: 92 },
    frontArm: { upperDeg: 72, lowerDeg: 96 },
    frontLeg: { upperDeg: 54, lowerDeg: 98 },
    frontHand: 'glove',
    backHand: 'none',
  },
  /** 송구 — 공 쥔 팔을 위로 젖히고 반대 팔로 겨눈다. */
  throw: {
    leanDeg: -8,
    backArm: { upperDeg: 226, lowerDeg: 262 },
    backLeg: { upperDeg: 102, lowerDeg: 96 },
    frontArm: { upperDeg: -12, lowerDeg: -28 },
    frontLeg: { upperDeg: 52, lowerDeg: 62 },
    frontHand: 'glove',
    backHand: 'none',
  },
  /** 뜬공 — 글러브를 머리 위로 뻗어 올려 잡는다. */
  catch: {
    leanDeg: -12,
    backArm: { upperDeg: 202, lowerDeg: 232 },
    backLeg: { upperDeg: 108, lowerDeg: 96 },
    frontArm: { upperDeg: -62, lowerDeg: -82 },
    frontLeg: { upperDeg: 68, lowerDeg: 96 },
    frontHand: 'glove',
    backHand: 'none',
  },
  /** 달리기 — 타구를 쫓는다. 팔다리를 엇갈려 흔들고 글러브를 든다. */
  run: {
    leanDeg: 12,
    backArm: { upperDeg: 124, lowerDeg: 170 },
    backLeg: { upperDeg: 120, lowerDeg: 152 },
    frontArm: { upperDeg: 54, lowerDeg: -2 },
    frontLeg: { upperDeg: 50, lowerDeg: 94 },
    frontHand: 'glove',
    backHand: 'none',
  },

  /* ---- 타격 아홉 (2026-09-08) — 스탠드 카드 뒷면이 쓴다 -------------- *
   *
   * 스탠드 아홉 장의 뒷면이 **서로 다른 타격 자세**여야 한다는 요청에서 왔다.
   * 한 타순이 종이 위에 늘어서는 셈이라, 같은 자세가 둘 있으면 누가 몇 번인지
   * 그림으로 구분되지 않는다. 아홉을 가르는 것은 대부분 `batDeg`와 상체
   * 기울기다 — 배트가 어디를 가리키느냐가 한 동작의 어느 순간인지를 말한다.
   *
   * 한 스윙을 시간 순으로 늘어놓았다: 대기 → 준비 → 스윙 → 임팩트 → 팔로스루.
   * 나머지 넷(번트·퍼올리기·기다리기·뛰어나가기)은 그 밖의 순간이다.
   */

  /** 대기 — 배트를 뒤 어깨 위로 세우고 기다린다. 발은 넓게 벌린다. */
  'bat-ready': {
    leanDeg: 6,
    backArm: { upperDeg: 202, lowerDeg: 246 },
    backLeg: { upperDeg: 104, lowerDeg: 98 },
    frontArm: { upperDeg: 188, lowerDeg: 238 },
    frontLeg: { upperDeg: 74, lowerDeg: 88 },
    frontHand: 'bat',
    backHand: 'none',
    // 위·뒤 — 뒤 어깨 너머로 세운다.
    batDeg: 244,
  },
  /** 준비 — 손을 뒤로 더 당기고 배트를 곧추세운다. 몸이 뒤로 조금 눕는다. */
  'bat-load': {
    leanDeg: -7,
    backArm: { upperDeg: 214, lowerDeg: 258 },
    backLeg: { upperDeg: 110, lowerDeg: 98 },
    frontArm: { upperDeg: 200, lowerDeg: 252 },
    frontLeg: { upperDeg: 68, lowerDeg: 86 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 268,
  },
  /** 스윙 — 배트를 끌고 나오기 시작한다. 배트가 아직 뒤에 누워 있다. */
  'bat-swing': {
    leanDeg: 13,
    backArm: { upperDeg: 172, lowerDeg: 212 },
    backLeg: { upperDeg: 112, lowerDeg: 102 },
    frontArm: { upperDeg: 152, lowerDeg: 196 },
    frontLeg: { upperDeg: 58, lowerDeg: 80 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 214,
  },
  /** 임팩트 — 팔이 앞으로 뻗고 배트가 공을 때린다. 앞다리가 버틴다. */
  'bat-impact': {
    leanDeg: 10,
    backArm: { upperDeg: 34, lowerDeg: 4 },
    backLeg: { upperDeg: 116, lowerDeg: 106 },
    frontArm: { upperDeg: 18, lowerDeg: -10 },
    frontLeg: { upperDeg: 50, lowerDeg: 84 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: -12,
  },
  /** 팔로스루 — 다 휘둘러 배트가 앞 어깨 위로 넘어간다. */
  'bat-follow': {
    leanDeg: 2,
    backArm: { upperDeg: -26, lowerDeg: -64 },
    backLeg: { upperDeg: 108, lowerDeg: 112 },
    frontArm: { upperDeg: -40, lowerDeg: -78 },
    frontLeg: { upperDeg: 62, lowerDeg: 86 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: -62,
  },
  /** 번트 — 무릎을 굽히고 배트를 가로로 눕혀 갖다 댄다. */
  'bat-bunt': {
    leanDeg: 22,
    backArm: { upperDeg: 72, lowerDeg: 28 },
    backLeg: { upperDeg: 120, lowerDeg: 98 },
    frontArm: { upperDeg: 42, lowerDeg: 4 },
    frontLeg: { upperDeg: 54, lowerDeg: 96 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 2,
  },
  /** 퍼올리기 — 낮은 데서 걷어 올린다. 배트가 뒤로 처져 있다. */
  'bat-upper': {
    leanDeg: 18,
    backArm: { upperDeg: 148, lowerDeg: 168 },
    backLeg: { upperDeg: 116, lowerDeg: 104 },
    frontArm: { upperDeg: 132, lowerDeg: 158 },
    frontLeg: { upperDeg: 56, lowerDeg: 92 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 166,
  },
  /**
   * 기다리기 — 배트 끝을 앞 땅에 짚고 선다. 타석 밖에서 차례를 기다리는 모습이다.
   *
   * 배트를 몸 옆으로 곧게 내리면(94°) 다리를 관통한 것처럼 보였다 — 배트는
   * 다리보다 나중에 그려 흰 채움이 겹치는 구간을 덮지 못한다. 그래서 앞쪽으로
   * 비스듬히(68°) 내보내 발 앞을 짚게 했다.
   */
  'bat-wait': {
    leanDeg: 2,
    backArm: { upperDeg: 92, lowerDeg: 96 },
    backLeg: { upperDeg: 96, lowerDeg: 92 },
    frontArm: { upperDeg: 62, lowerDeg: 74 },
    frontLeg: { upperDeg: 82, lowerDeg: 90 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 68,
  },
  /** 겨누기 — 배트 끝으로 투수 쪽을 가리키고 선다. 타석에 들어서는 순간이다. */
  'bat-point': {
    leanDeg: -2,
    backArm: { upperDeg: 96, lowerDeg: 82 },
    backLeg: { upperDeg: 98, lowerDeg: 94 },
    frontArm: { upperDeg: -14, lowerDeg: -34 },
    frontLeg: { upperDeg: 80, lowerDeg: 90 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: -40,
  },
  /**
   * 어깨에 걸치기 — 배트를 뒤 어깨에 얹고 선다.
   *
   * 지명타자 카드의 **앞면**이 쓴다. 앞면은 이름표가 붙는 면인데 지명타자는
   * 수비를 나가지 않으므로, 수비 자세 대신 "칠 차례를 기다리는 타자"를 그린다.
   */
  'bat-shoulder': {
    leanDeg: 3,
    backArm: { upperDeg: 156, lowerDeg: 206 },
    backLeg: { upperDeg: 100, lowerDeg: 94 },
    frontArm: { upperDeg: 172, lowerDeg: 220 },
    frontLeg: { upperDeg: 78, lowerDeg: 90 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 214,
  },
  /** 뛰어나가기 — 치고 나서 배트를 든 채 1루로 달린다. */
  'bat-dash': {
    leanDeg: 15,
    backArm: { upperDeg: 128, lowerDeg: 174 },
    backLeg: { upperDeg: 122, lowerDeg: 154 },
    frontArm: { upperDeg: 50, lowerDeg: 6 },
    frontLeg: { upperDeg: 48, lowerDeg: 92 },
    frontHand: 'bat',
    backHand: 'none',
    batDeg: 236,
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

/** 수비 자세. 슬롯 배정은 `../index.ts`가 한다. */
export const FIELDER_POSE_LIST: readonly Pose[] = FIELDER_POSES.map(poseOf);

/**
 * 스탠드에만 쓰는 자세 — 포수와 타격 아홉.
 *
 * 마커 아트워크로는 나오지 않는다(`./index.ts`의 `ARTWORK`가 `FIELDER_POSES`만
 * 돈다). 그림이 필요한 곳은 스탠드 카드뿐이고, 거기서는 `fittedShapes`가 자세
 * id로 바로 찾아 쓴다.
 */
const STAND_ONLY_POSE_LIST: readonly Pose[] = STAND_ONLY_POSES.map(poseOf);

/**
 * 야구 모자 — 머리 위 돔에 챙을 붙인 한 도형.
 *
 * 축구의 머리카락 자리를 대신한다. 실루엣에서는 머리와 한 덩어리가 되어 챙만
 * 옆으로 튀어나오고, 윤곽선에서는 모자 선이 그대로 이마 경계가 된다. 상체
 * 기울기만큼 같이 기울여야 숙인 자세에서 모자가 머리를 떠나지 않는다.
 */
const capShape = (head: Pt, leanDeg: number): Shape => {
  const R = BODY.capRadiusMm;
  const brim = BODY.capBrimMm;
  const thick = BODY.capBrimThickMm;

  // 머리 중심을 원점으로 두고 만든 뒤 통째로 기울인다.
  const local: Pt[] = [];
  for (let deg = 180; deg <= 360; deg += 20) {
    const rad = (deg * Math.PI) / 180;
    local.push([R * Math.cos(rad), R * Math.sin(rad)]);
  }
  local.push(
    // 챙 — 보는 쪽으로 뻗고 끝이 살짝 처진다.
    [R + brim, thick * 0.25],
    [R + brim * 0.9, thick],
    [-R, thick],
  );

  return {
    kind: 'poly',
    points: local.map((p) =>
      rotateAbout([head[0] + p[0], head[1] + p[1]], head, leanDeg),
    ),
    roundMm: 0.3,
  };
};

/**
 * 배트 — 손잡이에서 배럴로 굵어지는 막대.
 *
 * 잡은 손에서 자세가 적은 방향(`batDeg`)으로 뻗는다. 손잡이 쪽에 손잡이 마디
 * (`batKnobMm`)를 조금 남겨, 손이 배트 끝을 쥔 것으로 보이게 한다.
 */
const batShape = (grip: Pt, deg: number): Shape => {
  const knob = step(grip, deg + 180, BODY.batKnobMm);
  const tip = step(grip, deg, BODY.batLengthMm);
  const n = normal(knob, tip);
  const gripHalf = BODY.batGripMm / 2;
  const tipHalf = BODY.batBarrelMm / 2;
  return {
    kind: 'poly',
    points: [
      off(knob, n, gripHalf),
      off(tip, n, tipHalf),
      off(tip, n, -tipHalf),
      off(knob, n, -gripHalf),
    ],
    roundMm: tipHalf * 0.7,
  };
};

/** 도형을 세로축 `x0`에 대해 좌우로 뒤집는다. 정면 그림의 왼쪽 몫을 만든다. */
const mirrorX = (shape: Shape, x0: number): Shape =>
  shape.kind === 'poly'
    ? { ...shape, points: shape.points.map(([x, y]) => [2 * x0 - x, y] as Pt) }
    : { ...shape, center: [2 * x0 - shape.center[0], shape.center[1]] as Pt };

/** 가로로 눕는 얇은 띠 — 마스크 그물살과 보호대 이음매가 쓴다. */
const barShape = (
  centerXMm: number,
  yMm: number,
  halfWidthMm: number,
  thickMm: number,
): Shape => ({
  kind: 'poly',
  points: [
    [centerXMm - halfWidthMm, yMm - thickMm / 2],
    [centerXMm + halfWidthMm, yMm - thickMm / 2],
    [centerXMm + halfWidthMm, yMm + thickMm / 2],
    [centerXMm - halfWidthMm, yMm + thickMm / 2],
  ],
  roundMm: thickMm / 2,
});

/**
 * 포수 마스크 — 머리를 덮는 헬멧 위에 그물을 얹는다.
 *
 * 그리는 차례가 곧 겹치는 차례다(윤곽선 변형에서 나중 도형의 흰 채움이 앞
 * 도형을 덮는다). 헬멧이 머리를 덮고, 그물 테가 얼굴 아래쪽을 덮고, 살 둘이
 * 그 위에 남는다 — **살이 보이는 것이 마스크로 읽히는 유일한 단서**라 굵기를
 * 선 굵기(0.45)보다 얇게 두지 않았다.
 */
const catcherMaskShapes = (head: Pt): Shape[] => {
  const [cx, cy] = head;
  const half = BODY.cageHalfWidthMm;
  const top = cy + BODY.cageTopMm;
  const bottom = cy + BODY.cageBottomMm;
  return [
    { kind: 'disc', center: [cx, cy - 0.15], radiusMm: BODY.maskRadiusMm },
    {
      kind: 'poly',
      points: [
        [cx - half, top],
        [cx + half, top],
        [cx + half, bottom],
        [cx - half, bottom],
      ],
      roundMm: 0.85,
    },
    barShape(cx, top + (bottom - top) * 0.36, half - 0.22, BODY.cageBarMm),
    barShape(cx, top + (bottom - top) * 0.72, half - 0.34, BODY.cageBarMm),
  ];
};

/**
 * 가슴 보호대 — 어깨에서 배까지 덮는 한 장에 이음매 둘.
 *
 * 셔츠보다 나중에 그려 상체를 통째로 덮는다. 어깨선 밖으로 조금 나가야 "입은
 * 것"으로 보인다 — 셔츠 안에 들어가면 그냥 무늬가 된다.
 */
const chestProtectorShapes = (
  cxMm: number,
  shoulderYMm: number,
  hipYMm: number,
): Shape[] => {
  const topHalf = BODY.shoulderHalfMm + BODY.chestExtraMm;
  const bottomHalf = BODY.hemHalfMm + BODY.chestExtraMm;
  const bottomYMm = hipYMm + BODY.chestDropMm;
  const at = (t: number) => topHalf + (bottomHalf - topHalf) * t;
  return [
    {
      kind: 'poly',
      points: [
        [cxMm - topHalf, shoulderYMm - 0.3],
        [cxMm + topHalf, shoulderYMm - 0.3],
        [cxMm + bottomHalf, bottomYMm],
        [cxMm - bottomHalf, bottomYMm],
      ],
      roundMm: 0.9,
    },
    ...[0.34, 0.68].map((t) =>
      barShape(
        cxMm,
        shoulderYMm - 0.3 + (bottomYMm - shoulderYMm + 0.3) * t,
        at(t) - 0.5,
        BODY.chestSeamMm,
      ),
    ),
  ];
};

/** 정강이 보호대 — 무릎 덮개 + 정강이 통. 양말 위에 덮어 그린다. */
const shinGuardShapes = (knee: Pt, ankle: Pt, shinDeg: number): Shape[] => [
  tubeShape(
    step(knee, shinDeg, -0.2),
    shinDeg,
    Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]) + 0.5,
    BODY.shinGuardWidthMm,
    0.5,
  ),
  { kind: 'disc', center: knee, radiusMm: BODY.kneeCapMm },
];

/**
 * 자세 하나의 도형들 — **뒤에서 앞으로** 차례대로다.
 *
 * 윤곽선 변형에서는 나중 도형의 흰 채움이 앞 도형의 안쪽 선을 덮으므로, 이
 * 차례가 곧 "무엇이 무엇 위에 있는가"다: 뒤쪽 팔다리 → 앞쪽 다리 → 바지 →
 * 목 → 셔츠 → 앞쪽 팔 → 배트 → 머리 → 모자. 옷(소매·바지·스타킹)은 살 위에
 * 얹혀 옷 경계선이 되고, 실루엣에서는 색이 같아 전부 한 덩어리로 녹는다.
 */
export const figureShapes = (pose: Pose): Shape[] => {
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
  // 글러브는 손끝보다 손목 쪽으로 조금 물린다 — 손끝에 정확히 얹으면 팔과
  // 글러브 사이에 흰 틈이 생겨 윤곽선 변형에서 떨어져 보인다.
  const hand = (tip: Pt, limb: Limb, held: Held): Shape =>
    held === 'glove'
      ? mittShape(
          step(tip, limb.lowerDeg + 180, BODY.gloveGripMm),
          BODY.gloveMm,
        )
      : { kind: 'disc', center: tip, radiusMm: BODY.handMm };
  const sock = (tip: Pt, limb: Limb): Shape =>
    tubeShape(
      tip,
      limb.lowerDeg + 180,
      BODY.shinMm * BODY.sockRatio,
      BODY.legTipMm + BODY.sockExtraMm,
      0.4,
    );

  // 바지 — 허리 판에 가랑이 둘을 한 도형으로 이었다. 허벅지가 어느 쪽으로
  // 뻗든 바깥선이 허리에서 가랑이 끝까지 이어진다.
  const pantsLeg = (root: Pt, limb: Limb): readonly [Pt, Pt] => {
    const end = step(root, limb.upperDeg, BODY.thighMm * BODY.pantsRatio);
    const n = normal(root, end);
    const half = (BODY.legRootMm + BODY.pantsExtraMm) / 2;
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
  const [frontOuter, frontInner] = pantsLeg(frontHip, pose.frontLeg);
  const [backOuter, backInner] = pantsLeg(backHip, pose.backLeg);
  const waistHalf = BODY.hipHalfMm + BODY.pantsExtraMm * 0.7;
  const pants: Shape = {
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

  // 포수는 정면으로 앉는다 — 뒤쪽 신발만 좌우를 뒤집어야 두 발이 바깥을 본다.
  // `shoeShape`은 정강이에 직각으로 발끝을 내므로 각도만으로는 뒤집히지 않는다.
  const isCatcher = pose.gear === 'catcher';
  const shoe = (tip: Pt, limb: Limb, mirror: boolean): Shape => {
    const s = shoeShape(tip, limb.lowerDeg, BODY);
    return mirror ? mirrorX(s, tip[0]) : s;
  };

  // 배트는 앞손에서 뻗는다. 자세가 적은 방향이 없으면 앞팔을 따라간다.
  const bat: Shape[] =
    pose.frontHand === 'bat'
      ? [batShape(frontArm.tip, pose.batDeg ?? pose.frontArm.lowerDeg)]
      : [];

  return [
    backArm.shape,
    sleeve(backShoulder, pose.backArm),
    hand(backArm.tip, pose.backArm, pose.backHand),
    backLeg.shape,
    sock(backLeg.tip, pose.backLeg),
    shoe(backLeg.tip, pose.backLeg, isCatcher),
    ...(isCatcher
      ? shinGuardShapes(backLeg.joint, backLeg.tip, pose.backLeg.lowerDeg)
      : []),
    frontLeg.shape,
    sock(frontLeg.tip, pose.frontLeg),
    shoe(frontLeg.tip, pose.frontLeg, false),
    ...(isCatcher
      ? shinGuardShapes(frontLeg.joint, frontLeg.tip, pose.frontLeg.lowerDeg)
      : []),
    pants,
    neck,
    shirt,
    ...(isCatcher ? chestProtectorShapes(cxMm, BODY.shoulderYMm, hip[1]) : []),
    frontArm.shape,
    sleeve(frontShoulder, pose.frontArm),
    hand(
      frontArm.tip,
      pose.frontArm,
      pose.frontHand === 'bat' ? 'none' : pose.frontHand,
    ),
    // 배트는 머리보다 먼저 그린다 — 어깨 너머로 넘어가는 자세에서 머리 뒤를
    // 지나야 하고, 윤곽선 변형에서는 나중에 그린 머리의 흰 채움이 그 구간을
    // 덮는다.
    ...bat,
    { kind: 'disc', center: head, radiusMm: BODY.headRadiusMm },
    ...(isCatcher ? catcherMaskShapes(head) : [capShape(head, pose.leanDeg)]),
  ];
};

/** 자세 id → 자세. 판 마커 자세와 스탠드 전용 자세가 다 들어간다. */
export const POSE_BY_ID: ReadonlyMap<string, Pose> = new Map(
  [...FIELDER_POSE_LIST, ...STAND_ONLY_POSE_LIST].map((p) => [p.id, p]),
);

const poseByIdOrThrow = (poseId: string): Pose => {
  const pose = POSE_BY_ID.get(poseId);
  if (!pose) throw new Error(`없는 자세다: ${poseId}`);
  return pose;
};

/**
 * 상자에 맞춰 넣은 도형들. 마커와 스탠드(`./stands.ts`)가 **상자만 달리해서**
 * 같은 그림을 쓴다 — 스탠드 카드가 마커보다 커서 그림도 그만큼 커진다.
 */
export const fittedShapes = (
  poseId: string,
  box: { widthMm: number; heightMm: number },
): Shape[] =>
  fitToBox(figureShapes(poseByIdOrThrow(poseId)), box, FIGURE_OUTLINE_MM);

/**
 * 선수 그림 한 벌. 실루엣은 채움으로, 윤곽선은 테두리로 팀 색을 받는다 —
 * 레이어 하나가 `fill`과 `stroke`를 둘 다 받으므로 두 변형이 같은 규약을 쓴다.
 */
export const renderFigure = (poseId: string, mode: FigureMode): string => {
  const pose = poseByIdOrThrow(poseId);
  const shape = mode === 'illustration' ? '실루엣' : '윤곽선';

  return svgDocument({
    widthMm: ILLUSTRATION.widthMm,
    heightMm: ILLUSTRATION.heightMm,
    title: `야구 게임판 · 수비 마커 · ${pose.label} · ${shape}`,
    children: [
      group({ id: ART_LAYER_ID }, [
        group(
          {
            id: MARKER_TEAM_LAYER_ID,
            fill: TEAM_COLOR_PLACEHOLDER,
            stroke: mode === 'illustration' ? 'none' : TEAM_COLOR_PLACEHOLDER,
          },
          fittedShapes(poseId, ILLUSTRATION).map((s) =>
            drawShape(s, figureModeAttrs(mode, FIGURE_OUTLINE_MM)),
          ),
        ),
      ]),
    ],
  });
};

/** 스타일 세트 × 변형 → 아트워크 id. 치수 파일이 정한 이름을 그대로 쓴다. */
export const figureArtworkId = (poseId: string, mode: FigureMode): string =>
  markerArtworkId(poseId, mode);

export { poseStyleSetId, FIGURE_OUTLINE_MM };
export type { FigureMode, Pose };

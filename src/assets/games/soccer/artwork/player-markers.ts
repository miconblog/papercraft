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
import { ART_LAYER_ID, circle, group, num, path, svgDocument } from './svg.ts';

/**
 * 팀 색을 받는 레이어. 렌더러가 이 id의 `fill`과 `stroke`를 둘 다 갈아 끼운다
 * (`lib/customization/render.ts`) — 빈 원·윤곽선은 테두리로, 실루엣은 채움으로
 * 팀을 가르므로 한 레이어가 둘 다 받아야 세 변형이 같은 규약을 쓴다. 안에서
 * 흰 속처럼 색을 받지 **말아야** 하는 도형은 제 값을 명시해 덮어쓴다.
 */
const MARKER_TEAM_LAYER_ID = 'pc-marker-team';

/** 팀 색을 못 받았을 때 남는 색. 브라우저로 SVG를 열어 봤을 때의 모습이다. */
const TEAM_COLOR_PLACEHOLDER = '#1a1a1a';

/** 색을 받지 않고 흰 종이로 남는 면 — 아이가 칠할 자리다. */
const PAPER = '#ffffff';

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

type Pt = readonly [number, number];

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
 * 관절 두 마디. 각도는 도(°)이고 **0°가 오른쪽(공격 방향), 90°가 아래**다 —
 * SVG는 y가 아래로 자라므로 각도가 커지면 내려간다.
 *
 * `upperDeg`는 몸통에 붙은 마디(위팔·허벅지), `lowerDeg`는 그다음 마디
 * (아래팔·정강이)다. 둘이 같으면 곧게 편 것이고, 벌어질수록 팔꿈치·무릎이
 * 굽는다.
 */
interface Limb {
  readonly upperDeg: number;
  readonly lowerDeg: number;
}

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

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** `from`에서 `deg` 방향으로 `lenMm`만큼 간 점. */
const step = (from: Pt, deg: number, lenMm: number): Pt => [
  from[0] + lenMm * Math.cos(rad(deg)),
  from[1] + lenMm * Math.sin(rad(deg)),
];

/** `pivot`을 축으로 `deg`만큼 돌린 점. 상체 기울기에 쓴다. */
const rotateAbout = (p: Pt, pivot: Pt, deg: number): Pt => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const dx = p[0] - pivot[0];
  const dy = p[1] - pivot[1];
  return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
};

/**
 * 그리기 전 단계의 도형. 상자에 맞춰 넣는 계산을 좌표로 하려고 기하로 둔다.
 *
 * 다각형은 `roundMm`만큼 모서리를 둥글려 그린다(`roundedPath`) — 각진 사각형
 * 여섯 개를 이어 붙인 예전 그림이 로봇처럼 보였던 것이 이 값 하나로 사라진다.
 * 팔다리 끝은 폭의 절반으로 둥글려 캡슐이 되고, 무릎·팔꿈치도 부드럽게 꺾인다.
 */
type Shape =
  | {
      readonly kind: 'poly';
      readonly points: readonly Pt[];
      readonly roundMm: number;
    }
  | { readonly kind: 'disc'; readonly center: Pt; readonly radiusMm: number };

/** 선분에 수직인 단위 벡터. 마디를 폭 있는 도형으로 부풀릴 때 쓴다. */
const normal = (a: Pt, b: Pt): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
};

const off = (p: Pt, n: Pt, d: number): Pt => [p[0] + n[0] * d, p[1] + n[1] * d];

/**
 * 두 마디짜리 팔·다리를 **닫힌 도형 하나**로 낸다.
 *
 * 마디마다 도형을 내면 윤곽선 변형에서 팔꿈치·무릎마다 선이 하나씩 더 생겨
 * 그림이 조각조각 나 보인다. 관절에서는 두 마디의 법선을 평균 내 한 번에
 * 꺾는다 — 이러면 굽은 팔다리가 선 하나로 이어진다. 뿌리에서 끝으로
 * 가늘어진다.
 */
const limbShape = (
  root: Pt,
  limb: Limb,
  upperMm: number,
  lowerMm: number,
  rootWidthMm: number,
  tipWidthMm: number,
): { readonly shape: Shape; readonly joint: Pt; readonly tip: Pt } => {
  const joint = step(root, limb.upperDeg, upperMm);
  const tip = step(joint, limb.lowerDeg, lowerMm);
  const nUpper = normal(root, joint);
  const nLower = normal(joint, tip);
  // 관절의 법선은 두 마디의 평균이다. 정규화해 두지 않으면 많이 굽은 관절에서
  // 폭이 잘록해진다.
  const mixLen = Math.hypot(nUpper[0] + nLower[0], nUpper[1] + nLower[1]) || 1;
  const nJoint: Pt = [
    (nUpper[0] + nLower[0]) / mixLen,
    (nUpper[1] + nLower[1]) / mixLen,
  ];
  const rootHalf = rootWidthMm / 2;
  const jointHalf = (rootWidthMm + tipWidthMm) / 4;
  const tipHalf = tipWidthMm / 2;

  return {
    shape: {
      kind: 'poly',
      points: [
        off(root, nUpper, rootHalf),
        off(joint, nJoint, jointHalf),
        off(tip, nLower, tipHalf),
        off(tip, nLower, -tipHalf),
        off(joint, nJoint, -jointHalf),
        off(root, nUpper, -rootHalf),
      ],
      roundMm: tipHalf,
    },
    joint,
    tip,
  };
};

/**
 * 한 마디 위에 얹는 통 — 소매·반바지 가랑이·양말이다. 밑에 깔린 팔다리보다
 * 조금 넓어, 윤곽선 변형에서 그 구간의 바깥선을 대신하고 끝선이 옷 경계가 된다.
 */
const tubeShape = (
  from: Pt,
  deg: number,
  lenMm: number,
  widthMm: number,
  roundMm: number,
): Shape => {
  const to = step(from, deg, lenMm);
  const n = normal(from, to);
  const half = widthMm / 2;
  return {
    kind: 'poly',
    points: [
      off(from, n, half),
      off(to, n, half),
      off(to, n, -half),
      off(from, n, -half),
    ],
    roundMm,
  };
};

/**
 * 신발. 발목에서 정강이에 **직각**으로 낸다 — 정강이가 수직이면 발끝이 앞을
 * 보고, 슛처럼 정강이가 앞으로 뻗으면 발끝이 위를 본다. 발끝 방향이 곧 그림이
 * 보는 쪽이다.
 */
const shoeShape = (ankle: Pt, shinDeg: number): Shape => {
  const toeDeg = shinDeg - 90;
  const along = (u: number, v: number): Pt =>
    step(step(ankle, toeDeg, u), shinDeg, v);
  const { shoeLengthMm: len, shoeHeelMm: heel, shoeHeightMm: h } = BODY;
  return {
    kind: 'poly',
    points: [
      along(-heel, -0.2),
      along(len * 0.62, -0.2),
      along(len, h * 0.5),
      along(len * 0.82, h),
      along(-heel, h),
    ],
    roundMm: 0.45,
  };
};

/** 골키퍼 장갑. 손끝에 얹는 둥근 네모다. */
const gloveShape = (hand: Pt): Shape => {
  const half = BODY.gloveMm / 2;
  return {
    kind: 'poly',
    points: [
      [hand[0] - half, hand[1] - half],
      [hand[0] + half, hand[1] - half],
      [hand[0] + half, hand[1] + half],
      [hand[0] - half, hand[1] + half],
    ],
    roundMm: 0.5,
  };
};

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
      ? gloveShape(l.tip)
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
    shoeShape(backLeg.tip, pose.backLeg.lowerDeg),
    frontLeg.shape,
    sock(frontLeg, pose.frontLeg),
    shoeShape(frontLeg.tip, pose.frontLeg.lowerDeg),
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
 * 그림을 마커 상자 한가운데로 맞춰 넣는다.
 *
 * 자세마다 팔다리가 뻗는 범위가 달라, 각도만 적어 두면 어떤 자세는 상자를
 * 넘고(질주가 그랬다) 어떤 자세는 한쪽으로 쏠린다. 상자를 넘으면 이웃 마커와
 * 겹친다 — 겹침 판정은 상자로만 하기 때문이다(`styleSetBounds`). 그래서 **자세
 * 각도를 손으로 맞추는 대신** 나온 도형의 경계를 재서 필요한 만큼만 줄이고
 * 가운데로 옮긴다. 자세를 새로 더할 때 상자 걱정을 하지 않아도 되는 이유다.
 *
 * 마커의 기준점이 상자 중심이므로(IDE-010) 가운데 맞춤은 곧 "슬롯 좌표에
 * 선수가 선다"는 뜻이기도 하다.
 */
const fitToBox = (shapes: readonly Shape[]): Shape[] => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of shapes) {
    if (shape.kind === 'poly') {
      for (const [x, y] of shape.points) {
        xs.push(x);
        ys.push(y);
      }
    } else {
      xs.push(
        shape.center[0] - shape.radiusMm,
        shape.center[0] + shape.radiusMm,
      );
      ys.push(
        shape.center[1] - shape.radiusMm,
        shape.center[1] + shape.radiusMm,
      );
    }
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // 윤곽선이 상자 밖으로 삐져나오지 않을 만큼만 여백을 둔다.
  const marginMm = FIGURE_OUTLINE_MM;
  const scale = Math.min(
    1,
    (ILLUSTRATION.widthMm - 2 * marginMm) / (maxX - minX),
    (ILLUSTRATION.heightMm - 2 * marginMm) / (maxY - minY),
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const map = (p: Pt): Pt => [
    ILLUSTRATION.widthMm / 2 + (p[0] - cx) * scale,
    ILLUSTRATION.heightMm / 2 + (p[1] - cy) * scale,
  ];

  return shapes.map((shape) =>
    shape.kind === 'poly'
      ? {
          kind: 'poly',
          points: shape.points.map(map),
          roundMm: shape.roundMm * scale,
        }
      : {
          kind: 'disc',
          center: map(shape.center),
          radiusMm: shape.radiusMm * scale,
        },
  );
};

/**
 * 그림 모양. 값이 곧 변형 id다(`../index.ts`의 스타일 세트) — 파일 이름도
 * 여기서 나오므로 셋이 어긋날 자리가 없다.
 */
export type FigureMode = 'illustration' | 'outline';

/**
 * 도형 하나에 붙는 속성.
 *
 * 실루엣은 레이어의 팀 색 채움을 그대로 물려받고, 윤곽선은 속을 흰 종이로
 * 못 박고 테두리만 팀 색을 받는다 — 빈 원과 같은 규약이다. 윤곽선의 모서리는
 * 둥글게 잇는다(`stroke-linejoin`) — 뾰족하게 두면 앞머리·발끝 같은 예각에서
 * 선이 바늘처럼 튀어나온다.
 */
const modeAttrs = (mode: FigureMode): Record<string, string | number> =>
  mode === 'illustration'
    ? { stroke: 'none' }
    : {
        fill: PAPER,
        'stroke-width': FIGURE_OUTLINE_MM,
        'stroke-linejoin': 'round',
      };

/**
 * 모서리를 둥글린 다각형 경로. 꼭짓점마다 양옆 변을 `roundMm`만큼 잘라 내고
 * 그 사이를 꼭짓점을 제어점 삼은 2차 곡선으로 잇는다. 변이 짧으면 절반까지만
 * 자른다 — 그래야 이웃 모서리와 겹치지 않는다.
 */
const roundedPath = (points: readonly Pt[], roundMm: number): string => {
  const n = points.length;
  if (roundMm <= 0) {
    return (
      points
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${num(x)} ${num(y)}`)
        .join(' ') + ' Z'
    );
  }
  const parts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i + n - 1) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const dPrev = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]) || 1;
    const dNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
    const cut = Math.min(roundMm, dPrev / 2, dNext / 2);
    const a: Pt = [
      cur[0] + ((prev[0] - cur[0]) / dPrev) * cut,
      cur[1] + ((prev[1] - cur[1]) / dPrev) * cut,
    ];
    const b: Pt = [
      cur[0] + ((next[0] - cur[0]) / dNext) * cut,
      cur[1] + ((next[1] - cur[1]) / dNext) * cut,
    ];
    parts.push(`${i === 0 ? 'M' : 'L'} ${num(a[0])} ${num(a[1])}`);
    parts.push(`Q ${num(cur[0])} ${num(cur[1])} ${num(b[0])} ${num(b[1])}`);
  }
  parts.push('Z');
  return parts.join(' ');
};

const drawShape = (shape: Shape, mode: FigureMode): string => {
  const attrs = modeAttrs(mode);
  return shape.kind === 'disc'
    ? circle(shape.center[0], shape.center[1], shape.radiusMm, attrs)
    : path(roundedPath(shape.points, shape.roundMm), attrs);
};

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
          fitToBox(figureShapes(pose)).map((shape) => drawShape(shape, mode)),
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

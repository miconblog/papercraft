/**
 * 보드 파트 — 운동장 (IDE-004)
 *
 * 배율 100%에서 297×210mm(A4 가로). 터치라인 안쪽이 공을 튕기는 면이고, 사방
 * 6mm 여백만 남긴다 — 팀 이름·제목·배율 안내를 운동장에서 빼고 그만큼 놀 면을
 * 넓혔다(2026-09-05).
 *
 * **골대 자리는 눈금 셋으로만 찍는다.** 예전에는 골라인 안쪽 골대 바닥 넓이를
 * 파선 상자와 "골대" 글자로 그렸는데, 골 에어리어 안에 사각형이 하나 더 겹쳐
 * 골라인 근처가 삼중선이 됐다(2026-09-05 사용자 요청으로 삭제). 골대가 골라인
 * 바깥으로 나간 뒤에는 반대로 **놓을 자리가 종이에 하나도 안 보여** 가운데
 * 맞추기가 어려웠다 — 그래서 골포스트 두 곳과 골문 한가운데만 골라인에 걸친
 * 짧은 눈금으로 되살렸다. 맞출 것은 골대 앞면 좌우 끝뿐이다.
 *
 * 필드를 초록으로 **칠하지 않는다.** 잉크를 크게 먹고, 공이 미끄러지는 면이라
 * 잉크가 두꺼우면 연필 자국도 더 남는다. 사용자가 만든 판처럼 라인만 초록이다.
 */
import {
  BOARD,
  FIELD,
  FIELD_BOTTOM_MM,
  FIELD_CENTER_X_MM,
  FIELD_CENTER_Y_MM,
  FIELD_MARKS,
  FIELD_RIGHT_MM,
  GOAL,
  GOAL_GUIDE,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  FIELD_LINE_COLOR,
  circle,
  group,
  line,
  num,
  path,
  rect,
  svgDocument,
} from './svg.ts';

const {
  centerCircleRadiusMm,
  spotDiameterMm,
  penaltyAreaDepthMm,
  penaltyAreaWidthMm,
  goalAreaDepthMm,
  goalAreaWidthMm,
  penaltySpotDistanceMm,
  cornerArcRadiusMm,
  lineWidthMm,
} = FIELD_MARKS;

/**
 * 골라인에서 안쪽으로 뻗는 상자(페널티·골 에어리어)를 양 진영에 하나씩.
 *
 * 사각형이 아니라 **세 변**이다. 네 번째 변은 골라인과 같은 자리라, 사각형으로
 * 그리면 같은 선 위에 잉크가 두 번 얹힌다.
 */
const goalLineBox = (depthMm: number, widthMm: number): string[] => {
  const topYMm = FIELD_CENTER_Y_MM - widthMm / 2;
  const bottomYMm = FIELD_CENTER_Y_MM + widthMm / 2;
  return [
    path(
      `M ${num(FIELD.xMm)} ${num(topYMm)} H ${num(FIELD.xMm + depthMm)} V ${num(bottomYMm)} H ${num(FIELD.xMm)}`,
    ),
    path(
      `M ${num(FIELD_RIGHT_MM)} ${num(topYMm)} H ${num(FIELD_RIGHT_MM - depthMm)} V ${num(bottomYMm)} H ${num(FIELD_RIGHT_MM)}`,
    ),
  ];
};

/**
 * 페널티 아크 — 페널티 스팟을 중심으로 한 원 중 에어리어 **밖**에 나오는 부분.
 * 에어리어 경계선과 만나는 두 점을 구해 그 사이만 그린다.
 */
const penaltyArc = (spotXMm: number, boundaryXMm: number): string => {
  const dxMm = Math.abs(boundaryXMm - spotXMm);
  const dyMm = Math.sqrt(
    centerCircleRadiusMm * centerCircleRadiusMm - dxMm * dxMm,
  );
  const topYMm = FIELD_CENTER_Y_MM - dyMm;
  const bottomYMm = FIELD_CENTER_Y_MM + dyMm;
  // sweep=1은 각도가 커지는 쪽(화면상 시계 방향)이다. 왼쪽 진영은 위 → 아래로
  // 돌면 필드 가운데를 향해 볼록해지고, 오른쪽 진영은 그 반대다.
  const [fromYMm, toYMm] =
    spotXMm < FIELD_CENTER_X_MM ? [topYMm, bottomYMm] : [bottomYMm, topYMm];
  return path(
    `M ${num(boundaryXMm)} ${num(fromYMm)} A ${num(centerCircleRadiusMm)} ${num(
      centerCircleRadiusMm,
    )} 0 0 1 ${num(boundaryXMm)} ${num(toYMm)}`,
  );
};

/** 센터·페널티 스팟. 채움만 쓴다 — 테두리를 물려받으면 지름이 커진다. */
const spot = (xMm: number): string =>
  circle(xMm, FIELD_CENTER_Y_MM, spotDiameterMm / 2, {
    fill: FIELD_LINE_COLOR,
    stroke: 'none',
  });

/** 코너 아크. 네 귀퉁이에서 필드 안쪽으로 볼록하게. */
const cornerArcs = (): string[] => {
  const r = cornerArcRadiusMm;
  // [시작 x, 시작 y, 끝 x, 끝 y] — 모두 sweep=1 방향으로 돈다.
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [FIELD.xMm + r, FIELD.yMm, FIELD.xMm, FIELD.yMm + r],
    [FIELD_RIGHT_MM, FIELD.yMm + r, FIELD_RIGHT_MM - r, FIELD.yMm],
    [FIELD_RIGHT_MM - r, FIELD_BOTTOM_MM, FIELD_RIGHT_MM, FIELD_BOTTOM_MM - r],
    [FIELD.xMm, FIELD_BOTTOM_MM - r, FIELD.xMm + r, FIELD_BOTTOM_MM],
  ];
  return corners.map(([x1, y1, x2, y2]) =>
    path(
      `M ${num(x1)} ${num(y1)} A ${num(r)} ${num(r)} 0 0 1 ${num(x2)} ${num(y2)}`,
    ),
  );
};

/**
 * 골대 자리 눈금 — 양 진영에 셋씩.
 *
 * 골포스트가 설 두 지점은 골라인을 가로질러(안쪽 2mm · 바깥 4mm) 찍고, 골문
 * 한가운데는 안쪽으로만 짧게 찍는다. 셋을 다른 길이로 둔 것은 **가운데 눈금을
 * 골포스트로 착각하지 않게** 하려는 것이다.
 */
const goalGuideTicks = (): string[] => {
  const halfMm = GOAL.mouthWidthMm / 2;
  const ticks: string[] = [];
  for (const [goalLineXMm, outwardSign] of [
    [FIELD.xMm, -1],
    [FIELD_RIGHT_MM, 1],
  ] as const) {
    const outerXMm = goalLineXMm + GOAL_GUIDE.outsideMm * outwardSign;
    const innerXMm = goalLineXMm - GOAL_GUIDE.insideMm * outwardSign;
    for (const offsetMm of [-halfMm, halfMm]) {
      ticks.push(
        line(
          outerXMm,
          FIELD_CENTER_Y_MM + offsetMm,
          innerXMm,
          FIELD_CENTER_Y_MM + offsetMm,
        ),
      );
    }
    ticks.push(
      line(
        goalLineXMm,
        FIELD_CENTER_Y_MM,
        goalLineXMm - GOAL_GUIDE.centerInsideMm * outwardSign,
        FIELD_CENTER_Y_MM,
      ),
    );
  }
  return ticks;
};

export const renderField = (): string =>
  svgDocument({
    widthMm: BOARD.widthMm,
    heightMm: BOARD.heightMm,
    title: '축구 게임판 · 운동장',
    children: [
      group(
        {
          id: ART_LAYER_ID,
          fill: 'none',
          stroke: FIELD_LINE_COLOR,
          'stroke-width': lineWidthMm,
        },
        [
          // 터치라인·골라인
          rect(FIELD.xMm, FIELD.yMm, FIELD.widthMm, FIELD.heightMm),
          // 하프라인과 센터서클
          line(
            FIELD_CENTER_X_MM,
            FIELD.yMm,
            FIELD_CENTER_X_MM,
            FIELD_BOTTOM_MM,
          ),
          circle(FIELD_CENTER_X_MM, FIELD_CENTER_Y_MM, centerCircleRadiusMm),
          spot(FIELD_CENTER_X_MM),
          ...goalLineBox(penaltyAreaDepthMm, penaltyAreaWidthMm),
          ...goalLineBox(goalAreaDepthMm, goalAreaWidthMm),
          spot(FIELD.xMm + penaltySpotDistanceMm),
          spot(FIELD_RIGHT_MM - penaltySpotDistanceMm),
          penaltyArc(
            FIELD.xMm + penaltySpotDistanceMm,
            FIELD.xMm + penaltyAreaDepthMm,
          ),
          penaltyArc(
            FIELD_RIGHT_MM - penaltySpotDistanceMm,
            FIELD_RIGHT_MM - penaltyAreaDepthMm,
          ),
          ...cornerArcs(),
          ...goalGuideTicks(),
        ],
      ),

      // 선수 마커가 놓이는 자리. 값은 렌더러가 그린다 — 아트워크가 직접 그려
      // 넣으면 커스터마이즈가 먹지 않는다.
      '<g id="pc-slot" />',
    ],
  });

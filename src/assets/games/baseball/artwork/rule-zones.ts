/**
 * 실제 야구 규칙의 판정 영역 (IDE-044)
 *
 * 기본 규칙 판에서 아웃이 되는 자리는 「수비수 그림에 맞으면」뿐이었다. 그
 * 넓이가 페어 지역의 7.6%라, **유격수 앞에 멈춘 땅볼이 안타**가 됐다
 * (2026-09-20 사용자 지적). 여기서 그리는 것은 그 빈자리를 메우는 선들이다 —
 * 수비수마다의 **범위 원**, 파울라인 안쪽의 **선상 쐐기**, 아웃선 안의
 * **번트 가름선**, 그리고 겹쳤을 때 무엇이 이기는지를 적은 **판정 차례**.
 *
 * ## 층이 둘이다 — 옅은 면은 아래, 선과 글자는 위
 *
 * 범위 원의 옅은 면은 **경기장 선 아래**에 깔린다(`reachWash`). 위에 얹으면
 * 흙색 다이아몬드와 빨간 아웃선을 덮어 버린다 — 인쇄 파서는 `fill-opacity`를
 * 읽지 않으므로(`lib/print/artwork.ts`) 반투명으로 피해 갈 수 없고, 아예 **옅은
 * 색을 밑에 까는 것**이 화면과 인쇄물에서 똑같이 나오는 유일한 길이다.
 *
 * ## 겹치는 자리는 그림이 아니라 차례가 가른다
 *
 * 선상 쐐기와 수비 범위는 겹친다. 처음에는 쐐기에서 원을 오려 낼 생각이었으나
 * (`spikes/baseball-rule-zones/`가 마스크로 그렇게 그렸다) **인쇄 경로가 마스크도
 * 클립도 받지 않는다.** 대신 범위 원을 쐐기 **위에** 그려 눈으로 이기게 하고,
 * 판정 차례 일곱 줄을 판 오른쪽 아래에 찍는다 — 옛 인쇄본이 아이들 합의에
 * 맡겨 형제끼리 싸우던 자리를 종이가 대신 말한다.
 *
 * 잉크를 아낀다. 공이 미끄러지는 면이라 두꺼운 잉크는 연필 자국도 더 남긴다 —
 * 쐐기와 번트 칸은 **선만** 긋고, 면을 까는 것은 범위 원뿐이다.
 */
import {
  BOARD,
  BUNT_CALLS,
  HOME,
  JUDGE_ORDER,
  LINES,
  LINE_DRIVE_SIDES,
  REAL_RULE_ZONES,
  fieldPoint,
  lineDriveCall,
  reachCall,
} from '../dimensions.ts';
import {
  INK_COLOR,
  RULE_COLOR,
  circle,
  estimateTextWidthMm,
  group,
  line,
  num,
  path,
  text,
} from '../../../shared/svg.ts';
import type { DefenseOnField, FieldSpec } from './field-spec.ts';

/** 땅볼 — 아웃선과 같은 빨강이다. 둘 다 "내야에서 잡혔다"를 뜻한다. */
const GROUND_COLOR = '#dc2626';
/** 뜬공 — 땅볼과 갈라 읽히되 이웃한 색. 흑백에서는 농도로 갈린다. */
const FLY_COLOR = '#ea580c';
/** 선상 2루타 — 2루타선과 같은 파랑. */
const LINE_DRIVE_COLOR = '#1d4ed8';

/**
 * 범위 원 안에 까는 색.
 *
 * **여기 값 둘이 「점선이냐 옅은 면이냐」의 나사다**(할 일의 물음). 실물로
 * 뽑아 보고 면이 두껍거나 연필이 미끄러지지 않으면 `'none'`으로 바꾸면 된다 —
 * 점선 테두리는 그대로 남으므로 원은 여전히 원이다.
 */
const REACH_WASH: Readonly<Record<'infield' | 'outfield', string>> = {
  infield: '#fdeaea',
  outfield: '#fdf1e7',
};

const zoneColor = (at: DefenseOnField): string =>
  at.position.zone === 'infield' ? GROUND_COLOR : FLY_COLOR;

/** 범위 원의 테두리 — 판정선과 갈라 읽히게 파선이고 조금 가늘다. */
const REACH_STROKE = { widthMm: 0.7, dash: '3 1.6' } as const;

/** 홈에서 `bearingDeg` 방향으로 갔을 때 종이를 벗어나는 거리. */
const edgeDistanceMm = (bearingDeg: number): number => {
  const rad = (Math.abs(bearingDeg) * Math.PI) / 180;
  const sideMm =
    Math.sin(rad) > 0 ? BOARD.widthMm / 2 / Math.sin(rad) : Infinity;
  return Math.min(sideMm, HOME.yMm / Math.cos(rad));
};

/** 종이 안에 붙들어 둔다 — 글자는 잘리면 읽을 수 없다. */
const onPaperY = (yMm: number): number =>
  Math.min(Math.max(yMm, 4), BOARD.heightMm - 4);

const zoneLabel = (
  value: string,
  xMm: number,
  yMm: number,
  fontMm: number,
  color: string,
  attrs: Record<string, string | number | undefined> = {},
): string =>
  text(value, xMm, yMm, fontMm, {
    'text-anchor': 'middle',
    fill: color,
    stroke: 'none',
    'font-weight': 600,
    ...attrs,
  });

/**
 * 범위 원의 옅은 면 — **경기장 선 아래에 깔린다.**
 *
 * 테두리는 여기 없다. 선과 글자는 경기장 위에 얹혀야 읽히므로 `ruleZones`가
 * 따로 그린다.
 */
export const reachWash = (spec: FieldSpec): string[] =>
  spec.ruleSet === 'real'
    ? [
        group({ id: 'pc-reach-wash', stroke: 'none' }, [
          ...spec.defense.map((at) =>
            circle(at.xMm, at.yMm, at.reachMm, {
              fill: REACH_WASH[at.position.zone],
            }),
          ),
        ]),
      ]
    : [];

/** 선상 쐐기 — 베이스 바깥 파울라인 안쪽 7°. 안쪽 호와 38° 변만 긋는다. */
const lineDriveWedges = (): string[] => {
  const { lineDriveDeg, lineDriveFromMm } = REAL_RULE_ZONES;
  return [1, -1].flatMap((side) => {
    const innerAt = fieldPoint(side * lineDriveDeg, lineDriveFromMm);
    const innerFoul = fieldPoint(side * 45, lineDriveFromMm);
    const outerAt = fieldPoint(
      side * lineDriveDeg,
      edgeDistanceMm(lineDriveDeg),
    );
    // 45° 변은 이미 파울라인이 긋고 있다 — 같은 자리에 두 선을 겹치지 않는다.
    return [
      path(
        `M ${num(innerAt.xMm)} ${num(innerAt.yMm)} ` +
          `A ${num(lineDriveFromMm)} ${num(lineDriveFromMm)} 0 0 ${side > 0 ? 1 : 0} ` +
          `${num(innerFoul.xMm)} ${num(innerFoul.yMm)}`,
      ),
      line(innerAt.xMm, innerAt.yMm, outerAt.xMm, outerAt.yMm),
    ];
  });
};

/** 선상 2루타 이름표 — 쐐기 방향으로 눕는다. 좁은 띠라 가로로 쓰면 넘친다. */
const lineDriveLabels = (): string[] =>
  [1, -1].map((side) => {
    const bearing = side * 41.5;
    const at = fieldPoint(bearing, 122);
    return zoneLabel(
      lineDriveCall(LINE_DRIVE_SIDES[side > 0 ? 1 : 0]),
      at.xMm,
      at.yMm,
      3.4,
      LINE_DRIVE_COLOR,
      {
        transform: `rotate(${num(-bearing)} ${num(at.xMm)} ${num(at.yMm)})`,
      },
    );
  });

/**
 * 번트 칸 — 아웃선 안을 30°로 가른다.
 *
 * 아웃선과 그 안쪽은 지금 판 그대로다(약한 땅볼 = 아웃). 여기 더하는 것은
 * **선언**이다 — 치기 전에 "번트"라고 말하고 튕기면 양옆이 번트안타, 가운데는
 * 실패다. 선은 홈에서 아웃선까지 둘뿐이다.
 */
const buntZones = (): string[] => {
  const { buntDeg } = REAL_RULE_ZONES;
  return [1, -1].map((side) => {
    const at = fieldPoint(side * buntDeg, LINES.outMm);
    return line(HOME.xMm, HOME.yMm, at.xMm, at.yMm);
  });
};

const buntLabels = (): string[] => [
  // 번트안타 칸은 30°와 파울라인 사이 15°뿐이라 가로로 쓰면 넘친다 — 선상
  // 이름표와 같이 **반지름 방향으로 눕힌다.** 그러면 글자가 홈에서 아웃선
  // 쪽으로 뻗어 칸을 따라 읽힌다.
  ...[1, -1].map((side) => {
    const bearing = side * 37.5;
    const at = fieldPoint(bearing, 40);
    return zoneLabel(BUNT_CALLS.hit, at.xMm, at.yMm, 3, GROUND_COLOR, {
      transform: `rotate(${num(-bearing)} ${num(at.xMm)} ${num(at.yMm)})`,
    });
  }),
  zoneLabel('번트 실패', HOME.xMm, HOME.yMm - 28, 3, GROUND_COLOR),
];

/**
 * 수비 범위 원과 그 판정.
 *
 * 이름표에 **능력치를 붙이는 것은 준 자리뿐이다**(`IDE-032`의 "들어갈 때만
 * 적는다"). 배분하지 않은 판에는 `+0`이 여덟 번 찍히지 않는다.
 *
 * 투수 범위에는 판정을 적지 않는다 — 아웃선 안과 한 덩어리라 「번트 실패」와
 * 글자가 겹친다. 투수 앞에 멈춘 공은 어차피 아웃선 안이라 같은 아웃이다.
 */
const reachRings = (spec: FieldSpec): string[] =>
  spec.defense.flatMap((at) => {
    const color = zoneColor(at);
    const name =
      at.abilityMm > 0
        ? `${at.position.label} +${at.abilityMm}`
        : at.position.label;
    return [
      circle(at.xMm, at.yMm, at.reachMm, {
        stroke: color,
        'stroke-width': REACH_STROKE.widthMm,
        'stroke-dasharray': REACH_STROKE.dash,
      }),
      zoneLabel(name, at.xMm, onPaperY(at.yMm - 13), 2.8, INK_COLOR, {
        'font-weight': undefined,
      }),
      ...(at.position.id === 'pitcher'
        ? []
        : [
            zoneLabel(
              reachCall(at.position),
              at.xMm,
              onPaperY(at.yMm + at.reachMm - 4.5),
              3,
              color,
            ),
          ]),
    ];
  });

/**
 * 판정 차례 — 오른쪽 아래 파울 지역.
 *
 * 왼쪽 아래의 S·O 카운터와 마주 보는 자리다. 파울라인(x + y = 379) 바깥이라
 * 어느 시프트에서도 수비가 서지 않고, 백네트(홈에서 19mm)에도 닿지 않는다.
 *
 * **여기 적힌 일곱 줄이 규칙문과 같은 상수다**(`JUDGE_ORDER`). 설명서를 펴지
 * 않고도 겹친 자리를 가를 수 있어야 하므로 판 쪽이 원본이다.
 */
const JUDGE_PANEL = {
  // 파울라인에서 떼어 놓는다(2026-09-20 사용자 요청). **가로는 2.5mm가
  // 끝이었다** — 가장 긴 줄(「내야 땅볼 · 병살 · 외야 뜬공」)이 종이 오른쪽
  // 안전선(210 − 4 = 206mm)에 0.5mm를 남기고 닿는다.
  //
  // 그래서 나머지는 **아래로** 간다. 파울 삼각형은 내려갈수록 넓어지므로
  // (파울라인이 x + y = 379다) 칸을 6mm 내리면 왼쪽 위 모서리와 1루
  // 베이스라인 사이가 5.5 → 11.5mm로 벌어진다 — 오른쪽으로 6mm를 민 것과
  // 같은 효과다. 줄 간격을 5.2 → 4.9로 좁혀 마지막 줄이 종이 아래
  // 안전선(293mm) 안에 남는다.
  whereXMm: 139.5,
  callXMm: 164.5,
  topYMm: 251,
  rowGapMm: 4.9,
  fontMm: 2.8,
  /** 번트 선언 한 줄. 칸보다 길어 한 호 작다. */
  noteFontMm: 2.6,
} as const;

/** 번트는 선언해야 성립한다 — 판정 차례 아래에 한 줄로 붙인다. */
const noteText = (): string =>
  `번트는 치기 전에 선언한다 · ${BUNT_CALLS.tooHard}`;

const judgePanel = (): string[] => {
  const { whereXMm, callXMm, topYMm, rowGapMm, fontMm, noteFontMm } =
    JUDGE_PANEL;
  const row = (
    value: string,
    xMm: number,
    yMm: number,
    color: string,
    sizeMm: number = fontMm,
  ) =>
    text(value, xMm, yMm, sizeMm, {
      'text-anchor': 'start',
      fill: color,
      stroke: 'none',
    });
  return [
    text('판정 차례 — 위에서부터 읽는다', whereXMm, topYMm, 3.2, {
      'text-anchor': 'start',
      fill: INK_COLOR,
      stroke: 'none',
      'font-weight': 600,
    }),
    ...JUDGE_ORDER.flatMap((step, i) => {
      const yMm = topYMm + rowGapMm * (i + 1);
      return [
        row(`${i + 1}. ${step.where}`, whereXMm, yMm, RULE_COLOR),
        row(`→ ${step.call}`, callXMm, yMm, INK_COLOR),
      ];
    }),
    row(
      noteText(),
      whereXMm,
      topYMm + rowGapMm * (JUDGE_ORDER.length + 1) + 1,
      RULE_COLOR,
      noteFontMm,
    ),
  ];
};

/**
 * 판정 영역 층 — **경기장 선 위, 선수 마커 아래**.
 *
 * 기본 규칙이면 빈 배열이다. 그래서 기본 판은 IDE-014가 그린 야구장과
 * 바이트까지 같다.
 */
export const ruleZones = (spec: FieldSpec): string[] =>
  spec.ruleSet === 'real'
    ? [
        group({ id: 'pc-zones', fill: 'none', stroke: 'none' }, [
          group(
            {
              stroke: LINE_DRIVE_COLOR,
              'stroke-width': 0.7,
            },
            lineDriveWedges(),
          ),
          group(
            {
              stroke: GROUND_COLOR,
              'stroke-width': 0.5,
              'stroke-dasharray': '2 1.4',
            },
            buntZones(),
          ),
          group({}, reachRings(spec)),
          ...buntLabels(),
          ...lineDriveLabels(),
          ...judgePanel(),
        ]),
      ]
    : [];

/**
 * 판정 차례 칸이 판 안에 드는가 — 칸 이름·판정·번트 한 줄이 모두 오른쪽
 * 끝을 넘지 않고, 마지막 줄이 종이 아래 끝에 걸리지 않는다. 테스트가 쓴다.
 */
export const judgePanelFitsBoard = (): boolean => {
  const { whereXMm, callXMm, topYMm, rowGapMm, fontMm, noteFontMm } =
    JUDGE_PANEL;
  const rightEdgeMm = Math.max(
    ...JUDGE_ORDER.flatMap((step, i) => [
      whereXMm + estimateTextWidthMm(`${i + 1}. ${step.where}`, fontMm),
      callXMm + estimateTextWidthMm(`→ ${step.call}`, fontMm),
    ]),
    whereXMm + estimateTextWidthMm(noteText(), noteFontMm),
  );
  const whereColumnMm = Math.max(
    ...JUDGE_ORDER.map((step, i) =>
      estimateTextWidthMm(`${i + 1}. ${step.where}`, fontMm),
    ),
  );
  const bottomMm = topYMm + rowGapMm * (JUDGE_ORDER.length + 1) + 1;
  return (
    rightEdgeMm <= BOARD.widthMm - 4 &&
    // 칸 이름이 판정 열을 밀고 들어가지 않는다.
    whereXMm + whereColumnMm <= callXMm &&
    bottomMm <= BOARD.heightMm - 4
  );
};

/** 판정 차례 칸이 파울 지역 안에 있는가 — 수비가 서는 자리를 덮지 않는다. */
export const judgePanelInFoulTerritory = (): boolean =>
  JUDGE_PANEL.whereXMm + JUDGE_PANEL.topYMm > HOME.xMm + HOME.yMm;

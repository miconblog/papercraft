/**
 * 조립물 파트 — 종이 주사위 (IDE-015)
 *
 * 옛 인쇄본의 위 띠에 있던 〈종이주사위 만들기〉다. "잘라서 오리고 풀칠을 하고
 * 접어서 만듭니다." — 십자 전개도에 풀칠면 일곱이고, 마주 보는 면의 눈을
 * 더하면 7이 된다(1–6 · 2–5 · 3–4).
 *
 * 축구 골대·야구 스탠드와 달리 **풀을 쓴다.** 정육면체는 풀 없이 닫히지 않고,
 * 주사위는 던지는 물건이라 끼워 맞춘 모서리가 벌어지면 굴러가지 않는다.
 *
 * 면의 차례(왼쪽부터) A·B·C·D, B 위가 T, B 아래가 U. 눈은 B=1 D=6, A=2 C=5,
 * T=3 U=4.
 */
import { DICE, DICE_SHEET } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  glueHatch,
  group,
  line,
  markLayer,
  num,
  path,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const s = DICE.faceMm;
const d = DICE.tabDepthMm;
const i = DICE.tabInsetMm;
const ox = DICE.originXMm;
const oy = DICE.originYMm;

type Pt = readonly [number, number];

/** 바깥 오림선 — 면 여섯과 풀칠면 일곱을 한 붓으로 두른다. A의 왼쪽 위에서 시계 방향. */
const OUTLINE: readonly Pt[] = [
  [ox, oy + s],
  // A 위 풀칠면
  [ox + i, oy + s - d],
  [ox + s - i, oy + s - d],
  [ox + s, oy + s],
  // T
  [ox + s, oy],
  [ox + 2 * s, oy],
  [ox + 2 * s, oy + s],
  // C 위 풀칠면
  [ox + 2 * s + i, oy + s - d],
  [ox + 3 * s - i, oy + s - d],
  [ox + 3 * s, oy + s],
  // D 위 풀칠면
  [ox + 3 * s + i, oy + s - d],
  [ox + 4 * s - i, oy + s - d],
  [ox + 4 * s, oy + s],
  // D 오른쪽 풀칠면
  [ox + 4 * s + d, oy + s + i],
  [ox + 4 * s + d, oy + 2 * s - i],
  [ox + 4 * s, oy + 2 * s],
  // D 아래 풀칠면
  [ox + 4 * s - i, oy + 2 * s + d],
  [ox + 3 * s + i, oy + 2 * s + d],
  [ox + 3 * s, oy + 2 * s],
  // C 아래 풀칠면
  [ox + 3 * s - i, oy + 2 * s + d],
  [ox + 2 * s + i, oy + 2 * s + d],
  [ox + 2 * s, oy + 2 * s],
  // U
  [ox + 2 * s, oy + 3 * s],
  [ox + s, oy + 3 * s],
  [ox + s, oy + 2 * s],
  // A 아래 풀칠면
  [ox + s - i, oy + 2 * s + d],
  [ox + i, oy + 2 * s + d],
  [ox, oy + 2 * s],
];

/** 접는선(골접기) — 면 사이 다섯 + 풀칠면 밑동 일곱. */
const FOLDS: ReadonlyArray<readonly [Pt, Pt]> = [
  // 면 사이
  [
    [ox + s, oy + s],
    [ox + s, oy + 2 * s],
  ],
  [
    [ox + 2 * s, oy + s],
    [ox + 2 * s, oy + 2 * s],
  ],
  [
    [ox + 3 * s, oy + s],
    [ox + 3 * s, oy + 2 * s],
  ],
  [
    [ox + s, oy + s],
    [ox + 2 * s, oy + s],
  ],
  [
    [ox + s, oy + 2 * s],
    [ox + 2 * s, oy + 2 * s],
  ],
  // 풀칠면 밑동
  [
    [ox, oy + s],
    [ox + s, oy + s],
  ],
  [
    [ox + 2 * s, oy + s],
    [ox + 3 * s, oy + s],
  ],
  [
    [ox + 3 * s, oy + s],
    [ox + 4 * s, oy + s],
  ],
  [
    [ox + 4 * s, oy + s],
    [ox + 4 * s, oy + 2 * s],
  ],
  [
    [ox + 3 * s, oy + 2 * s],
    [ox + 4 * s, oy + 2 * s],
  ],
  [
    [ox + 2 * s, oy + 2 * s],
    [ox + 3 * s, oy + 2 * s],
  ],
  [
    [ox, oy + 2 * s],
    [ox + s, oy + 2 * s],
  ],
];

/** 풀칠면 빗금 상자 — 사다리꼴 안쪽에 드는 사각형. */
const GLUE_BOXES: ReadonlyArray<readonly [number, number, number, number]> = [
  [ox + i, oy + s - d + 0.8, s - 2 * i, d - 1.6], // A 위
  [ox + 2 * s + i, oy + s - d + 0.8, s - 2 * i, d - 1.6], // C 위
  [ox + 3 * s + i, oy + s - d + 0.8, s - 2 * i, d - 1.6], // D 위
  [ox + 4 * s + 0.8, oy + s + i, d - 1.6, s - 2 * i], // D 오른쪽
  [ox + 3 * s + i, oy + 2 * s + 0.8, s - 2 * i, d - 1.6], // D 아래
  [ox + 2 * s + i, oy + 2 * s + 0.8, s - 2 * i, d - 1.6], // C 아래
  [ox + i, oy + 2 * s + 0.8, s - 2 * i, d - 1.6], // A 아래
];

/** 면의 좌상단과 눈 수. */
const FACES: ReadonlyArray<{ x: number; y: number; pips: number }> = [
  { x: ox, y: oy + s, pips: 2 }, // A
  { x: ox + s, y: oy + s, pips: 1 }, // B
  { x: ox + 2 * s, y: oy + s, pips: 5 }, // C
  { x: ox + 3 * s, y: oy + s, pips: 6 }, // D
  { x: ox + s, y: oy, pips: 3 }, // T
  { x: ox + s, y: oy + 2 * s, pips: 4 }, // U
];

/** 눈 자리 — 면 한 변을 1로 본 좌표. */
const PIP_LAYOUT: Readonly<Record<number, ReadonlyArray<Pt>>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.27, 0.27],
    [0.5, 0.5],
    [0.73, 0.73],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.27, 0.25],
    [0.73, 0.25],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.75],
    [0.73, 0.75],
  ],
};

export const renderDice = (): string => {
  const outline = path(
    OUTLINE.map(
      ([x, y], k) => `${k === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`,
    ).join('') + 'Z',
  );
  const folds = FOLDS.map(([[x1, y1], [x2, y2]]) => line(x1, y1, x2, y2));
  const glue = GLUE_BOXES.flatMap(([x, y, w, h]) => glueHatch(x, y, w, h));
  const pips = FACES.flatMap((face) =>
    PIP_LAYOUT[face.pips].map(([fx, fy]) =>
      circle(face.x + fx * s, face.y + fy * s, DICE.pipRadiusMm),
    ),
  );

  return svgDocument({
    widthMm: DICE_SHEET.widthMm,
    heightMm: DICE_SHEET.heightMm,
    title: '세계일주 주사위놀이 · 종이 주사위',
    children: [
      markLayer('cut', [outline]),
      markLayer('fold-valley', folds),
      markLayer('glue', glue),
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('종이 주사위', DICE_SHEET.widthMm / 2, 6, 5, {
          'text-anchor': 'middle',
          'font-weight': 'bold',
        }),
        text(
          '바깥 실선을 오리고 파선을 안으로 접는다. 빗금 면에 풀을 발라 정육면체로 붙인다.',
          DICE_SHEET.widthMm / 2,
          11.5,
          2.6,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
        ...pips,
      ]),
    ],
  });
};

/** 테스트가 쓴다 — 마주 보는 면의 눈 합. */
export const OPPOSITE_FACE_SUMS = [
  FACES[0].pips + FACES[2].pips,
  FACES[1].pips + FACES[3].pips,
  FACES[4].pips + FACES[5].pips,
] as const;
export const GLUE_TAB_COUNT = GLUE_BOXES.length;

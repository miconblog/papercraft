/**
 * 홀 판 한 장 (IDE-030)
 *
 * 열여덟 장이 **같은 함수에서 나온다** — 다른 것은 `HOLES`의 홀 하나뿐이다.
 * 판마다 손으로 그리면 열여덟 번 어긋날 자리가 생기고, 머리띠 위치 하나를
 * 고치는 데 열여덟 파일을 고쳐야 한다.
 *
 * 그리는 차례가 곧 겹치는 차례다: 페어웨이 → 물 → 그린 → 벙커 → 숲 → 티 →
 * 홀. **물이 페어웨이보다 나중**인 것은 3번 홀처럼 연못이 페어웨이를 가로지르는
 * 홀이 있기 때문이고, **그린이 물보다 나중**인 것은 6번 홀의 섬 그린 때문이다.
 */
import {
  BOARD,
  COURSE,
  COURSE_AREA,
  HOLES,
  INK,
  PANEL,
  TYPE,
  cupPoint,
  greenCenter,
  teePoint,
  type EllipseSpec,
  type HoleSpec,
  type Xy,
} from '../dimensions.ts';
import { PENALTY, termsForPar } from '../scoring.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  line,
  path,
  rect,
  svgDocument,
  text,
  estimateTextWidthMm,
} from '../../../shared/svg.ts';
import { SLOT_LAYER_ID } from '../../../../lib/schema/marks.ts';
import {
  clearanceFromPolygon,
  closedPath,
  ellipsePoints,
  ellipseRadiusAt,
  grow,
  inEllipse,
  openPath,
  plantForest,
  pointInPolygon,
  rectContains,
  pt,
  ribbon,
  smoothSpine,
  trimEnd,
  type Pt,
  type Rect,
  type Tree,
} from './geometry.ts';

export interface HoleLayout {
  readonly hole: HoleSpec;
  readonly spine: Pt[];
  readonly fairway: Pt[];
  readonly green: Pt[];
  /** 그린을 두르는 띠. 그린보다 먼저 깔린다. */
  readonly collar: Pt[];
  readonly greenCenter: Pt;
  readonly cup: Pt;
  readonly tee: { readonly center: Pt; readonly corners: Pt[] };
  /** 그린 밖으로 민 뒤의 벙커. 그림과 검사가 같은 값을 본다. */
  readonly bunkerSpecs: EllipseSpec[];
  readonly bunkers: Pt[][];
  readonly ponds: Pt[][];
  readonly streams: Pt[][];
  readonly trees: Tree[];
}

const ellipseRing = (e: EllipseSpec): Pt[] =>
  ellipsePoints(e.xMm, e.yMm, e.rxMm, e.ryMm, e.rotDeg ?? 0);

/**
 * 그린을 덮은 벙커를 바깥으로 민다.
 *
 * 벙커 좌표는 손으로 적는데, 그린에 붙이려다 보면 몇 mm씩 올라탄다. 종이에서는
 * 모래가 그린 위에 얹힌 것처럼 보이고, 규칙으로도 말이 안 된다 — 그린과 벙커는
 * 닿을 뿐 겹치지 않는다. **데이터를 열여덟 번 고치는 대신 규칙을 여기 한 곳에
 * 둔다**: 미는 방향은 그린 중심에서 벙커 중심으로, 미는 거리는 칼라 바깥에
 * 겨우 닿을 만큼이다. 이미 떨어져 있는 벙커는 건드리지 않는다.
 */
function clearOfGreen(
  bunker: EllipseSpec,
  green: Xy,
  greenRxMm: number,
  greenRyMm: number,
): EllipseSpec {
  const dx = bunker.xMm - green[0];
  const dy = bunker.yMm - green[1];
  const angle = Math.atan2(dy, dx);
  const gap =
    ellipseRadiusAt(
      greenRxMm + COURSE.greenCollarMm,
      greenRyMm + COURSE.greenCollarMm,
      angle,
    ) +
    Math.max(bunker.rxMm, bunker.ryMm) +
    0.8;
  const current = Math.hypot(dx, dy);
  if (current >= gap) return bunker;
  // 중심이 겹쳐 방향을 못 정하면 그린 위쪽으로 민다.
  const ux = current < 0.01 ? 0 : dx / current;
  const uy = current < 0.01 ? -1 : dy / current;
  return { ...bunker, xMm: green[0] + ux * gap, yMm: green[1] + uy * gap };
}

/** 티 박스 — 진행 방향에 수직인 긴 변을 갖는 직사각형. */
function teeCorners(center: Pt, heading: Pt): Pt[] {
  const half = COURSE.teeWidthMm / 2;
  const depth = COURSE.teeHeightMm / 2;
  // 진행 방향이 '깊이', 그 수직이 '폭'이다.
  const n = pt(heading.y, -heading.x);
  return [
    pt(
      center.x + n.x * half - heading.x * depth,
      center.y + n.y * half - heading.y * depth,
    ),
    pt(
      center.x + n.x * half + heading.x * depth,
      center.y + n.y * half + heading.y * depth,
    ),
    pt(
      center.x - n.x * half + heading.x * depth,
      center.y - n.y * half + heading.y * depth,
    ),
    pt(
      center.x - n.x * half - heading.x * depth,
      center.y - n.y * half - heading.y * depth,
    ),
  ];
}

/**
 * 홀 하나의 모든 좌표. 렌더러와 테스트가 **같은 값**을 본다 — 검증이 그림이
 * 아니라 이 구조를 보므로 "판에는 있는데 검사에는 없는 것"이 생기지 않는다.
 */
export function layoutHole(hole: HoleSpec): HoleLayout {
  const spine = smoothSpine(hole.spine);
  const [gx, gy] = greenCenter(hole);
  // 페어웨이는 그린 앞에서 끝난다 — 중심까지 부풀리면 굽은 홀에서 그린
  // 옆구리로 길이 새어 나간다.
  const fairway = ribbon(
    trimEnd(spine, Math.min(hole.green.rxMm, hole.green.ryMm) * 0.6),
    hole.fairwayWidthMm,
  );
  const green = ellipsePoints(gx, gy, hole.green.rxMm, hole.green.ryMm);
  const collar = ellipsePoints(
    gx,
    gy,
    hole.green.rxMm + COURSE.greenCollarMm,
    hole.green.ryMm + COURSE.greenCollarMm,
  );
  const [cx, cy] = cupPoint(hole);
  const [tx, ty] = teePoint(hole);
  const heading = (() => {
    const a = spine[0];
    const b = spine[Math.min(3, spine.length - 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return pt((b.x - a.x) / len, (b.y - a.y) / len);
  })();
  const tee = { center: pt(tx, ty), corners: teeCorners(pt(tx, ty), heading) };
  const bunkerSpecs = hole.bunkers.map((b) =>
    clearOfGreen(b, [gx, gy], hole.green.rxMm, hole.green.ryMm),
  );
  const bunkers = bunkerSpecs.map(ellipseRing);
  const ponds = hole.ponds.map(ellipseRing);
  const streams = hole.streams.map((s) =>
    ribbon(smoothSpine(s.points, 10), s.widthMm, false),
  );

  const panelRect: Rect = {
    xMm: hole.panel[0],
    yMm: hole.panel[1],
    widthMm: PANEL.widthMm,
    heightMm: PANEL.heightMm,
  };

  /**
   * O.B. 처분이 적히는 아래 두 모서리 (IDE-032).
   *
   * 글자가 나무보다 나중에 그려져 가려지지는 않지만, 연한 잎 위의 회색 글자는
   * 흐려서 읽히지 않는다. **자리를 비우는 편이 낫다.**
   */
  const obLabelBoxes: Rect[] = [
    {
      xMm: COURSE_AREA.xMm,
      yMm: COURSE_AREA.yMm + COURSE_AREA.heightMm - 10,
      widthMm: 54,
      heightMm: 10,
    },
    {
      xMm: COURSE_AREA.xMm + COURSE_AREA.widthMm - 22,
      yMm: COURSE_AREA.yMm + COURSE_AREA.heightMm - 10,
      widthMm: 22,
      heightMm: 10,
    },
  ];

  /**
   * 나무가 앉으면 안 되는 자리. 코스에서 놀이가 일어나는 면 전부와 **홀 정보
   * 카드**다 — 카드는 코스 위에 얹히므로 그 밑에 나무를 심으면 가려진다.
   */
  const blocked = (p: Pt, r: number): boolean => {
    const pad = COURSE.treeClearanceMm + r;
    if (rectContains(grow(panelRect, r + 1), p)) return true;
    if (obLabelBoxes.some((box) => rectContains(grow(box, r), p))) return true;
    if (
      p.x - r < COURSE_AREA.xMm + 1 ||
      p.x + r > COURSE_AREA.xMm + COURSE_AREA.widthMm - 1 ||
      p.y - r < COURSE_AREA.yMm + 1 ||
      p.y + r > COURSE_AREA.yMm + COURSE_AREA.heightMm - 1
    ) {
      return true;
    }
    if (clearanceFromPolygon(fairway, p) < pad) return true;
    if (clearanceFromPolygon(green, p) < pad) return true;
    if (clearanceFromPolygon(tee.corners, p) < pad) return true;
    if (streams.some((s) => clearanceFromPolygon(s, p) < pad)) return true;
    if (
      hole.ponds.some((e) =>
        inEllipse(p, e.xMm, e.yMm, e.rxMm + pad, e.ryMm + pad, e.rotDeg ?? 0),
      )
    ) {
      return true;
    }
    return bunkerSpecs.some((e) =>
      inEllipse(p, e.xMm, e.yMm, e.rxMm + pad, e.ryMm + pad, e.rotDeg ?? 0),
    );
  };

  const trees: Tree[] = [];
  const plant = (
    box: { xMm: number; yMm: number; widthMm: number; heightMm: number },
    count: number,
    seed: number,
    spacingMm: number,
  ) =>
    trees.push(
      ...plantForest(
        {
          box,
          count,
          // 씨앗은 홀 번호와 차례에서만 나온다 — 돌릴 때마다 같은 숲이어야
          // 커밋된 SVG와 생성기가 어긋나지 않는다.
          seed,
          radiusMm: COURSE.treeRadiusMm,
          jitterMm: COURSE.treeRadiusJitterMm,
          spacingMm,
          blocked,
        },
        trees,
      ),
    );

  for (const [i, forest] of hole.forests.entries()) {
    plant(
      forest,
      forest.count,
      hole.number * 1009 + i * 37 + 7,
      COURSE.treeSpacingMm,
    );
  }

  // 남는 러프를 메우는 몫. 숲을 다 심은 뒤라 이미 선 나무를 피해 앉는다.
  plant(
    COURSE_AREA,
    COURSE.scatterCount,
    hole.number * 7717 + 31,
    COURSE.scatterSpacingMm,
  );

  return {
    hole,
    spine,
    fairway,
    green,
    collar,
    greenCenter: pt(gx, gy),
    cup: pt(cx, cy),
    tee,
    bunkerSpecs,
    bunkers,
    ponds,
    streams,
    trees,
  };
}

/**
 * 땅 위에 적는 처분 (IDE-032).
 *
 * 사용자가 쳐 보고 청했다 — 벌타와 되돌아가는 자리를 **땅 모양에 같이** 적어
 * 설명서를 왔다 갔다 하지 않게 해 달라고. 그래서 모래에는 `+1타`가, 물에는
 * `+1타`와 `앞자리에서 다시`가 적힌다.
 *
 * 글자가 도형보다 크면 아무 말도 안 하느니만 못하므로 **들어갈 때만 적는다** —
 * 폭이 모자라면 두 줄 중 아랫줄을 버리고, 그래도 모자라면 통째로 뺀다.
 */
function penaltyMark(
  center: Pt,
  penalty: { mark: string; note: string | null },
  widthMm: number,
  color: string,
): string[] {
  const markFont = COURSE.penaltyFontMm;
  const noteFont = COURSE.penaltyNoteFontMm;
  if (estimateTextWidthMm(penalty.mark, markFont) > widthMm) return [];

  const note =
    penalty.note !== null &&
    estimateTextWidthMm(penalty.note, noteFont) <= widthMm
      ? penalty.note
      : null;
  const shift = note === null ? 0 : markFont * 0.5;

  return [
    text(penalty.mark, center.x, center.y - shift, markFont, {
      fill: color,
      'text-anchor': 'middle',
      'font-weight': 'bold',
    }),
    ...(note === null
      ? []
      : [
          text(note, center.x, center.y + noteFont * 1.35, noteFont, {
            fill: color,
            'text-anchor': 'middle',
          }),
        ]),
  ];
}

/**
 * 물의 처분을 적을 자리.
 *
 * 연못 한가운데가 첫 후보지만 6번 홀은 거기에 섬 그린이 떠 있다. 그린에 물리면
 * 아래쪽으로, 그래도 물리면 위쪽으로 비킨다 — 물 위 어딘가에는 적혀야 한다.
 */
function waterLabelSpot(e: EllipseSpec, green: readonly Pt[]): Pt | null {
  const candidates: Pt[] = [
    pt(e.xMm, e.yMm),
    pt(e.xMm, e.yMm + e.ryMm * 0.62),
    pt(e.xMm, e.yMm - e.ryMm * 0.62),
  ];
  return candidates.find((c) => !pointInPolygon(green, c)) ?? null;
}

/** 개울의 처분을 적을 자리 — 중심선의 가운데다. 띠가 코스를 가로지르므로 판 한복판이 된다. */
function streamLabelSpot(points: readonly Xy[]): Pt {
  const [x, y] = points[Math.floor(points.length / 2)];
  return pt(x, y);
}

/**
 * 연못 안의 물결. 클립을 쓰지 않고 타원 폭을 재서 선 길이를 맞춘다.
 *
 * 그린에 가리는 줄은 **통째로 뺀다**. 6번 홀은 그린이 연못 한가운데 떠 있는
 * 섬이라, 그리고 지우면 양옆에 토막 난 선만 남는다.
 */
function pondRipples(
  e: EllipseSpec,
  green: readonly Pt[],
  labelAt: Pt | null,
): string[] {
  const rot = ((e.rotDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const toWorld = (x: number, y: number): Pt =>
    pt(e.xMm + x * cos - y * sin, e.yMm + x * sin + y * cos);

  return [-0.62, -0.3, 0.3, 0.62].flatMap((ratio) => {
    const y = e.ryMm * ratio;
    const half = e.rxMm * Math.sqrt(Math.max(0, 1 - ratio * ratio)) * 0.66;
    if (half < 3) return [];
    const steps = 16;
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const x = -half + (2 * half * i) / steps;
      return toWorld(x, y + Math.sin((i / steps) * Math.PI * 3) * 0.9);
    });
    // 한 점이라도 그린에 물리면 그 줄은 그리지 않는다.
    if (points.some((p) => pointInPolygon(green, p))) return [];
    // 처분을 적은 자리도 비운다 — 물결 위에 글자를 얹으면 둘 다 안 읽힌다.
    if (
      labelAt !== null &&
      points.some(
        (p) =>
          Math.abs(p.y - labelAt.y) < COURSE.penaltyClearMm &&
          Math.abs(p.x - labelAt.x) < COURSE.penaltyClearMm * 2.6,
      )
    ) {
      return [];
    }
    return [
      path(openPath(points), {
        fill: 'none',
        stroke: INK.waterStroke,
        'stroke-width': 0.3,
      }),
    ];
  });
}

/**
 * 벙커 안의 모래알. 홀 번호를 씨앗으로 흩어 홀마다 다르게 보이게 한다.
 *
 * 가운데는 비운다 — 거기에 처분(`+1타`)이 적힌다(IDE-032).
 */
function bunkerGrains(e: EllipseSpec, seed: number): string[] {
  const grains: string[] = [];
  let a = seed;
  const next = () => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a / 2147483648;
  };
  for (let i = 0; i < 7; i++) {
    const t = next() * Math.PI * 2;
    // 안쪽 절반은 글자 자리라 바깥 테두리 쪽에만 흩는다.
    const r = 0.58 + Math.sqrt(next()) * 0.3;
    const rot = ((e.rotDeg ?? 0) * Math.PI) / 180;
    const x = Math.cos(t) * e.rxMm * r;
    const y = Math.sin(t) * e.ryMm * r;
    grains.push(
      circle(
        e.xMm + x * Math.cos(rot) - y * Math.sin(rot),
        e.yMm + x * Math.sin(rot) + y * Math.cos(rot),
        0.5,
        { fill: INK.bunkerStroke, stroke: 'none' },
      ),
    );
  }
  return grains;
}

/** 나무 한 그루 — 둥근 잎과 짧은 줄기. */
const tree = (t: Tree): string[] => [
  line(t.x, t.y + t.r * 0.55, t.x, t.y + t.r * 1.25, {
    stroke: INK.treeStroke,
    'stroke-width': 0.45,
  }),
  circle(t.x, t.y, t.r, {
    fill: INK.treeFill,
    stroke: INK.treeStroke,
    'stroke-width': 0.35,
  }),
];

/** 홀 원과 깃대. 깃대는 홀 **뒤**로 뻗어 공이 들어갈 길을 막지 않는다. */
function cupAndFlag(cup: Pt): string[] {
  const top = cup.y - COURSE.flagPoleHeightMm;
  return [
    circle(cup.x, cup.y, COURSE.cupRadiusMm, {
      fill: '#ffffff',
      stroke: INK_COLOR,
      'stroke-width': 0.5,
    }),
    circle(cup.x, cup.y, COURSE.cupDotRadiusMm, {
      fill: INK_COLOR,
      stroke: 'none',
    }),
    line(cup.x, cup.y, cup.x, top, {
      stroke: INK_COLOR,
      'stroke-width': 0.6,
    }),
    path(
      `M${cup.x} ${top} L${cup.x + COURSE.flagWidthMm} ${top + COURSE.flagHeightMm / 2} L${cup.x} ${top + COURSE.flagHeightMm} Z`,
      { fill: INK_COLOR, stroke: 'none' },
    ),
  ];
}

/**
 * 홀 정보 카드 — 코스 안 빈 자리에 얹히는 종이 한 장.
 *
 * 옛 판은 이 내용을 위아래 띠에 두었다. 사용자가 그것을 코스 안으로 들이라고
 * 했고(2026-09-15), 그래서 종이 전체가 골프장이 됐다. 앉는 자리는 홀마다
 * 데이터가 말한다(`hole.panel`).
 */
function infoPanel(hole: HoleSpec): string[] {
  const [px, py] = hole.panel;
  const at = (dx: number, dy: number) => [px + dx, py + dy] as const;
  const terms = termsForPar(hole.par);

  const [numberX, numberY] = at(PANEL.numberXMm, PANEL.numberYMm);
  const [nameX, nameY] = at(PANEL.nameXMm, PANEL.nameYMm);

  return [
    rect(px, py, PANEL.widthMm, PANEL.heightMm, {
      fill: '#ffffff',
      stroke: RULE_COLOR,
      'stroke-width': 0.4,
      rx: PANEL.cornerMm,
    }),

    text(String(hole.number), numberX, numberY, PANEL.numberFontMm, {
      'text-anchor': 'middle',
      'font-weight': 'bold',
    }),
    text('번 홀', numberX, py + PANEL.unitYMm, PANEL.unitFontMm, {
      fill: RULE_COLOR,
      'text-anchor': 'middle',
    }),
    text(hole.name, nameX, nameY, PANEL.nameFontMm, {
      'text-anchor': 'start',
      'font-weight': 'bold',
    }),
    text(
      `파 ${hole.par} · ${hole.yards}야드`,
      nameX,
      py + PANEL.statYMm,
      PANEL.statFontMm,
      { fill: RULE_COLOR, 'text-anchor': 'start' },
    ),

    ...[PANEL.ruleTopYMm, PANEL.ruleBottomYMm].map((dy) =>
      line(
        px + PANEL.ruleInsetMm,
        py + dy,
        px + PANEL.widthMm - PANEL.ruleInsetMm,
        py + dy,
        { stroke: RULE_COLOR, 'stroke-width': 0.25 },
      ),
    ),

    // 타수 이름 — 두 열 세 행. 왼쪽 열을 다 채우고 오른쪽으로 넘어간다.
    // '파'만 굵다: 그 줄이 기준이고, 나머지는 거기서 몇 타 떨어졌는지다.
    ...terms.map((term, i) =>
      text(
        `${term.strokes}타 ${term.label}`,
        px + PANEL.termColumnsXMm[Math.floor(i / PANEL.termRowsYMm.length)],
        py + PANEL.termRowsYMm[i % PANEL.termRowsYMm.length],
        PANEL.termFontMm,
        {
          'text-anchor': 'start',
          'font-weight': term.label === '파' ? 'bold' : undefined,
          fill: term.label === '파' ? INK_COLOR : RULE_COLOR,
        },
      ),
    ),

    // 코스 이름 슬롯의 밑줄. 값이 비어 있어도 아이가 손으로 쓸 수 있다.
    line(
      px + PANEL.courseRuleInsetMm,
      py + PANEL.courseRuleYMm,
      px + PANEL.widthMm - PANEL.courseRuleInsetMm,
      py + PANEL.courseRuleYMm,
      { stroke: RULE_COLOR, 'stroke-width': 0.25 },
    ),
  ];
}

export function renderHole(hole: HoleSpec): string {
  const layout = layoutHole(hole);

  return svgDocument({
    widthMm: BOARD.widthMm,
    heightMm: BOARD.heightMm,
    title: `골프 게임판 · ${hole.number}번 홀 (파 ${hole.par})`,
    children: [
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        // 러프 — 코스 영역 전체를 덮는 바닥이다. 그 경계선이 곧 OB 선이라,
        // 이 선 밖으로 나간 공은 1벌타다.
        rect(
          COURSE_AREA.xMm,
          COURSE_AREA.yMm,
          COURSE_AREA.widthMm,
          COURSE_AREA.heightMm,
          {
            fill: INK.roughFill,
            stroke: INK.obStroke,
            'stroke-width': 0.4,
            'stroke-dasharray': '3 2',
          },
        ),
        // O.B. 표시는 아래 두 모서리에 둔다 — 위쪽은 홀 정보 카드가 앉는
        // 자리이고, 페어웨이의 티 쪽 끝은 가운데라 모서리가 비어 있다.
        // 페어웨이.
        path(closedPath(layout.fairway), {
          fill: INK.fairwayFill,
          stroke: INK.fairwayStroke,
          'stroke-width': 0.4,
        }),

        // 물 — 페어웨이 위에 온다(3번 홀의 연못이 페어웨이를 가로지른다).
        ...layout.streams.flatMap((s, i) => [
          path(closedPath(s), {
            fill: INK.waterFill,
            stroke: INK.waterStroke,
            'stroke-width': 0.4,
          }),
          // 개울도 물이다 — 같은 처분을 띠 한가운데에 적는다. 띠를 따라 가로로
          // 눕는 글이라 폭은 띠 길이가 아니라 넉넉히 잡는다.
          ...penaltyMark(
            streamLabelSpot(hole.streams[i].points),
            PENALTY.water,
            40,
            INK.waterInk,
          ),
        ]),
        ...hole.ponds.flatMap((e, i) => {
          const spot = waterLabelSpot(e, layout.green);
          return [
            path(closedPath(layout.ponds[i]), {
              fill: INK.waterFill,
              stroke: INK.waterStroke,
              'stroke-width': 0.4,
            }),
            ...pondRipples(e, layout.green, spot),
            // 물에 빠지면 어떻게 되는지를 물 위에 적는다(IDE-032).
            ...(spot === null
              ? []
              : penaltyMark(spot, PENALTY.water, e.rxMm * 1.7, INK.waterInk)),
          ];
        }),

        // 그린 — 물 위에 온다(6번 홀은 섬 그린이다). 칼라를 먼저 깔아
        // 그린이 러프 한가운데 떠 있지 않게 한다.
        path(closedPath(layout.collar), {
          fill: INK.fairwayFill,
          // 테두리를 두지 않는다 — 선을 그으면 그린 둘레가 고리처럼 보인다.
          stroke: 'none',
        }),
        path(closedPath(layout.green), {
          fill: INK.greenFill,
          stroke: INK.greenStroke,
          'stroke-width': 0.5,
        }),

        // 벙커.
        ...layout.bunkerSpecs.flatMap((e, i) => [
          path(closedPath(layout.bunkers[i]), {
            fill: INK.bunkerFill,
            stroke: INK.bunkerStroke,
            'stroke-width': 0.4,
          }),
          ...bunkerGrains(e, hole.number * 7919 + i * 131 + 3),
          // 모래에 빠지면 1벌타 — 그 자리에서 계속 친다(IDE-032).
          ...penaltyMark(
            pt(e.xMm, e.yMm),
            PENALTY.bunker,
            e.rxMm * 1.7,
            INK.bunkerInk,
          ),
        ]),

        // 숲.
        ...layout.trees.flatMap(tree),

        // O.B. 처분은 **나무 뒤에** 적는다 — 러프 바로 위에 두었더니 나중에
        // 심은 나무가 글자를 덮었다. 왼쪽에만 처분까지 적고 오른쪽은 이름만
        // 둔다: 같은 문장을 두 번 적으면 판이 수다스러워진다(IDE-032).
        text(
          `${PENALTY.ob.mark} · ${PENALTY.ob.note}`,
          COURSE_AREA.xMm + 4,
          COURSE_AREA.yMm + COURSE_AREA.heightMm - 4.5,
          TYPE.markerFontMm,
          { fill: INK.obStroke, 'text-anchor': 'start' },
        ),
        text(
          'O.B.',
          COURSE_AREA.xMm + COURSE_AREA.widthMm - 9,
          COURSE_AREA.yMm + COURSE_AREA.heightMm - 4.5,
          TYPE.markerFontMm,
          { fill: INK.obStroke, 'text-anchor': 'middle' },
        ),

        // 티잉 그라운드.
        path(closedPath(layout.tee.corners), {
          fill: '#ffffff',
          stroke: INK.fairwayStroke,
          'stroke-width': 0.4,
        }),
        ...[-1, 1].map((side) =>
          circle(
            layout.tee.center.x + (side * COURSE.teeMarkerGapMm) / 2,
            layout.tee.center.y,
            COURSE.teeMarkerRadiusMm,
            { fill: INK.fairwayStroke, stroke: 'none' },
          ),
        ),
        text(
          '티',
          layout.tee.center.x,
          layout.tee.center.y + 9.5,
          TYPE.markerFontMm,
          {
            fill: RULE_COLOR,
            'text-anchor': 'middle',
          },
        ),

        // 홀과 깃대.
        ...cupAndFlag(layout.cup),

        // 홀 정보 카드 — 코스 위에 얹힌다. 코스 요소와 겹치지 않는 자리에
        // 앉으므로 그림을 가리지 않는다.
        ...infoPanel(hole),
      ]),

      // 코스 이름 슬롯이 앉을 자리. 아트워크는 값을 그리지 않는다.
      `<g id="${SLOT_LAYER_ID}" />`,
    ],
  });
}

/** 파트 id → 생성기. `artwork/index.ts`가 이것을 펼쳐 담는다. */
export const HOLE_ARTWORK: Readonly<Record<string, () => string>> =
  Object.fromEntries(
    HOLES.map((hole) => [`hole-${hole.number}`, () => renderHole(hole)]),
  );

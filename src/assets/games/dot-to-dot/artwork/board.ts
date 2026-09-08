/**
 * 점 잇기 판 — 점 · 번호 · 시작 화살표 (IDE-019)
 *
 * 그리는 요소는 원과 숫자와 옅은 선뿐이다. `parseArtwork`가 이미 읽는 범위
 * 안에 머무는 것이 중요하다 — 새 요소를 쓰면 인쇄물에서만 조용히 빠진다.
 *
 * **사진은 그리지 않는다.** 파서가 `<image>`를 모르기도 하지만, 그보다 이을
 * 선이 이미 종이에 보이면 아이가 번호를 따라갈 이유가 없어진다.
 */
import {
  planDots,
  toPoints,
  type Dot,
} from '../../../../lib/dot-to-dot/index.ts';
import {
  ART_AREA,
  BOARD,
  GUIDE_COLOR,
  GUIDE_STROKE_MM,
  METRICS,
  SAMPLE_OUTLINE,
  TYPE,
} from '../dimensions.ts';
import { BOARD_HINT, FOOTER_NOTE } from '../rules.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  line,
  path,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

/**
 * 점 개수 기본값. 도안 정의(`../index.ts`)와 정적 아트워크가 같은 값을 써야
 * 썸네일과 만들기 화면의 첫 모습이 같다.
 */
export const DEFAULT_DOT_COUNT = 20;

export interface BoardInput {
  /** 판 좌표(mm)로 적힌 닫힌 윤곽. 사진에서 딴 것이거나 보기 그림이다. */
  readonly outline: readonly number[];
  readonly dotCount: number;
  /** 옅은 안내선을 깔 것인가. 만 3~4세는 있어야 선을 따라간다. */
  readonly guide: boolean;
}

/** 닫힌 폴리라인의 `d`. 직선뿐이라 M·L·Z 세 명령이면 된다. */
export const outlinePath = (outline: readonly number[]): string => {
  const points = toPoints(outline);
  if (points.length === 0) return '';
  const head = `M ${points[0].x.toFixed(3)} ${points[0].y.toFixed(3)}`;
  const rest = points
    .slice(1)
    .map((p) => `L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
    .join(' ');
  return `${head} ${rest} Z`;
};

/**
 * 진행 방향 화살촉 — **1번 바로 옆**, 2번 쪽을 보고 놓는다.
 *
 * 두 점의 가운데에 두면 점이 성길 때(스무 개짜리 판) 1번에서 20mm나 떨어져
 * 무엇을 가리키는지 알 수 없다. 1번에서 잰 거리로 놓되, 점이 촘촘하면 2번을
 * 덮지 않게 사이 거리의 절반을 넘지 않는다.
 *
 * 선 위가 아니라 **바깥으로 살짝 비켜** 앉는다 — 1번과 2번을 잇는 자리는
 * 아이가 연필을 지나가게 할 자리다.
 */
const startArrow = (first: Dot, second: Dot): string => {
  const dx = second.xMm - first.xMm;
  const dy = second.yMm - first.yMm;
  const gap = Math.hypot(dx, dy);
  if (gap < 0.01) return '';
  const ux = dx / gap;
  const uy = dy / gap;

  // 길고 좁아야 어느 쪽으로 가는지가 보인다. 짧고 넓으면 그냥 세모다.
  const tipLengthMm = 5;
  const halfWidthMm = 1.6;
  const alongMm = Math.min(6.4, gap * 0.5);

  const cx = first.xMm + ux * alongMm + first.outward.x * 3;
  const cy = first.yMm + uy * alongMm + first.outward.y * 3;
  const tipX = cx + ux * tipLengthMm * 0.5;
  const tipY = cy + uy * tipLengthMm * 0.5;
  const backX = cx - ux * tipLengthMm * 0.5;
  const backY = cy - uy * tipLengthMm * 0.5;
  // 진행 방향에 수직인 벡터로 밑변 두 점을 잡는다.
  const px = -uy * halfWidthMm;
  const py = ux * halfWidthMm;

  return path(
    `M ${tipX.toFixed(2)} ${tipY.toFixed(2)} ` +
      `L ${(backX + px).toFixed(2)} ${(backY + py).toFixed(2)} ` +
      `L ${(backX - px).toFixed(2)} ${(backY - py).toFixed(2)} Z`,
    { fill: INK_COLOR, stroke: 'none' },
  );
};

/** 번호보다 한 칸 더 바깥에 앉는 안내 글자("시작"·"1로"). */
const outerNote = (dot: Dot, value: string): string => {
  const offset =
    METRICS.dotDiameterMm / 2 +
    METRICS.numberFontMm / 2 +
    TYPE.markerExtraOffsetMm;
  // 한글 두 글자라 폭이 글자 크기와 거의 같다. 종이 끝에 붙지 않게 넉넉히 잡는다.
  const widthMm = value.length * TYPE.markerFontMm;
  const x = Math.min(
    Math.max(dot.xMm + dot.outward.x * offset, ART_AREA.x + widthMm / 2),
    ART_AREA.x + ART_AREA.width - widthMm / 2,
  );
  const y = Math.min(
    Math.max(dot.yMm + dot.outward.y * offset, ART_AREA.y + TYPE.markerFontMm),
    ART_AREA.y + ART_AREA.height - TYPE.markerFontMm,
  );
  return text(value, x, y, TYPE.markerFontMm, {
    'text-anchor': 'middle',
    fill: RULE_COLOR,
  });
};

export const renderBoard = (input: BoardInput): string => {
  const plan = planDots(input.outline, input.dotCount, {
    clampTo: ART_AREA,
  });
  const dots = plan.dots;
  const last = dots[dots.length - 1];

  const guideLayer = input.guide
    ? [
        path(outlinePath(input.outline), {
          fill: 'none',
          stroke: GUIDE_COLOR,
          'stroke-width': GUIDE_STROKE_MM,
          'stroke-linejoin': 'round',
        }),
      ]
    : [];

  return svgDocument({
    widthMm: BOARD.widthMm,
    heightMm: BOARD.heightMm,
    title: '점 잇기 판',
    children: [
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        // 제목 칸 밑줄. 제목을 비우면 아이가 여기에 손으로 쓴다.
        line(
          TYPE.titleRuleInsetMm,
          TYPE.titleRuleYMm,
          BOARD.widthMm - TYPE.titleRuleInsetMm,
          TYPE.titleRuleYMm,
          { stroke: RULE_COLOR, 'stroke-width': 0.3 },
        ),
        text(BOARD_HINT, BOARD.widthMm / 2, TYPE.hintYMm, TYPE.hintFontMm, {
          'text-anchor': 'middle',
          fill: RULE_COLOR,
        }),

        ...guideLayer,

        ...dots.map((dot) =>
          circle(dot.xMm, dot.yMm, METRICS.dotDiameterMm / 2, {
            fill: INK_COLOR,
          }),
        ),
        ...dots.map((dot) =>
          text(
            String(dot.number),
            dot.labelXMm,
            dot.labelYMm,
            METRICS.numberFontMm,
            { 'text-anchor': 'middle', fill: INK_COLOR },
          ),
        ),

        ...(dots.length >= 2 ? [startArrow(dots[0], dots[1])] : []),
        ...(dots.length >= 1 ? [outerNote(dots[0], '시작')] : []),
        // 닫힌 윤곽이라 마지막 점은 1번으로 돌아온다. 적지 않으면 아이가
        // 거기서 멈춘다(IDE-019 「번호」).
        ...(dots.length >= 3 ? [outerNote(last, '1로')] : []),

        text(
          FOOTER_NOTE,
          BOARD.widthMm / 2,
          TYPE.footerYMm,
          TYPE.footerFontMm,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
      ]),
    ],
  });
};

/** `npm run artwork`가 쓰는 기본 판 — 보기 그림에 기본 개수만큼 점을 찍는다. */
export const renderDefaultBoard = (): string =>
  renderBoard({
    outline: SAMPLE_OUTLINE,
    dotCount: DEFAULT_DOT_COUNT,
    guide: false,
  });

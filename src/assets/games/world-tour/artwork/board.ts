/**
 * 보드 파트 — 세계지도 게임판 (IDE-015)
 *
 * 배율 100%에서 297×210mm(A4 가로). 위 띠에 제목과 특수칸 범례, 가운데에 세계
 * 지도와 칸·화살표, 아래 띠에 놀이 안내가 있다 — 옛 인쇄본 〈세계일주 주사위
 * 놀이〉의 얼개 그대로다. 그림 지도 대신 **실제 지형**(Natural Earth)을 쓴다는
 * 것이 다르다(2026-09-08 사용자 결정).
 *
 * 도시 수 프리셋(50·60·70·80)마다 판이 하나씩 나온다. 칸이 겹치지 않게 미는
 * 배치(`./layout.ts`)가 도시 집합에 따라 달라지므로 판마다 칸 자리가 조금씩
 * 다르다.
 *
 * ## 잉크
 *
 * 바다는 칠하지 않는다. 축구 운동장·야구장이 초록을 칠하지 않은 것과 같은
 * 이유다 — 종이의 3분의 2가 바다라 채우면 잉크를 통째로 먹는다. 땅만 옅은
 * 모래색으로 칠하고 해안선을 가늘게 두른다. 흑백으로 뽑으면 땅이 옅은 회색이
 * 되어 여전히 바다와 갈린다.
 */
import {
  CITY_MARKER,
  ROUTE_LINE,
  SPECIAL_CHIP,
  frameFor,
  type Frame,
} from '../dimensions.ts';
import {
  LEG_LABELS,
  LEG_ORDER,
  citiesFor,
  type City,
  type PresetCount,
  type ResolvedSpecial,
} from '../cities.ts';
import { ringToMapPolygons, type LonLat, type MapBox } from '../projection.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  estimateTextWidthMm,
  group,
  line,
  num,
  path,
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';
import {
  chipRect,
  footprint,
  layoutCities,
  layoutRoute,
  specialText,
  type PlacedCity,
} from './layout.ts';
import landData from './land.json' with { type: 'json' };

export const LAND_FILL = '#efe4c6';
export const COAST_COLOR = '#9a7b4f';
export const OCEAN_FRAME_COLOR = '#7fa7c9';
export const ROUTE_COLOR = '#d1352b';
const PAPER = '#ffffff';
/** 이름표 흰 바탕의 여백. */
const LABEL_PAD_MM = 0.35;

/**
 * 특수칸 색. 글자가 뜻을 말하고 색은 거든다.
 * 급행(노랑)·후퇴(분홍)는 옛 인쇄본의 색이다.
 */
export const SPECIAL_COLORS: Readonly<
  Record<ResolvedSpecial['display'], string>
> = {
  forward: '#f8d24a',
  back: '#f4a3b9',
  restart: '#8fbbe8',
  rest: '#d6d6d6',
};

const SPECIAL_LEGEND: ReadonlyArray<{
  display: ResolvedSpecial['display'];
  sample: string;
  meaning: string;
}> = [
  {
    display: 'forward',
    sample: '급행',
    meaning: '한 번 더 굴려 그 수만큼 앞으로',
  },
  { display: 'back', sample: '후퇴', meaning: '한 번 더 굴려 그 수만큼 뒤로' },
  { display: 'restart', sample: '다시', meaning: '서울(출발)로 돌아간다' },
  { display: 'rest', sample: '쉼', meaning: '다음 차례를 한 번 쉰다' },
];

type Ring = readonly LonLat[];
// JSON은 `number[][][][]`로 읽힌다. 고리의 점이 [경도, 위도] 둘이라는 것은
// 만든 스크립트(`scripts/fetch-natural-earth.mts`)가 보장한다.
const LAND = landData.polygons as unknown as ReadonlyArray<ReadonlyArray<Ring>>;

/** 0.01mm면 충분하다 — 세 자리로 쓰면 판 하나가 50KB 더 커진다. */
const mm2 = (value: number): string => num(Math.round(value * 100) / 100);

const polygonPath = (
  points: ReadonlyArray<readonly [number, number]>,
): string =>
  points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${mm2(x)} ${mm2(y)}`)
    .join('') + 'Z';

/**
 * 땅. 폴리곤 하나가 바깥 고리 + 구멍(카스피해 같은 내해)이라 한 `<path>`에
 * 고리를 다 넣는다 — nonzero 채움에서 반대 방향 고리가 구멍이 된다.
 */
const landPaths = (map: MapBox): string[] => {
  const out: string[] = [];
  for (const rings of LAND) {
    const d = rings
      .flatMap((ring) => ringToMapPolygons(ring, map))
      .map(polygonPath)
      .join('');
    if (d !== '') out.push(path(d));
  }
  return out;
};

/**
 * 칸과 칸을 잇는 화살표. 이웃한 칸이 바싹 붙어 있어도 **화살촉은 반드시
 * 그린다** — 화살표가 빠지면 길이 끊긴 것처럼 보인다. 자리가 모자라면 화살촉을
 * 줄이고 선을 생략한다.
 */
const routeArrow = (from: PlacedCity, to: PlacedCity): string[] => {
  const dx = to.xMm - from.xMm;
  const dy = to.yMm - from.yMm;
  const length = Math.hypot(dx, dy);
  const startGap = from.radiusMm + ROUTE_LINE.clearanceMm;
  const endGap = to.radiusMm + ROUTE_LINE.clearanceMm;
  const available = Math.max(0.6, length - startGap - endGap);
  const headLength = Math.min(ROUTE_LINE.arrowLengthMm, available);
  const headHalf =
    ROUTE_LINE.arrowHalfWidthMm * (headLength / ROUTE_LINE.arrowLengthMm);
  const ux = dx / length;
  const uy = dy / length;
  const tipX = to.xMm - ux * Math.min(endGap, length - headLength);
  const tipY = to.yMm - uy * Math.min(endGap, length - headLength);
  const baseX = tipX - ux * headLength;
  const baseY = tipY - uy * headLength;
  const nx = -uy * headHalf;
  const ny = ux * headHalf;
  const items: string[] = [];
  if (available > headLength + 0.2) {
    items.push(
      line(from.xMm + ux * startGap, from.yMm + uy * startGap, baseX, baseY),
    );
  }
  items.push(
    path(
      `M${num(tipX)} ${num(tipY)}L${num(baseX + nx)} ${num(baseY + ny)}` +
        `L${num(baseX - nx)} ${num(baseY - ny)}Z`,
      { fill: ROUTE_COLOR, stroke: 'none' },
    ),
  );
  return items;
};

/**
 * 실제 위치 점과, 번호 원에서 점으로 가는 선. 점이 곧 지리이므로 **언제나**
 * 그린다. 선은 원 가장자리에서 점 가장자리까지만 — 원 안으로 들어가면 번호를
 * 가리고, 점을 지나치면 자리가 흐려진다.
 */
const anchorMarks = (p: PlacedCity): string[] => {
  const distance = Math.hypot(p.xMm - p.anchor.xMm, p.yMm - p.anchor.yMm);
  const items: string[] = [];
  if (distance > p.radiusMm + CITY_MARKER.anchorDotRadiusMm + 0.3) {
    const ux = (p.anchor.xMm - p.xMm) / distance;
    const uy = (p.anchor.yMm - p.yMm) / distance;
    items.push(
      line(
        p.xMm + ux * p.radiusMm,
        p.yMm + uy * p.radiusMm,
        p.anchor.xMm - ux * (CITY_MARKER.anchorDotRadiusMm + 0.2),
        p.anchor.yMm - uy * (CITY_MARKER.anchorDotRadiusMm + 0.2),
        { stroke: INK_COLOR, 'stroke-width': CITY_MARKER.anchorLineMm },
      ),
    );
  }
  items.push(
    circle(
      p.anchor.xMm,
      p.anchor.yMm,
      CITY_MARKER.anchorDotRadiusMm + CITY_MARKER.anchorHaloMm,
      { fill: PAPER, stroke: 'none' },
    ),
    circle(p.anchor.xMm, p.anchor.yMm, CITY_MARKER.anchorDotRadiusMm, {
      fill: p.index === 0 ? ROUTE_COLOR : INK_COLOR,
      stroke: 'none',
    }),
  );
  return items;
};

const cityMarker = (p: PlacedCity): string[] => {
  const isStart = p.index === 0;
  const items: string[] = [
    circle(p.xMm, p.yMm, p.radiusMm, {
      fill: PAPER,
      stroke: isStart ? ROUTE_COLOR : INK_COLOR,
      'stroke-width': isStart ? CITY_MARKER.strokeMm * 2 : CITY_MARKER.strokeMm,
    }),
  ];
  if (isStart) {
    items.push(
      text('출발', p.xMm, p.yMm - 1.3, 2.4, {
        'text-anchor': 'middle',
        'font-weight': 'bold',
        fill: ROUTE_COLOR,
        stroke: 'none',
      }),
      text('도착', p.xMm, p.yMm + 1.5, 2.4, {
        'text-anchor': 'middle',
        'font-weight': 'bold',
        fill: ROUTE_COLOR,
        stroke: 'none',
      }),
    );
  } else {
    items.push(
      text(String(p.index), p.xMm, p.yMm, CITY_MARKER.numberFontMm, {
        'text-anchor': 'middle',
        'font-weight': 'bold',
        fill: INK_COLOR,
        stroke: 'none',
      }),
    );
  }
  // 이름표 뒤에 흰 바탕을 깐다 — 화살표와 해안선이 글자를 지나가도 읽힌다.
  const labelYMm =
    p.yMm + p.radiusMm + CITY_MARKER.labelGapMm + CITY_MARKER.labelFontMm / 2;
  items.push(
    rect(
      p.xMm - p.labelWidthMm / 2 - LABEL_PAD_MM,
      labelYMm - CITY_MARKER.labelFontMm / 2 - LABEL_PAD_MM * 0.6,
      p.labelWidthMm + LABEL_PAD_MM * 2,
      CITY_MARKER.labelFontMm + LABEL_PAD_MM * 1.2,
      { fill: PAPER, stroke: 'none' },
    ),
    text(p.city.name, p.xMm, labelYMm, CITY_MARKER.labelFontMm, {
      'text-anchor': 'middle',
      'font-weight': isStart ? 'bold' : undefined,
      fill: INK_COLOR,
      stroke: 'none',
    }),
  );
  return items;
};

const specialChip = (p: PlacedCity): string[] => {
  const chip = chipRect(p);
  if (!chip || !p.special) return [];
  return [
    rect(chip.xMm, chip.yMm, chip.widthMm, chip.heightMm, {
      fill: SPECIAL_COLORS[p.special.display],
      stroke: INK_COLOR,
      'stroke-width': SPECIAL_CHIP.strokeMm,
    }),
    text(
      specialText(p.special),
      chip.xMm + chip.widthMm / 2,
      chip.yMm + chip.heightMm / 2,
      SPECIAL_CHIP.fontMm,
      {
        'text-anchor': 'middle',
        'font-weight': 'bold',
        fill: INK_COLOR,
        stroke: 'none',
      },
    ),
  ];
};

/**
 * 위 띠 — 제목 왼쪽, 특수칸 범례 오른쪽.
 *
 * 자리와 글자 크기는 A4 기준값에 `k`를 곱한다 — 판이 커지면 띠도 그만큼
 * 커진다. 범례의 표식 견본만은 실물 크기(판 위 표식과 같다)로 둔다.
 */
const titleBand = (count: number, frame: Frame): string[] => {
  const { k, paper } = frame;
  const sheets =
    paper.sheets === 1 ? 'A4 한 장' : `${paper.label} · A4 ${paper.sheets}장`;
  const items: string[] = [
    text('세계일주 주사위놀이', 8 * k, 11 * k, 9 * k, {
      'font-weight': 'bold',
      fill: INK_COLOR,
      stroke: 'none',
    }),
    text(
      `서울에서 출발해 세계를 한 바퀴 돌고 서울로 · 도시 ${count}개 · ${sheets} · 2–6명`,
      8 * k,
      19.5 * k,
      2.8 * k,
      { fill: RULE_COLOR, stroke: 'none' },
    ),
  ];
  // 범례 — 두 줄, 두 열.
  const legendLeft = 128 * k;
  const columnWidth = 84 * k;
  const rowHeight = 7.4 * k;
  const firstRowY = 5.6 * k;
  for (const [i, item] of SPECIAL_LEGEND.entries()) {
    const column = Math.floor(i / 2);
    const row = i % 2;
    const x = legendLeft + column * columnWidth;
    const y = firstRowY + row * rowHeight;
    const chipWidth =
      estimateTextWidthMm(item.sample, SPECIAL_CHIP.fontMm) +
      SPECIAL_CHIP.paddingMm * 2;
    items.push(
      rect(x, y, chipWidth, SPECIAL_CHIP.heightMm, {
        fill: SPECIAL_COLORS[item.display],
        stroke: INK_COLOR,
        'stroke-width': SPECIAL_CHIP.strokeMm,
      }),
      text(
        item.sample,
        x + chipWidth / 2,
        y + SPECIAL_CHIP.heightMm / 2,
        SPECIAL_CHIP.fontMm,
        {
          'text-anchor': 'middle',
          'font-weight': 'bold',
          fill: INK_COLOR,
          stroke: 'none',
        },
      ),
      text(
        item.meaning,
        x + chipWidth + 2 * k,
        y + SPECIAL_CHIP.heightMm / 2,
        2.6 * k,
        { fill: INK_COLOR, stroke: 'none' },
      ),
    );
  }
  return items;
};

/** 아래 띠 — 놀이 요령 · 경로 · 지도 출처. */
const noteBand = (frame: Frame): string[] => {
  const { k } = frame;
  const top = frame.noteBand.yMm;
  const legs = LEG_ORDER.filter((leg) => leg !== 'start')
    .map((leg) => LEG_LABELS[leg])
    .join(' → ');
  const lines: Array<[string, number, string]> = [
    [
      '놀이 요령 — 차례대로 주사위를 던져 나온 수만큼 화살표를 따라 간다. 색 칸에 멈추면 칸에 적힌 대로 한다.',
      2.9,
      INK_COLOR,
    ],
    [
      '세계를 한 바퀴 돌아 서울에 먼저 돌아오는 사람이 이긴다. 자세한 규칙과 주사위·말 만드는 법은 소개 페이지에 있다.',
      2.9,
      INK_COLOR,
    ],
    [`경로 — 서울 → ${legs} → 서울`, 2.7, RULE_COLOR],
    [
      '지도: Natural Earth (public domain) · 로빈슨 도법, 동경 150° 중심 · 검은 점이 도시의 실제 위치다. 번호 칸은 그 자리를 가리지 않도록 가까운 바다에 두고 선으로 이었다.',
      2.3,
      RULE_COLOR,
    ],
  ];
  const items: string[] = [];
  let y = top + 7 * k;
  for (const [value, size, color] of lines) {
    items.push(
      text(value, 8 * k, y, size * k, { fill: color, stroke: 'none' }),
    );
    y += (size * 1.9 + 1.2) * k;
  }
  return items;
};

export interface BoardOptions {
  /** 경로 차례의 도시. 서울이 있으면 서울부터 시작하도록 돌린다. */
  readonly route: readonly City[];
  /** 제목·안내 띠 없이 지도만. */
  readonly mapOnly?: boolean;
}

/**
 * 도시 목록에서 판을 그린다. 종이는 도시 수를 따른다 — 50까지 A4, 70까지 A3,
 * 그 위는 A2(`PAPER_STEPS`). 칸·화살표·표식은 실물 치수 그대로이고 틀만 커진다.
 * 만들기 화면의 도시 목록(`IDE-016`)이 바뀔 때마다 서버가 이걸 불러 그린다.
 */
export const renderBoardRoute = ({
  route: given,
  mapOnly = false,
}: BoardOptions): string => {
  const seoulAt = given.findIndex((city) => city.id === 'seoul');
  const route =
    seoulAt > 0 ? [...given.slice(seoulAt), ...given.slice(0, seoulAt)] : given;
  const count = route.length;
  const frame = frameFor(count, mapOnly);
  const { board, map, titleBand: title } = frame;
  const placed = layoutCities(route, map);
  const arrows: string[] = [];
  for (let i = 0; i < placed.length; i += 1) {
    arrows.push(...routeArrow(placed[i], placed[(i + 1) % placed.length]));
  }

  return svgDocument({
    widthMm: board.widthMm,
    heightMm: board.heightMm,
    title: `세계일주 주사위놀이 · 게임판 (도시 ${count}개 · ${frame.paper.label}${mapOnly ? ' · 지도만' : ''})`,
    children: [
      group({ id: ART_LAYER_ID, fill: 'none', stroke: 'none' }, [
        // 지도 상자 — 바다는 칠하지 않고 테만 두른다.
        rect(map.xMm, map.yMm, map.widthMm, map.heightMm, {
          fill: 'none',
          stroke: OCEAN_FRAME_COLOR,
          'stroke-width': 0.4,
        }),
        group(
          {
            id: 'pc-land',
            fill: LAND_FILL,
            stroke: COAST_COLOR,
            'stroke-width': 0.22,
          },
          landPaths(map),
        ),
        group(
          {
            id: 'pc-route',
            fill: 'none',
            stroke: ROUTE_COLOR,
            'stroke-width': ROUTE_LINE.strokeMm,
          },
          arrows,
        ),
        group(
          { id: 'pc-anchors', fill: 'none', stroke: 'none' },
          placed.flatMap(anchorMarks),
        ),
        group(
          { id: 'pc-cities', fill: 'none', stroke: 'none' },
          placed.flatMap((p) => [...cityMarker(p), ...specialChip(p)]),
        ),
        ...(mapOnly
          ? []
          : [
              group({ id: 'pc-title', fill: 'none', stroke: 'none' }, [
                line(0, title.heightMm, board.widthMm, title.heightMm, {
                  stroke: RULE_COLOR,
                  'stroke-width': 0.3,
                }),
                ...titleBand(count, frame),
              ]),
              group(
                { id: 'pc-note', fill: 'none', stroke: 'none' },
                noteBand(frame),
              ),
            ]),
      ]),
    ],
  });
};

/** 프리셋 N의 판 — 기본 도시 목록으로. 정적 파일(썸네일)과 테스트가 쓴다. */
export const renderBoard = (count: PresetCount, mapOnly = false): string =>
  renderBoardRoute({ route: citiesFor(count), mapOnly });

/** 테스트가 발자국 겹침을 검사할 때 쓴다. */
export { footprint, layoutRoute };

/**
 * 칸 배치 — 실제 위치는 점으로 남기고, 번호 원은 바다에 앉힌다 (IDE-015)
 *
 * 도시 칸은 원(번호)과 그 아래 이름, 특수칸이면 오른쪽 위 표식까지가 한
 * 발자국이다. 처음에는 원을 실제 위치에 놓고 겹치는 것만 밀었는데, 그러면
 * **원이 도시의 자리를 가린다** — 아이가 배워야 할 것이 바로 그 자리다
 * (2026-09-08 사용자 지적). 그래서 지금은:
 *
 * 1. 실제 위치에는 **점**을 찍는다. 점은 움직이지 않는다.
 * 2. 번호 원은 실제 위치에서 가장 가까운 **빈 바다**에 앉힌다(`landmask.ts`).
 *    옛 인쇄본도 파리를 대서양에, 런던을 북해에 찍었다 — 게임판의 칸은 지도의
 *    점이 아니라 **말이 서는 자리**다. 바다가 너무 먼 내륙 도시(모스크바·덴버)는
 *    점 바로 위에 앉힌다.
 * 3. 겹치는 발자국을 덜 겹치는 축으로 반씩 밀어내기를 겹침이 없어질 때까지
 *    되풀이한다. 이때 **모든 도시의 점도 장애물**이다 — 원이 어느 도시의 자리도
 *    덮지 않는다.
 *
 * 무작위가 없어 **같은 입력이면 같은 배치**다 — 커밋된 SVG가 생성기와 같아야
 * 하므로 이것이 중요하다. 원과 점은 언제나 가는 선으로 잇는다.
 */
import { CITY_MARKER, LAYOUT, SPECIAL_CHIP, frameFor } from '../dimensions.ts';
import {
  citiesFor,
  resolveSpecials,
  SPECIAL_LABELS,
  type City,
  type PresetCount,
  type ResolvedSpecial,
} from '../cities.ts';
import { projectToMap, type MapBox } from '../projection.ts';
import { landMaskFor, searchOffsets } from './landmask.ts';
import { estimateTextWidthMm } from '../../../shared/svg.ts';

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PlacedCity {
  readonly city: City;
  /** 경로에서의 차례. 0이 서울(출발)이고 칸 번호이기도 하다. */
  readonly index: number;
  readonly radiusMm: number;
  /** 실제 위치(투영). */
  readonly anchor: { readonly xMm: number; readonly yMm: number };
  /** 원의 중심. 밀려난 뒤의 값이다. */
  xMm: number;
  yMm: number;
  readonly labelWidthMm: number;
  readonly special?: ResolvedSpecial;
  /** 표식 글자 폭 + 여백. 특수칸에만 있다. */
  readonly chipWidthMm?: number;
}

/** 표식에 찍히는 글자 — 종류 이름 그대로다. */
export const specialText = (special: ResolvedSpecial): string =>
  SPECIAL_LABELS[special.display];

/** 표식 상자의 위치 — 원의 오른쪽 위에 붙는다. */
export const chipRect = (
  placed: PlacedCity,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } | null => {
  if (!placed.chipWidthMm) return null;
  return {
    xMm: placed.xMm + placed.radiusMm + SPECIAL_CHIP.gapMm,
    yMm: placed.yMm - placed.radiusMm * 0.9 - SPECIAL_CHIP.heightMm / 2,
    widthMm: placed.chipWidthMm,
    heightMm: SPECIAL_CHIP.heightMm,
  };
};

/**
 * 원과 표식만 덮는 상자 — 실제 위치 점을 가리면 안 되는 부분이다. 이름표는
 * 글자라 점이 비쳐 보이므로 여기 넣지 않는다. 넣으면 폭 16mm짜리 이름표가
 * 점 하나에 부딪힐 때마다 크게 튀어 배치가 수렴하지 않는다.
 */
export const solidBox = (placed: PlacedCity): Box => {
  const r = placed.radiusMm;
  const box: Box = {
    left: placed.xMm - r,
    right: placed.xMm + r,
    top: placed.yMm - r,
    bottom: placed.yMm + r,
  };
  const chip = chipRect(placed);
  if (chip) {
    box.right = Math.max(box.right, chip.xMm + chip.widthMm);
    box.top = Math.min(box.top, chip.yMm);
  }
  return box;
};

/** 발자국 — 원·이름·표식을 다 덮는 상자. 칸끼리의 겹침 판정은 이걸로 한다. */
export const footprint = (placed: PlacedCity): Box => {
  const halfLabel = placed.labelWidthMm / 2;
  const r = placed.radiusMm;
  const box: Box = {
    left: placed.xMm - Math.max(r, halfLabel),
    right: placed.xMm + Math.max(r, halfLabel),
    top: placed.yMm - r,
    bottom: placed.yMm + r + CITY_MARKER.labelGapMm + CITY_MARKER.labelFontMm,
  };
  const chip = chipRect(placed);
  if (chip) {
    box.right = Math.max(box.right, chip.xMm + chip.widthMm);
    box.top = Math.min(box.top, chip.yMm);
  }
  return box;
};

const boundsOf = (box: MapBox): Box => ({
  left: box.xMm + LAYOUT.edgeInsetMm,
  right: box.xMm + box.widthMm - LAYOUT.edgeInsetMm,
  top: box.yMm + LAYOUT.edgeInsetMm,
  bottom: box.yMm + box.heightMm - LAYOUT.edgeInsetMm,
});

type Segment = readonly [number, number, number, number];

/** 선분이 상자를 지나는가 (Liang–Barsky). 끝점이 상자 안이어도 참이다. */
const segmentCrossesBox = (seg: Segment, box: Box): boolean => {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, x1 - box.left],
    [dx, box.right - x1],
    [-dy, y1 - box.top],
    [dy, box.bottom - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
};

const inside = (box: Box, bounds: Box): boolean =>
  box.left >= bounds.left &&
  box.right <= bounds.right &&
  box.top >= bounds.top &&
  box.bottom <= bounds.bottom;

const round = (value: number): number => Math.round(value * 100) / 100;

/** 프리셋 N의 칸 배치 — 도시 수에 맞는 종이 위에서. 경로 차례대로다. */
export const layoutRoute = (count: PresetCount): PlacedCity[] =>
  layoutCities(citiesFor(count), frameFor(count).map);

/**
 * 임의의 도시 목록(경로 차례)을 주어진 지도 상자에 배치한다. 토글 편집
 * (`IDE-016`)이 이걸 쓴다. 상자가 클수록 칸이 실제 위치 가까이 앉는다.
 *
 * **탐욕 배치**다. 경로 차례대로 한 도시씩, 실제 위치에서 가까운 자리부터
 * 훑어 아래를 다 만족하는 첫 자리에 앉힌다:
 *
 * 1. 원의 중심부가 바다에 있다 (`seaSearchMm` 안에서만 요구한다 — 내륙은 땅에 앉는다).
 * 2. 발자국이 지도 안에 있다.
 * 3. 먼저 앉은 칸의 발자국과 겹치지 않는다.
 * 4. 원·표식이 어느 도시의 실제 위치 점도 덮지 않는다 (이름표까지는 1차에서만).
 * 5. 이 칸의 이음선(원→점)과 앞 칸에서 오는 화살표가 먼저 앉은 원을 지나지
 *    않고, 이 원이 먼저 그어진 이음선·화살표 위에 앉지 않는다 — 선이 원 아래를
 *    지나면 길이 그 칸을 들르는 것처럼 보인다.
 *
 * 앞서 쓰던 "겹치면 밀어내기" 반복은 점을 장애물로 두자 표류했다 — 원이 점과
 * 이웃 원 사이에서 튕기며 카이로 원이 로마까지 흘러갔다. 탐욕 배치는 진동이
 * 없고, 같은 입력이면 같은 배치이며, 빈 자리가 있으면 반드시 찾는다.
 */
export const layoutCities = (
  route: readonly City[],
  box: MapBox,
): PlacedCity[] => {
  const specials = new Map(
    resolveSpecials(route).map((s) => [s.cityId, s] as const),
  );
  const mask = landMaskFor(box);
  const bounds = boundsOf(box);
  const anchors = route.map((city) => projectToMap(city.lon, city.lat, box));

  const placed: PlacedCity[] = [];
  /** 먼저 그어진 선 — 이음선과 화살표. 새 원이 이 위에 앉으면 안 된다. */
  const lines: Segment[] = [];
  for (const [index, city] of route.entries()) {
    const anchor = anchors[index];
    const special = specials.get(city.id);
    const radiusMm =
      index === 0 ? CITY_MARKER.startRadiusMm : CITY_MARKER.radiusMm;
    const candidate: PlacedCity = {
      city,
      index,
      radiusMm,
      anchor,
      xMm: anchor.xMm,
      yMm: anchor.yMm,
      labelWidthMm: estimateTextWidthMm(city.name, CITY_MARKER.labelFontMm),
      ...(special
        ? {
            special,
            chipWidthMm:
              estimateTextWidthMm(specialText(special), SPECIAL_CHIP.fontMm) +
              SPECIAL_CHIP.paddingMm * 2,
          }
        : {}),
    };
    const minDistance =
      radiusMm + CITY_MARKER.anchorDotRadiusMm + LAYOUT.anchorClearanceMm;

    const previous = placed[placed.length - 1];

    const fits = (x: number, y: number, strict: boolean): boolean => {
      candidate.xMm = x;
      candidate.yMm = y;
      const foot = footprint(candidate);
      if (!inside(foot, bounds)) return false;
      for (const other of placed) {
        if (!apart(foot, footprint(other), LAYOUT.marginMm)) return false;
      }
      const solid = strict ? foot : solidBox(candidate);
      for (const a of anchors) {
        if (
          coversPoint(
            solid,
            a,
            CITY_MARKER.anchorDotRadiusMm + LAYOUT.anchorClearanceMm,
          )
        )
          return false;
      }
      if (!strict) return true;
      // 선이 원을 지나지 않게. 이음선은 이 원에서 제 점으로, 화살표는 앞 원에서
      // 이 원으로 — 둘 다 양 끝의 원은 빼고 본다.
      const leader: Segment = [x, y, anchor.xMm, anchor.yMm];
      const arrow: Segment | null = previous
        ? [previous.xMm, previous.yMm, x, y]
        : null;
      for (const other of placed) {
        const box = solidBox(other);
        if (segmentCrossesBox(leader, box)) return false;
        if (arrow && other !== previous && segmentCrossesBox(arrow, box))
          return false;
      }
      for (const line of lines) {
        if (segmentCrossesBox(line, solid)) return false;
      }
      return true;
    };

    // 자리의 값 — 실제 위치까지의 거리에 앞 칸까지의 거리를 조금 더한다. 뒤엣것이
    // 없으면 "가장 가까운 빈 바다"만 좇아 런던이 비스케이만으로, 파리가 대서양으로
    // 가며 경로가 지그재그가 된다.
    const cost = (x: number, y: number): number =>
      Math.hypot(x - anchor.xMm, y - anchor.yMm) +
      (previous
        ? LAYOUT.routeWeight * Math.hypot(x - previous.xMm, y - previous.yMm)
        : 0);

    // 바다 자리와 땅 자리를 각각 찾고, 바다가 땅보다 `seaBonusMm` 넘게 멀지
    // 않으면 바다를 고른다. 바다만 고집하면 영국해협(A4에서 1mm)이 바다로 안
    // 잡혀 런던 원이 비스케이만까지 내려간다. 둘 다 선이 원을 지나지 않고
    // 이름표도 점을 피하는 자리다. 그것도 없으면 겹침과 점만 피하고, 더 멀리 본다.
    const sea = bestSeat(
      anchor,
      minDistance,
      LAYOUT.seaSearchMm,
      cost,
      (x, y) =>
        mask.isOpenSea(x, y, radiusMm * LAYOUT.seaCoreFraction) &&
        fits(x, y, true),
    );
    const land = bestSeat(
      anchor,
      minDistance,
      LAYOUT.landSearchMm,
      cost,
      (x, y) => fits(x, y, true),
    );
    const preferred =
      sea && (!land || sea.cost <= land.cost + LAYOUT.seaBonusMm) ? sea : land;
    const seat =
      preferred ??
      bestSeat(anchor, minDistance, LAYOUT.landSearchMm, cost, (x, y) =>
        fits(x, y, false),
      ) ??
      bestSeat(anchor, minDistance, LAYOUT.landSearchMm * 2, cost, (x, y) =>
        fits(x, y, false),
      );
    if (!seat) {
      throw new Error(
        `칸을 놓을 자리가 없다: ${city.id} (도시 ${route.length}개, ${box.widthMm}×${box.heightMm}mm)`,
      );
    }
    candidate.xMm = round(seat.xMm);
    candidate.yMm = round(seat.yMm);
    lines.push([candidate.xMm, candidate.yMm, anchor.xMm, anchor.yMm]);
    if (previous)
      lines.push([previous.xMm, previous.yMm, candidate.xMm, candidate.yMm]);
    placed.push(candidate);
  }
  return placed;
};

/**
 * `ok`를 만족하는 격자점 가운데 `cost`가 가장 작은 자리. 오프셋이 실제 위치에서
 * 가까운 차례로 정렬돼 있고 값은 그 거리보다 작을 수 없으므로, 남은 오프셋의
 * 거리가 지금까지의 최솟값을 넘으면 더 볼 것이 없다.
 */
const bestSeat = (
  anchor: { readonly xMm: number; readonly yMm: number },
  minDistanceMm: number,
  maxDistanceMm: number,
  cost: (xMm: number, yMm: number) => number,
  ok: (xMm: number, yMm: number) => boolean,
): { xMm: number; yMm: number; cost: number } | null => {
  let best: { xMm: number; yMm: number; cost: number } | null = null;
  for (const [dx, dy, d] of searchOffsets(maxDistanceMm)) {
    if (d < minDistanceMm) continue;
    if (best && d >= best.cost) break;
    const x = anchor.xMm + dx;
    const y = anchor.yMm + dy;
    const c = cost(x, y);
    if (best && c >= best.cost) continue;
    if (ok(x, y)) best = { xMm: x, yMm: y, cost: c };
  }
  return best;
};

/** 발자국이 어느 점을 덮는가. 테스트가 쓴다. */
export const coversPoint = (
  box: Box,
  point: { readonly xMm: number; readonly yMm: number },
  marginMm = 0,
): boolean =>
  point.xMm >= box.left - marginMm &&
  point.xMm <= box.right + marginMm &&
  point.yMm >= box.top - marginMm &&
  point.yMm <= box.bottom + marginMm;

/** 두 발자국이 여유를 두고 떨어져 있는가. 테스트가 쓴다. */
export const apart = (a: Box, b: Box, marginMm = 0): boolean =>
  a.right + marginMm <= b.left ||
  b.right + marginMm <= a.left ||
  a.bottom + marginMm <= b.top ||
  b.bottom + marginMm <= a.top;

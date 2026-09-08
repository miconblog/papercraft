/**
 * 마스크 → 닫힌 윤곽선 (IDE-019)
 *
 * 파이프라인의 4~6단계다 — **윤곽 추적(marching squares) · 다듬기(Chaikin) ·
 * 단순화(Ramer–Douglas–Peucker)**.
 *
 * 세 단계가 각각 다른 일을 한다.
 *
 * 1. `traceContours`는 화소 경계를 그대로 딴다. 계단이 남고 점이 수천 개다.
 * 2. `chaikin`이 그 계단의 모서리를 깎는다. 점은 두 배가 되지만 곡선이 된다.
 * 3. `simplify`가 곧은 구간의 점을 버린다. **여기서 남는 점이 곧 형태의
 *    모서리**이고, 점 배분(`dots.ts`)이 그것을 먼저 집는다.
 */
import { area, bounds, distance, rotateTo, type Point } from './geometry.ts';
import type { Mask } from './image.ts';

/**
 * Marching squares — 마스크의 등고선을 닫힌 고리들로 딴다.
 *
 * 격자는 화소 **모서리**가 아니라 화소 자체를 표본으로 삼고, 선분의 끝점은 두
 * 표본 사이의 중점이다. 그래서 나오는 좌표가 0.5 단위다.
 *
 * 마스크를 **0으로 한 겹 두른 뒤** 훑는다. 피사체가 사진 가장자리에 닿아 있어도
 * 고리가 닫히고, 닫히지 않은 조각을 따로 다루는 코드가 통째로 없어진다.
 *
 * 애매한 두 경우(대각선으로만 닿은 5·10)는 **피사체가 이어지는 쪽**으로 푼다 —
 * 팔과 몸통이 한 화소로 닿은 사진에서 팔이 떨어져 나가지 않게.
 */
export function traceContours(mask: Mask): Point[][] {
  const width = mask.width + 2;
  const height = mask.height + 2;
  const at = (x: number, y: number): number => {
    if (x < 1 || y < 1 || x > mask.width || y > mask.height) return 0;
    return mask.data[(y - 1) * mask.width + (x - 1)];
  };

  // 선분을 "시작점 → 끝점"으로 모은다. 방향이 일관되므로(피사체가 늘 같은
  // 쪽에 온다) 끝점을 열쇠로 다음 선분을 찾아 고리를 만들 수 있다.
  const starts = new Map<string, Point[]>();
  const key = (p: Point) => `${p.x},${p.y}`;
  const add = (from: Point, to: Point) => {
    const list = starts.get(key(from));
    if (list) list.push(to);
    else starts.set(key(from), [to]);
  };

  for (let cy = 0; cy < height - 1; cy += 1) {
    for (let cx = 0; cx < width - 1; cx += 1) {
      const tl = at(cx, cy);
      const tr = at(cx + 1, cy);
      const br = at(cx + 1, cy + 1);
      const bl = at(cx, cy + 1);
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;

      const T = { x: cx + 0.5, y: cy };
      const R = { x: cx + 1, y: cy + 0.5 };
      const B = { x: cx + 0.5, y: cy + 1 };
      const L = { x: cx, y: cy + 0.5 };

      switch (code) {
        case 1:
          add(L, B);
          break;
        case 2:
          add(B, R);
          break;
        case 3:
          add(L, R);
          break;
        case 4:
          add(R, T);
          break;
        // 피사체가 대각으로 이어진다고 본다 — 배경 쪽 두 귀퉁이를 각각 자른다.
        case 5:
          add(L, T);
          add(R, B);
          break;
        case 6:
          add(B, T);
          break;
        case 7:
          add(L, T);
          break;
        case 8:
          add(T, L);
          break;
        case 9:
          add(T, B);
          break;
        case 10:
          add(T, R);
          add(B, L);
          break;
        case 11:
          add(T, R);
          break;
        case 12:
          add(R, L);
          break;
        case 13:
          add(R, B);
          break;
        case 14:
          add(B, L);
          break;
      }
    }
  }

  const contours: Point[][] = [];
  for (const [startKey, firstTargets] of starts) {
    while (firstTargets.length > 0) {
      const [firstX, firstY] = startKey.split(',').map(Number);
      const start: Point = { x: firstX, y: firstY };
      const loop: Point[] = [start];
      let current = firstTargets.pop()!;

      // 고리가 닫힐 때까지 끝점을 다시 시작점으로 삼아 따라간다. 마스크가
      // 유한하므로 반드시 닫히지만, 데이터가 깨졌을 때 무한히 돌지 않게
      // 선분 총수를 상한으로 둔다.
      let guard = 0;
      const limit = (width * height * 2) | 0;
      while (key(current) !== startKey && guard < limit) {
        loop.push(current);
        const next = starts.get(key(current));
        if (!next || next.length === 0) break;
        current = next.pop()!;
        guard += 1;
      }
      // 화소 하나짜리 잡티는 선분 셋 이하로 끝난다. 형태가 아니다.
      if (loop.length >= 4) contours.push(loop);
    }
  }
  return contours;
}

/**
 * Chaikin 모서리 깎기 — 닫힌 고리 한 판.
 *
 * 변마다 1/4·3/4 지점 두 점으로 갈아 끼운다. 화소 경계의 직각 계단이 45°로
 * 눕고, 점 수는 두 배가 된다. **한 번만** 돌린다 — 두 번 이상 돌리면 강아지
 * 귀 끝처럼 실제로 뾰족한 자리까지 둥글어져 점 배분이 집을 모서리가 사라진다.
 */
export function chaikin(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  return out;
}

/** 선분 `a–b`에서 점 `p`까지의 수직 거리. RDP가 버릴 점을 고르는 잣대다. */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return distance(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
}

/** 열린 폴리라인 하나에 대한 RDP. 재귀 대신 스택을 써 긴 윤곽에서도 안 터진다. */
function simplifyOpen(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop()!;
    let farthest = -1;
    let best = epsilon;
    for (let i = from + 1; i < to; i += 1) {
      const d = perpendicularDistance(points[i], points[from], points[to]);
      if (d > best) {
        best = d;
        farthest = i;
      }
    }
    if (farthest === -1) continue;
    keep[farthest] = 1;
    stack.push([from, farthest], [farthest, to]);
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * 닫힌 고리에 대한 RDP.
 *
 * 닫힌 도형은 "어디서 시작하는가"가 없어 그대로 돌리면 0번 점이 그저 배열의
 * 첫 칸이라는 이유로 살아남는다. **무게중심에서 가장 먼 점**으로 배열을 돌린
 * 뒤 여는데, 그 점은 형태의 뾰족한 끝(귀·꼬리)일 가능성이 높아 시작점으로
 * 삼기에 알맞다.
 */
export function simplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 4) return [...points];

  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  let anchor = 0;
  let best = -1;
  for (let i = 0; i < points.length; i += 1) {
    const d = Math.hypot(points[i].x - cx, points[i].y - cy);
    if (d > best) {
      best = d;
      anchor = i;
    }
  }

  const rotated = rotateTo(points, anchor);
  // 닫힌 고리를 열려면 첫 점을 끝에도 한 번 둬야 마지막 변이 평가된다.
  const opened = [...rotated, rotated[0]];
  const simplified = simplifyOpen(opened, epsilon);
  simplified.pop();
  return simplified;
}

/** 단순화 세기 — 윤곽 대각선 길이에 대한 비율이다. 화소 크기와 무관해진다. */
export const SIMPLIFY_RATIO = 0.004;

/** 이 도형에 맞는 RDP 임계값. 아주 작은 윤곽에서 0이 되지 않게 바닥을 둔다. */
export function simplifyEpsilon(points: readonly Point[]): number {
  const b = bounds(points);
  const diagonal = Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
  return Math.max(diagonal * SIMPLIFY_RATIO, 0.5);
}

/** 넓이가 가장 큰 고리. 구멍(눈·입)은 1차에서 버린다(IDE-019 「안 하는 것」). */
export function largestContour(contours: readonly Point[][]): Point[] | null {
  let best: Point[] | null = null;
  let bestArea = 0;
  for (const contour of contours) {
    const a = area(contour);
    if (a > bestArea) {
      bestArea = a;
      best = contour;
    }
  }
  return best;
}

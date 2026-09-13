/**
 * 사진을 사진 옆에 끌어 놓기 — 좌표와 줄 계산 (IDE-028)
 *
 * 사용자 요청(2026-09-10) — 위아래로 쌓인 사진을 **끌어서 옆으로 붙이고** 싶다.
 * 노션이 그렇게 한다. 편집기의 기본 끌어 놓기는 사진을 다른 마디의 **위나
 * 아래**로만 옮기므로, 사진 위에 놓았을 때만 가로챈다.
 *
 * 여기에는 DOM 도 ProseMirror 도 없다 — 상자 좌표와 사진 목록만 받는 순수
 * 함수라 시험으로 전부 덮는다. 끌기 이벤트를 붙이는 몫은
 * `components/blog/SideDrop.ts` 가 한다.
 */
import { MAX_ROW_IMAGES } from './doc';

/**
 * 줄에 드는 사진 한 칸. `width` 는 끌어 오기 전에 정해 둔 너비(글 폭에 대한 %)다
 * — 합칠 때 버리지 않는다(2026-09-10 사용자 신고).
 */
export type RowImage = { src: string; alt: string; width?: number };

/** 화면 위의 상자. `DOMRect` 에서 필요한 칸만. */
export type Box = { left: number; top: number; width: number; height: number };

/**
 * 위·아래 가장자리 띠의 두께(상자 높이에 대한 비율).
 *
 * **여기에 놓으면 가로채지 않는다** — 평소처럼 그 사진의 위나 아래로 옮겨진다.
 * 옆으로 붙이는 것과 위아래로 옮기는 것을 한 사진 위에서 둘 다 할 수 있어야
 * 한다. 가운데 띠(높이의 절반)에 놓을 때만 옆으로 붙는다.
 */
export const EDGE_BAND = 0.25;

/**
 * 끌어 놓은 자리가 줄의 몇 번째 틈인가. 옆으로 붙일 자리가 아니면 `null`.
 *
 * `count` 는 그 마디에 든 사진 수다 — 낱장이면 1, 줄이면 2~4. 틈은 `0..count`
 * 가운데 **가장 가까운 것**이다. 낱장이면 왼쪽 절반이 0(왼쪽에 붙음), 오른쪽
 * 절반이 1(오른쪽에 붙음)이 된다.
 *
 * 가로로는 상자 밖이어도 받는다. 너비를 줄인 사진은 옆이 비어 있고, 사람은
 * 그 빈 곳에 놓는 것을 "옆에 붙인다"로 여긴다.
 */
export function sideDropIndex(
  box: Box,
  x: number,
  y: number,
  count: number,
): number | null {
  if (count < 1 || box.width <= 0 || box.height <= 0) return null;

  const ry = (y - box.top) / box.height;
  if (!(ry >= EDGE_BAND && ry <= 1 - EDGE_BAND)) return null;

  const rx = Math.min(1, Math.max(0, (x - box.left) / box.width));
  return Math.round(rx * count);
}

/**
 * 끌어 온 사진들을 줄의 `index` 번째 틈에 끼운다. 넉 장을 넘기면 `null`.
 *
 * 넘칠 때 조용히 잘라 넣지 않는다 — 사진 한 장이 사라진다. 대신 끼우지 않고
 * 평소 끌어 놓기(위·아래로 옮기기)로 떨어진다.
 */
export function joinRow(
  target: RowImage[],
  dragged: RowImage[],
  index: number,
): RowImage[] | null {
  if (dragged.length === 0 || target.length === 0) return null;
  if (target.length + dragged.length > MAX_ROW_IMAGES) return null;
  const at = Math.min(target.length, Math.max(0, Math.round(index)));
  return [...target.slice(0, at), ...dragged, ...target.slice(at)];
}

/** 틈을 보여 줄 세로 막대의 가로 위치. 칸을 똑같이 나눈다고 보고 어림한다. */
export const gapX = (box: Box, index: number, count: number): number =>
  box.left + (box.width * Math.min(count, Math.max(0, index))) / count;

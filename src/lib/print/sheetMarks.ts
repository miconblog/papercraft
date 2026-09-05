/**
 * 타일 표식 — 재단선 · 겹침 · 조립 표식 · 장 번호 (IDE-007)
 *
 * 규격은 `docs/print-spec.md` §5. 좌표는 **용지 절대 mm**다(도안 좌표가 아니다).
 * 표식은 배율을 먹지 않는다 — 200%로 뽑았다고 재단선이 두 배로 굵어지면 자를
 * 자리가 흐려진다.
 *
 * 모든 표식은 **인쇄 가능 영역 안**에 그린다. 스파이크는 장 번호를 용지
 * 아래 1.6mm에 두었는데, 그 자리는 가정용 프린터가 인쇄하지 못하는 여백이라
 * 종이에서는 사라진다. 아래쪽 표식 띠(`STAMP_BAND_MM`)를 타일 계획에서 미리
 * 떼어 두는 이유가 이것이다.
 */
import { MIN_STROKE_MM, STAMP_BAND_MM } from './geometry';
import { BLACK, INK, path, text, type Draw } from './draw';
import { linePath, polygonPath, rectPath } from './path';
import type { Tile, TilePlan } from './tile';

/** 귀퉁이 재단선 — 도안 모서리에서 띄우는 거리와 길이. */
const CROP_GAP_MM = 1;
const CROP_LEN_MM = 4;
/** 정렬 삼각형의 반높이. */
const TRIANGLE_MM = 2.2;

/**
 * 하단 표식 띠의 두 줄. 띠는 7mm뿐이라(`STAMP_BAND_MM`) 글자 크기가 빠듯하다.
 *
 * 한글 글자 상자는 크기의 약 1.45배(ascent 1.16em + descent 0.288em)를 차지한다.
 * 2.4mm + 2.0mm이면 상자 높이가 3.48 + 2.90 = 6.38mm로 7mm 안에 들어간다.
 * 이보다 키우면 띠를 넘어 인쇄되지 않는 여백으로 밀려난다.
 */
const STAMP_LINE_1_MM = 2.0;
const STAMP_LINE_2_MM = 5.0;
const STAMP_SIZE_1_MM = 2.4;
const STAMP_SIZE_2_MM = 2.0;

/** 한 줄이라도 들어갈 최소 띠 폭. 이보다 좁으면 표식을 아예 빼는 편이 낫다. */
const STAMP_MIN_BAND_MM = 4;

const FRAME_STROKE_MM = MIN_STROKE_MM;

export interface TileMarksInput {
  readonly plan: TilePlan;
  readonly tile: Tile;
  /** `축구 게임판 · 운동장`처럼 사람이 읽을 이름. */
  readonly sheetLabel: string;
  /** `200%`. */
  readonly scaleLabel: string;
  /** 여러 벌 중 몇 벌째인가. 1벌뿐이면 `null`. */
  readonly copy: { readonly index: number; readonly total: number } | null;
}

const mark = (
  commands: ReturnType<typeof linePath>,
  strokeMm: number,
  dashMm: readonly number[] | null = null,
) =>
  path(commands, {
    stroke: BLACK,
    fill: null,
    strokeMm,
    dashMm,
    fixedStroke: true,
  });

export function tileMarks({
  plan,
  tile,
  sheetLabel,
  scaleLabel,
  copy,
}: TileMarksInput): Draw[] {
  const items: Draw[] = [];
  const x0 = tile.dstXMm;
  const y0 = tile.dstYMm;
  const x1 = x0 + tile.srcWMm;
  const y1 = y0 + tile.srcHMm;

  // 인쇄 가능 영역 — 표식이 이 밖으로 나가면 종이에서 사라진다.
  const left = plan.marginMm;
  const top = plan.marginMm;
  const right = plan.pageWidthMm - plan.marginMm;
  const bottom = plan.pageHeightMm - plan.marginMm;

  // ① 재단선 — **여러 장으로 나뉠 때만** 그린다.
  //
  //    한 장이면 자를 이유가 없다. 오히려 부속 도안이 이미 가진 오림선 바깥에
  //    네모가 하나 더 생겨 어느 선을 잘라야 하는지 헷갈린다. 여러 장일 때는
  //    반대로 반드시 있어야 한다 — 흰 여백을 남긴 채로는 도안이 이어지지 않는다.
  if (plan.total > 1) {
    // 테두리 — 귀퉁이 눈금만으로는 도안이 용지를 거의 채우는 배율에서 자를
    // 자리가 보이지 않는다.
    items.push(
      mark(rectPath(x0, y0, tile.srcWMm, tile.srcHMm), FRAME_STROKE_MM),
    );
    // 귀퉁이 눈금 — 마주 붙는 장의 눈금과 맞춰 자른다. 여백이 좁으면 그만큼
    // 짧아진다(인쇄 가능 영역 밖으로 나가지 않는다).
    for (const [cx, cy, sx, sy] of [
      [x0, y0, -1, -1],
      [x1, y0, 1, -1],
      [x0, y1, -1, 1],
      [x1, y1, 1, 1],
    ] as const) {
      const hx = clampSegment(cx, sx, left, right);
      if (hx) items.push(mark(linePath(hx[0], cy, hx[1], cy), 0.15));
      const vy = clampSegment(cy, sy, top, bottom);
      if (vy) items.push(mark(linePath(cx, vy[0], cx, vy[1]), 0.15));
    }
  }

  // ③ 겹침 경계 — 파선 안쪽이 옆 장과 포개지는 띠다.
  if (tile.col < plan.cols) {
    items.push(
      mark(
        linePath(x1 - plan.overlapXMm, y0, x1 - plan.overlapXMm, y1),
        0.12,
        [1.5, 1.5],
      ),
    );
  }
  if (tile.row < plan.rows) {
    items.push(
      mark(
        linePath(x0, y1 - plan.overlapYMm, x1, y1 - plan.overlapYMm),
        0.12,
        [1.5, 1.5],
      ),
    );
  }

  // ④ 정렬 삼각형 — 두 장을 겹칠 때 이 삼각형끼리 정확히 포개져야 한다.
  //    겹침 경계와 그것에 마주 붙는 변에 각각 ¼·¾ 지점 두 쌍이다.
  const t = TRIANGLE_MM;
  const ysAt = [y0 + tile.srcHMm * 0.25, y0 + tile.srcHMm * 0.75];
  const xsAt = [x0 + tile.srcWMm * 0.25, x0 + tile.srcWMm * 0.75];
  if (tile.col < plan.cols) {
    for (const y of ysAt)
      items.push(triangle(x1 - plan.overlapXMm, y, t, 'right'));
  }
  if (tile.col > 1) {
    for (const y of ysAt) items.push(triangle(x0, y, t, 'right'));
  }
  if (tile.row < plan.rows) {
    for (const x of xsAt)
      items.push(triangle(x, y1 - plan.overlapYMm, t, 'down'));
  }
  if (tile.row > 1) {
    for (const x of xsAt) items.push(triangle(x, y0, t, 'down'));
  }

  // ⑤ 하단 표식 띠 — 장 번호와 인쇄 안내. 계획이 떼어 둔 자리 안에서만 그린다.
  //
  //    도안이 인쇄 가능 영역을 꽉 채우는 배율에서는 띠가 좁아지거나 아예
  //    없어진다. 그때는 표식을 뺀다 — 도안 위에 덧그리거나 종이를 한 장 더
  //    쓰는 쪽보다 낫고, 같은 안내는 조립 안내 시트에 남는다.
  if (plan.stampBandMm < STAMP_MIN_BAND_MM) return items;

  const bandTop = bottom - plan.stampBandMm;
  const bandWidth = right - left;
  const copyLabel = copy ? ` · ${copy.total}벌 중 ${copy.index}벌째` : '';
  items.push(
    text(
      `${sheetLabel} · ${tile.index}/${plan.total}장 (${tile.row}행 ${tile.col}열)${copyLabel}`,
      left,
      bandTop + STAMP_LINE_1_MM,
      STAMP_SIZE_1_MM,
      { bold: true, fill: INK, maxWidthMm: bandWidth * 0.72 },
    ),
    text(
      `배율 ${scaleLabel}`,
      right,
      bandTop + STAMP_LINE_1_MM,
      STAMP_SIZE_1_MM,
      {
        anchor: 'end',
        bold: true,
        fill: INK,
        maxWidthMm: bandWidth * 0.26,
      },
    ),
  );

  // 둘째 줄은 띠가 넉넉할 때만. 좁으면 장 번호 한 줄을 살린다.
  if (plan.stampBandMm < STAMP_BAND_MM) return items;

  const neighbours = neighbourLabel(plan, tile);
  if (neighbours) {
    items.push(
      text(neighbours, left, bandTop + STAMP_LINE_2_MM, STAMP_SIZE_2_MM, {
        fill: INK,
        maxWidthMm: bandWidth * 0.62,
      }),
    );
  }
  // 프린터의 자동 맞춤이 치수를 말없이 바꾼다(IDE-002 §8.2). 화면 안내만으로는
  // 인쇄 대화상자 앞에서 잊히므로 종이에도 같이 박아 둔다.
  items.push(
    text(
      '배율 100%(맞춤 없음)으로 인쇄',
      right,
      bandTop + STAMP_LINE_2_MM,
      STAMP_SIZE_2_MM,
      {
        anchor: 'end',
        fill: INK,
        maxWidthMm: bandWidth * 0.36,
      },
    ),
  );

  return items;
}

/**
 * 이웃 장 번호와 방향. 겹침 띠 안에 라벨을 넣으면 붙인 뒤에도 글자가 남아
 * 도안 위에 보이므로, 잘라 버리는 하단 띠에 모아 적는다.
 */
function neighbourLabel(plan: TilePlan, tile: Tile): string | null {
  const at = (row: number, col: number) => (row - 1) * plan.cols + col;
  const parts: string[] = [];
  if (tile.col > 1) parts.push(`◀ ${at(tile.row, tile.col - 1)}번`);
  if (tile.col < plan.cols) parts.push(`▶ ${at(tile.row, tile.col + 1)}번`);
  if (tile.row > 1) parts.push(`▲ ${at(tile.row - 1, tile.col)}번`);
  if (tile.row < plan.rows) parts.push(`▼ ${at(tile.row + 1, tile.col)}번`);
  if (parts.length === 0) return null;
  return `이어 붙일 장 ${parts.join(' · ')} · 겹침 ${plan.overlapXMm || plan.overlapYMm}mm`;
}

/** `from`에서 `dir` 쪽으로 뻗는 재단선. 인쇄 가능 영역을 넘으면 잘라 낸다. */
function clampSegment(
  from: number,
  dir: -1 | 1,
  lowerBound: number,
  upperBound: number,
): [number, number] | null {
  const start = from + dir * CROP_GAP_MM;
  const end = from + dir * (CROP_GAP_MM + CROP_LEN_MM);
  const clampedStart = Math.min(Math.max(start, lowerBound), upperBound);
  const clampedEnd = Math.min(Math.max(end, lowerBound), upperBound);
  return Math.abs(clampedEnd - clampedStart) < 0.5
    ? null
    : [clampedStart, clampedEnd];
}

/** 겹침 경계에 붙는 삼각형. 두 장을 포갰을 때 이것끼리 정확히 맞아야 한다. */
const triangle = (
  xMm: number,
  yMm: number,
  sizeMm: number,
  direction: 'right' | 'down',
): Draw =>
  path(
    polygonPath(
      direction === 'right'
        ? [
            [xMm, yMm - sizeMm],
            [xMm, yMm + sizeMm],
            [xMm + sizeMm * 1.6, yMm],
          ]
        : [
            [xMm - sizeMm, yMm],
            [xMm + sizeMm, yMm],
            [xMm, yMm + sizeMm * 1.6],
          ],
    ),
    { fill: BLACK, stroke: null, strokeMm: 0, fixedStroke: true },
  );

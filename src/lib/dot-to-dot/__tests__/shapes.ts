/**
 * 테스트가 쓰는 "사진" — 알려진 도형을 픽셀로 그린다 (IDE-019)
 *
 * 파이프라인이 순수 함수라 진짜 사진이 없어도 끝까지 돌릴 수 있다. 도형을
 * **답을 아는 채로** 넣는 것이 이 파일의 목적이다 — 별을 넣었으면 꼭짓점
 * 열 개가 점을 받아야 하고, 원을 넣었으면 점이 고르게 퍼져야 한다.
 */
import type { RgbaImage } from '../image.ts';

export interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** 흰 바탕. 사진 한 장에 해당한다. */
export function blank(width: number, height: number): Canvas {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  return { width, height, data };
}

const setPixel = (canvas: Canvas, x: number, y: number, value: number) => {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const o = (y * canvas.width + x) * 4;
  canvas.data[o] = value;
  canvas.data[o + 1] = value;
  canvas.data[o + 2] = value;
  canvas.data[o + 3] = 255;
};

/** 다각형 안쪽을 칠한다. 짝수-홀수 규칙 스캔라인이다. */
export function fillPolygon(
  canvas: Canvas,
  points: ReadonlyArray<readonly [number, number]>,
  value = 0,
): Canvas {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (
    let y = Math.max(0, Math.floor(minY));
    y <= Math.min(canvas.height - 1, Math.ceil(maxY));
    y += 1
  ) {
    const scan = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if (y1 === y2) continue;
      if (scan >= Math.min(y1, y2) && scan < Math.max(y1, y2)) {
        crossings.push(x1 + ((scan - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      for (
        let x = Math.ceil(crossings[i] - 0.5);
        x <= Math.floor(crossings[i + 1] - 0.5);
        x += 1
      ) {
        setPixel(canvas, x, y, value);
      }
    }
  }
  return canvas;
}

export function fillCircle(
  canvas: Canvas,
  cx: number,
  cy: number,
  radius: number,
  value = 0,
): Canvas {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= radius) {
        setPixel(canvas, x, y, value);
      }
    }
  }
  return canvas;
}

/** 꼭짓점 `n`개짜리 별. 뾰족한 끝이 `n`개라 모서리 판정을 그대로 검사한다. */
export function starPoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  n: number,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < n * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / n - Math.PI / 2;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return points;
}

/**
 * 사람 실루엣 — 머리·몸통·팔다리를 이은 한 덩어리.
 *
 * 볼록하지 않고 오목한 자리(겨드랑이·가랑이)가 있어야 "모서리를 집는가"가
 * 진짜로 검사된다. 원과 별만으로는 그 경우가 안 나온다.
 */
export function figurePoints(
  cx: number,
  cy: number,
  scale: number,
): Array<[number, number]> {
  // 아래 좌표는 폭 1, 높이 2인 상자에 그린 사람이다.
  const raw: Array<[number, number]> = [
    [0, -1],
    [0.16, -0.9],
    [0.16, -0.72],
    [0.42, -0.6],
    [0.5, -0.1],
    [0.36, -0.05],
    [0.28, -0.45],
    [0.24, 0.1],
    [0.36, 0.95],
    [0.2, 1],
    [0.05, 0.35],
    [-0.05, 0.35],
    [-0.2, 1],
    [-0.36, 0.95],
    [-0.24, 0.1],
    [-0.28, -0.45],
    [-0.36, -0.05],
    [-0.5, -0.1],
    [-0.42, -0.6],
    [-0.16, -0.72],
    [-0.16, -0.9],
  ];
  return raw.map(([x, y]) => [cx + x * scale, cy + y * scale]);
}

export const toImage = (canvas: Canvas): RgbaImage => canvas;

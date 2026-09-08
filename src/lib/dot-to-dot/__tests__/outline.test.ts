/**
 * 윤곽 따기 — 알려진 도형을 넣어 답을 안 채로 검사한다 (IDE-019)
 */
import { describe, expect, it } from 'vitest';
import {
  binarize,
  bounds,
  gaussianBlur,
  otsuThreshold,
  signedArea,
  toGray,
  toMask,
  toPoints,
  traceContours,
  traceOutline,
} from '..';
import {
  blank,
  fillCircle,
  fillPolygon,
  figurePoints,
  starPoints,
} from './shapes.ts';

describe('이진화', () => {
  it('밝은 배경의 어두운 피사체를 1로 잡는다', () => {
    const canvas = fillCircle(blank(80, 80), 40, 40, 20);
    const mask = toMask(canvas);
    expect(mask.data[40 * 80 + 40]).toBe(1);
    expect(mask.data[0]).toBe(0);
  });

  it('어두운 배경의 밝은 피사체도 1로 잡는다 — 테두리를 보고 뒤집는다', () => {
    const canvas = blank(80, 80);
    canvas.data.fill(20);
    for (let i = 3; i < canvas.data.length; i += 4) canvas.data[i] = 255;
    fillCircle(canvas, 40, 40, 20, 240);
    const mask = toMask(canvas);
    expect(mask.data[40 * 80 + 40]).toBe(1);
    expect(mask.data[0]).toBe(0);
  });

  it('Otsu 임계값이 두 봉우리 사이에 온다', () => {
    const canvas = fillCircle(blank(60, 60), 30, 30, 15);
    const gray = gaussianBlur(toGray(canvas), 1);
    const threshold = otsuThreshold(gray);
    expect(threshold).toBeGreaterThan(20);
    expect(threshold).toBeLessThan(235);
  });
});

describe('윤곽 추적', () => {
  it('사각형 하나에서 닫힌 고리 하나가 나온다', () => {
    const canvas = fillPolygon(blank(60, 60), [
      [15, 15],
      [45, 15],
      [45, 45],
      [15, 45],
    ]);
    const gray = toGray(canvas);
    const contours = traceContours(binarize(gray, otsuThreshold(gray)));
    expect(contours).toHaveLength(1);
    // 고리가 닫혀 있어야 넓이가 실제 넓이에 가깝다(30×30 = 900).
    const a = Math.abs(signedArea(contours[0]));
    expect(a).toBeGreaterThan(830);
    expect(a).toBeLessThan(970);
  });

  it('떨어진 덩어리 둘은 고리 둘이다', () => {
    const canvas = blank(80, 40);
    fillCircle(canvas, 20, 20, 10);
    fillCircle(canvas, 60, 20, 10);
    const gray = toGray(canvas);
    expect(traceContours(binarize(gray, otsuThreshold(gray)))).toHaveLength(2);
  });
});

describe('traceOutline', () => {
  it('별을 넣으면 꼭짓점이 살아남는다', () => {
    const canvas = fillPolygon(
      blank(240, 240),
      starPoints(120, 120, 95, 42, 5),
    );
    const result = traceOutline(canvas);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 별 하나에 꼭짓점이 열(바깥 다섯 · 안쪽 다섯)이다. 단순화가 그보다 훨씬
    // 많이 남기면 계단이 남은 것이고, 적게 남기면 형태를 깎은 것이다.
    const points = toPoints(result.outline);
    expect(points.length).toBeGreaterThanOrEqual(10);
    expect(points.length).toBeLessThanOrEqual(24);
  });

  it('시계 방향으로 돌려준다 — 번호가 늘 같은 쪽으로 흐른다', () => {
    const canvas = fillCircle(blank(200, 200), 100, 100, 70);
    const result = traceOutline(canvas);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(signedArea(toPoints(result.outline))).toBeGreaterThan(0);
  });

  it('판에 맞춰 넣으면 비율을 지킨 채 가운데 온다', () => {
    // 가로로 넓은 도형을 세로 판에 넣는다. 늘이지 않고 위아래를 비운다.
    const canvas = fillPolygon(blank(300, 150), [
      [20, 40],
      [280, 40],
      [280, 110],
      [20, 110],
    ]);
    const box = { x: 10, y: 30, width: 170, height: 220 };
    const result = traceOutline(canvas, { fitTo: box });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const b = bounds(toPoints(result.outline));
    const width = b.maxX - b.minX;
    const height = b.maxY - b.minY;
    expect(width).toBeCloseTo(box.width, 0);
    expect(height).toBeLessThan(box.height);
    // 원본 비율 260:70 을 지켰는가.
    expect(width / height).toBeCloseTo(260 / 70, 0);
    // 가운데. 위아래 여백이 같다.
    expect(b.minY - box.y).toBeCloseTo(box.y + box.height - b.maxY, 1);
  });

  it('사람 실루엣의 오목한 자리(겨드랑이)가 살아남는다', () => {
    const canvas = fillPolygon(blank(240, 400), figurePoints(120, 200, 180));
    const result = traceOutline(canvas);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toPoints(result.outline).length).toBeGreaterThanOrEqual(16);
  });
});

describe('실패를 조용히 넘기지 않는다', () => {
  it('빈 사진 — 사유가 나온다', () => {
    const result = traceOutline(blank(120, 120));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty');
    expect(result.message.length).toBeGreaterThan(10);
  });

  it('피사체가 너무 작다', () => {
    const canvas = fillCircle(blank(300, 300), 150, 150, 18);
    const result = traceOutline(canvas);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('too-small');
  });

  it('배경이 복잡하면 어느 것이 피사체인지 못 고른다', () => {
    const canvas = blank(300, 300);
    for (let i = 0; i < 9; i += 1) {
      fillCircle(canvas, 50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100, 38);
    }
    const result = traceOutline(canvas);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('scattered');
  });

  it('사진 거의 전체가 한 덩어리로 잡히면 대비를 탓한다', () => {
    const canvas = fillPolygon(blank(200, 200), [
      [2, 2],
      [198, 2],
      [198, 198],
      [2, 198],
    ]);
    const result = traceOutline(canvas);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(['flooded', 'empty']).toContain(result.reason);
  });
});

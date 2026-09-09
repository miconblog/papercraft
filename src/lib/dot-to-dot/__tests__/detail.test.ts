/**
 * 세부 선 — 알려진 얼굴을 넣어 답을 안 채로 검사한다 (IDE-021)
 *
 * 흰 바탕에 회색 머리 하나, 그 안에 검은 눈 둘과 입 하나. 윤곽은 머리 하나이고
 * 세부는 셋이어야 한다 — 지금 방식(임계값 하나)으로는 셋이 통째로 머리에 묻힌다는
 * 것이 이 이슈의 출발점이다.
 */
import { describe, expect, it } from 'vitest';
import {
  bounds,
  erodeMask,
  multiThresholds,
  prepareImage,
  toPoints,
  traceDetail,
  tracePicture,
  traceOutline,
  DETAIL_MAX_AREA_RATIO,
  MAX_DETAIL_LEVELS,
} from '..';
import { blank, fillCircle, fillPolygon } from './shapes.ts';

/** 회색 머리 · 검은 눈 둘 · 검은 입. 지금 파이프라인이 실루엣 하나로 뭉치는 사진. */
const facePhoto = () => {
  const canvas = fillCircle(blank(300, 300), 150, 150, 100, 160);
  fillCircle(canvas, 115, 125, 18, 30);
  fillCircle(canvas, 185, 125, 18, 30);
  fillPolygon(
    canvas,
    [
      [120, 190],
      [180, 190],
      [180, 205],
      [120, 205],
    ],
    30,
  );
  return canvas;
};

/** 안쪽이 살짝 더 어두운 원. 갈랐을 때 나오는 고리가 실루엣을 그대로 되짚는다. */
const twoTonePhoto = () => {
  const canvas = fillCircle(blank(300, 300), 150, 150, 100, 150);
  fillCircle(canvas, 150, 150, 95, 120);
  return canvas;
};

const detailOf = (image: ReturnType<typeof facePhoto>, levels: number) => {
  const { gray, mask } = prepareImage(image);
  return traceDetail(gray, mask, { levels });
};

describe('다단계 임계값', () => {
  it('고른 수만큼 작은 값부터 늘어선다', () => {
    const histogram = new Float64Array(256);
    for (const [value, count] of [
      [30, 500],
      [120, 500],
      [220, 500],
    ] as const) {
      histogram[value] = count;
    }
    // 임계값 `t`는 `gray <= t`를 어두운 쪽으로 가른다 — 봉우리 값 자체가 임계값이
    // 될 수 있다. 봉우리 셋이면 임계값 둘이 그 사이사이에 하나씩 놓인다.
    const two = multiThresholds(histogram, 2);
    expect(two).toHaveLength(2);
    expect(two[0]).toBeGreaterThanOrEqual(30);
    expect(two[0]).toBeLessThan(120);
    expect(two[1]).toBeGreaterThanOrEqual(120);
    expect(two[1]).toBeLessThan(220);
  });

  it('더 가를 것이 없으면 거기서 멈춘다', () => {
    const flat = new Float64Array(256);
    flat[100] = 1000;
    expect(multiThresholds(flat, 3).length).toBeLessThanOrEqual(1);
  });
});

describe('깎기', () => {
  it('둘레를 벗겨 낸다 — 안쪽만 남는다', () => {
    const mask = {
      width: 9,
      height: 9,
      data: new Uint8Array(81).fill(1),
    };
    const inner = erodeMask(mask, 2);
    expect(inner.data[4 * 9 + 4]).toBe(1);
    expect(inner.data[0]).toBe(0);
    expect(inner.data[1 * 9 + 1]).toBe(0);
  });

  it('반지름 0이면 그대로다', () => {
    const mask = { width: 4, height: 4, data: new Uint8Array(16).fill(1) };
    expect(erodeMask(mask, 0)).toBe(mask);
  });
});

describe('세부 따기', () => {
  it('0단이면 아무것도 안 딴다 — 세부를 끈 판은 지금까지와 같다', () => {
    expect(detailOf(facePhoto(), 0)).toEqual([]);
  });

  it('한 단만 더 갈라도 눈 둘과 입이 나온다', () => {
    const rings = detailOf(facePhoto(), 1);
    expect(rings).toHaveLength(3);
    // 셋 다 머리 안쪽에 있다.
    for (const ring of rings) {
      const b = bounds(ring);
      expect(b.minX).toBeGreaterThan(55);
      expect(b.maxX).toBeLessThan(245);
      expect(b.minY).toBeGreaterThan(55);
      expect(b.maxY).toBeLessThan(245);
    }
  });

  it('실루엣을 되짚는 고리는 버린다 — 점을 잇기 전에 답이 보이면 안 된다', () => {
    const { gray, mask } = prepareImage(twoTonePhoto());
    let subject = 0;
    for (const v of mask.data) subject += v;
    for (const ring of traceDetail(gray, mask, { levels: 2 })) {
      const b = bounds(ring);
      const box = (b.maxX - b.minX) * (b.maxY - b.minY);
      expect(box).toBeLessThan(subject / DETAIL_MAX_AREA_RATIO);
    }
  });

  it('고리 수와 점 수에 상한이 있다 — 저장과 전송이 감당할 만해야 한다', () => {
    const { gray, mask } = prepareImage(facePhoto());
    const rings = traceDetail(gray, mask, {
      levels: MAX_DETAIL_LEVELS,
      maxRings: 2,
      maxPoints: 40,
    });
    expect(rings.length).toBeLessThanOrEqual(2);
    expect(rings.reduce((sum, r) => sum + r.length, 0)).toBeLessThanOrEqual(40);
  });
});

describe('윤곽과 세부를 함께', () => {
  it('세부를 꺼도 윤곽은 `traceOutline`과 같다', () => {
    const image = facePhoto();
    const picture = tracePicture(image, { detailLevels: 0 });
    const outline = traceOutline(image);
    expect(picture.ok && outline.ok).toBe(true);
    if (!picture.ok || !outline.ok) return;
    expect(picture.outline).toEqual(outline.outline);
    expect(picture.detail).toEqual([]);
  });

  it('세부를 켜면 윤곽은 그대로고 선만 붙는다', () => {
    const image = facePhoto();
    const off = tracePicture(image, { detailLevels: 0 });
    const on = tracePicture(image, { detailLevels: 1 });
    expect(off.ok && on.ok).toBe(true);
    if (!off.ok || !on.ok) return;
    expect(on.outline).toEqual(off.outline);
    expect(on.detail.length).toBe(3);
    // 납작한 좌표 배열이라 짝이 맞는다.
    for (const ring of on.detail) expect(ring.length % 2).toBe(0);
  });

  it('윤곽을 못 따면 세부도 안 딴다 — 사유만 나온다', () => {
    const result = tracePicture(blank(120, 120), { detailLevels: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty');
  });

  it('세부는 윤곽과 같은 좌표계에 있다', () => {
    const result = tracePicture(facePhoto(), { detailLevels: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const outline = bounds(toPoints(result.outline));
    for (const ring of result.detail) {
      const b = bounds(toPoints(ring));
      expect(b.minX).toBeGreaterThanOrEqual(outline.minX);
      expect(b.maxX).toBeLessThanOrEqual(outline.maxX);
      expect(b.minY).toBeGreaterThanOrEqual(outline.minY);
      expect(b.maxY).toBeLessThanOrEqual(outline.maxY);
    }
  });
});

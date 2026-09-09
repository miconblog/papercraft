/**
 * 사용자가 사진을 고치는 데 필요한 것들 (IDE-020)
 *
 * `IDE-019`가 낸 파이프라인에 두 가지가 붙었다 — **임계값 밀기**(자동 이진화가
 * 실패한 사진을 사용자가 민다)와 **맞춰 넣는 변환 꺼내 쓰기**(윤곽과 사진을
 * 같은 자리에 겹쳐 보려면 둘에 같은 변환을 먹여야 한다).
 */
import { describe, expect, it } from 'vitest';
import {
  applyFit,
  bounds,
  fitOutline,
  fitTransform,
  toMask,
  toPoints,
  traceOutline,
  MAX_SIDE_PX,
  MAX_THRESHOLD_OFFSET,
} from '..';
import { PHOTO_MAX_SIDE_PX, readPhoto } from '../browser.ts';
import { blank, fillCircle, fillPolygon, starPoints } from './shapes.ts';

const litArea = (mask: { data: Uint8Array }): number =>
  mask.data.reduce((sum, v) => sum + v, 0);

describe('임계값 밀기', () => {
  const photo = () => fillCircle(blank(90, 90), 45, 45, 25);

  it('밝은 쪽으로 밀면 피사체가 커지고 어두운 쪽으로 밀면 작아진다', () => {
    const dark = litArea(toMask(photo(), { thresholdOffset: -40 }));
    const auto = litArea(toMask(photo(), { thresholdOffset: 0 }));
    const light = litArea(toMask(photo(), { thresholdOffset: 40 }));
    expect(dark).toBeLessThan(auto);
    expect(auto).toBeLessThan(light);
  });

  it('한계 밖으로 밀어도 한계까지만 민다 — 마스크가 통째로 뒤집히지 않는다', () => {
    const far = litArea(
      toMask(photo(), { thresholdOffset: MAX_THRESHOLD_OFFSET * 10 }),
    );
    const edge = litArea(
      toMask(photo(), { thresholdOffset: MAX_THRESHOLD_OFFSET }),
    );
    expect(far).toBe(edge);
  });

  it('임계값을 직접 주면 밀기는 무시된다', () => {
    const fixed = litArea(toMask(photo(), { threshold: 120 }));
    const both = litArea(
      toMask(photo(), { threshold: 120, thresholdOffset: 50 }),
    );
    expect(both).toBe(fixed);
  });

  it('민 값이 그대로 `traceOutline`까지 간다', () => {
    const image = photo();
    const wide = traceOutline(image, { thresholdOffset: 40 });
    const narrow = traceOutline(image, { thresholdOffset: -40 });
    expect(wide.ok && narrow.ok).toBe(true);
    if (!wide.ok || !narrow.ok) return;
    const size = (flat: number[]) => {
      const b = bounds(toPoints(flat));
      return (b.maxX - b.minX) * (b.maxY - b.minY);
    };
    expect(size(wide.outline)).toBeGreaterThan(size(narrow.outline));
  });
});

describe('맞춰 넣는 변환', () => {
  const box = { x: 20, y: 30, width: 100, height: 200 };
  /** 사진 화소 좌표의 윤곽 하나. 아직 아무 상자에도 맞추지 않았다. */
  const star = () => {
    const traced = traceOutline(
      fillPolygon(blank(120, 160), starPoints(60, 80, 45, 20, 5)),
    );
    if (!traced.ok) throw new Error(`별을 못 땄다: ${traced.reason}`);
    return toPoints(traced.outline);
  };

  it('변환을 손으로 먹인 결과가 `fitOutline`과 같다', () => {
    const points = star();
    const fit = fitTransform(points, box);
    const byHand = points.map((p) => applyFit(fit, p.x, p.y));
    const byHelper = fitOutline(points, box);
    expect(byHand).toHaveLength(byHelper.length);
    for (const [i, p] of byHand.entries()) {
      expect(p.x).toBeCloseTo(byHelper[i].x, 9);
      expect(p.y).toBeCloseTo(byHelper[i].y, 9);
    }
  });

  it('사진 테두리를 같은 변환으로 옮기면 윤곽을 감싼다', () => {
    // 원본 대조 보기가 서는 근거다 — 사진과 윤곽이 같은 좌표계에 놓인다.
    const points = star();
    const fit = fitTransform(points, box);
    const topLeft = applyFit(fit, 0, 0);
    const bottomRight = applyFit(fit, 120, 160);
    const placed = bounds(fitOutline(points, box));
    expect(topLeft.x).toBeLessThanOrEqual(placed.minX + 1e-9);
    expect(topLeft.y).toBeLessThanOrEqual(placed.minY + 1e-9);
    expect(bottomRight.x).toBeGreaterThanOrEqual(placed.maxX - 1e-9);
    expect(bottomRight.y).toBeGreaterThanOrEqual(placed.maxY - 1e-9);
  });

  it('넓이가 0인 윤곽은 그대로 둔다 — 0으로 나누지 않는다', () => {
    const line = [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
    ];
    expect(fitOutline(line, box)).toEqual(line);
  });
});

describe('사진 받기', () => {
  it('저장 사진이 윤곽 따기의 축소 한계보다 작다', () => {
    // 어긋나면 겹쳐 본 사진이 슬며시 밀리기만 해 눈으로는 잡기 어렵다.
    expect(PHOTO_MAX_SIDE_PX).toBeLessThanOrEqual(MAX_SIDE_PX);
  });

  it('그림이 아닌 파일은 받지 않는다', async () => {
    const file = new File(['x'], 'memo.txt', { type: 'text/plain' });
    await expect(readPhoto(file)).rejects.toThrow('그림 파일이 아니다');
  });

  it('너무 큰 파일은 받지 않는다 — 최대치를 함께 말한다', async () => {
    const file = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 40 * 1024 * 1024 });
    await expect(readPhoto(file)).rejects.toThrow('20MB까지');
  });
});

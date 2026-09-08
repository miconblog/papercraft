/**
 * 점 배분과 번호 — 답을 아는 도형으로 검사한다 (IDE-019)
 */
import { describe, expect, it } from 'vitest';
import {
  DOT_METRICS,
  dotCapacity,
  distance,
  fitOutline,
  planDots,
  toFlat,
  toPoints,
  traceOutline,
  type Dot,
} from '..';
import { blank, fillPolygon, starPoints } from './shapes.ts';

/** 판 안쪽. 실제 도안(`dimensions.ts`)이 쓰는 값과 같은 크기다. */
const BOX = { x: 17, y: 37, width: 156, height: 218 };

const circleOutline = (radius: number, segments = 96): number[] =>
  toFlat(
    Array.from({ length: segments }, (_, i) => {
      const angle = (Math.PI * 2 * i) / segments;
      return {
        x: 95 + Math.cos(angle) * radius,
        y: 138 + Math.sin(angle) * radius,
      };
    }),
  );

/** 두 번호 글자 상자가 겹치는가. 폭 어림값은 배치 코드와 같은 규칙을 쓴다. */
const labelsOverlap = (a: Dot, b: Dot, fontMm: number): boolean => {
  const halfWidth = (n: number) => (String(n).length * 0.55 * fontMm) / 2;
  return (
    Math.abs(a.labelXMm - b.labelXMm) <
      halfWidth(a.number) + halfWidth(b.number) &&
    Math.abs(a.labelYMm - b.labelYMm) < fontMm
  );
};

describe('점 개수', () => {
  it('넣은 개수와 찍힌 개수가 같다', () => {
    const outline = circleOutline(70);
    for (const n of [5, 12, 20, 37, 50]) {
      expect(planDots(outline, n).dots).toHaveLength(n);
    }
  });

  it('상한을 넘기면 최대치에서 멈추고 그 사실을 알린다', () => {
    const outline = circleOutline(20);
    const capacity = dotCapacity(outline);
    const plan = planDots(outline, 100);
    expect(plan.dots).toHaveLength(capacity);
    expect(plan.clamped).toBe(true);
    expect(plan.capacity).toBe(capacity);
    // 둘레 ÷ 최소 간격이 상한이다.
    expect(capacity).toBe(
      Math.floor((2 * Math.PI * 20) / DOT_METRICS.minGapMm),
    );
  });

  it('상한 안이면 알리지 않는다', () => {
    const plan = planDots(circleOutline(70), 30);
    expect(plan.clamped).toBe(false);
    expect(plan.crowded).toBe(false);
  });
});

describe('점 배분', () => {
  it('별의 뾰족한 끝이 모두 점을 받는다', () => {
    const star = starPoints(150, 150, 130, 55, 5);
    const canvas = fillPolygon(blank(300, 300), star);
    const traced = traceOutline(canvas, { fitTo: BOX });
    expect(traced.ok).toBe(true);
    if (!traced.ok) return;

    const plan = planDots(traced.outline, 20);
    expect(plan.dots).toHaveLength(20);

    // 원본 별의 꼭짓점을 같은 상자에 맞춰 넣으면 도안 위 어디여야 하는지가
    // 나온다. 딴 윤곽의 테두리가 화소 반 칸만큼 넓어 완전히 같지는 않다.
    const fitted = fitOutline(
      star.map(([x, y]) => ({ x, y })),
      BOX,
    );
    const tips = fitted.filter((_, i) => i % 2 === 0);
    expect(tips).toHaveLength(5);

    for (const tip of tips) {
      const nearest = Math.min(
        ...plan.dots.map((d) => Math.hypot(d.xMm - tip.x, d.yMm - tip.y)),
      );
      expect(nearest).toBeLessThan(3);
    }
  });

  it('긴 직선 구간이 점 없이 비지 않는다', () => {
    // 한 변이 아주 긴 직사각형. 모서리는 넷뿐이라 나머지는 균등 배분이 채운다.
    const outline = toFlat([
      { x: 20, y: 60 },
      { x: 170, y: 60 },
      { x: 170, y: 200 },
      { x: 20, y: 200 },
    ]);
    const plan = planDots(outline, 24);
    expect(plan.dots).toHaveLength(24);

    // 이웃한 점 사이가 최소 간격의 절반보다는 넓고, 긴 변 하나에 점이
    // 적어도 여섯은 있어야 "비지 않는다"고 할 수 있다.
    const onTop = plan.dots.filter((d) => Math.abs(d.yMm - 60) < 0.5).length;
    expect(onTop).toBeGreaterThanOrEqual(6);
  });

  it('점 사이가 최소 간격보다 넓다 — 상한의 절반쯤을 넣었을 때', () => {
    const outline = circleOutline(70);
    const plan = planDots(outline, Math.floor(dotCapacity(outline) / 2));
    for (let i = 0; i < plan.dots.length; i += 1) {
      const a = plan.dots[i];
      const b = plan.dots[(i + 1) % plan.dots.length];
      expect(
        distance({ x: a.xMm, y: a.yMm }, { x: b.xMm, y: b.yMm }),
      ).toBeGreaterThan(DOT_METRICS.minGapMm);
    }
  });
});

describe('번호', () => {
  it('1번이 가장 위쪽 점이다', () => {
    const plan = planDots(circleOutline(70), 24);
    const topmost = Math.min(...plan.dots.map((d) => d.yMm));
    expect(plan.dots[0].yMm).toBeCloseTo(topmost, 6);
    expect(plan.dots[0].number).toBe(1);
  });

  it('진행이 시계 방향이다 — 1번 다음 점이 오른쪽으로 간다', () => {
    const plan = planDots(circleOutline(70), 24);
    expect(plan.dots[1].xMm).toBeGreaterThan(plan.dots[0].xMm);
  });

  it('윤곽 방향이 반대로 저장돼 있어도 시계 방향으로 매긴다', () => {
    const forward = toPoints(circleOutline(70));
    const reversed = toFlat([...forward].reverse());
    const plan = planDots(reversed, 24);
    expect(plan.dots[1].xMm).toBeGreaterThan(plan.dots[0].xMm);
  });

  it('번호끼리 겹치지 않는다', () => {
    for (const n of [10, 20, 30, 45]) {
      const plan = planDots(circleOutline(72), n, { clampTo: BOX });
      expect(plan.crowded).toBe(false);
      for (let i = 0; i < plan.dots.length; i += 1) {
        for (let j = i + 1; j < plan.dots.length; j += 1) {
          expect(
            labelsOverlap(plan.dots[i], plan.dots[j], DOT_METRICS.numberFontMm),
          ).toBe(false);
        }
      }
    }
  });

  it('번호가 점을 가리지 않는다', () => {
    const plan = planDots(circleOutline(72), 30, { clampTo: BOX });
    for (const label of plan.dots) {
      for (const dot of plan.dots) {
        const dx = Math.abs(label.labelXMm - dot.xMm);
        const dy = Math.abs(label.labelYMm - dot.yMm);
        const halfWidth =
          (String(label.number).length * 0.55 * DOT_METRICS.numberFontMm) / 2;
        const covered =
          dx < halfWidth + DOT_METRICS.dotDiameterMm / 2 &&
          dy < DOT_METRICS.numberFontMm / 2 + DOT_METRICS.dotDiameterMm / 2;
        expect(covered).toBe(false);
      }
    }
  });

  it('번호가 윤곽선 바깥쪽에 앉는다 — 안쪽은 연필이 지나갈 자리다', () => {
    const outline = circleOutline(70);
    const center = { x: 95, y: 138 };
    for (const dot of planDots(outline, 20).dots) {
      const dotRadius = Math.hypot(dot.xMm - center.x, dot.yMm - center.y);
      const labelRadius = Math.hypot(
        dot.labelXMm - center.x,
        dot.labelYMm - center.y,
      );
      expect(labelRadius).toBeGreaterThan(dotRadius);
    }
  });

  it('번호가 판 밖으로 나가지 않는다', () => {
    const plan = planDots(circleOutline(105), 40, { clampTo: BOX });
    for (const dot of plan.dots) {
      expect(dot.labelXMm).toBeGreaterThanOrEqual(BOX.x);
      expect(dot.labelXMm).toBeLessThanOrEqual(BOX.x + BOX.width);
      expect(dot.labelYMm).toBeGreaterThanOrEqual(BOX.y);
      expect(dot.labelYMm).toBeLessThanOrEqual(BOX.y + BOX.height);
    }
  });
});

describe('망가진 값', () => {
  it('점이 셋보다 적으면 빈 계획을 준다', () => {
    const plan = planDots([1, 2, 3, 4], 20);
    expect(plan.dots).toHaveLength(0);
    expect(plan.clamped).toBe(true);
  });

  it('아주 작은 윤곽에서도 최소 세 점은 나온다', () => {
    const plan = planDots(circleOutline(2), 20);
    expect(plan.dots.length).toBeGreaterThanOrEqual(3);
  });
});

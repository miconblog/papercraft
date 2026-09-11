/**
 * 말 여섯 (IDE-015) — 말과 주사위 시트(`./pieces.ts`)의 오른쪽
 *
 * 옛 인쇄본의 〈말패〉는 얼굴 그림 여섯을 오려 쓰는 것이었다. 여기서는
 * **지름 13mm 원판**이다. 두꺼운 종이에 뽑아 오리면 손가락으로 집히고, 칸
 * (지름 6.6mm) 위에 얹어도 칸 아래 이름이 보인다. 세우는 말(텐트형)은 칸
 * 간격 8mm 안에서 이웃 칸을 가려 쓰지 않았다.
 *
 * 말마다 **색과 모양**이 다르다. 색만으로 가르면 흑백 인쇄에서 누구 말인지
 * 알 수 없다(`IDE-009`가 축구 팀 색에서 확인한 것). 색은 사용자가 고른다 —
 * 레이어 `pc-token-<n>`에 `paint` 배치가 칠한다. 이름도 슬롯이다(`text`
 * 배치). 여기서는 자리를 비워 둔다.
 */
import {
  TOKEN,
  TOKEN_STYLES,
  tokenCenter,
  tokenLayerId,
  type TokenShape,
} from '../dimensions.ts';
import {
  INK_COLOR,
  circle,
  group,
  num,
  path,
  rect,
  text,
} from '../../../shared/svg.ts';

const PAPER = '#ffffff';

const polygon = (points: ReadonlyArray<readonly [number, number]>): string =>
  points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
    .join('') + 'Z';

/** 모양 하나 — 중심 (cx, cy), 한 변/지름 size. 채움은 레이어 색을 물려받는다. */
const shapePath = (
  shape: TokenShape,
  cx: number,
  cy: number,
  size: number,
): string => {
  const h = size / 2;
  switch (shape) {
    case 'circle':
      return circle(cx, cy, h);
    case 'square':
      return rect(cx - h * 0.9, cy - h * 0.9, h * 1.8, h * 1.8);
    case 'triangle':
      return path(
        polygon([
          [cx, cy - h],
          [cx + h, cy + h * 0.8],
          [cx - h, cy + h * 0.8],
        ]),
      );
    case 'diamond':
      return path(
        polygon([
          [cx, cy - h],
          [cx + h * 0.8, cy],
          [cx, cy + h],
          [cx - h * 0.8, cy],
        ]),
      );
    case 'star': {
      const points: Array<readonly [number, number]> = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? h : h * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return path(polygon(points));
    }
    case 'heart': {
      const s = h;
      return path(
        `M${num(cx)} ${num(cy + s)}` +
          `C${num(cx - s * 1.6)} ${num(cy - s * 0.1)} ${num(cx - s * 0.9)} ${num(cy - s * 1.1)} ${num(cx)} ${num(cy - s * 0.35)}` +
          `C${num(cx + s * 0.9)} ${num(cy - s * 1.1)} ${num(cx + s * 1.6)} ${num(cy - s * 0.1)} ${num(cx)} ${num(cy + s)}Z`,
      );
    }
  }
};

/** 원판 조각 — 오림 원과 몸. 시트가 표시 레이어와 그림 레이어에 나눠 담는다. */
export const renderTokenDiscs = (): { cuts: string[]; bodies: string[] } => {
  const cuts: string[] = [];
  const bodies: string[] = [];

  for (const style of TOKEN_STYLES) {
    const { xMm, yMm } = tokenCenter(style.id);
    cuts.push(circle(xMm, yMm, TOKEN.radiusMm));

    // 색을 받는 레이어 — 테와 모양. 채움을 여기서 정하지 않는다(렌더러가 칠한다).
    bodies.push(
      circle(xMm, yMm, TOKEN.radiusMm - 0.3, {
        fill: PAPER,
        stroke: INK_COLOR,
        'stroke-width': 0.3,
      }),
      group({ id: tokenLayerId(style.id), fill: style.color, stroke: 'none' }, [
        // 테 — 안쪽 원을 흰색으로 덮어 고리를 만든다.
        circle(xMm, yMm, TOKEN.radiusMm - 0.6),
        circle(xMm, yMm, TOKEN.radiusMm - 0.6 - TOKEN.ringWidthMm, {
          fill: PAPER,
        }),
        shapePath(style.shape, xMm, yMm - TOKEN.iconOffsetMm, TOKEN.iconSizeMm),
      ]),
      // 번호는 흰 면 안, 그림 왼쪽 아래 — 색 테 위에 찍으면 어두운 색에서 안 보인다.
      text(String(style.id), xMm - 3.4, yMm + 1, TOKEN.numberFontMm, {
        'text-anchor': 'middle',
        fill: INK_COLOR,
        stroke: 'none',
      }),
    );
  }

  return { cuts, bodies };
};

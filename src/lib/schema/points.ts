/**
 * 점 목록 값의 변환 (IDE-031)
 *
 * 점 슬롯의 값은 납작한 `[x0, y0, x1, y1, …]`이다. 그것을 읽고 쓰는 일은
 * 검증(`slots.ts`)뿐 아니라 **아트워크 생성기**도 한다.
 *
 * 파일이 따로 있는 것은 그 생성기 때문이다. `npm run artwork`는 도안 파일을
 * node로 곧장 읽는데, `slots.ts`는 zod와 다른 스키마 파일을 끌고 들어와
 * 확장자 없는 import에서 걸린다. **의존성이 하나도 없어야** 양쪽이 같은 함수를
 * 쓴다 — 좌표를 푸는 코드가 두 벌이 되면 한쪽만 고쳤을 때 판과 검증이 어긋난다.
 */

export interface MmPoint {
  readonly xMm: number;
  readonly yMm: number;
}

/** 납작한 좌표를 점의 목록으로. 읽는 쪽이 짝을 세지 않아도 된다. */
export const pointsOf = (value: unknown): MmPoint[] => {
  if (!Array.isArray(value)) return [];
  const flat = value as number[];
  const out: MmPoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (typeof flat[i] !== 'number' || typeof flat[i + 1] !== 'number')
      continue;
    out.push({ xMm: flat[i], yMm: flat[i + 1] });
  }
  return out;
};

/** 0.01mm보다 잘게 저장하지 않는다 — 인쇄에서 뜻이 없고 저장만 커진다. */
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** 점의 목록을 납작한 좌표로. 저장되는 값은 늘 이 모양이다. */
export const toFlatPoints = (points: readonly MmPoint[]): number[] =>
  points.flatMap((p) => [round2(p.xMm), round2(p.yMm)]);

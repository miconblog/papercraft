/**
 * 마커 스타일 변형 (IDE-003)
 *
 * 같은 슬롯을 여러 모습으로 그릴 수 있게 한다. 축구 게임판의 선수 마커가
 * 원 + 등번호 / 일러스트 + 등번호 두 벌인 것이 그렇다(IDE-010).
 *
 * 변형끼리 크기는 달라도 된다 — 기준점이 마커 **중심**이라 바꿔 끼워도 배치가
 * 어긋나지 않는다. 겹침 검사에는 세트에서 가장 큰 변형을 쓴다.
 */
import { z } from 'zod';
import { assetRef } from './parts';
import { mmLength, slug } from './units';

export const markerStyleVariant = z.strictObject({
  id: slug,
  label: z.string().min(1).max(40),
  widthMm: mmLength,
  heightMm: mmLength,
  /** 마커 위에 얹는 값(등번호)의 글자 크기. */
  valueFontSizeMm: mmLength,
  /**
   * 마커 **안이 그룹 색으로 채워지는지**.
   *
   * 채워지면 값(등번호)을 배경 밝기에 맞춰 반전해야 읽힌다. 채워지지 않는
   * 변형 — 축구 게임판의 빈 원처럼 테두리만 색을 받는 것 — 은 배경이 흰
   * 종이라 값도 그룹 색으로 찍어야 한다. 흰 배경에 흰 글자가 나오는 것을
   * 막는 것이 이 값의 존재 이유다.
   */
  filled: z.boolean().default(true),
  /** 변형의 아트워크. IDE-010에서 채운다. */
  artwork: assetRef.optional(),
});
export type MarkerStyleVariant = z.infer<typeof markerStyleVariant>;

export const markerStyleSet = z
  .strictObject({
    id: slug,
    label: z.string().min(1).max(40),
    variants: z.array(markerStyleVariant).min(1),
    /**
     * 사용자가 변형을 고르는 슬롯. `choice` 슬롯이어야 하고 선택지가 변형 id와
     * 정확히 같아야 한다(게임 단위 검증). 변형이 하나뿐이면 생략한다.
     */
    selectorSlotId: slug.optional(),
  })
  .check((ctx) => {
    const set = ctx.value;
    const seen = new Set<string>();
    for (const [i, v] of set.variants.entries()) {
      if (seen.has(v.id)) {
        ctx.issues.push({
          code: 'custom',
          input: set,
          path: ['variants', i, 'id'],
          message: `변형 id가 중복된다: ${v.id}`,
        });
      }
      seen.add(v.id);
    }
    if (set.variants.length > 1 && !set.selectorSlotId) {
      ctx.issues.push({
        code: 'custom',
        input: set,
        path: ['selectorSlotId'],
        message:
          '변형이 둘 이상이면 사용자가 고를 슬롯(selectorSlotId)이 있어야 한다',
      });
    }
  });

export type MarkerStyleSet = z.infer<typeof markerStyleSet>;

/** 겹침 검사에 쓰는 세트 최대 크기. */
export const styleSetBounds = (
  set: MarkerStyleSet,
): { widthMm: number; heightMm: number } => ({
  widthMm: Math.max(...set.variants.map((v) => v.widthMm)),
  heightMm: Math.max(...set.variants.map((v) => v.heightMm)),
});

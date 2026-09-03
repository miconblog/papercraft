/**
 * 파트 — 게임 하나를 이루는 인쇄 단위 (IDE-003)
 *
 * 게임은 종이 한 장이 아니다. 보드 파트 1개와 부속 파트 N개로 나뉘고, 사용자는
 * 이것들을 **따로, 서로 다른 배율로** 뽑는다. 분리를 모델이 표현하지 못하면
 * 내보내기(IDE-007)에 게임마다 특수 처리가 쌓인다.
 */
import { z } from 'zod';
import { markKind } from './marks';
import { mmLength, rectMm, slug } from './units';

/**
 * - `board` — 핵심 게임판. 게임마다 정확히 1개다. 오리거나 접지 않는다.
 * - `cutout` — 오려서 쓰는 부속(점수 기록칸, 게임 방법, 공 마커).
 * - `buildable` — 오리고 접어서 세우는 조립물(골대·주사위 전개도).
 */
export const partKind = z.enum(['board', 'cutout', 'buildable']);
export type PartKind = z.infer<typeof partKind>;

export const orientation = z.enum(['portrait', 'landscape']);
export type Orientation = z.infer<typeof orientation>;

/**
 * 파트 안의 이름 붙은 영역. 슬롯의 이동 범위를 여기로 제한한다.
 * 축구 게임판이라면 필드 라인 안쪽이 `playable-field`다.
 */
export const region = z.strictObject({
  id: slug,
  label: z.string().min(1).max(40),
  rect: rectMm,
});
export type Region = z.infer<typeof region>;

/** `public/games/<게임 id>/…` 아래의 정적 자산. 게임 id 일치는 게임 단위에서 검사한다. */
export const assetRef = z
  .string()
  .regex(
    /^\/games\/[a-z0-9-]+\/[a-z0-9][a-z0-9./-]*$/,
    'public/games/<게임 id>/ 아래 경로여야 한다 (예: /games/soccer/field.svg)',
  );

export const part = z
  .strictObject({
    id: slug,
    kind: partKind,
    title: z.string().min(1).max(60),
    description: z.string().max(400).optional(),

    /** 배율 100%에서의 실측 치수. 이 값이 종이 위 mm다. */
    widthMm: mmLength,
    heightMm: mmLength,

    /** 인쇄 방향. 치수와 어긋나면 검증에서 걸린다. */
    orientation,

    /** 내보내기 화면의 배율 기본값. 1 = 100%. */
    defaultScale: z.number().positive().default(1),
    /**
     * 이 파트가 읽히는 배율 범위. 하한은 실제 출력으로 재서 정한다(IDE-004).
     * 규칙 텍스트가 든 부속은 보드보다 하한이 높다.
     */
    minScale: z.number().positive().default(0.5),
    maxScale: z.number().positive().default(4),

    /** 내보내기의 '몇 벌' 기본값. 잃어버리기 쉬운 작은 부속은 1보다 크게 잡는다. */
    defaultCopies: z.number().int().positive().default(1),

    /** 이 파트가 쓰는 표시 종류. 파트 종류에 맞지 않으면 검증에서 걸린다. */
    marks: z.array(markKind).default([]),

    regions: z.array(region).default([]),

    /** 도안 SVG. 아트워크는 IDE-004에서 채운다 — 없어도 규격 검증은 통과한다. */
    artwork: assetRef.optional(),
  })
  .check((ctx) => {
    const p = ctx.value;

    const declared = p.orientation;
    const actual = p.widthMm >= p.heightMm ? 'landscape' : 'portrait';
    if (declared !== actual) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['orientation'],
        message: `인쇄 방향이 치수와 어긋난다: ${p.widthMm}×${p.heightMm}mm는 ${actual}인데 ${declared}로 선언했다`,
      });
    }

    if (p.minScale > p.maxScale) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['minScale'],
        message: `minScale(${p.minScale})이 maxScale(${p.maxScale})보다 크다`,
      });
    }
    if (p.defaultScale < p.minScale || p.defaultScale > p.maxScale) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['defaultScale'],
        message: `defaultScale(${p.defaultScale})이 ${p.minScale}–${p.maxScale} 범위 밖이다`,
      });
    }

    // 보드는 오리지도 접지도 않는다. 타일 재단선은 인쇄 규격(IDE-002)이 용지 위에
    // 그리는 것이라 도안 표시가 아니다.
    if (p.kind === 'board' && p.marks.length > 0) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['marks'],
        message: '보드 파트에는 오림선·접는선·풀칠면을 두지 않는다',
      });
    }
    if (p.kind === 'cutout' && !p.marks.includes('cut')) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['marks'],
        message: "오림용 부속은 marks에 'cut'이 있어야 한다",
      });
    }
    if (p.kind === 'buildable') {
      if (!p.marks.includes('cut')) {
        ctx.issues.push({
          code: 'custom',
          input: p,
          path: ['marks'],
          message: "조립물은 marks에 'cut'이 있어야 한다",
        });
      }
      if (!p.marks.some((m) => m.startsWith('fold-'))) {
        ctx.issues.push({
          code: 'custom',
          input: p,
          path: ['marks'],
          message:
            '조립물은 접는선(fold-mountain·fold-valley)이 하나 이상 있어야 한다',
        });
      }
    }

    const seenMarks = new Set<string>();
    for (const [i, m] of p.marks.entries()) {
      if (seenMarks.has(m)) {
        ctx.issues.push({
          code: 'custom',
          input: p,
          path: ['marks', i],
          message: `표시 종류가 중복된다: ${m}`,
        });
      }
      seenMarks.add(m);
    }

    const partRect = {
      xMm: 0,
      yMm: 0,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
    };
    const seenRegions = new Set<string>();
    for (const [i, r] of p.regions.entries()) {
      if (seenRegions.has(r.id)) {
        ctx.issues.push({
          code: 'custom',
          input: p,
          path: ['regions', i, 'id'],
          message: `영역 id가 중복된다: ${r.id}`,
        });
      }
      seenRegions.add(r.id);

      const insideX =
        r.rect.xMm >= 0 && r.rect.xMm + r.rect.widthMm <= partRect.widthMm;
      const insideY =
        r.rect.yMm >= 0 && r.rect.yMm + r.rect.heightMm <= partRect.heightMm;
      if (!insideX || !insideY) {
        ctx.issues.push({
          code: 'custom',
          input: p,
          path: ['regions', i, 'rect'],
          message: `영역 '${r.id}'이 파트(${p.widthMm}×${p.heightMm}mm) 밖으로 나간다`,
        });
      }
    }
  });

export type Part = z.infer<typeof part>;

export const findRegion = (p: Part, regionId: string): Region | undefined =>
  p.regions.find((r) => r.id === regionId);

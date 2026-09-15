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
 * - `sheet` — 보드와 같은 낱장인데 **보드가 아닌 것**. 오리지도 접지도 않는다.
 * - `cutout` — 오려서 쓰는 부속(점수 기록칸, 게임 방법, 공 마커).
 * - `buildable` — 오리고 접어서 세우는 조립물(골대·주사위 전개도).
 *
 * `sheet`는 골프(IDE-030)가 데려왔다. 골프는 **판이 열여덟 장**이다 — 홀 하나가
 * A4 한 장이고, 열여덟 장이 다 나와야 한 라운드가 된다. 보드는 정확히 1개라
 * 나머지 열일곱을 담을 종류가 없었고, `cutout`으로 두면 오릴 데가 없는 판에
 * 오림선을 그려야 했다. 그래서 "보드처럼 그냥 쓰는 낱장"을 종류로 세웠다.
 *
 * 쓰는 쪽에서 갈리는 것은 **가위가 드는가**다(`isBoardLike`) — 인쇄 화면의
 * '게임판만 · 부속만'과 PDF 파일 이름이 그 선으로 나뉜다.
 */
export const partKind = z.enum(['board', 'sheet', 'cutout', 'buildable']);
export type PartKind = z.infer<typeof partKind>;

/** 그대로 쓰는 낱장인가(보드·시트). 거짓이면 가위가 드는 부속이다. */
export const isBoardLike = (kind: PartKind): boolean =>
  kind === 'board' || kind === 'sheet';

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

/**
 * 파트 변형 — **선택 슬롯 값에 따라 파트의 크기와 아트워크가 바뀐다** (IDE-016).
 *
 * 세계일주 게임판이 처음 쓴다: 도시 수(50~100)를 고르면 판이 A4 → A3 → A2로
 * 커지고 그 수만큼의 칸이 그려진 다른 SVG가 온다. 파트 하나에 아트워크 하나라는
 * 규약은 유지된다 — 변형은 "지금 값에서 어느 아트워크가 그 하나인가"를 정할
 * 뿐이고, 렌더러·에디터·인쇄는 `resolvePart`로 고른 파트를 받아 파트가 하나인
 * 것처럼 다룬다.
 *
 * 선택지의 값은 선택 슬롯의 `options`와 **정확히 같아야** 한다(마커 스타일
 * 세트의 `selectorSlotId`와 같은 규칙). 선택 슬롯의 기본값에 해당하는 변형은
 * 파트 자체의 치수·아트워크와 같아야 한다 — 선택 슬롯을 모르는 곳(카탈로그
 * 썸네일·소개 페이지)이 보는 파트가 곧 기본값이어야 하기 때문이다.
 */
export const partVariantOption = z.strictObject({
  value: slug,
  /** 파트 제목을 갈아 끼운다. 없으면 파트 제목 그대로다. */
  title: z.string().min(1).max(60).optional(),
  widthMm: mmLength,
  heightMm: mmLength,
  artwork: assetRef,
});
export type PartVariantOption = z.infer<typeof partVariantOption>;

export const partVariants = z.strictObject({
  selectorSlotId: slug,
  options: z.array(partVariantOption).min(2),
});
export type PartVariants = z.infer<typeof partVariants>;

/**
 * 동적 파트 — **아트워크를 값에서 그때 그린다** (IDE-016 2단계).
 *
 * 세계일주 게임판이 처음 쓴다. 목록 슬롯(`listSlotId`)이 켠 도시의 수에 따라
 * 판이 A4 → A3 → A2로 커지므로(`sizeSteps`, `maxItems` 오름차순 — 마지막
 * 단계는 그 위의 어떤 수도 받는다) 크기는 여기서 데이터로 정하고, 그림은 게임 id별 렌더러(`lib/games/dynamic-artwork.ts`)가
 * 서버에서 그린다 — 미리보기는 API로 받고 내보내기는 같은 렌더러를 부른다.
 * `frameSlotId`(choice)의 값이 `map`이면 제목·안내 띠 없이 지도만 낸다 — 그때
 * 높이는 `mapHeightMm`다.
 *
 * **`listSlotId`·`sizeSteps`는 함께 있거나 함께 없다.** 없으면 크기가 파트
 * 선언 그대로 고정이고 그림만 값에서 나온다 — 점 잇기(IDE-019)가 그렇다.
 * 사진이 무엇이든 판은 190×277 한 장이고, 바뀌는 것은 그 위의 점과 번호뿐이다.
 *
 * **무엇이 그림을 바꾸는지는 따로 적지 않는다.** 이 파트에 `control` 배치를
 * 가진 슬롯이 곧 그것이다(`dynamicSourceSlots`) — 같은 사실을 두 곳에 적으면
 * 슬롯을 더할 때 한쪽만 고쳐 미리보기가 안 따라오는 일이 생긴다.
 *
 * `artwork`는 그대로 둔다 — 기본값으로 그린 정적 파일이고 썸네일이 그것을 쓴다.
 */
export const dynamicSizeStep = z.strictObject({
  maxItems: z.number().int().positive(),
  widthMm: mmLength,
  heightMm: mmLength,
  mapHeightMm: mmLength.optional(),
});
export type DynamicSizeStep = z.infer<typeof dynamicSizeStep>;

export const partDynamic = z
  .strictObject({
    listSlotId: slug.optional(),
    sizeSteps: z.array(dynamicSizeStep).min(1).optional(),
    frameSlotId: slug.optional(),
  })
  .check((ctx) => {
    const d = ctx.value;
    if ((d.listSlotId === undefined) !== (d.sizeSteps === undefined)) {
      ctx.issues.push({
        code: 'custom',
        input: d,
        path: ['sizeSteps'],
        message:
          '목록 슬롯(listSlotId)과 크기 단계(sizeSteps)는 함께 적거나 함께 비운다',
      });
    }
    if (d.frameSlotId !== undefined && d.sizeSteps === undefined) {
      ctx.issues.push({
        code: 'custom',
        input: d,
        path: ['frameSlotId'],
        message: '틀 슬롯은 크기 단계가 있을 때만 뜻이 있다',
      });
    }
  });
export type PartDynamic = z.infer<typeof partDynamic>;

/** 지도만 낼 때 frame 슬롯이 갖는 값. */
export const MAP_ONLY_FRAME = 'map';

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

    /**
     * 같은 성격의 파트를 **한 묶음으로 보이게 하는 이름** (IDE-030).
     *
     * 골프의 홀 판 열여덟 장이 처음 쓴다. 만들기 화면의 파트 줄은 파트마다
     * 단추 하나인데, 열여덟 개가 늘어서자 고를 것이 아니라 벽이 되었다
     * (2026-09-15 사용자 요청 — "홀 선택은 셀렉트 박스로"). 같은 묶음 이름을
     * 단 파트는 단추 대신 **셀렉트 하나로 접힌다**.
     *
     * 접는 것은 화면뿐이다 — 인쇄는 여전히 파트마다 한 줄이고, 열여덟 장을
     * 한 번에 뽑을 수 있다. 묶음은 UI의 편의이지 인쇄 단위가 아니다.
     *
     * 혼자인 묶음은 뜻이 없다(단추 하나를 셀렉트로 바꿀 이유가 없다). 검증이
     * 막는다.
     */
    series: z.string().min(1).max(20).optional(),

    /**
     * 만들기 화면의 미리보기를 **확대해 볼 수 있는가** (IDE-016 · 2026-09-15).
     *
     * 세계일주 게임판만 켠다. A4 한 장에 도시 50개, A2에 100개라 화면에서는
     * 칸이 손톱만 해서 지도 앱 같은 조작(휠·핀치·이동)이 필요했다.
     *
     * 다른 게임에는 **없는 편이 낫다**(사용자 요청) — 판 하나가 화면에 다 들어와
     * 확대할 일이 없는데 우하단에 단추 두 개가 늘 떠 있었다. 판을 끌어 옮기는
     * 조작이 마커를 끄는 조작과 헷갈리기도 한다.
     */
    zoomable: z.boolean().default(false),

    /** 이 파트가 쓰는 표시 종류. 파트 종류에 맞지 않으면 검증에서 걸린다. */
    marks: z.array(markKind).default([]),

    regions: z.array(region).default([]),

    /** 도안 SVG. 아트워크는 IDE-004에서 채운다 — 없어도 규격 검증은 통과한다. */
    artwork: assetRef.optional(),

    variants: partVariants.optional(),

    dynamic: partDynamic.optional(),
  })
  .check((ctx) => {
    const p = ctx.value;

    if (p.variants && p.dynamic) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['dynamic'],
        message: '변형(variants)과 동적(dynamic)은 함께 쓰지 않는다',
      });
    }
    if (p.dynamic?.sizeSteps) {
      let previousMax = 0;
      for (const [i, step] of p.dynamic.sizeSteps.entries()) {
        if (step.maxItems <= previousMax) {
          ctx.issues.push({
            code: 'custom',
            input: p,
            path: ['dynamic', 'sizeSteps', i, 'maxItems'],
            message: '크기 단계는 maxItems 오름차순이어야 한다',
          });
        }
        previousMax = step.maxItems;
        for (const [w, h, label] of [
          [step.widthMm, step.heightMm, ''],
          [step.widthMm, step.mapHeightMm ?? step.heightMm, ' (지도만)'],
        ] as const) {
          const actual = w >= h ? 'landscape' : 'portrait';
          if (actual !== p.orientation) {
            ctx.issues.push({
              code: 'custom',
              input: p,
              path: ['dynamic', 'sizeSteps', i],
              message: `크기 단계 ${i}${label}(${w}×${h}mm)이 파트의 인쇄 방향(${p.orientation})과 어긋난다`,
            });
          }
        }
      }
    }

    // 변형도 파트와 같은 방향이어야 한다 — 가로 판이 세로 판으로 바뀌면 인쇄
    // 미리보기·타일 계산이 파트 선언과 어긋난다.
    if (p.variants) {
      const seen = new Set<string>();
      for (const [i, option] of p.variants.options.entries()) {
        if (seen.has(option.value)) {
          ctx.issues.push({
            code: 'custom',
            input: p,
            path: ['variants', 'options', i, 'value'],
            message: `변형 값이 중복된다: ${option.value}`,
          });
        }
        seen.add(option.value);
        const actual =
          option.widthMm >= option.heightMm ? 'landscape' : 'portrait';
        if (actual !== p.orientation) {
          ctx.issues.push({
            code: 'custom',
            input: p,
            path: ['variants', 'options', i],
            message: `변형 '${option.value}'(${option.widthMm}×${option.heightMm}mm)이 파트의 인쇄 방향(${p.orientation})과 어긋난다`,
          });
        }
      }
    }

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
    if (isBoardLike(p.kind) && p.marks.length > 0) {
      ctx.issues.push({
        code: 'custom',
        input: p,
        path: ['marks'],
        message: `${p.kind === 'board' ? '보드' : '낱장'} 파트에는 오림선·접는선·풀칠면을 두지 않는다`,
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

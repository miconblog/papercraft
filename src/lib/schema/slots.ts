/**
 * 커스터마이즈 슬롯 — 도안 안에 선언된 "사용자가 고칠 수 있는 자리" (IDE-003)
 *
 * 슬롯은 두 축을 갖는다.
 *
 * - **kind** — 값의 종류와 제약(텍스트·숫자·색상·선택지). 에디터(IDE-006)가
 *   이걸 보고 입력 컴포넌트를 고른다.
 * - **placements** — 그 값이 어느 파트에 어떤 방식으로 나타나는가. 슬롯 하나가
 *   여러 파트에 놓일 수 있다 — 팀명은 보드에도 점수 기록칸에도 나온다.
 *
 * `mode: 'marker'` placement를 가진 슬롯이 **위치를 가진 슬롯**이다. 값뿐 아니라
 * 좌표까지 사용자 편집 대상이고, 이동 범위는 `regionId`가 가리키는 영역이다.
 */
import { z } from 'zod';
import { mmCoord, mmLength, hexColor, slug } from './units';

export const textAlign = z.enum(['start', 'center', 'end']);

const placementBase = { partId: slug };

/** 값을 글자로 그린다. 기준점은 `align`이 정하는 가로 위치, 세로는 글자 중심이다. */
export const textPlacement = z.strictObject({
  ...placementBase,
  mode: z.literal('text'),
  xMm: mmCoord,
  yMm: mmCoord,
  align: textAlign.default('center'),
  fontSizeMm: mmLength,
  /** 넘치면 렌더러가 줄여 맞춘다. 없으면 제한하지 않는다. */
  maxWidthMm: mmLength.optional(),
  rotationDeg: z.number().min(-180).max(180).default(0),
});

/**
 * 값을 마커로 그린다. 기준점은 **마커의 중심**이다 — 스타일 변형끼리 크기가
 * 달라도 중심이 같으므로 바꿔 끼워도 배치가 어긋나지 않는다(IDE-010).
 */
export const markerPlacement = z.strictObject({
  ...placementBase,
  mode: z.literal('marker'),
  xMm: mmCoord,
  yMm: mmCoord,
  /** 어떤 마커 스타일 세트로 그릴지. 세트 안의 변형은 사용자가 고른다. */
  styleSetId: slug,
  /** 사용자가 마커를 옮길 수 있는 범위. 파트의 영역 id다. */
  regionId: slug,
});

/** 값을 도안 레이어의 색으로 칠한다. 팀 색이 여기 해당한다. */
export const paintPlacement = z.strictObject({
  ...placementBase,
  mode: z.literal('paint'),
  /** 색을 입힐 SVG 레이어(그룹) id. */
  layerId: slug,
  property: z.enum(['fill', 'stroke']).default('fill'),
});

/** 도안에 직접 그려지지는 않지만 그 파트의 렌더링을 바꾸는 값(예: 마커 스타일 선택). */
export const controlPlacement = z.strictObject({
  ...placementBase,
  mode: z.literal('control'),
});

export const placement = z.discriminatedUnion('mode', [
  textPlacement,
  markerPlacement,
  paintPlacement,
  controlPlacement,
]);
export type Placement = z.infer<typeof placement>;
export type MarkerPlacement = z.infer<typeof markerPlacement>;

const slotBase = {
  id: slug,
  label: z.string().min(1).max(60),
  /** 에디터에 띄우는 도움말. */
  help: z.string().max(200).optional(),
  /** 그룹(축구라면 팀) 소속. 프리셋과 에디터의 묶음 단위다. */
  groupId: slug.optional(),
  /** 렌더러가 읽는 자유 표식. 예: 골키퍼를 구분하는 `goalkeeper`. */
  tags: z.array(slug).default([]),
  /** 최소 1개 — 어느 파트에도 속하지 않는 슬롯은 도안에 나타날 자리가 없다. */
  placements: z.array(placement).min(1),
};

export const textSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('text'),
  maxLength: z.number().int().positive().max(200),
  default: z.string(),
  placeholder: z.string().max(60).optional(),
});

export const numberSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('number'),
  min: z.number(),
  max: z.number(),
  integer: z.boolean().default(true),
  default: z.number(),
});

export const colorSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('color'),
  default: hexColor,
  /** 고를 수 있는 색을 제한한다. 없으면 자유 입력이다. */
  palette: z.array(hexColor).min(2).optional(),
});

export const choiceOption = z.strictObject({
  value: slug,
  label: z.string().min(1).max(60),
});

export const choiceSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('choice'),
  options: z.array(choiceOption).min(2),
  default: slug,
});

export const slot = z
  .discriminatedUnion('kind', [textSlot, numberSlot, colorSlot, choiceSlot])
  .check((ctx) => {
    const s = ctx.value;

    // 기본값이 자기 제약을 어기면 에디터가 첫 화면부터 오류 상태로 시작한다.
    if (s.kind === 'text' && s.default.length > s.maxLength) {
      ctx.issues.push({
        code: 'custom',
        input: s,
        path: ['default'],
        message: `기본값이 maxLength(${s.maxLength})를 넘는다`,
      });
    }
    if (s.kind === 'number') {
      if (s.min > s.max) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['min'],
          message: `min(${s.min})이 max(${s.max})보다 크다`,
        });
      }
      if (s.default < s.min || s.default > s.max) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['default'],
          message: `기본값 ${s.default}이 ${s.min}–${s.max} 범위 밖이다`,
        });
      }
      if (s.integer && !Number.isInteger(s.default)) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['default'],
          message: '정수 슬롯인데 기본값이 정수가 아니다',
        });
      }
    }
    if (s.kind === 'color' && s.palette && !s.palette.includes(s.default)) {
      ctx.issues.push({
        code: 'custom',
        input: s,
        path: ['default'],
        message: `기본값 ${s.default}이 palette에 없다`,
      });
    }
    if (s.kind === 'choice') {
      const values = s.options.map((o) => o.value);
      if (!values.includes(s.default)) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['default'],
          message: `기본값 '${s.default}'이 options에 없다`,
        });
      }
      const seen = new Set<string>();
      for (const [i, o] of s.options.entries()) {
        if (seen.has(o.value)) {
          ctx.issues.push({
            code: 'custom',
            input: s,
            path: ['options', i, 'value'],
            message: `선택지 값이 중복된다: ${o.value}`,
          });
        }
        seen.add(o.value);
      }
    }

    // kind와 placement 방식의 조합. 색을 글자로 그리거나 선택지를 마커로 놓는 건
    // 렌더러가 처리할 수 없다.
    const allowed: Record<typeof s.kind, ReadonlyArray<Placement['mode']>> = {
      text: ['text', 'marker'],
      number: ['text', 'marker'],
      color: ['paint'],
      choice: ['control', 'text'],
    };
    for (const [i, pl] of s.placements.entries()) {
      if (!allowed[s.kind].includes(pl.mode)) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['placements', i, 'mode'],
          message: `${s.kind} 슬롯에는 '${pl.mode}' 배치를 쓸 수 없다 (가능: ${allowed[s.kind].join(', ')})`,
        });
      }
    }

    // 옮길 수 있는 자리는 하나뿐이다. 두 파트에서 동시에 옮긴다는 건 뜻이 없다.
    const markers = s.placements.filter((p) => p.mode === 'marker');
    if (markers.length > 1) {
      ctx.issues.push({
        code: 'custom',
        input: s,
        path: ['placements'],
        message: `마커 배치는 슬롯당 하나여야 한다 (현재 ${markers.length}개)`,
      });
    }
  });

export type Slot = z.infer<typeof slot>;
export type SlotKind = Slot['kind'];
export type SlotValue = string | number;

/** 이 슬롯이 나타나는 파트 id 집합. 선언 순서를 유지한다. */
export const slotPartIds = (s: Slot): string[] => [
  ...new Set(s.placements.map((p) => p.partId)),
];

/** 위치를 가진 슬롯이면 그 마커 배치를, 아니면 undefined를 준다. */
export const slotMarker = (s: Slot): MarkerPlacement | undefined =>
  s.placements.find((p): p is MarkerPlacement => p.mode === 'marker');

/** 사용자가 좌표를 옮길 수 있는 슬롯인가. */
export const isMovable = (s: Slot): boolean => slotMarker(s) !== undefined;

/**
 * 값 하나가 슬롯 제약을 지키는지. 에디터의 입력 검증(IDE-006)이 그대로 쓴다.
 * 통과하면 null, 아니면 사용자에게 보일 한국어 사유를 준다.
 */
export function validateSlotValue(s: Slot, value: unknown): string | null {
  switch (s.kind) {
    case 'text': {
      if (typeof value !== 'string') return '텍스트를 입력한다';
      if (value.length > s.maxLength) return `${s.maxLength}자 이내로 입력한다`;
      return null;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value))
        return '숫자를 입력한다';
      if (s.integer && !Number.isInteger(value)) return '정수를 입력한다';
      if (value < s.min || value > s.max)
        return `${s.min}–${s.max} 사이여야 한다`;
      return null;
    }
    case 'color': {
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value))
        return '#RRGGBB 형식의 색이어야 한다';
      if (s.palette && !s.palette.includes(value))
        return '고를 수 있는 색이 아니다';
      return null;
    }
    case 'choice': {
      if (
        typeof value !== 'string' ||
        !s.options.some((o) => o.value === value)
      )
        return '고를 수 있는 값이 아니다';
      return null;
    }
  }
}

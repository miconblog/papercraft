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
  /**
   * 이 값이 어느 파트에 어떻게 나타나는가.
   *
   * 보통은 하나 이상이다 — 나타날 자리가 없는 슬롯은 도안에 쓸모가 없다. 다만
   * **그룹의 색 슬롯만은 비워 둘 수 있다**(2026-09-08): 그 값은 배치가 아니라
   * 그룹을 통해 마커를 칠하기 때문이다(`groupColorOf`). 축구 게임판의 팀 색이
   * 점수 기록칸의 색 막대를 잃고 그렇게 됐다 — 여전히 운동장 선수 마커를
   * 칠한다. "배치도 없고 그룹의 색 슬롯도 아닌" 슬롯은 `parseGame`이 막는다.
   */
  placements: z.array(placement),
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

export const listOption = z.strictObject({
  value: slug,
  label: z.string().min(1).max(60),
  /** 목록을 묶어 보여 줄 이름(세계일주의 경로 구간). 없으면 한 묶음이다. */
  group: z.string().max(40).optional(),
});
export type ListOption = z.infer<typeof listOption>;

export const listPreset = z.strictObject({
  id: slug,
  label: z.string().min(1).max(40),
  values: z.array(slug).min(1),
});

/**
 * 사용자가 **직접 더한 항목**. `options`에 없는 것이라 이름과 자료를 값에 싣고
 * 다닌다 — 세계일주라면 검색해서 더한 도시의 이름·경위도다. `data`의 뜻은
 * 게임 렌더러가 안다.
 */
export const listItem = z.strictObject({
  id: slug,
  label: z.string().min(1).max(40),
  data: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});
export type ListItem = z.infer<typeof listItem>;

/** 목록 슬롯의 검색 — 서버의 제공자(`lib/games/list-search.ts`)가 `providerId`로 잇는다. */
export const listSearch = z.strictObject({
  providerId: slug,
  placeholder: z.string().max(60).optional(),
});

/**
 * 목록 슬롯 — **차례가 있는 항목 집합**이다 (IDE-016 2단계).
 *
 * 세계일주 게임판이 처음 쓴다: 도시 113개 가운데 켠 것들이 그 차례대로 경로가
 * 된다. `choice`로는 안 된다 — 선택지를 2^113개 만들 수 없고, 값이 집합이
 * 아니라 차례까지 갖는다. 배치는 `control`뿐이다 — 값을 글자나 마커로 그릴 수
 * 없고, 이 값에서 판을 그때 그리는 것은 파트의 `dynamic`이 한다.
 *
 * `fixed`는 뺄 수 없는 항목(출발지 서울)이고, `presets`는 한 번에 고르는
 * 묶음(도시 50·60·…개)이다.
 */
export const listSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('list'),
  options: z.array(listOption).min(2),
  presets: z.array(listPreset).default([]),
  fixed: z.array(slug).default([]),
  min: z.number().int().positive().default(1),
  /** 참이면 `options` 밖의 항목(`ListItem`)도 값에 올 수 있다. */
  custom: z.boolean().default(false),
  /** 있으면 에디터가 검색 상자를 낸다. `custom`이 참이어야 뜻이 있다. */
  search: listSearch.optional(),
  default: z.array(slug),
});

export const slot = z
  .discriminatedUnion('kind', [
    textSlot,
    numberSlot,
    colorSlot,
    choiceSlot,
    listSlot,
  ])
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

    if (s.kind === 'list') {
      const values = new Set(s.options.map((o) => o.value));
      if (values.size !== s.options.length) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['options'],
          message: '목록 항목 값이 중복된다',
        });
      }
      const checkList = (
        path: (string | number)[],
        list: readonly string[],
        name: string,
      ) => {
        const seen = new Set<string>();
        for (const id of list) {
          if (!values.has(id)) {
            ctx.issues.push({
              code: 'custom',
              input: s,
              path,
              message: `${name}에 options에 없는 항목이 있다: ${id}`,
            });
          }
          if (seen.has(id)) {
            ctx.issues.push({
              code: 'custom',
              input: s,
              path,
              message: `${name}에 항목이 중복된다: ${id}`,
            });
          }
          seen.add(id);
        }
        for (const id of s.fixed) {
          if (!seen.has(id)) {
            ctx.issues.push({
              code: 'custom',
              input: s,
              path,
              message: `${name}에 고정 항목이 빠졌다: ${id}`,
            });
          }
        }
        if (list.length < s.min) {
          ctx.issues.push({
            code: 'custom',
            input: s,
            path,
            message: `${name}은 ${s.min}개 이상이어야 한다 (현재 ${list.length}개)`,
          });
        }
      };
      checkList(['default'], s.default, '기본값');
      for (const [i, preset] of s.presets.entries()) {
        checkList(
          ['presets', i, 'values'],
          preset.values,
          `프리셋 '${preset.id}'`,
        );
      }
      for (const id of s.fixed) {
        if (!values.has(id)) {
          ctx.issues.push({
            code: 'custom',
            input: s,
            path: ['fixed'],
            message: `고정 항목이 options에 없다: ${id}`,
          });
        }
      }
      if (s.search && !s.custom) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['search'],
          message: '검색은 직접 추가(custom)를 허용하는 목록에만 둔다',
        });
      }
    }

    // kind와 placement 방식의 조합. 색을 글자로 그리거나 선택지를 마커로 놓는 건
    // 렌더러가 처리할 수 없다.
    const allowed: Record<typeof s.kind, ReadonlyArray<Placement['mode']>> = {
      text: ['text', 'marker'],
      number: ['text', 'marker'],
      color: ['paint'],
      choice: ['control', 'text'],
      list: ['control'],
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
/**
 * 목록 슬롯의 값 — 항목 id(옵션) 또는 직접 더한 항목의 차례 있는 배열.
 */
export type ListEntry = string | ListItem;
export type ListValue = ListEntry[];
export type SlotValue = string | number | ListValue;

export const listEntryId = (entry: ListEntry): string =>
  typeof entry === 'string' ? entry : entry.id;

/** 항목의 표시 이름. 옵션이면 슬롯의 라벨, 직접 더한 것이면 실려 온 라벨. */
export const listEntryLabel = (
  s: Extract<Slot, { kind: 'list' }>,
  entry: ListEntry,
): string =>
  typeof entry === 'string'
    ? (s.options.find((o) => o.value === entry)?.label ?? entry)
    : entry.label;

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
    case 'list': {
      if (!Array.isArray(value)) return '항목의 목록이어야 한다';
      const known = new Set(s.options.map((o) => o.value));
      const ids: string[] = [];
      for (const entry of value as unknown[]) {
        if (typeof entry === 'string') {
          if (!known.has(entry)) return '목록에 없는 항목이 있다';
          ids.push(entry);
          continue;
        }
        if (!s.custom) return '이 목록에는 직접 더한 항목을 둘 수 없다';
        const parsed = listItem.safeParse(entry);
        if (!parsed.success) return '직접 더한 항목의 모양이 틀렸다';
        if (known.has(parsed.data.id))
          return '직접 더한 항목의 id가 옵션과 겹친다';
        ids.push(parsed.data.id);
      }
      if (new Set(ids).size !== ids.length) return '항목이 중복된다';
      const missing = s.fixed.filter((id) => !ids.includes(id));
      if (missing.length > 0)
        return `뺄 수 없는 항목이 빠졌다: ${missing
          .map((id) => s.options.find((o) => o.value === id)?.label ?? id)
          .join(', ')}`;
      if (ids.length < s.min) return `${s.min}개 이상 골라야 한다`;
      return null;
    }
  }
}

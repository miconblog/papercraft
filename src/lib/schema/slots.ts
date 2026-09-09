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
import { mmCoord, mmLength, hexColor, rectMm, slug } from './units';

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

/**
 * 숫자 슬롯의 **자주 쓰는 값 단추**. 입력 칸을 대신하지 않고 옆에 붙는다.
 *
 * 점 잇기의 점 개수가 처음 쓴다(IDE-020) — 10·20·30·50·100이고, 어느 나이대가
 * 어느 값인지가 `help`에 붙는다. 범위가 5~100이라 입력 칸만 두면 사용자가
 * "몇 개가 우리 아이에게 맞나"를 스스로 정해야 한다.
 */
export const numberPreset = z.strictObject({
  value: z.number(),
  label: z.string().min(1).max(24),
  /** 어느 때 고르는 값인지. 단추의 도움말과 스크린리더 이름에 붙는다. */
  help: z.string().max(60).optional(),
});
export type NumberPreset = z.infer<typeof numberPreset>;

export const numberSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('number'),
  min: z.number(),
  max: z.number(),
  integer: z.boolean().default(true),
  default: z.number(),
  presets: z.array(numberPreset).default([]),
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

/**
 * 윤곽이 앉는 자리 — **어느 파트의 어느 사각형에 비율 그대로 맞춰 넣는가**.
 *
 * 값이 파트 로컬 mm이므로 그것을 계산하는 쪽(사진을 다루는 에디터)이 이 상자를
 * 알아야 한다(IDE-020). 파트 전체를 쓸 수 없는 것은 제목·놀이 방법·번호가 갈
 * 자리를 비워 둬야 하기 때문이다.
 *
 * 슬롯이 여러 파트에 놓여도 상자는 하나다 — 값은 **한 파트의 좌표계**로만
 * 저장되고, 다른 파트는 제 상자에 다시 맞춰 그린다(점 잇기의 완성 그림 부속).
 */
export const outlineBox = z.strictObject({
  partId: slug,
  ...rectMm.shape,
});
export type OutlineBox = z.infer<typeof outlineBox>;

/**
 * 윤곽 슬롯 — **사용자 입력에서 생성된 기하 데이터**다 (IDE-019).
 *
 * 점 잇기가 처음 쓴다. 앞선 슬롯들과 다른 점은 **도안이 후보를 미리 선언해
 * 둘 수 없다**는 것이다 — 값이 사용자가 넣은 사진에서 나온다. `list`도 값을
 * 미리 다 적지는 않지만(직접 더한 도시) 그쪽은 여전히 "고르는 것"이고 이쪽은
 * "계산되는 것"이다.
 *
 * 값은 `[x0, y0, x1, y1, …]`이 납작하게 늘어선 **닫힌 폴리라인**이고 단위는
 * **파트 로컬 mm**다. 마지막 점 다음은 첫 점이라 첫 점을 되풀이해 적지 않는다.
 * 점마다 객체를 두지 않는 것은 크기 때문이다 — 점 400개가 객체면 12KB,
 * 납작한 수 배열이면 4KB고 `localStorage`에 사진과 함께 들어가야 한다(IDE-020).
 *
 * 배치는 `control`뿐이다. 값을 글자나 마커로 그릴 수 없고, 이 값에서 판을 그때
 * 그리는 것은 파트의 `dynamic`이 한다 — 목록 슬롯과 같은 규약이다.
 */
export const outlineSlot = z.strictObject({
  ...slotBase,
  kind: z.literal('outline'),
  /** 값이 어느 파트의 어느 사각형에 맞춰 들어가는가. */
  box: outlineBox,
  /**
   * 고리를 몇 개까지 담나 (IDE-021).
   *
   * **1이면 값이 `number[]`, 2 이상이면 `number[][]`다.** 한 슬롯이 두 모양을
   * 갖는 것이 반갑지는 않지만, 고리 하나짜리가 늘 `[[…]]`로 한 겹 싸이면
   * 점 잇기 판이 쓰는 모든 자리가 그 겹을 벗기는 코드를 갖게 된다. 읽는 쪽은
   * `outlineRings(slot, value)`를 거치면 개수를 몰라도 된다.
   *
   * 점 잇기는 슬롯을 둘 쓴다 — 아이가 잇는 `outline`(1)과 미리 그려 두는
   * `detail`(여럿)이다.
   */
  maxRings: z.number().int().positive().default(1),
  /**
   * 같은 사진에서 딴 **세부 선**을 담을 다른 윤곽 슬롯의 id (IDE-021).
   *
   * 눈·입·머리카락 경계처럼 아이가 잇지 않고 판에 미리 그려 두는 선이다.
   * 점 잇기는 한 붓 그리기라 선이 여럿이면 연필을 떼야 하는데, 그 표시를
   * 도안에 넣는 일은 이 놀이를 처음 하는 나이대에 이르다.
   *
   * 가리키는 슬롯은 `maxRings`가 2 이상인 윤곽 슬롯이어야 하고, 같은 상자·같은
   * 파트를 써야 한다 — 사진 하나에서 같은 변환으로 나온 것이라야 서로 맞는다.
   */
  detailSlotId: slug.optional(),
  /** 이보다 꼭짓점이 적으면 이을 형태가 아니다. 고리 **하나**의 기준이다. */
  minPoints: z.number().int().min(3).default(3),
  /** 이보다 많으면 저장이 커지고 단순화가 덜 된 것이다. 고리 하나의 기준이다. */
  maxPoints: z.number().int().positive().default(2000),
  /**
   * 이 윤곽선 **위에 몇 개를 놓을지** 정하는 숫자 슬롯의 id.
   *
   * 두 값이 붙어 다녀야 하는 것은 **넣을 수 있는 개수가 윤곽선의 길이에서
   * 나오기** 때문이다(IDE-019의 `dotCapacity`). 짧은 윤곽에 100개를 넣으면
   * 번호가 서로 겹쳐 읽을 수 없으므로, 개수를 고치는 자리와 윤곽을 만드는
   * 자리가 같아야 사용자가 "왜 68개에서 멈추는지"를 그 자리에서 안다.
   *
   * `part.dynamic.listSlotId`와 같은 규약이다 — 슬롯이 슬롯을 가리킬 때는
   * `<쓰임>SlotId`로 적는다. 적으면 그 숫자 슬롯은 폼의 한 줄 입력에서 빠지고
   * 윤곽 패널이 대신 그린다.
   */
  countSlotId: slug.optional(),
  default: z.union([z.array(z.number()), z.array(z.array(z.number()))]),
});

export const slot = z
  .discriminatedUnion('kind', [
    textSlot,
    numberSlot,
    colorSlot,
    choiceSlot,
    listSlot,
    outlineSlot,
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
      // 값 단추는 입력 칸이 받는 값만 낼 수 있다 — 눌렀는데 곧장 오류가 되는
      // 단추는 사용자가 무엇이 잘못됐는지 알 길이 없다.
      const seenPresets = new Set<number>();
      for (const [i, preset] of s.presets.entries()) {
        const reason = validateNumberValue(s, preset.value);
        if (reason) {
          ctx.issues.push({
            code: 'custom',
            input: s,
            path: ['presets', i, 'value'],
            message: `값 단추 '${preset.label}'이 제 슬롯의 제약을 어긴다: ${reason}`,
          });
        }
        if (seenPresets.has(preset.value)) {
          ctx.issues.push({
            code: 'custom',
            input: s,
            path: ['presets', i, 'value'],
            message: `값 단추가 중복된다: ${preset.value}`,
          });
        }
        seenPresets.add(preset.value);
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

    if (s.kind === 'outline') {
      if (s.minPoints > s.maxPoints) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['minPoints'],
          message: `minPoints(${s.minPoints})가 maxPoints(${s.maxPoints})보다 크다`,
        });
      }
      const reason = validateOutlineValue(s, s.default);
      if (reason) {
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['default'],
          message: `기본값이 제 제약을 어긴다: ${reason}`,
        });
      } else if (!outlineFitsBox(s.box, outlineRings(s, s.default))) {
        // 기본값은 상자에 맞춰 넣은 결과여야 한다(`fitOutline`). 벗어나 있으면
        // 사진을 넣기 전 첫 화면에서만 그림이 판 밖으로 나가, 사진을 한 장
        // 넣는 순간 조용히 제자리로 돌아온다 — 원인을 찾기 어려운 종류다.
        ctx.issues.push({
          code: 'custom',
          input: s,
          path: ['default'],
          message: '기본값이 box 밖으로 나간다 — fitOutline으로 맞춰 넣는다',
        });
      }
    }

    // kind와 placement 방식의 조합. 색을 글자로 그리거나 선택지를 마커로 놓는 건
    // 렌더러가 처리할 수 없다.
    //
    // `number`에 `control`이 있는 것은 점 잇기의 점 개수 때문이다(IDE-019) —
    // 값이 글자로 찍히는 게 아니라 **판 전체를 다시 그리게 한다**.
    const allowed: Record<typeof s.kind, ReadonlyArray<Placement['mode']>> = {
      text: ['text', 'marker'],
      number: ['text', 'marker', 'control'],
      color: ['paint'],
      choice: ['control', 'text'],
      list: ['control'],
      outline: ['control'],
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
/**
 * 윤곽 슬롯의 값 — `[x0, y0, x1, y1, …]` 납작한 mm 좌표(IDE-019).
 *
 * 고리를 여럿 담는 슬롯(`maxRings > 1`)에서는 그 배열의 배열이다(IDE-021).
 */
export type OutlineRing = number[];
export type OutlineValue = OutlineRing | OutlineRing[];
export type SlotValue = string | number | ListValue | OutlineValue;

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

/**
 * 윤곽 값을 **늘 고리의 목록으로** 읽는다. 슬롯이 고리 하나짜리든 여럿이든
 * 읽는 쪽은 같은 코드를 쓴다.
 *
 * 값이 모양을 어겼으면 빈 목록이다 — 여기서 걸러 두면 렌더러가 `NaN`을 SVG의
 * `d`에 흘려 판이 통째로 비는 일이 없다.
 */
export function outlineRings(
  s: Extract<Slot, { kind: 'outline' }>,
  value: unknown,
): OutlineRing[] {
  if (!Array.isArray(value)) return [];
  if (s.maxRings <= 1) {
    return value.every((v) => typeof v === 'number')
      ? [value as OutlineRing]
      : [];
  }
  return value.every(
    (ring) => Array.isArray(ring) && ring.every((v) => typeof v === 'number'),
  )
    ? (value as OutlineRing[])
    : [];
}

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
    case 'number':
      return validateNumberValue(s, value);
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
    case 'outline':
      return validateOutlineValue(s, value);
  }
}

/** 숫자 하나가 숫자 슬롯의 제약을 지키는지. 기본값·값 단추·사용자 입력이 함께 쓴다. */
function validateNumberValue(
  s: Extract<Slot, { kind: 'number' }>,
  value: unknown,
): string | null {
  if (typeof value !== 'number' || Number.isNaN(value))
    return '숫자를 입력한다';
  if (s.integer && !Number.isInteger(value)) return '정수를 입력한다';
  if (value < s.min || value > s.max) return `${s.min}–${s.max} 사이여야 한다`;
  return null;
}

/**
 * 윤곽이 제 상자 안에 들어 있는지. 맞춰 넣은 결과라 딱 맞게 닿으므로 부동소수
 * 오차만큼(0.01mm) 봐준다.
 */
function outlineFitsBox(box: OutlineBox, rings: OutlineRing[]): boolean {
  return rings.every((ring) => ringFitsBox(box, ring));
}

function ringFitsBox(box: OutlineBox, flat: readonly number[]): boolean {
  const slack = 0.01;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (flat[i] < box.xMm - slack || flat[i] > box.xMm + box.widthMm + slack)
      return false;
    if (
      flat[i + 1] < box.yMm - slack ||
      flat[i + 1] > box.yMm + box.heightMm + slack
    )
      return false;
  }
  return true;
}

/**
 * 윤곽 값 검사 (IDE-019).
 *
 * 값이 생성된 것이라 사용자가 오타를 낼 일은 없다. 그래도 여기서 막는 이유는
 * **옛 저장값과 손으로 만든 요청**이다 — 홀수 길이 배열이나 `NaN`이 그대로
 * 렌더러에 들어가면 SVG의 `d` 속성이 통째로 깨져 빈 판이 나온다.
 */
function validateOutlineValue(
  s: Extract<Slot, { kind: 'outline' }>,
  value: unknown,
): string | null {
  if (!Array.isArray(value)) return '좌표의 배열이어야 한다';
  if (s.maxRings <= 1) return validateRing(s, value);
  // 고리가 여럿인 슬롯(IDE-021). 하나도 없는 것은 어긋난 값이 아니다 —
  // 세부를 끈 도안이 그렇다.
  if (value.length > s.maxRings)
    return `선이 ${s.maxRings}개를 넘는다 (현재 ${value.length}개)`;
  for (const ring of value) {
    if (!Array.isArray(ring)) return '선 하나하나가 좌표의 배열이어야 한다';
    const reason = validateRing(s, ring);
    if (reason) return reason;
  }
  return null;
}

/** 고리 하나. 짝·유한·개수를 본다. */
function validateRing(
  s: Extract<Slot, { kind: 'outline' }>,
  ring: unknown[],
): string | null {
  if (ring.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
    return '좌표가 모두 유한한 수여야 한다';
  if (ring.length % 2 !== 0) return 'x·y가 짝을 이뤄야 한다';
  const points = ring.length / 2;
  if (points < s.minPoints) return `점이 ${s.minPoints}개 이상이어야 한다`;
  if (points > s.maxPoints) return `점이 ${s.maxPoints}개를 넘는다`;
  return null;
}

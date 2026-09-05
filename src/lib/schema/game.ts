/**
 * 게임 정의 — 도안 데이터 모델의 최상위 (IDE-003)
 *
 * 게임 하나 = 메타데이터 + 파트 여러 개 + 슬롯 여러 개 + (선택) 그룹·마커 스타일·
 * 배치 프리셋. 잘못된 도안은 `parseGame`에서 즉시 예외로 터진다.
 */
import { z } from 'zod';
import { assetRef, part, type Part } from './parts';
import { isMovable, slot, slotMarker, type Slot } from './slots';
import { layoutPreset } from './presets';
import { markerStyleSet, styleSetBounds } from './styles';
import {
  containsPoint,
  rectAround,
  rectContainsRect,
  rectsOverlap,
  slug,
} from './units';

/** 규격 버전. 규격이 바뀌면 올리고, 옛 도안은 검증에서 걸러진다. */
export const SCHEMA_VERSION = 1;

/** 슬롯을 묶는 단위. 축구 게임판이라면 팀 하나가 그룹 하나다. */
export const group = z.strictObject({
  id: slug,
  label: z.string().min(1).max(40),
  /** 이 그룹의 이름을 담는 `text` 슬롯. */
  nameSlotId: slug.optional(),
  /** 이 그룹의 색을 담는 `color` 슬롯. */
  colorSlotId: slug.optional(),
  /**
   * 이 그룹의 마커 아트워크를 세로 중심선 기준으로 뒤집어 그릴지.
   *
   * 마커에 방향이 있는 도안을 위한 것이다 — 축구 게임판의 마커에는 공격 방향을
   * 가리키는 화살촉이 붙어 있어(`docs/soccer-artwork.md` 11절), 반대편으로
   * 공격하는 팀은 반전해서 그려야 한다. 아트워크 파일을 두 벌 만드는 대신
   * 렌더러가 뒤집는다.
   *
   * 색에 기대지 않는 팀 구분이기도 하다. 두 팀이 필드 전체에 섞여 서므로
   * 위치로는 팀을 알 수 없고, 흑백으로 뽑으면 팀 색도 구분되지 않을 수 있다.
   */
  mirrorMarkers: z.boolean().default(false),
});
export type Group = z.infer<typeof group>;

export const gameDefinition = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: slug,
    title: z.string().min(1).max(60),
    /** 목록에 한 줄로 붙는 소개. */
    tagline: z.string().min(1).max(120),
    description: z.string().min(1).max(2000),
    players: z
      .strictObject({
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      })
      .check((ctx) => {
        if (ctx.value.min > ctx.value.max) {
          ctx.issues.push({
            code: 'custom',
            input: ctx.value,
            path: ['min'],
            message: '최소 인원이 최대 인원보다 많다',
          });
        }
      }),
    /** 인쇄물 외에 필요한 것. 예: 연필, 가위, 풀. */
    supplies: z.array(z.string().min(1).max(60)).min(1),
    thumbnail: assetRef,

    parts: z.array(part).min(1),
    slots: z.array(slot).min(1),
    groups: z.array(group).default([]),
    styleSets: z.array(markerStyleSet).default([]),
    presets: z.array(layoutPreset).default([]),
  })
  .check((ctx) => {
    const g = ctx.value;
    const push = (path: (string | number)[], message: string) =>
      ctx.issues.push({ code: 'custom', input: g, path, message });

    const dupes = (items: { id: string }[], field: string) => {
      const seen = new Set<string>();
      for (const [i, item] of items.entries()) {
        if (seen.has(item.id))
          push([field, i, 'id'], `id가 중복된다: ${item.id}`);
        seen.add(item.id);
      }
    };
    dupes(g.parts, 'parts');
    dupes(g.slots, 'slots');
    dupes(g.groups, 'groups');
    dupes(g.styleSets, 'styleSets');
    dupes(g.presets, 'presets');

    const partById = new Map(g.parts.map((p) => [p.id, p]));
    const slotById = new Map(g.slots.map((s) => [s.id, s]));
    const groupIds = new Set(g.groups.map((x) => x.id));
    const styleSetById = new Map(g.styleSets.map((x) => [x.id, x]));

    // 게임 = 보드 파트 1개 + 부속 파트 N개.
    const boards = g.parts.filter((p) => p.kind === 'board');
    if (boards.length !== 1) {
      push(
        ['parts'],
        `보드 파트는 정확히 1개여야 한다 (현재 ${boards.length}개)`,
      );
    }

    // 정적 자산은 자기 게임 폴더 아래에만 둔다.
    const checkAsset = (path: (string | number)[], ref: string | undefined) => {
      if (ref && !ref.startsWith(`/games/${g.id}/`)) {
        push(
          path,
          `자산 경로가 다른 게임을 가리킨다: ${ref} (/games/${g.id}/… 이어야 한다)`,
        );
      }
    };
    checkAsset(['thumbnail'], g.thumbnail);
    for (const [i, p] of g.parts.entries())
      checkAsset(['parts', i, 'artwork'], p.artwork);
    for (const [i, set] of g.styleSets.entries()) {
      for (const [j, v] of set.variants.entries()) {
        checkAsset(['styleSets', i, 'variants', j, 'artwork'], v.artwork);
      }
    }

    for (const [i, s] of g.slots.entries()) {
      if (s.groupId && !groupIds.has(s.groupId)) {
        push(['slots', i, 'groupId'], `없는 그룹을 가리킨다: ${s.groupId}`);
      }

      for (const [j, pl] of s.placements.entries()) {
        const p = partById.get(pl.partId);
        if (!p) {
          push(
            ['slots', i, 'placements', j, 'partId'],
            `없는 파트를 가리킨다: ${pl.partId}`,
          );
          continue;
        }
        const partRect = {
          xMm: 0,
          yMm: 0,
          widthMm: p.widthMm,
          heightMm: p.heightMm,
        };

        if (pl.mode === 'text' && !containsPoint(partRect, pl.xMm, pl.yMm)) {
          push(
            ['slots', i, 'placements', j],
            `좌표(${pl.xMm}, ${pl.yMm})가 파트 '${p.id}'(${p.widthMm}×${p.heightMm}mm) 밖이다`,
          );
        }

        if (pl.mode === 'marker') {
          const set = styleSetById.get(pl.styleSetId);
          if (!set) {
            push(
              ['slots', i, 'placements', j, 'styleSetId'],
              `없는 마커 스타일 세트를 가리킨다: ${pl.styleSetId}`,
            );
          }
          const region = p.regions.find((r) => r.id === pl.regionId);
          if (!region) {
            push(
              ['slots', i, 'placements', j, 'regionId'],
              `파트 '${p.id}'에 없는 영역을 가리킨다: ${pl.regionId}`,
            );
          } else if (!containsPoint(region.rect, pl.xMm, pl.yMm)) {
            push(
              ['slots', i, 'placements', j],
              `기본 좌표(${pl.xMm}, ${pl.yMm})가 영역 '${region.id}' 밖이다`,
            );
          }
          if (set) {
            const size = styleSetBounds(set);
            const box = rectAround(pl.xMm, pl.yMm, size.widthMm, size.heightMm);
            if (!rectContainsRect(partRect, box)) {
              push(
                ['slots', i, 'placements', j],
                `마커가 파트 '${p.id}' 밖으로 나간다 (중심 ${pl.xMm}, ${pl.yMm} · ${size.widthMm}×${size.heightMm}mm)`,
              );
            }
          }
        }
      }
    }

    for (const [i, grp] of g.groups.entries()) {
      const checkGroupSlot = (
        field: 'nameSlotId' | 'colorSlotId',
        expected: Slot['kind'],
      ) => {
        const id = grp[field];
        if (!id) return;
        const s = slotById.get(id);
        if (!s) {
          push(['groups', i, field], `없는 슬롯을 가리킨다: ${id}`);
          return;
        }
        if (s.kind !== expected) {
          push(
            ['groups', i, field],
            `'${id}'는 ${expected} 슬롯이어야 한다 (현재 ${s.kind})`,
          );
        }
        if (s.groupId !== grp.id) {
          push(
            ['groups', i, field],
            `'${id}'가 그룹 '${grp.id}' 소속이 아니다`,
          );
        }
      };
      checkGroupSlot('nameSlotId', 'text');
      checkGroupSlot('colorSlotId', 'color');
    }

    for (const [i, set] of g.styleSets.entries()) {
      if (!set.selectorSlotId) continue;
      const s = slotById.get(set.selectorSlotId);
      if (!s) {
        push(
          ['styleSets', i, 'selectorSlotId'],
          `없는 슬롯을 가리킨다: ${set.selectorSlotId}`,
        );
        continue;
      }
      if (s.kind !== 'choice') {
        push(
          ['styleSets', i, 'selectorSlotId'],
          `선택 슬롯은 choice여야 한다 (현재 ${s.kind})`,
        );
        continue;
      }
      const optionValues = [...s.options.map((o) => o.value)].sort();
      const variantIds = [...set.variants.map((v) => v.id)].sort();
      if (optionValues.join('|') !== variantIds.join('|')) {
        push(
          ['styleSets', i, 'selectorSlotId'],
          `슬롯 '${s.id}'의 선택지(${optionValues.join(', ')})가 변형 목록(${variantIds.join(', ')})과 다르다`,
        );
      }
    }

    /**
     * 프리셋마다 만든 마커 상자. 아래에서 **다른 그룹끼리도** 겹치는지 본다 —
     * 프리셋 하나 안의 겹침만 보면 두 팀을 나란히 놓았을 때를 놓친다.
     */
    const presetBoxes: {
      preset: (typeof g.presets)[number];
      index: number;
      boxes: { slotId: string; rect: ReturnType<typeof rectAround> }[];
    }[] = [];

    for (const [i, preset] of g.presets.entries()) {
      if (!groupIds.has(preset.groupId)) {
        push(
          ['presets', i, 'groupId'],
          `없는 그룹을 가리킨다: ${preset.groupId}`,
        );
        continue;
      }
      const p = partById.get(preset.partId);
      if (!p) {
        push(
          ['presets', i, 'partId'],
          `없는 파트를 가리킨다: ${preset.partId}`,
        );
        continue;
      }

      // 프리셋은 그 그룹의 옮길 수 있는 슬롯 전부를 빠짐없이, 한 번씩 배치한다.
      const expected = new Set(
        g.slots
          .filter((s) => s.groupId === preset.groupId && isMovable(s))
          .filter((s) => slotMarker(s)!.partId === preset.partId)
          .map((s) => s.id),
      );
      const placed = new Set<string>();
      const boxes: { slotId: string; rect: ReturnType<typeof rectAround> }[] =
        [];
      presetBoxes.push({ preset, index: i, boxes });

      for (const [j, pos] of preset.positions.entries()) {
        const s = slotById.get(pos.slotId);
        if (!s) {
          push(
            ['presets', i, 'positions', j, 'slotId'],
            `없는 슬롯을 가리킨다: ${pos.slotId}`,
          );
          continue;
        }
        const marker = slotMarker(s);
        if (!marker) {
          push(
            ['presets', i, 'positions', j, 'slotId'],
            `'${pos.slotId}'는 위치를 가진 슬롯이 아니다`,
          );
          continue;
        }
        if (s.groupId !== preset.groupId) {
          push(
            ['presets', i, 'positions', j, 'slotId'],
            `'${pos.slotId}'가 그룹 '${preset.groupId}' 소속이 아니다`,
          );
          continue;
        }
        if (marker.partId !== preset.partId) {
          push(
            ['presets', i, 'positions', j, 'slotId'],
            `'${pos.slotId}'는 파트 '${marker.partId}'에 있는데 프리셋은 '${preset.partId}'다`,
          );
          continue;
        }
        if (placed.has(pos.slotId)) {
          push(
            ['presets', i, 'positions', j, 'slotId'],
            `슬롯이 중복 배치됐다: ${pos.slotId}`,
          );
          continue;
        }
        placed.add(pos.slotId);

        const region = p.regions.find((r) => r.id === marker.regionId);
        if (region && !containsPoint(region.rect, pos.xMm, pos.yMm)) {
          push(
            ['presets', i, 'positions', j],
            `좌표(${pos.xMm}, ${pos.yMm})가 영역 '${region.id}' 밖이다`,
          );
        }

        const set = styleSetById.get(marker.styleSetId);
        if (set) {
          const size = styleSetBounds(set);
          boxes.push({
            slotId: pos.slotId,
            rect: rectAround(pos.xMm, pos.yMm, size.widthMm, size.heightMm),
          });
        }
      }

      for (const id of expected) {
        if (!placed.has(id)) {
          push(['presets', i, 'positions'], `프리셋에 빠진 슬롯이 있다: ${id}`);
        }
      }

      for (let a = 0; a < boxes.length; a += 1) {
        for (let b = a + 1; b < boxes.length; b += 1) {
          if (rectsOverlap(boxes[a].rect, boxes[b].rect)) {
            push(
              ['presets', i, 'positions'],
              `마커가 겹친다: ${boxes[a].slotId} · ${boxes[b].slotId}`,
            );
          }
        }
      }
    }

    /**
     * 서로 다른 그룹의 프리셋을 **동시에** 적용했을 때도 마커가 겹치지 않아야
     * 한다. 사용자는 팀마다 대형을 따로 고르므로 (홈 대형 × 원정 대형) 모든
     * 조합이 종이 위에서 성립해야 한다.
     *
     * 프리셋 하나 안의 겹침만 보던 시절에는 두 팀이 각자 진영 절반에 갇혀 있어
     * 이 검사가 필요 없었다. 팀을 필드 전체에 섞어 세우면서(IDE-010) 비로소
     * 실제 위험이 됐다.
     */
    for (let a = 0; a < presetBoxes.length; a += 1) {
      for (let b = a + 1; b < presetBoxes.length; b += 1) {
        const left = presetBoxes[a];
        const right = presetBoxes[b];
        if (left.preset.groupId === right.preset.groupId) continue;
        if (left.preset.partId !== right.preset.partId) continue;

        for (const boxA of left.boxes) {
          for (const boxB of right.boxes) {
            if (rectsOverlap(boxA.rect, boxB.rect)) {
              push(
                ['presets', left.index, 'positions'],
                `다른 그룹의 프리셋과 마커가 겹친다: ` +
                  `'${left.preset.label}'의 ${boxA.slotId} · ` +
                  `'${right.preset.label}'의 ${boxB.slotId}`,
              );
            }
          }
        }
      }
    }
  });

export type GameDefinition = z.infer<typeof gameDefinition>;
/** 기본값이 채워지기 전, 도안 작성자가 손으로 쓰는 모양. */
export type GameDefinitionInput = z.input<typeof gameDefinition>;

/**
 * 도안 파일에서 쓰는 선언 헬퍼. 값을 그대로 돌려주고 타입만 잡아 준다 —
 * 런타임 검증은 등록 시점의 `parseGame`이 한다.
 */
export const defineGame = (
  definition: GameDefinitionInput,
): GameDefinitionInput => definition;

export class GameSchemaError extends Error {
  constructor(
    readonly gameId: string,
    readonly issues: z.core.$ZodIssue[],
    message: string,
  ) {
    super(message);
    this.name = 'GameSchemaError';
  }
}

/** 도안을 검증해 정규화된 정의를 준다. 어긋나면 즉시 예외로 터진다. */
export function parseGame(input: unknown): GameDefinition {
  const result = gameDefinition.safeParse(input);
  if (result.success) return result.data;

  const id =
    input &&
    typeof input === 'object' &&
    'id' in input &&
    typeof input.id === 'string'
      ? input.id
      : '(id 없음)';
  throw new GameSchemaError(
    id,
    result.error.issues,
    `도안 '${id}'이 규격을 어긴다:\n${z.prettifyError(result.error)}`,
  );
}

export const findPart = (
  game: GameDefinition,
  partId: string,
): Part | undefined => game.parts.find((p) => p.id === partId);

export const findSlot = (
  game: GameDefinition,
  slotId: string,
): Slot | undefined => game.slots.find((s) => s.id === slotId);

/** 파트 하나에 나타나는 슬롯들. 렌더러가 파트 단위로 그릴 때 쓴다. */
export const slotsOfPart = (game: GameDefinition, partId: string): Slot[] =>
  game.slots.filter((s) => s.placements.some((p) => p.partId === partId));

/** 같은 대형의 팀별 프리셋을 묶는다. UI는 이 단위로 대형을 보여준다. */
export function presetsByFormation(
  game: GameDefinition,
): Map<string, ReturnType<typeof gameDefinition.parse>['presets']> {
  const byFormation = new Map<string, GameDefinition['presets']>();
  for (const preset of game.presets) {
    const key = preset.formationId ?? preset.id;
    const list = byFormation.get(key) ?? [];
    list.push(preset);
    byFormation.set(key, list);
  }
  return byFormation;
}

/**
 * 커스터마이즈 값 (IDE-003)
 *
 * 도안이 "고칠 수 있는 자리"를 선언하면, 사용자가 채운 값이 여기 담긴다.
 * 에디터(IDE-006)의 상태이자 내보내기(IDE-007)의 입력이다. 게임마다 모양이
 * 같으므로 저장·복원 코드도 게임을 알 필요가 없다.
 */
import type { GameDefinition } from './game';
import { z } from 'zod';
import { MAP_ONLY_FRAME, type Part } from './parts';
import { listItem } from './slots';
import { findSlot } from './game';
import {
  isMovable,
  slotMarker,
  validateSlotValue,
  type SlotValue,
} from './slots';
import { containsPoint } from './units';
import type { MarkerStyleVariant } from './styles';

export interface SlotPoint {
  xMm: number;
  yMm: number;
  /**
   * 마커를 **제 중심을 축으로** 돌린 각도. 없으면 0이다.
   *
   * 배치 프리셋이 주는 자세는 한 가지뿐인데, 방향이 있는 마커(축구 게임판의
   * 달리는 선수 일러스트)는 같은 그림이 스물두 번 되풀이되면 판이 단조롭다.
   * 사용자가 마커를 눌러 돌릴 수 있게 한 값이다(2026-09-05 사용자 요청).
   *
   * 파트의 `placements[].rotationDeg`(도안이 정한 고정 각도)와는 다르다 —
   * 이쪽은 **사용자가 만든 값**이라 커스터마이즈에 실려 저장된다.
   */
  rotationDeg?: number;
}

export interface GameCustomization {
  gameId: string;
  /** 슬롯 id → 값. 모든 슬롯에 대해 채워져 있다. */
  values: Record<string, SlotValue>;
  /** 위치를 가진 슬롯의 현재 좌표. 마커 슬롯에 대해서만 있다. */
  positions: Record<string, SlotPoint>;
}

export interface CustomizationIssue {
  slotId: string;
  message: string;
}

/** 도안의 기본값으로 채운 커스터마이즈. 에디터의 첫 상태이자 '되돌리기'의 목적지다. */
export function defaultCustomization(game: GameDefinition): GameCustomization {
  const values: Record<string, SlotValue> = {};
  const positions: Record<string, SlotPoint> = {};
  for (const slot of game.slots) {
    values[slot.id] = slot.default;
    const marker = slotMarker(slot);
    if (marker) positions[slot.id] = { xMm: marker.xMm, yMm: marker.yMm };
  }
  return { gameId: game.id, values, positions };
}

/** 값과 좌표가 도안의 제약을 지키는지. 빈 배열이면 그대로 인쇄해도 된다. */
export function validateCustomization(
  game: GameDefinition,
  customization: GameCustomization,
): CustomizationIssue[] {
  const issues: CustomizationIssue[] = [];
  if (customization.gameId !== game.id) {
    issues.push({
      slotId: '(게임)',
      message: `다른 게임의 커스터마이즈다: ${customization.gameId}`,
    });
    return issues;
  }

  for (const slot of game.slots) {
    const value = customization.values[slot.id];
    if (value === undefined) {
      issues.push({ slotId: slot.id, message: '값이 없다' });
    } else {
      const reason = validateSlotValue(slot, value);
      if (reason) issues.push({ slotId: slot.id, message: reason });
    }

    const marker = slotMarker(slot);
    if (!marker) continue;
    const point = customization.positions[slot.id];
    if (!point) {
      issues.push({ slotId: slot.id, message: '좌표가 없다' });
      continue;
    }
    const part = game.parts.find((p) => p.id === marker.partId);
    const region = part?.regions.find((r) => r.id === marker.regionId);
    if (region && !containsPoint(region.rect, point.xMm, point.yMm)) {
      issues.push({
        slotId: slot.id,
        message: `좌표(${point.xMm}, ${point.yMm})가 '${region.label}' 밖이다`,
      });
    }
    // 각도는 범위를 두지 않는다(한 바퀴를 넘겨도 그림은 같다). 다만 수가
    // 아니면 SVG transform이 통째로 깨지므로 그것만 막는다.
    if (
      point.rotationDeg !== undefined &&
      !Number.isFinite(point.rotationDeg)
    ) {
      issues.push({ slotId: slot.id, message: '회전 각도가 숫자가 아니다' });
    }
  }

  const known = new Set(game.slots.map((s) => s.id));
  for (const id of Object.keys(customization.values)) {
    if (!known.has(id))
      issues.push({ slotId: id, message: '도안에 없는 슬롯이다' });
  }

  return issues;
}

/** 프리셋을 적용한 새 커스터마이즈. 프리셋에 없는 슬롯의 좌표는 그대로 둔다. */
export function applyPreset(
  game: GameDefinition,
  customization: GameCustomization,
  presetId: string,
): GameCustomization {
  const preset = game.presets.find((p) => p.id === presetId);
  if (!preset) throw new Error(`없는 프리셋이다: ${presetId}`);

  const positions = { ...customization.positions };
  for (const pos of preset.positions) {
    positions[pos.slotId] = { xMm: pos.xMm, yMm: pos.yMm };
  }
  return { ...customization, positions };
}

/** 사용자가 고른 마커 스타일 변형. 선택 슬롯이 없으면 첫 변형이다. */
export function resolveVariant(
  game: GameDefinition,
  styleSetId: string,
  customization: GameCustomization,
): MarkerStyleVariant {
  const set = game.styleSets.find((s) => s.id === styleSetId);
  if (!set) throw new Error(`없는 마커 스타일 세트다: ${styleSetId}`);
  if (!set.selectorSlotId) return set.variants[0];

  const chosen = customization.values[set.selectorSlotId];
  const variant = set.variants.find((v) => v.id === chosen);
  return variant ?? set.variants[0];
}

/** 위치를 가진 슬롯만 추린다. 에디터가 드래그 대상을 고를 때 쓴다. */
export const movableSlots = (game: GameDefinition) =>
  game.slots.filter(isMovable);

/** 슬롯이 도안에 실제로 존재하는지 — 에디터의 '미리보기에서 슬롯 찾기'에 쓴다. */
export const hasSlot = (game: GameDefinition, slotId: string): boolean =>
  findSlot(game, slotId) !== undefined;

/**
 * 지금 값에서 파트가 실제로 어떤 모습인가 — 변형이 있으면 고른 변형의 치수·
 * 아트워크·제목을 입힌 파트를, 없으면 파트 그대로를 돌려준다.
 *
 * 렌더러(`lib/print/compose.ts`)·에디터 미리보기·인쇄 옵션이 모두 이걸 거친다.
 * 한 곳이라도 원본 파트를 그대로 쓰면 화면과 인쇄물의 크기가 어긋난다.
 * 값이 어느 변형에도 없으면(옛 저장값 등) 파트 자체, 곧 기본값이다.
 */
export function resolvePart(
  game: GameDefinition,
  part: Part,
  customization: GameCustomization,
): Part {
  if (part.dynamic) {
    const size = dynamicSize(part, customization);
    return { ...part, widthMm: size.widthMm, heightMm: size.heightMm };
  }
  if (!part.variants) return part;
  const chosen = customization.values[part.variants.selectorSlotId];
  const option = part.variants.options.find((o) => o.value === chosen);
  if (!option) return part;
  return {
    ...part,
    title: option.title ?? part.title,
    widthMm: option.widthMm,
    heightMm: option.heightMm,
    artwork: option.artwork,
  };
}

/** 게임의 파트 전부를 지금 값으로 푼다. 차례는 도안이 선언한 대로다. */
export const resolveParts = (
  game: GameDefinition,
  customization: GameCustomization,
): Part[] => game.parts.map((part) => resolvePart(game, part, customization));

/**
 * 동적 파트의 지금 크기 — 목록 슬롯의 항목 수가 정하는 단계와, 틀 슬롯이
 * `map`이면 지도 높이. 렌더러가 그리는 SVG의 크기와 같아야 하며 내보내기가
 * 그것을 확인한다.
 */
export function dynamicSize(
  part: Part,
  customization: GameCustomization,
): { widthMm: number; heightMm: number; itemCount: number; mapOnly: boolean } {
  if (!part.dynamic) {
    return {
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      itemCount: 0,
      mapOnly: false,
    };
  }
  const items = customization.values[part.dynamic.listSlotId];
  const itemCount = Array.isArray(items) ? items.length : 0;
  const steps = part.dynamic.sizeSteps;
  const step =
    steps.find((candidate) => itemCount <= candidate.maxItems) ??
    steps[steps.length - 1];
  const frame = part.dynamic.frameSlotId
    ? customization.values[part.dynamic.frameSlotId]
    : undefined;
  const mapOnly = frame === MAP_ONLY_FRAME && step.mapHeightMm !== undefined;
  return {
    widthMm: step.widthMm,
    heightMm: mapOnly ? step.mapHeightMm! : step.heightMm,
    itemCount,
    mapOnly,
  };
}

/**
 * 요청 본문으로 들어오는 커스터마이즈의 모양. API 경로들이 같은 것을 쓴다 —
 * 값의 종류가 늘 때(목록 슬롯의 직접 더한 항목) 한 곳만 고치면 된다. 뜻은
 * `validateCustomization`이 본다.
 */
export const customizationBody = z.object({
  gameId: z.string(),
  values: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.array(z.union([z.string(), listItem]))]),
  ),
  positions: z.record(
    z.string(),
    z.object({
      xMm: z.number(),
      yMm: z.number(),
      rotationDeg: z.number().optional(),
    }),
  ),
});

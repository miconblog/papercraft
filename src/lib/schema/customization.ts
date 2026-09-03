/**
 * 커스터마이즈 값 (IDE-003)
 *
 * 도안이 "고칠 수 있는 자리"를 선언하면, 사용자가 채운 값이 여기 담긴다.
 * 에디터(IDE-006)의 상태이자 내보내기(IDE-007)의 입력이다. 게임마다 모양이
 * 같으므로 저장·복원 코드도 게임을 알 필요가 없다.
 */
import type { GameDefinition } from './game';
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

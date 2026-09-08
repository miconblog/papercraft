/**
 * 커스터마이즈 값을 브라우저에 남기는 저장소 (IDE-006)
 *
 * 새로고침해도 입력이 남아야 한다는 수용 기준이 근거다. 게임마다 키를 나눈다.
 *
 * 저장된 값이 지금 도안과 안 맞으면(슬롯이 늘거나 이름이 바뀐 뒤의 옛 저장)
 * **맞는 것만 살리고 나머지는 기본값으로 채운다**(2026-09-08). 처음엔 통째로
 * 버렸는데, 도안을 손볼 때마다 사용자가 만든 경로가 사라졌다 — 슬롯 하나가
 * 새로 생겼다고 도시 60개의 차례를 잃을 이유는 없다.
 */
import {
  containsPoint,
  defaultCustomization,
  slotMarker,
  validateSlotValue,
  type GameCustomization,
  type GameDefinition,
} from '@/lib/schema';

const KEY_PREFIX = 'papercraft:customization:';

const storageKey = (gameId: string): string => `${KEY_PREFIX}${gameId}`;

/**
 * 저장된 값을 지금 도안에 맞춰 살린다. 슬롯마다 저장값이 있고 제약을 지키면
 * 그것을, 아니면 기본값을 쓴다. 좌표도 마찬가지 — 영역 안이면 살린다. 도안에
 * 없는 슬롯의 값은 버린다. 하나라도 살렸으면 돌려주고, 전부 기본값이면 null이다
 * — 그래야 "복원했다"는 표시가 거짓말이 아니다.
 */
export const restoreCustomization = (
  game: GameDefinition,
  stored: unknown,
): GameCustomization | null => {
  if (!stored || typeof stored !== 'object') return null;
  const parsed = stored as Partial<GameCustomization>;
  if (parsed.gameId !== game.id) return null;
  const values = parsed.values ?? {};
  const positions = parsed.positions ?? {};
  if (typeof values !== 'object' || typeof positions !== 'object') return null;

  const merged = defaultCustomization(game);
  let kept = 0;
  for (const slot of game.slots) {
    const value = (values as Record<string, unknown>)[slot.id];
    if (value !== undefined && validateSlotValue(slot, value) === null) {
      merged.values[slot.id] = value as GameCustomization['values'][string];
      kept += 1;
    }
    const marker = slotMarker(slot);
    if (!marker) continue;
    const point = (positions as Record<string, unknown>)[slot.id];
    if (!point || typeof point !== 'object') continue;
    const { xMm, yMm, rotationDeg } = point as Record<string, unknown>;
    if (!Number.isFinite(xMm) || !Number.isFinite(yMm)) continue;
    if (rotationDeg !== undefined && !Number.isFinite(rotationDeg)) continue;
    const part = game.parts.find((p) => p.id === marker.partId);
    const region = part?.regions.find((r) => r.id === marker.regionId);
    if (region && !containsPoint(region.rect, xMm as number, yMm as number))
      continue;
    merged.positions[slot.id] = {
      xMm: xMm as number,
      yMm: yMm as number,
      ...(rotationDeg !== undefined
        ? { rotationDeg: rotationDeg as number }
        : {}),
    };
    kept += 1;
  }
  return kept > 0 ? merged : null;
};

const parseStored = (
  raw: string | null,
  game: GameDefinition,
): GameCustomization | null => {
  if (!raw) return null;
  try {
    return restoreCustomization(game, JSON.parse(raw));
  } catch {
    return null;
  }
};

/** 저장된 값을 읽는다. 없거나, 파싱할 수 없거나, 지금 도안과 안 맞으면 null. */
export function loadCustomization(
  game: GameDefinition,
): GameCustomization | null {
  if (typeof window === 'undefined') return null;
  return parseStored(window.localStorage.getItem(storageKey(game.id)), game);
}

let snapshotCache: {
  raw: string | null;
  gameId: string;
  value: GameCustomization | null;
} | null = null;

/**
 * `useSyncExternalStore`의 `getSnapshot`으로 쓴다. localStorage 원문 문자열이
 * 그대로면 **같은 참조**를 돌려준다 — 매번 새 객체를 만들면 React가 스토어가
 * 계속 바뀐다고 보고 무한 리렌더에 빠진다.
 */
export function readStoredCustomizationSnapshot(
  game: GameDefinition,
): GameCustomization | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(game.id));
  if (
    snapshotCache &&
    snapshotCache.raw === raw &&
    snapshotCache.gameId === game.id
  ) {
    return snapshotCache.value;
  }
  const value = parseStored(raw, game);
  snapshotCache = { raw, gameId: game.id, value };
  return value;
}

export function saveCustomization(customization: GameCustomization): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(customization.gameId),
      JSON.stringify(customization),
    );
  } catch {
    // 저장 용량 초과 등은 무시한다 — 에디터 자체는 메모리 상태로 계속 동작한다.
  }
}

export function clearCustomization(gameId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(gameId));
}

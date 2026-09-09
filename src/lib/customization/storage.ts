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

/**
 * 저장 결과 — **실패를 삼키지 않는다**(IDE-020).
 *
 * 오래도록 `try {} catch {}` 한 줄이었다. 값이 슬롯 몇 개짜리 글자·색이라
 * 한도에 닿을 일이 없었기 때문인데, 점 잇기가 줄인 사진을 함께 남기면서
 * `localStorage`가 꽉 차는 경우가 처음 생겼다. 조용히 넘기면 사용자는 창을
 * 닫고 나서야 도안이 사라진 것을 안다.
 *
 * 에디터는 그래도 계속 동작한다 — 메모리 상태는 멀쩡하고, 못 하는 것은
 * "다음에 다시 여는 것"뿐이다. 그 말을 그대로 화면에 적는다.
 */
export type SaveResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: SaveFailure };

/** `quota`는 한도 초과, `blocked`는 저장소 자체를 못 쓰는 경우(사생활 보호 모드). */
export type SaveFailure = 'quota' | 'blocked';

/**
 * 사용자에게 그대로 보이는 문장. **무엇을 잃는지**를 적는다 — "저장 실패"만
 * 적으면 지금 만들던 것이 사라진 줄 알고 다시 시작한다.
 */
export const SAVE_FAILURE_MESSAGE: Record<SaveFailure, string> = {
  quota:
    '브라우저 저장 공간이 가득 차 이 도안을 남기지 못했다. 지금 화면에서는 그대로 쓰고 인쇄할 수 있지만, 창을 닫으면 사라진다.',
  blocked:
    '이 브라우저에서는 도안을 남길 수 없다(사생활 보호 모드일 수 있다). 지금 화면에서는 그대로 쓰고 인쇄할 수 있지만, 창을 닫으면 사라진다.',
};

const OK: SaveResult = { ok: true };

/**
 * 지금 **저장에 실패해 있는 키**들. 화면의 경고가 이 집합을 읽는다.
 *
 * "마지막 저장 결과" 하나로는 안 된다 — 사진(수백 KB)이 한도에 걸려 실패한
 * 직후에 값(몇 KB)은 멀쩡히 들어가므로, 마지막 결과만 보면 경고가 곧바로
 * 사라진다. 사진은 여전히 안 남았는데 화면은 괜찮다고 말하게 된다.
 */
const failedKeys = new Map<string, SaveFailure>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** `useSyncExternalStore`용. 하나라도 실패해 있으면 그 사유를 준다. */
export const getSaveFailure = (): SaveFailure | null =>
  failedKeys.values().next().value ?? null;

/** 서버에는 저장소가 없다 — 서버 스냅샷은 늘 "실패 없음"이다. */
export const getServerSaveFailure = (): SaveFailure | null => null;

export function subscribeSaveFailure(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 테스트 전용 — 모듈 레벨 상태는 테스트 파일 안에서도 이어진다. */
export function __resetSaveFailuresForTests(): void {
  failedKeys.clear();
}

const record = (key: string, reason: SaveFailure | null) => {
  const before = failedKeys.get(key) ?? null;
  if (before === reason) return;
  if (reason === null) failedKeys.delete(key);
  else failedKeys.set(key, reason);
  notify();
};

/**
 * 한도 초과인지 가린다. 브라우저마다 이름·코드가 달라 셋을 다 본다 — Chrome은
 * `QuotaExceededError`, Firefox는 `NS_ERROR_DOM_QUOTA_REACHED`(코드 1014),
 * 옛 Safari는 이름 없이 코드 22만 준다.
 */
const isQuota = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as DOMException).code;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
};

/** 문자열 하나를 남긴다. 사진 저장(`./photo.ts`)도 같은 판정을 쓴다. */
export function writeStorage(key: string, value: string): SaveResult {
  if (typeof window === 'undefined') return OK;
  try {
    window.localStorage.setItem(key, value);
    record(key, null);
    return OK;
  } catch (error) {
    const reason: SaveFailure = isQuota(error) ? 'quota' : 'blocked';
    record(key, reason);
    return { ok: false, reason };
  }
}

/** 지운 키는 더 이상 실패해 있지 않다 — 경고도 함께 걷힌다. */
export function removeStorage(key: string): void {
  record(key, null);
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

export function saveCustomization(
  customization: GameCustomization,
): SaveResult {
  return writeStorage(
    storageKey(customization.gameId),
    JSON.stringify(customization),
  );
}

export function clearCustomization(gameId: string): void {
  removeStorage(storageKey(gameId));
}

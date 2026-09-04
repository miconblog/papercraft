/**
 * 커스터마이즈 값을 브라우저에 남기는 저장소 (IDE-006)
 *
 * 새로고침해도 입력이 남아야 한다는 수용 기준이 근거다. 게임마다 키를 나누고,
 * 저장된 값이 지금 도안과 안 맞으면(슬롯이 바뀐 옛 저장 등) 조용히 버린다 —
 * 잘못된 값으로 에디터가 오류 상태로 시작하는 것보다 기본값으로 새로 시작하는
 * 편이 낫다.
 */
import {
  validateCustomization,
  type GameCustomization,
  type GameDefinition,
} from '@/lib/schema';

const KEY_PREFIX = 'papercraft:customization:';

const storageKey = (gameId: string): string => `${KEY_PREFIX}${gameId}`;

const parseStored = (
  raw: string | null,
  game: GameDefinition,
): GameCustomization | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameCustomization;
    if (!parsed || typeof parsed !== 'object' || parsed.gameId !== game.id)
      return null;
    if (validateCustomization(game, parsed).length > 0) return null;
    return parsed;
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
  if (snapshotCache && snapshotCache.raw === raw && snapshotCache.gameId === game.id) {
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

'use client';

import { useSyncExternalStore } from 'react';
import type { GameCustomization, GameDefinition } from '@/lib/schema';
import { readStoredCustomizationSnapshot } from './storage';

const neverNotifies = () => () => {};

/**
 * 로컬 저장소에 남은 커스터마이즈 값. 서버에는 없으므로 서버 스냅샷은 null이다
 * — 실제 적용은 `useHydrated`로 하이드레이션이 끝난 뒤에 한다(`EditorClient`).
 */
export function useStoredCustomization(
  game: GameDefinition,
): GameCustomization | null {
  return useSyncExternalStore(
    neverNotifies,
    () => readStoredCustomizationSnapshot(game),
    () => null,
  );
}

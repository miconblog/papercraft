/**
 * 하이드레이션 전에는 저장하지 않는다 (IDE-006 · 2026-09-08)
 *
 * 서버 렌더 직후 첫 화면은 기본값이다. 그때 "값이 바뀌면 저장" 효과가 돌면
 * 사용자가 만든 값을 기본값으로 덮어쓴 뒤에야 복원이 시작된다 — 새로고침할
 * 때마다 경로가 초기화되던 원인이다. `useHydrated`를 거짓으로 고정해 그 첫
 * 화면을 흉내 낸다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { getGame } from '@/lib/games';
import { defaultCustomization } from '@/lib/schema';
import { EditorClient } from '../EditorClient';

vi.mock('@/lib/customization/useHydrated', () => ({
  useHydrated: () => false,
}));

const game = getGame('world-tour')!;
const KEY = `papercraft:customization:${game.id}`;

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('EditorClient — 하이드레이션 전', () => {
  it('저장된 값을 기본값으로 덮어쓰지 않는다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => '<svg />' })),
    );
    const mine = defaultCustomization(game);
    mine.values.cities = ['seoul', 'paris', 'rome', 'cairo', 'tokyo'];
    window.localStorage.setItem(KEY, JSON.stringify(mine));

    render(<EditorClient game={game} />);

    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as {
      values: { cities: string[] };
    };
    expect(stored.values.cities).toEqual([
      'seoul',
      'paris',
      'rome',
      'cairo',
      'tokyo',
    ]);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { defaultCustomization, parseGame } from '@/lib/schema';
import { makeGameWithMarkers } from '@/lib/schema/__tests__/fixtures';
import {
  clearCustomization,
  loadCustomization,
  saveCustomization,
} from '../storage';

const game = parseGame(makeGameWithMarkers());

afterEach(() => {
  window.localStorage.clear();
});

describe('로컬 저장 (IDE-006 수용 기준: 새로고침해도 입력값이 유지된다)', () => {
  it('저장한 값을 그대로 읽어온다', () => {
    const customization = defaultCustomization(game);
    customization.values['red-name'] = '고친 이름';
    saveCustomization(customization);

    const loaded = loadCustomization(game);
    expect(loaded?.values['red-name']).toBe('고친 이름');
  });

  it('저장된 값이 없으면 null이다', () => {
    expect(loadCustomization(game)).toBeNull();
  });

  it('다른 게임의 저장값은 읽지 않는다', () => {
    const other = parseGame(
      makeGameWithMarkers({ id: 'other', thumbnail: '/games/other/thumb.png' }),
    );
    saveCustomization(defaultCustomization(other));
    expect(loadCustomization(game)).toBeNull();
  });

  it('도안과 안 맞는 값(제약 위반)은 버리고 null을 준다', () => {
    const customization = defaultCustomization(game);
    // number 슬롯 제약(1–99)을 어긴 값을 직접 흘려 넣는다.
    customization.values['red-piece-1'] = 1000;
    saveCustomization(customization);

    expect(loadCustomization(game)).toBeNull();
  });

  it('clearCustomization 이후엔 다시 null이다', () => {
    saveCustomization(defaultCustomization(game));
    clearCustomization(game.id);
    expect(loadCustomization(game)).toBeNull();
  });
});

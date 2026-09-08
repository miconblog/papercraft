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

  it('제약을 어긴 값만 기본값으로 되돌리고 나머지는 살린다', () => {
    // 처음엔 하나라도 틀리면 통째로 버렸는데, 도안을 손볼 때마다 사용자가 만든
    // 값이 사라졌다(2026-09-08). 이제 맞는 것만 살린다.
    const customization = defaultCustomization(game);
    customization.values['red-name'] = '살아남을 이름';
    // number 슬롯 제약(1–99)을 어긴 값을 직접 흘려 넣는다.
    customization.values['red-piece-1'] = 1000;
    saveCustomization(customization);

    const loaded = loadCustomization(game);
    expect(loaded?.values['red-name']).toBe('살아남을 이름');
    expect(loaded?.values['red-piece-1']).toBe(
      defaultCustomization(game).values['red-piece-1'],
    );
  });

  it('슬롯이 새로 생기거나 없어진 옛 저장값도 맞는 것은 살린다', () => {
    const customization = defaultCustomization(game);
    customization.values['red-name'] = '옛 저장';
    const stale = {
      ...customization,
      values: {
        ...customization.values,
        'gone-slot': '도안에 없는 슬롯',
      },
    } as typeof customization;
    delete (stale.values as Record<string, unknown>)['red-piece-1'];
    window.localStorage.setItem(
      `papercraft:customization:${game.id}`,
      JSON.stringify(stale),
    );

    const loaded = loadCustomization(game);
    expect(loaded?.values['red-name']).toBe('옛 저장');
    expect(loaded?.values['red-piece-1']).toBe(
      defaultCustomization(game).values['red-piece-1'],
    );
    expect(loaded?.values['gone-slot']).toBeUndefined();
  });

  it('영역 밖 좌표는 기본 좌표로 되돌린다', () => {
    const customization = defaultCustomization(game);
    const [slotId] = Object.keys(customization.positions);
    customization.positions[slotId] = { xMm: -999, yMm: -999 };
    saveCustomization(customization);
    expect(loadCustomization(game)?.positions[slotId]).toEqual(
      defaultCustomization(game).positions[slotId],
    );
  });

  it('모양이 아예 아니면(gameId 없음) null이다', () => {
    window.localStorage.setItem(
      `papercraft:customization:${game.id}`,
      JSON.stringify({ hello: 'world' }),
    );
    expect(loadCustomization(game)).toBeNull();
  });

  it('clearCustomization 이후엔 다시 null이다', () => {
    saveCustomization(defaultCustomization(game));
    clearCustomization(game.id);
    expect(loadCustomization(game)).toBeNull();
  });
});

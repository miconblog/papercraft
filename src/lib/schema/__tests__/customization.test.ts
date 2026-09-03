import { describe, expect, it } from 'vitest';
import { parseGame } from '../game';
import {
  applyPreset,
  defaultCustomization,
  resolveVariant,
  validateCustomization,
} from '../customization';
import { validateSlotValue } from '../slots';
import { makeGameWithMarkers } from './fixtures';

const game = parseGame(makeGameWithMarkers());

describe('기본 커스터마이즈', () => {
  it('모든 슬롯의 값과 마커 슬롯의 좌표가 채워진다', () => {
    const c = defaultCustomization(game);
    expect(Object.keys(c.values).sort()).toEqual(
      game.slots.map((s) => s.id).sort(),
    );
    expect(Object.keys(c.positions).sort()).toEqual([
      'red-piece-1',
      'red-piece-2',
    ]);
    expect(c.positions['red-piece-1']).toEqual({ xMm: 60, yMm: 60 });
  });

  it('기본값은 그대로 검증을 통과한다', () => {
    expect(validateCustomization(game, defaultCustomization(game))).toEqual([]);
  });
});

describe('값 검증', () => {
  it('제약을 어긴 값을 사유와 함께 잡는다', () => {
    const c = defaultCustomization(game);
    c.values['red-piece-1'] = 200;
    c.values['red-name'] = '열두글자를넘기는아주긴이름';
    c.values['red-color'] = 'blue';
    const issues = validateCustomization(game, c);
    expect(issues.map((i) => i.slotId).sort()).toEqual([
      'red-color',
      'red-name',
      'red-piece-1',
    ]);
    expect(issues.find((i) => i.slotId === 'red-piece-1')!.message).toContain(
      '1–99',
    );
  });

  it('좌표가 영역을 벗어나면 잡는다', () => {
    const c = defaultCustomization(game);
    c.positions['red-piece-1'] = { xMm: 205, yMm: 60 };
    expect(validateCustomization(game, c)[0].message).toContain('밖이다');
  });

  it('도안에 없는 슬롯이 섞이면 잡는다', () => {
    const c = defaultCustomization(game);
    c.values['ghost'] = 'x';
    expect(validateCustomization(game, c)).toContainEqual({
      slotId: 'ghost',
      message: '도안에 없는 슬롯이다',
    });
  });

  it('다른 게임의 커스터마이즈는 즉시 잡는다', () => {
    const c = { ...defaultCustomization(game), gameId: 'other' };
    expect(validateCustomization(game, c)).toHaveLength(1);
  });

  it('validateSlotValue는 슬롯 종류마다 사유를 준다', () => {
    const number = game.slots.find((s) => s.id === 'red-piece-1')!;
    const color = game.slots.find((s) => s.id === 'red-color')!;
    expect(validateSlotValue(number, 5)).toBeNull();
    expect(validateSlotValue(number, 1.5)).toBe('정수를 입력한다');
    expect(validateSlotValue(color, '#00ff00')).toBeNull();
    expect(validateSlotValue(color, '초록')).toContain('#RRGGBB');
  });
});

describe('프리셋 적용', () => {
  it('프리셋 좌표로 바뀌고 값은 그대로다', () => {
    const c = defaultCustomization(game);
    const applied = applyPreset(game, c, 'spread');
    expect(applied.positions['red-piece-1']).toEqual({ xMm: 40, yMm: 100 });
    expect(applied.values).toEqual(c.values);
    expect(validateCustomization(game, applied)).toEqual([]);
  });

  it('원본을 건드리지 않는다', () => {
    const c = defaultCustomization(game);
    applyPreset(game, c, 'spread');
    expect(c.positions['red-piece-1']).toEqual({ xMm: 60, yMm: 60 });
  });

  it('없는 프리셋은 예외다', () => {
    expect(() => applyPreset(game, defaultCustomization(game), 'nope')).toThrow(
      '없는 프리셋',
    );
  });
});

describe('마커 스타일 변형 고르기', () => {
  it('선택 슬롯이 없으면 첫 변형이다', () => {
    expect(resolveVariant(game, 'piece', defaultCustomization(game)).id).toBe(
      'dot',
    );
  });
});

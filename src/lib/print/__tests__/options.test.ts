import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import type { GameDefinition } from '@/lib/schema';
import {
  defaultExportOptions,
  MAX_PAGES,
  validateExportOptions,
  type ExportOptions,
} from '../options';

const game = getGame('soccer') as GameDefinition;
const base = defaultExportOptions(game);
const only = (partId: string, scale: number, copies = 1): ExportOptions => ({
  ...base,
  parts: [{ partId, scale, copies }],
});

describe('validateExportOptions', () => {
  it('기본값은 아무 문제도 없다', () => {
    expect(validateExportOptions(game, base)).toEqual([]);
  });

  it('도안이 정한 하한보다 작은 배율은 막는다 (IDE-004의 minScale)', () => {
    const issues = validateExportOptions(game, only('goals', 0.5));
    expect(issues).toHaveLength(1);
    expect(issues[0].blocking).toBe(true);
    expect(issues[0].message).toContain('80%');
  });

  it('파트마다 하한이 다르다 — 운동장의 50%는 통과한다', () => {
    expect(validateExportOptions(game, only('field', 0.5))).toEqual([]);
    expect(validateExportOptions(game, only('goals', 0.8))).toEqual([]);
  });

  it('권장 상한을 넘으면 알리되 막지는 않는다', () => {
    const issues = validateExportOptions(game, only('field', 5));
    const warning = issues.find((i) => i.partId === 'field');
    expect(warning?.blocking).toBe(false);
    expect(warning?.message).toContain('400%');
  });

  it('한 번에 만드는 장수에 상한이 있다', () => {
    const issues = validateExportOptions(game, only('field', 20));
    expect(issues.some((i) => i.blocking && i.partId === null)).toBe(true);
    expect(issues.find((i) => i.partId === null)?.message).toContain(
      String(MAX_PAGES),
    );
  });

  it('없는 파트와 중복 선택을 막는다', () => {
    expect(validateExportOptions(game, only('없는-파트', 1))[0].blocking).toBe(
      true,
    );
    const duplicated: ExportOptions = {
      ...base,
      parts: [
        { partId: 'field', scale: 1, copies: 1 },
        { partId: 'field', scale: 1, copies: 1 },
      ],
    };
    expect(
      validateExportOptions(game, duplicated).some((i) =>
        i.message.includes('두 번'),
      ),
    ).toBe(true);
  });

  it('벌 수는 장수 계산에 곱해진다', () => {
    // 운동장 300%는 15장이다. 한 벌이면 상한 안이고 20벌이면 넘는다.
    expect(
      validateExportOptions(game, only('field', 3, 1)).some(
        (i) => i.partId === null,
      ),
    ).toBe(false);
    expect(
      validateExportOptions(game, only('field', 3, 20)).some(
        (i) => i.partId === null,
      ),
    ).toBe(true);
  });

  it('기본 선택은 도안이 정한 기본 배율·기본 벌 수를 쓴다', () => {
    // 도안이 선언한 값을 그대로 옮길 뿐, 화면이 제 나름의 기본값을 만들지 않는다.
    for (const part of game.parts) {
      expect(base.parts.find((p) => p.partId === part.id)).toEqual({
        partId: part.id,
        scale: part.defaultScale,
        copies: part.defaultCopies,
      });
    }
  });
});

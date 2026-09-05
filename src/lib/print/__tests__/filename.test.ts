import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import type { GameDefinition } from '@/lib/schema';
import { contentDisposition, exportFilename, groupLabelFor } from '../filename';

const game = getGame('soccer') as GameDefinition;
const sel = (partId: string, scale = 1, copies = 1) => ({
  partId,
  scale,
  copies,
});

describe('exportFilename', () => {
  it('게임 · 파트 · 배율이 이름에서 구분된다', () => {
    expect(
      exportFilename({ gameId: 'soccer', selections: [sel('field', 2)] }),
    ).toBe('soccer-field-200pct.pdf');
  });

  it('여러 파트는 묶음 이름을 쓴다', () => {
    expect(
      exportFilename({
        gameId: 'soccer',
        selections: [sel('score-sheet'), sel('goals')],
        groupLabel: 'accessories',
      }),
    ).toBe('soccer-accessories-100pct.pdf');
  });

  it('배율이 파트마다 다르면 mixed로 적는다 — 틀린 배율을 적지 않는다', () => {
    expect(
      exportFilename({
        gameId: 'soccer',
        selections: [sel('field', 2), sel('goals', 1)],
        groupLabel: 'parts',
      }),
    ).toBe('soccer-parts-mixed.pdf');
  });

  it('여러 벌이면 벌 수를 붙인다', () => {
    expect(
      exportFilename({ gameId: 'soccer', selections: [sel('field', 1, 3)] }),
    ).toBe('soccer-field-100pct-x3.pdf');
  });

  it('소수 배율도 파일명에서 안전하다', () => {
    expect(
      exportFilename({ gameId: 'soccer', selections: [sel('field', 0.905)] }),
    ).toBe('soccer-field-90_5pct.pdf');
  });

  it('파일명은 ASCII다 — 브라우저·OS를 지나며 깨질 자리를 없앤다', () => {
    const name = exportFilename({
      gameId: game.id,
      selections: game.parts.map((p) => sel(p.id)),
      groupLabel: 'all',
    });
    expect(name).toMatch(/^[\x20-\x7e]+$/);
    expect(name).toBe('soccer-all-100pct.pdf');
  });
});

describe('groupLabelFor', () => {
  it('보드 하나면 board, 부속 전부면 accessories, 다 고르면 all이다', () => {
    expect(groupLabelFor(game, [sel('field')])).toBe('board');
    expect(
      groupLabelFor(
        game,
        game.parts.filter((p) => p.kind !== 'board').map((p) => sel(p.id)),
      ),
    ).toBe('accessories');
    expect(
      groupLabelFor(
        game,
        game.parts.map((p) => sel(p.id)),
      ),
    ).toBe('all');
  });

  it('줄여 부를 수 없는 조합은 parts다', () => {
    expect(groupLabelFor(game, [sel('field'), sel('goals')])).toBe('parts');
  });
});

describe('contentDisposition', () => {
  it('ASCII 이름과 UTF-8 이름을 함께 낸다', () => {
    expect(contentDisposition('soccer-field-200pct.pdf')).toBe(
      'attachment; filename="soccer-field-200pct.pdf"; filename*=UTF-8\'\'soccer-field-200pct.pdf',
    );
  });
});

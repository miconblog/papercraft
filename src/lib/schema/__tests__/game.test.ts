import { describe, expect, it } from 'vitest';
import { GameSchemaError, parseGame } from '../game';
import { makeGame, makeGameWithMarkers, slotOf } from './fixtures';
import type { GameDefinitionInput } from '../game';

/** 검증이 어떤 사유로 걸렸는지까지 확인한다 — 그냥 실패하는 것과는 다르다. */
function issuesOf(input: GameDefinitionInput): string {
  try {
    parseGame(input);
  } catch (error) {
    if (error instanceof GameSchemaError)
      return error.issues.map((i) => i.message).join('\n');
    throw error;
  }
  throw new Error('검증을 통과했다 — 오류가 나야 한다');
}

describe('최소 도안', () => {
  it('유효한 도안은 통과하고 기본값이 채워진다', () => {
    const game = parseGame(makeGame());
    expect(game.id).toBe('demo');
    expect(game.parts[0].defaultScale).toBe(1);
    expect(game.parts[0].defaultCopies).toBe(1);
    expect(game.parts[0].marks).toEqual([]);
    expect(game.presets).toEqual([]);
  });

  it('마커·그룹·프리셋을 갖춘 도안도 통과한다', () => {
    const game = parseGame(makeGameWithMarkers());
    expect(game.presets).toHaveLength(1);
    expect(game.styleSets[0].variants).toHaveLength(1);
  });

  it('규격 버전이 다르면 걸러진다', () => {
    expect(issuesOf(makeGame({ schemaVersion: 2 as 1 }))).toMatch(/2|Invalid/);
  });
});

describe('슬롯', () => {
  it('슬롯이 하나도 없으면 걸러진다', () => {
    expect(issuesOf(makeGame({ slots: [] }))).toMatch(/at least 1|Too small/i);
  });

  it('슬롯 id가 중복되면 걸러진다', () => {
    const base = makeGame();
    expect(
      issuesOf(makeGame({ slots: [base.slots[0], base.slots[0]] })),
    ).toContain('id가 중복된다: headline');
  });

  it('값 타입이 슬롯 종류와 맞지 않으면 걸러진다', () => {
    const game = makeGame();
    const broken = {
      ...game.slots[0],
      default: 42,
    } as unknown as GameDefinitionInput['slots'][0];
    expect(issuesOf(makeGame({ slots: [broken] }))).toMatch(/string|Invalid/i);
  });

  it('배치가 하나도 없으면 — 어느 파트에도 속하지 않으면 — 걸러진다', () => {
    const game = makeGame();
    expect(
      issuesOf(makeGame({ slots: [{ ...game.slots[0], placements: [] }] })),
    ).toMatch(/at least 1|Too small/i);
  });

  it('없는 파트를 가리키는 배치는 걸러진다', () => {
    const game = makeGame();
    const slot = game.slots[0];
    expect(
      issuesOf(
        makeGame({
          slots: [
            {
              ...slot,
              placements: [
                {
                  partId: 'nowhere',
                  mode: 'text',
                  xMm: 10,
                  yMm: 10,
                  fontSizeMm: 5,
                },
              ],
            },
          ],
        }),
      ),
    ).toContain('없는 파트를 가리킨다: nowhere');
  });

  it('파트 밖 좌표는 걸러진다', () => {
    const game = makeGame();
    const slot = game.slots[0];
    expect(
      issuesOf(
        makeGame({
          slots: [
            {
              ...slot,
              placements: [
                {
                  partId: 'board',
                  mode: 'text',
                  xMm: 400,
                  yMm: 10,
                  fontSizeMm: 5,
                },
              ],
            },
          ],
        }),
      ),
    ).toContain('밖이다');
  });

  it('슬롯 종류에 맞지 않는 배치 방식은 걸러진다', () => {
    const game = makeGame();
    const slot = game.slots[0];
    expect(
      issuesOf(
        makeGame({
          slots: [
            {
              ...slot,
              placements: [{ partId: 'board', mode: 'paint', layerId: 'pc-x' }],
            },
          ],
        }),
      ),
    ).toContain("text 슬롯에는 'paint' 배치를 쓸 수 없다");
  });

  it('마커 배치가 둘이면 걸러진다 — 두 파트에서 동시에 옮길 수는 없다', () => {
    const game = makeGameWithMarkers();
    const piece = game.slots.find((s) => s.id === 'red-piece-1')!;
    const marker = piece.placements[0];
    expect(
      issuesOf(
        makeGameWithMarkers({
          slots: game.slots.map((s) =>
            s.id === 'red-piece-1' ? { ...s, placements: [marker, marker] } : s,
          ),
        }),
      ),
    ).toContain('마커 배치는 슬롯당 하나여야 한다');
  });

  it('기본값이 제약을 어기면 걸러진다', () => {
    const headline = slotOf(makeGame(), 'headline', 'text');
    expect(
      issuesOf(
        makeGame({
          slots: [{ ...headline, maxLength: 2, default: '너무긴제목' }],
        }),
      ),
    ).toContain('기본값이 maxLength(2)를 넘는다');

    const withMarkers = makeGameWithMarkers();
    const piece = slotOf(withMarkers, 'red-piece-1', 'number');
    expect(
      issuesOf(
        makeGameWithMarkers({
          slots: withMarkers.slots.map((s) =>
            s.id === 'red-piece-1' ? { ...piece, default: 100 } : s,
          ),
        }),
      ),
    ).toContain('기본값 100이 1–99 범위 밖이다');
  });

  it('없는 영역이나 영역 밖 기본 좌표는 걸러진다', () => {
    const game = makeGameWithMarkers();
    const swap = (patch: Record<string, unknown>) =>
      makeGameWithMarkers({
        slots: game.slots.map((s) =>
          s.id === 'red-piece-1'
            ? { ...s, placements: [{ ...s.placements[0], ...patch }] }
            : s,
        ),
      });

    expect(issuesOf(swap({ regionId: 'nowhere' }))).toContain(
      '없는 영역을 가리킨다: nowhere',
    );
    expect(issuesOf(swap({ xMm: 5, yMm: 5 }))).toContain(
      "영역 'play-area' 밖이다",
    );
  });
});

describe('파트', () => {
  it('인쇄 방향이 치수와 어긋나면 걸러진다', () => {
    const game = makeGame();
    expect(
      issuesOf(
        makeGame({ parts: [{ ...game.parts[0], orientation: 'landscape' }] }),
      ),
    ).toContain('인쇄 방향이 치수와 어긋난다');
  });

  it('보드 파트가 1개가 아니면 걸러진다', () => {
    const game = makeGame();
    expect(issuesOf(makeGame({ parts: [] }))).toMatch(/at least 1|Too small/i);
    expect(
      issuesOf(
        makeGame({
          parts: [game.parts[0], { ...game.parts[0], id: 'board-2' }],
        }),
      ),
    ).toContain('보드 파트는 정확히 1개여야 한다 (현재 2개)');
  });

  it('파트 종류에 맞는 표시가 없으면 걸러진다', () => {
    const game = makeGame();
    const board = game.parts[0];
    expect(
      issuesOf(makeGame({ parts: [{ ...board, marks: ['cut'] }] })),
    ).toContain('보드 파트에는 오림선·접는선·풀칠면을 두지 않는다');
    expect(
      issuesOf(
        makeGame({
          parts: [board, { ...board, id: 'pieces', kind: 'cutout', marks: [] }],
        }),
      ),
    ).toContain("오림용 부속은 marks에 'cut'이 있어야 한다");
    expect(
      issuesOf(
        makeGame({
          parts: [
            board,
            { ...board, id: 'goal', kind: 'buildable', marks: ['cut'] },
          ],
        }),
      ),
    ).toContain('조립물은 접는선');
  });

  it('배율 범위가 뒤집히거나 기본 배율이 범위 밖이면 걸러진다', () => {
    const board = makeGame().parts[0];
    expect(
      issuesOf(makeGame({ parts: [{ ...board, minScale: 2, maxScale: 1 }] })),
    ).toContain('minScale(2)이 maxScale(1)보다 크다');
    expect(
      issuesOf(makeGame({ parts: [{ ...board, defaultScale: 9 }] })),
    ).toContain('범위 밖이다');
  });

  it('파트 밖으로 나가는 영역은 걸러진다', () => {
    const board = makeGame().parts[0];
    expect(
      issuesOf(
        makeGame({
          parts: [
            {
              ...board,
              regions: [
                {
                  id: 'too-big',
                  label: '큰 영역',
                  rect: { xMm: 0, yMm: 0, widthMm: 300, heightMm: 300 },
                },
              ],
            },
          ],
        }),
      ),
    ).toContain('밖으로 나간다');
  });

  it('파트에 없는 속성을 적으면 걸러진다 — 오타가 조용히 무시되지 않는다', () => {
    const board = makeGame().parts[0];
    expect(
      issuesOf(
        makeGame({ parts: [{ ...board, orientaion: 'portrait' } as never] }),
      ),
    ).toMatch(/orientaion|Unrecognized/i);
  });
});

describe('마커 스타일 세트', () => {
  it('변형이 둘 이상인데 고를 슬롯이 없으면 걸러진다', () => {
    const game = makeGameWithMarkers();
    expect(
      issuesOf(
        makeGameWithMarkers({
          styleSets: [
            {
              ...game.styleSets![0],
              variants: [
                ...game.styleSets![0].variants,
                {
                  id: 'star',
                  label: '별',
                  widthMm: 12,
                  heightMm: 12,
                  valueFontSizeMm: 4,
                },
              ],
            },
          ],
        }),
      ),
    ).toContain('사용자가 고를 슬롯');
  });

  it('선택지와 변형 목록이 어긋나면 걸러진다', () => {
    const game = makeGameWithMarkers();
    expect(
      issuesOf(
        makeGameWithMarkers({
          styleSets: [
            {
              ...game.styleSets![0],
              selectorSlotId: 'piece-style',
              variants: [
                ...game.styleSets![0].variants,
                {
                  id: 'star',
                  label: '별',
                  widthMm: 12,
                  heightMm: 12,
                  valueFontSizeMm: 4,
                },
              ],
            },
          ],
          slots: [
            ...game.slots,
            {
              id: 'piece-style',
              kind: 'choice',
              label: '말 모양',
              options: [
                { value: 'dot', label: '점' },
                { value: 'square', label: '네모' },
              ],
              default: 'dot',
              placements: [{ partId: 'board', mode: 'control' }],
            },
          ],
        }),
      ),
    ).toContain('변형 목록');
  });
});

describe('그룹', () => {
  it('그룹이 가리키는 슬롯의 종류가 다르면 걸러진다', () => {
    const game = makeGameWithMarkers();
    expect(
      issuesOf(
        makeGameWithMarkers({
          groups: [{ ...game.groups![0], nameSlotId: 'red-color' }],
        }),
      ),
    ).toContain('text 슬롯이어야 한다');
  });

  it('없는 그룹을 가리키는 슬롯은 걸러진다', () => {
    const game = makeGameWithMarkers();
    expect(
      issuesOf(
        makeGameWithMarkers({
          slots: game.slots.map((s) =>
            s.id === 'red-name' ? { ...s, groupId: 'blue' } : s,
          ),
        }),
      ),
    ).toContain('없는 그룹을 가리킨다: blue');
  });
});

describe('배치 프리셋', () => {
  const game = makeGameWithMarkers();
  const preset = game.presets![0];
  const withPreset = (patch: Partial<typeof preset>) =>
    makeGameWithMarkers({ presets: [{ ...preset, ...patch }] });

  it('좌표가 영역을 벗어나면 걸러진다', () => {
    expect(
      issuesOf(
        withPreset({
          positions: [
            { slotId: 'red-piece-1', xMm: 205, yMm: 100 },
            { slotId: 'red-piece-2', xMm: 160, yMm: 100 },
          ],
        }),
      ),
    ).toContain("영역 'play-area' 밖이다");
  });

  it('그룹의 슬롯이 빠지면 걸러진다', () => {
    expect(
      issuesOf(
        withPreset({
          positions: [{ slotId: 'red-piece-1', xMm: 40, yMm: 100 }],
        }),
      ),
    ).toContain('프리셋에 빠진 슬롯이 있다: red-piece-2');
  });

  it('같은 슬롯을 두 번 배치하면 걸러진다', () => {
    expect(
      issuesOf(
        withPreset({
          positions: [
            { slotId: 'red-piece-1', xMm: 40, yMm: 100 },
            { slotId: 'red-piece-1', xMm: 60, yMm: 100 },
            { slotId: 'red-piece-2', xMm: 160, yMm: 100 },
          ],
        }),
      ),
    ).toContain('슬롯이 중복 배치됐다');
  });

  it('마커가 서로 겹치면 걸러진다', () => {
    expect(
      issuesOf(
        withPreset({
          positions: [
            { slotId: 'red-piece-1', xMm: 100, yMm: 100 },
            { slotId: 'red-piece-2', xMm: 105, yMm: 100 },
          ],
        }),
      ),
    ).toContain('마커가 겹친다');
  });

  it('위치를 갖지 않는 슬롯은 프리셋에 넣을 수 없다', () => {
    expect(
      issuesOf(
        withPreset({
          positions: [
            { slotId: 'red-name', xMm: 40, yMm: 100 },
            { slotId: 'red-piece-1', xMm: 40, yMm: 140 },
            { slotId: 'red-piece-2', xMm: 160, yMm: 100 },
          ],
        }),
      ),
    ).toContain("'red-name'는 위치를 가진 슬롯이 아니다");
  });
});

describe('자산 경로', () => {
  it('다른 게임 폴더를 가리키면 걸러진다', () => {
    expect(
      issuesOf(makeGame({ thumbnail: '/games/other/thumb.png' })),
    ).toContain('자산 경로가 다른 게임을 가리킨다');
  });

  it('public/games 밖 경로는 형식에서 걸러진다', () => {
    expect(issuesOf(makeGame({ thumbnail: '/thumb.png' }))).toMatch(/games/);
  });
});

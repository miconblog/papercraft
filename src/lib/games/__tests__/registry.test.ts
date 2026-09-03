import { describe, expect, it } from 'vitest';
import { GAMES, gameIds, getGame } from '../registry';
import {
  applyPreset,
  defaultCustomization,
  parseGame,
  presetsByFormation,
  rectAround,
  rectsOverlap,
  resolveVariant,
  slotMarker,
  slotsOfPart,
  styleSetBounds,
  validateCustomization,
  type GameDefinition,
} from '@/lib/schema';
import soccerDefinition from '@/assets/games/soccer';

describe('등록소', () => {
  it('등록된 도안은 모두 규격을 통과한다 — 통과하지 못하면 이 모듈을 읽는 순간 터진다', () => {
    expect(GAMES.length).toBeGreaterThan(0);
    expect(gameIds()).toContain('soccer');
    expect(getGame('soccer')).toBeDefined();
    expect(getGame('없는게임')).toBeUndefined();
  });
});

const soccer: GameDefinition = getGame('soccer')!;

describe('축구 게임판 — 파트', () => {
  it('보드 · 오림용 부속 · 조립물로 나뉜다', () => {
    const kinds = soccer.parts.map((p) => p.kind);
    expect(kinds.filter((k) => k === 'board')).toHaveLength(1);
    expect(kinds).toContain('cutout');
    expect(kinds).toContain('buildable');
  });

  it('보드는 가로 방향이고 배율 100%에서 A4를 가로로 놓은 크기다', () => {
    const board = soccer.parts.find((p) => p.kind === 'board')!;
    expect(board.orientation).toBe('landscape');
    expect([board.widthMm, board.heightMm]).toEqual([297, 210]);
  });

  it('파트마다 선언된 방향이 실제 치수와 일치한다', () => {
    for (const part of soccer.parts) {
      const actual = part.widthMm >= part.heightMm ? 'landscape' : 'portrait';
      expect(part.orientation, `${part.id}`).toBe(actual);
    }
  });

  it('파트마다 따로 출력할 정보가 들어 있다 — 배율 범위와 기본 벌수', () => {
    for (const part of soccer.parts) {
      expect(part.minScale).toBeLessThanOrEqual(part.defaultScale);
      expect(part.defaultScale).toBeLessThanOrEqual(part.maxScale);
      expect(part.defaultCopies).toBeGreaterThanOrEqual(1);
    }
    // 잃어버리기 쉬운 공 마커는 처음부터 여벌을 뽑는다.
    expect(
      soccer.parts.find((p) => p.id === 'ball-markers')!.defaultCopies,
    ).toBeGreaterThan(1);
  });

  it('조립물에는 오림선과 접는선이, 오림용 부속에는 오림선이 선언돼 있다', () => {
    const goals = soccer.parts.find((p) => p.id === 'goals')!;
    expect(goals.marks).toContain('cut');
    expect(goals.marks.some((m) => m.startsWith('fold-'))).toBe(true);
    expect(goals.marks).toContain('glue');
    for (const part of soccer.parts.filter((p) => p.kind === 'cutout')) {
      expect(part.marks, part.id).toContain('cut');
    }
  });
});

describe('축구 게임판 — 슬롯', () => {
  it('선수 슬롯 22개가 모두 좌표를 갖는다', () => {
    const players = soccer.slots.filter((s) => s.id.includes('-player-'));
    expect(players).toHaveLength(22);
    for (const player of players) {
      const marker = slotMarker(player);
      expect(marker, player.id).toBeDefined();
      expect(marker!.partId).toBe('field');
    }
    expect(players.filter((s) => s.groupId === 'home')).toHaveLength(11);
    expect(players.filter((s) => s.groupId === 'away')).toHaveLength(11);
    expect(players.filter((s) => s.tags.includes('goalkeeper'))).toHaveLength(
      2,
    );
  });

  it('팀 이름 슬롯 하나가 보드와 점수 기록칸 양쪽에 나온다', () => {
    const homeName = soccer.slots.find((s) => s.id === 'home-name')!;
    expect(homeName.placements.map((p) => p.partId).sort()).toEqual([
      'field',
      'score-sheet',
    ]);
    expect(slotsOfPart(soccer, 'score-sheet').map((s) => s.id)).toContain(
      'home-name',
    );
  });

  it('팀 색은 파트의 레이어에 칠해진다', () => {
    const color = soccer.slots.find((s) => s.id === 'home-color')!;
    expect(color.kind).toBe('color');
    expect(color.placements.every((p) => p.mode === 'paint')).toBe(true);
  });

  it('그룹이 이름·색 슬롯을 가리킨다', () => {
    expect(soccer.groups.map((g) => g.id)).toEqual(['home', 'away']);
    for (const group of soccer.groups) {
      expect(group.nameSlotId).toBe(`${group.id}-name`);
      expect(group.colorSlotId).toBe(`${group.id}-color`);
    }
  });
});

describe('축구 게임판 — 마커 스타일', () => {
  it('원형과 일러스트 두 변형을 사용자가 고른다', () => {
    const set = soccer.styleSets.find((s) => s.id === 'player-marker')!;
    expect(set.variants.map((v) => v.id)).toEqual(['circle', 'illustration']);

    const customization = defaultCustomization(soccer);
    expect(resolveVariant(soccer, 'player-marker', customization).id).toBe(
      'circle',
    );

    customization.values['marker-style'] = 'illustration';
    expect(validateCustomization(soccer, customization)).toEqual([]);
    expect(resolveVariant(soccer, 'player-marker', customization).id).toBe(
      'illustration',
    );
  });
});

describe('축구 게임판 — 전술 대형 프리셋', () => {
  it('대형마다 홈·원정 프리셋이 있고 각각 11명을 배치한다', () => {
    const byFormation = presetsByFormation(soccer);
    expect([...byFormation.keys()].sort()).toEqual(['3-5-2', '4-4-2']);
    for (const [formation, presets] of byFormation) {
      expect(presets.map((p) => p.groupId).sort(), formation).toEqual([
        'away',
        'home',
      ]);
      for (const preset of presets) {
        expect(preset.positions, preset.id).toHaveLength(11);
      }
    }
  });

  it('원정 프리셋은 홈 좌표를 세로 중심선 기준으로 뒤집은 것이다', () => {
    const home = soccer.presets.find((p) => p.id === '4-4-2-home')!;
    const away = soccer.presets.find((p) => p.id === '4-4-2-away')!;
    for (const [i, pos] of home.positions.entries()) {
      expect(away.positions[i].xMm).toBe(297 - pos.xMm);
      expect(away.positions[i].yMm).toBe(pos.yMm);
    }
  });

  it('어떤 대형 조합을 골라도 22명이 필드 안에 있고 서로 겹치지 않는다', () => {
    const homePresets = soccer.presets.filter((p) => p.groupId === 'home');
    const awayPresets = soccer.presets.filter((p) => p.groupId === 'away');
    const bounds = styleSetBounds(
      soccer.styleSets.find((s) => s.id === 'player-marker')!,
    );

    for (const home of homePresets) {
      for (const away of awayPresets) {
        const applied = applyPreset(
          soccer,
          applyPreset(soccer, defaultCustomization(soccer), home.id),
          away.id,
        );
        expect(
          validateCustomization(soccer, applied),
          `${home.id} + ${away.id}`,
        ).toEqual([]);

        const boxes = Object.entries(applied.positions).map(
          ([slotId, point]) => ({
            slotId,
            rect: rectAround(
              point.xMm,
              point.yMm,
              bounds.widthMm,
              bounds.heightMm,
            ),
          }),
        );
        for (let a = 0; a < boxes.length; a += 1) {
          for (let b = a + 1; b < boxes.length; b += 1) {
            expect(
              rectsOverlap(boxes[a].rect, boxes[b].rect),
              `${home.id} + ${away.id}: ${boxes[a].slotId} · ${boxes[b].slotId}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('프리셋 좌표가 필드 밖으로 나가면 검증에서 걸러진다', () => {
    const broken = structuredClone(soccerDefinition);
    const preset = broken.presets!.find((p) => p.id === '4-4-2-home')!;
    preset.positions[0] = { ...preset.positions[0], xMm: 320 };
    expect(() => parseGame(broken)).toThrow(/영역 'playable-field' 밖이다/);
  });
});

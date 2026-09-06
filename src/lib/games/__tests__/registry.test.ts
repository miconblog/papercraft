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
    // 골대는 양쪽에 하나씩 필요하지만 전개도 한 장에 두 벌이 들어 있다 —
    // 그래서 기본 벌 수가 1이다.
    expect(soccer.parts.find((p) => p.id === 'goals')!.defaultCopies).toBe(1);
  });

  it('조립물에는 오림선과 접는선이, 오림용 부속에는 오림선이 선언돼 있다', () => {
    const goals = soccer.parts.find((p) => p.id === 'goals')!;
    expect(goals.marks).toContain('cut');
    expect(goals.marks.some((m) => m.startsWith('fold-'))).toBe(true);
    // 지붕 탭을 옆벽에 붙여야 상자 모양이 유지된다. 선언은 실제로 그리는 표시와
    // 같아야 한다 — 어긋나면 조립 안내에 있지도 않은 표시 설명이 따라 나온다.
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

  it('팀 이름 슬롯이 없다 — 점수 기록칸의 팀 칸은 아이가 직접 쓴다', () => {
    // 2026-09-06 사용자 요청("팀 이름 입력칸도 필요없어"). 등번호와 같은 이유다.
    expect(soccer.slots.find((s) => s.id.endsWith('-name'))).toBeUndefined();
  });

  it('팀 색은 마커 테두리와 점수 기록칸 막대에 쓰인다', () => {
    const color = soccer.slots.find((s) => s.id === 'home-color')!;
    expect(color.kind).toBe('color');
    // 점수 기록칸에는 `paint` 배치로 간다. 마커 색은 배치가 아니라 그룹의
    // `colorSlotId`를 통해 렌더러가 읽어 간다 — 마커는 파트 레이어가 아니라
    // 슬롯마다 따로 그려지기 때문이다.
    expect(color.placements.every((p) => p.mode === 'paint')).toBe(true);
    expect(color.placements.map((p) => p.partId)).toEqual(['score-sheet']);
  });

  it('속을 비우는 변형만 채우지 않는다고 선언한다 — 등번호 색이 여기서 갈린다', () => {
    // 자세마다 세트가 하나씩이라(2026-09-06) 규칙은 세트 전부에 걸린다.
    for (const set of soccer.styleSets) {
      const filledOf = (id: string) =>
        set.variants.find((v) => v.id === id)!.filled;
      expect(filledOf('circle'), set.id).toBe(false);
      // 실루엣만 팀 색으로 꽉 찬다 — 등번호를 반전해야 읽힌다.
      expect(filledOf('illustration'), set.id).toBe(true);
      // 윤곽선은 아이가 칠할 흰 면이 남는다 — 빈 원과 같은 규칙이다.
      expect(filledOf('outline'), set.id).toBe(false);
    }
  });

  it('그룹이 색 슬롯을 가리키고 이름 슬롯은 없다', () => {
    expect(soccer.groups.map((g) => g.id)).toEqual(['home', 'away']);
    for (const group of soccer.groups) {
      expect(group.nameSlotId).toBeUndefined();
      expect(group.colorSlotId).toBe(`${group.id}-color`);
    }
  });
});

describe('축구 게임판 — 마커 스타일', () => {
  it('빈 원·선수 그림·색칠용 세 변형을 사용자가 고르고, 고른 값이 모든 자세에 걸린다', () => {
    // 세트는 자세라 사용자가 고르지 않는다. 고르는 것은 변형이고, 슬롯 하나가
    // 스물두 명을 한꺼번에 바꾼다.
    const setIds = soccer.styleSets.map((s) => s.id);
    expect(setIds.length).toBeGreaterThan(2);

    const customization = defaultCustomization(soccer);
    for (const setId of setIds) {
      expect(resolveVariant(soccer, setId, customization).id, setId).toBe(
        'circle',
      );
    }

    for (const variantId of ['illustration', 'outline']) {
      customization.values['marker-style'] = variantId;
      expect(validateCustomization(soccer, customization)).toEqual([]);
      for (const setId of setIds) {
        expect(
          resolveVariant(soccer, setId, customization).id,
          `${setId}/${variantId}`,
        ).toBe(variantId);
      }
    }
  });
});

describe('축구 게임판 — 전술 대형 프리셋', () => {
  it('대형마다 홈·원정 프리셋이 있고 각각 11명을 배치한다', () => {
    const byFormation = presetsByFormation(soccer);
    expect([...byFormation.keys()].sort()).toEqual([
      '3-5-2',
      '4-2-3-1',
      '4-3-3',
      '4-4-2',
    ]);
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
    // 세트가 자세마다 있지만 크기는 전부 같다(`player-markers.test.ts`가 지킨다).
    const bounds = styleSetBounds(soccer.styleSets[0]);

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

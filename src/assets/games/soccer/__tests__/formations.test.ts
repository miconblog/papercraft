/**
 * 전술 대형이 **경기가 되는 배치**인지 (IDE-010)
 *
 * 처음에는 두 팀을 각자 진영 절반에 세웠는데 그러면 경기를 할 수 없었다.
 * 선수 마커는 운동장에 인쇄되어 움직이지 않고, 규칙은 패스가 자기 팀 선수에게
 * 닿아야 이어지고 슛도 공이 자기 팀 선수 위에 있을 때만 되게 되어 있다 —
 * 상대 골대 쪽에 자기 팀 선수가 하나도 없으면 공을 앞으로 보낼 방법이 없다.
 *
 * 여기 있는 것은 "도안이 스키마를 만족하는가"가 아니라 **"이 배치로 놀 수
 * 있는가"**를 지키는 테스트다. 좌표를 손볼 때 이 조건들이 먼저 깨진다.
 */
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { parseGame, type GameDefinition } from '@/lib/schema';
import {
  BOARD,
  FIELD,
  FIELD_CENTER_X_MM,
  FIELD_MARKS,
  GOAL,
  FORMATION_LANES,
  PLAYER_MARKER,
} from '../dimensions';

/** 등록소를 거친 것으로 본다 — 검증을 통과한 도안이 실제로 쓰이는 모습이다. */
const soccer = getGame('soccer') as GameDefinition;

const formationIds = [...new Set(soccer.presets.map((p) => p.formationId!))];

const presetOf = (formationId: string, groupId: string) =>
  soccer.presets.find(
    (p) => p.formationId === formationId && p.groupId === groupId,
  )!;

/** 마커가 차지하는 폭 — 겹침 판정에 쓰는 가장 큰 변형 기준이다. */
const MARKER_W = Math.max(
  PLAYER_MARKER.circle.widthMm,
  PLAYER_MARKER.illustration.widthMm,
);

const homeGoalRightXMm = FIELD.xMm + GOAL.depthMm;
const awayGoalLeftXMm = FIELD.xMm + FIELD.widthMm - GOAL.depthMm;

describe('두 팀이 섞여 선다 — 경기 성립 조건', () => {
  it.each(formationIds)('%s · 홈 팀이 상대 진영에도 선수를 둔다', (id) => {
    const forwards = presetOf(id, 'home').positions.filter(
      (p) => p.xMm > FIELD_CENTER_X_MM,
    );
    // 상대 진영에 받아 줄 선수가 없으면 공을 앞으로 보낼 수 없다.
    expect(forwards.length).toBeGreaterThanOrEqual(1);
  });

  it.each(formationIds)('%s · 원정 팀이 상대 진영에도 선수를 둔다', (id) => {
    const forwards = presetOf(id, 'away').positions.filter(
      (p) => p.xMm < FIELD_CENTER_X_MM,
    );
    expect(forwards.length).toBeGreaterThanOrEqual(1);
  });

  it.each(formationIds)(
    '%s · 최전방이 상대 골대에 닿을 만한 거리에 있다',
    (id) => {
      const home = presetOf(id, 'home').positions;
      const furthest = Math.max(...home.map((p) => p.xMm));
      // 예전 배치는 최전방이 x=130이라 골대까지 143mm였다 — 한 번에 튕겨 넣을 수
      // 없는 거리다. 필드 길이의 1/3 안으로 들어와야 슛이 성립한다.
      expect(awayGoalLeftXMm - furthest).toBeLessThan(FIELD.widthMm / 3);
    },
  );

  it('골키퍼는 골대 자리를 비켜선다 — 종이 골대를 세울 자리다', () => {
    for (const id of formationIds) {
      const homeGk = presetOf(id, 'home').positions.find(
        (p) => p.slotId === 'home-player-1',
      )!;
      const awayGk = presetOf(id, 'away').positions.find(
        (p) => p.slotId === 'away-player-1',
      )!;
      expect(homeGk.xMm - MARKER_W / 2).toBeGreaterThan(homeGoalRightXMm);
      expect(awayGk.xMm + MARKER_W / 2).toBeLessThan(awayGoalLeftXMm);
    }
  });

  /**
   * 골대를 세우고 나면 골키퍼가 설 수 있는 자리는 골대 앞뿐이다. 그 자리가
   * 골 에어리어 **안**이어야 골키퍼가 제 구역에 선 것으로 보인다 — 골 에어리어
   * 깊이가 골대 깊이 + 마커 폭보다 얕으면 둘 다 만족할 수 없다.
   */
  it('골키퍼가 골 에어리어 안에 온전히 들어간다', () => {
    const goalAreaRightXMm = FIELD.xMm + FIELD_MARKS.goalAreaDepthMm;
    const goalAreaLeftXMm =
      FIELD.xMm + FIELD.widthMm - FIELD_MARKS.goalAreaDepthMm;
    const halfHeightMm =
      Math.max(
        PLAYER_MARKER.circle.heightMm,
        PLAYER_MARKER.illustration.heightMm,
      ) / 2;
    const goalAreaTopYMm =
      FIELD.yMm + FIELD.heightMm / 2 - FIELD_MARKS.goalAreaWidthMm / 2;
    const goalAreaBottomYMm =
      FIELD.yMm + FIELD.heightMm / 2 + FIELD_MARKS.goalAreaWidthMm / 2;

    for (const id of formationIds) {
      const homeGk = presetOf(id, 'home').positions.find(
        (p) => p.slotId === 'home-player-1',
      )!;
      const awayGk = presetOf(id, 'away').positions.find(
        (p) => p.slotId === 'away-player-1',
      )!;
      expect(homeGk.xMm + MARKER_W / 2, `${id} 홈 골키퍼`).toBeLessThanOrEqual(
        goalAreaRightXMm,
      );
      expect(
        awayGk.xMm - MARKER_W / 2,
        `${id} 원정 골키퍼`,
      ).toBeGreaterThanOrEqual(goalAreaLeftXMm);
      for (const gk of [homeGk, awayGk]) {
        expect(gk.yMm - halfHeightMm).toBeGreaterThanOrEqual(goalAreaTopYMm);
        expect(gk.yMm + halfHeightMm).toBeLessThanOrEqual(goalAreaBottomYMm);
      }
    }
  });

  /**
   * 골키퍼를 뺀 10명이 운동장 1/3마다 흩어져 있어야 한다.
   *
   * 선수가 한 구역에 몰리면 그 구역 밖에서는 패스를 받아 줄 사람이 없어 공이
   * 앞으로 나가지 못한다. 4-2-3-1의 공격형 미드필더가 중원에 서던 때는 상대
   * 진영에 공격수 한 명만 남아 다른 대형보다 앞이 헐거웠다.
   */
  it.each(formationIds)('%s · 골키퍼를 뺀 10명이 1/3마다 흩어져 있다', (id) => {
    const thirdMm = FIELD.widthMm / 3;
    for (const groupId of ['home', 'away']) {
      const positions = presetOf(id, groupId).positions.filter(
        (p) => !p.slotId.endsWith('-player-1'),
      );
      expect(positions).toHaveLength(10);
      const counts = [0, 0, 0];
      for (const pos of positions) {
        const index = Math.min(2, Math.floor((pos.xMm - FIELD.xMm) / thirdMm));
        counts[index] += 1;
      }
      for (const [index, count] of counts.entries()) {
        expect(
          count,
          `${id} ${groupId}의 ${index + 1}번째 1/3`,
        ).toBeGreaterThanOrEqual(2);
      }
      expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
    }
  });
});

describe('레인', () => {
  it('모든 대형이 정해진 다섯 레인만 쓴다', () => {
    const lanes = new Set<number>(Object.values(FORMATION_LANES));
    for (const id of formationIds) {
      for (const pos of presetOf(id, 'home').positions) {
        expect(lanes.has(pos.xMm), `${id} · ${pos.slotId} x=${pos.xMm}`).toBe(
          true,
        );
      }
    }
  });

  /**
   * 이 간격이 "두 팀이 어떤 대형 조합을 골라도 마커가 겹치지 않는다"의 근거다.
   * 레인만 지키면 y를 어떻게 잡든 안전하므로 대형을 늘릴 때 조합을 다시
   * 따지지 않아도 된다.
   */
  it('홈 레인과 원정 레인이 마커 폭보다 넉넉히 떨어져 있다', () => {
    const home = Object.values(FORMATION_LANES);
    const away = home.map((x) => BOARD.widthMm - x);
    const all = [...home, ...away].sort((a, b) => a - b);
    const gaps = all.slice(1).map((x, i) => x - all[i]);
    expect(Math.min(...gaps)).toBeGreaterThan(MARKER_W);
  });

  it('모든 좌표가 필드 안이다', () => {
    for (const id of formationIds) {
      for (const group of ['home', 'away']) {
        for (const pos of presetOf(id, group).positions) {
          expect(pos.xMm).toBeGreaterThanOrEqual(FIELD.xMm);
          expect(pos.xMm).toBeLessThanOrEqual(FIELD.xMm + FIELD.widthMm);
          expect(pos.yMm).toBeGreaterThanOrEqual(FIELD.yMm);
          expect(pos.yMm).toBeLessThanOrEqual(FIELD.yMm + FIELD.heightMm);
        }
      }
    }
  });
});

describe('팀 구분', () => {
  it('원정 마커는 뒤집어 그린다 — 섞여 서면 위치로는 팀을 알 수 없다', () => {
    const home = soccer.groups.find((g) => g.id === 'home')!;
    const away = soccer.groups.find((g) => g.id === 'away')!;
    expect(home.mirrorMarkers).toBe(false);
    expect(away.mirrorMarkers).toBe(true);
  });
});

describe('검증이 이 배치를 지킨다', () => {
  it('두 팀 마커가 겹치는 대형은 도안 검증이 걸러낸다', () => {
    // 원정 대형을 홈과 같은 레인에 올려 놓는다 — 사람이 좌표를 손보다 저지를
    // 수 있는 실수다. 프리셋 하나 안의 겹침만 보던 옛 검증은 이것을 놓쳤다.
    const collided = {
      ...soccer,
      presets: soccer.presets.map((preset) =>
        preset.groupId === 'away'
          ? {
              ...preset,
              positions: preset.positions.map((pos) => ({
                ...pos,
                xMm: BOARD.widthMm - pos.xMm,
              })),
            }
          : preset,
      ),
    };
    expect(() => parseGame(collided)).toThrow(
      /다른 그룹의 프리셋과 마커가 겹친다/,
    );
  });

  it('지금 도안은 그 검증을 통과한다', () => {
    expect(() => parseGame(soccer)).not.toThrow();
  });
});

/**
 * 전술 대형이 **판에 맞는 배치**인지 (IDE-010)
 *
 * 골키퍼를 뺀 열 명이 자기 진영에 다섯, 상대 진영에 다섯 선다(2026-09-06 사용자
 * 요청). 여기 있는 것은 "도안이 스키마를 만족하는가"가 아니라 **"이 배치가
 * 판의 약속을 지키는가"**를 지키는 테스트다 — 반반이 맞는지, 마커가 하프라인을
 * 물지 않는지, 골키퍼가 골 에어리어에 서는지. 좌표를 손볼 때 이 조건들이 먼저
 * 깨진다.
 */
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { parseGame, type GameDefinition } from '@/lib/schema';
import {
  BOARD,
  FIELD,
  FIELD_CENTER_X_MM,
  FIELD_RIGHT_MM,
  FIELD_MARKS,
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

/**
 * 골대는 골라인 **위**에 선다(2026-09-05). 필드 안으로 들어오는 깊이가 없으므로
 * 골라인이 곧 골대 자리이고, 슛 사거리도 골라인까지로 잰다.
 */
const homeGoalXMm = FIELD.xMm;
const awayGoalXMm = FIELD_RIGHT_MM;

describe('골키퍼를 뺀 열 명이 반반으로 선다', () => {
  const outfield = (id: string, groupId: string) =>
    presetOf(id, groupId).positions.filter(
      (p) => !p.slotId.endsWith('-player-1'),
    );

  it.each(formationIds)('%s · 홈은 자기 진영 다섯, 상대 진영 다섯', (id) => {
    const own = outfield(id, 'home').filter((p) => p.xMm < FIELD_CENTER_X_MM);
    expect(own).toHaveLength(5);
  });

  it.each(formationIds)('%s · 원정도 자기 진영 다섯, 상대 진영 다섯', (id) => {
    const own = outfield(id, 'away').filter((p) => p.xMm > FIELD_CENTER_X_MM);
    expect(own).toHaveLength(5);
  });

  it.each(formationIds)('%s · 어느 마커도 하프라인을 물지 않는다', (id) => {
    for (const groupId of ['home', 'away']) {
      for (const pos of presetOf(id, groupId).positions) {
        const left = pos.xMm - MARKER_W / 2;
        const right = pos.xMm + MARKER_W / 2;
        expect(
          left >= FIELD_CENTER_X_MM || right <= FIELD_CENTER_X_MM,
          `${groupId} ${pos.slotId}`,
        ).toBe(true);
      }
    }
  });

  it.each(formationIds)('%s · 골키퍼는 자기 골문 앞이다', (id) => {
    const homeGk = presetOf(id, 'home').positions[0];
    const awayGk = presetOf(id, 'away').positions[0];
    expect(homeGk.xMm).toBeLessThan(FIELD_CENTER_X_MM);
    expect(awayGk.xMm).toBeGreaterThan(FIELD_CENTER_X_MM);
  });

  it('골키퍼가 골라인을 넘지 않는다 — 골대가 서는 자리다', () => {
    for (const id of formationIds) {
      const homeGk = presetOf(id, 'home').positions.find(
        (p) => p.slotId === 'home-player-1',
      )!;
      const awayGk = presetOf(id, 'away').positions.find(
        (p) => p.slotId === 'away-player-1',
      )!;
      expect(homeGk.xMm - MARKER_W / 2).toBeGreaterThanOrEqual(homeGoalXMm);
      expect(awayGk.xMm + MARKER_W / 2).toBeLessThanOrEqual(awayGoalXMm);
    }
  });

  /**
   * 골키퍼는 골문 앞에 서고 그 자리가 골 에어리어 **안**이어야 제 구역에 선
   * 것으로 보인다. 골대가 필드 안을 차지하던 때는 그 깊이를 피하느라 골
   * 에어리어를 실제의 2배로 늘려야 했다 — 지금은 실제 축척(16mm)으로 되돌렸고,
   * 마커 폭 절반을 더한 20.5mm가 그 안에 들어가는지를 여기서 지킨다.
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
   * 골키퍼를 뺀 10명이 한 줄에 몰리지 않는다 — 수비·중원·공격 세 줄이 있어야
   * 자기 진영 안에서 패스를 이어 갈 수 있다.
   */
  it.each(formationIds)('%s · 골키퍼를 뺀 10명이 세 줄 이상에 선다', (id) => {
    for (const groupId of ['home', 'away']) {
      const positions = presetOf(id, groupId).positions.filter(
        (p) => !p.slotId.endsWith('-player-1'),
      );
      expect(positions).toHaveLength(10);
      const lanes = new Set(positions.map((p) => p.xMm));
      expect(lanes.size, `${id} ${groupId}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('레인', () => {
  it('모든 대형이 정해진 여섯 레인만 쓴다', () => {
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

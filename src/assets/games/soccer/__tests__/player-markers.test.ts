/**
 * 선수 마커 아트워크 검증 (IDE-010)
 *
 * 이 이슈의 수용 기준 중 종이 없이 확인할 수 있는 것을 여기서 강제한다.
 * 실제로 인쇄해 흑백으로 뽑아 보는 것은 `IDE-010`에 ⚠︎로 남아 있다 — 프린터가
 * 없는 사유는 `IDE-002`와 같다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games/registry';
import { slotMarker } from '@/lib/schema';
import { ARTWORK } from '../artwork';
import { attackWedgePoints } from '../artwork/player-markers';
import { PLAYER_MARKER } from '../dimensions';

const game = getGame('soccer')!;

const MARKER_ARTWORK_IDS = [
  'player-marker-circle',
  'player-marker-illustration',
  'goalkeeper-marker-circle',
  'goalkeeper-marker-illustration',
] as const;

const svgOf = (id: string): Document =>
  new DOMParser().parseFromString(ARTWORK[id](), 'image/svg+xml');

describe('마커 스타일 세트', () => {
  it('필드 선수·골키퍼가 스타일 세트를 따로 쓰고, 원형·일러스트 크기는 세트 간에 같다', () => {
    const player = game.styleSets.find((s) => s.id === 'player-marker')!;
    const goalkeeper = game.styleSets.find(
      (s) => s.id === 'goalkeeper-marker',
    )!;
    expect(player.variants.map((v) => v.id)).toEqual([
      'circle',
      'illustration',
    ]);
    expect(goalkeeper.variants.map((v) => v.id)).toEqual([
      'circle',
      'illustration',
    ]);

    for (const variantId of ['circle', 'illustration'] as const) {
      const a = player.variants.find((v) => v.id === variantId)!;
      const b = goalkeeper.variants.find((v) => v.id === variantId)!;
      expect(a.widthMm, variantId).toBe(b.widthMm);
      expect(a.heightMm, variantId).toBe(b.heightMm);
    }
  });

  it('두 세트 다 같은 선택 슬롯(marker-style)을 쓴다 — 하나를 고르면 필드 선수와 골키퍼가 같이 바뀐다', () => {
    const sets = game.styleSets.filter((s) =>
      ['player-marker', 'goalkeeper-marker'].includes(s.id),
    );
    for (const set of sets) {
      expect(set.selectorSlotId, set.id).toBe('marker-style');
    }
  });

  it('골키퍼 슬롯만 goalkeeper-marker를, 나머지는 player-marker를 쓴다', () => {
    const players = game.slots.filter((s) => s.id.includes('-player-'));
    for (const slot of players) {
      const marker = slotMarker(slot)!;
      const expected = slot.tags.includes('goalkeeper')
        ? 'goalkeeper-marker'
        : 'player-marker';
      expect(marker.styleSetId, slot.id).toBe(expected);
    }
  });
});

describe('마커 아트워크', () => {
  it('네 파일 모두 커밋된 SVG가 생성기와 같다', () => {
    for (const id of MARKER_ARTWORK_IDS) {
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'soccer', `${id}.svg`),
        'utf8',
      );
      expect(committed, `${id}.svg가 낡았다 — npm run artwork를 돌린다`).toBe(
        ARTWORK[id](),
      );
    }
  });

  it('SVG 치수가 스타일 세트에 선언한 크기와 같다', () => {
    for (const setId of ['player-marker', 'goalkeeper-marker']) {
      const set = game.styleSets.find((s) => s.id === setId)!;
      for (const variant of set.variants) {
        const id =
          setId === 'player-marker'
            ? `player-marker-${variant.id}`
            : `goalkeeper-marker-${variant.id}`;
        const root = svgOf(id).documentElement;
        expect(root.getAttribute('width'), id).toBe(`${variant.widthMm}mm`);
        expect(root.getAttribute('height'), id).toBe(`${variant.heightMm}mm`);
      }
    }
  });

  it('팀 색을 받을 레이어(pc-marker-fill)가 있고 비어 있지 않다', () => {
    for (const id of MARKER_ARTWORK_IDS) {
      const layer = svgOf(id).getElementById('pc-marker-fill');
      expect(layer, `${id}에 pc-marker-fill 레이어가 없다`).not.toBeNull();
      expect(layer!.children.length).toBeGreaterThan(0);
    }
  });

  it('아트워크가 등번호를 직접 그려 넣지 않는다 — 슬롯 값은 렌더러가 얹는다', () => {
    for (const id of MARKER_ARTWORK_IDS) {
      expect(svgOf(id).querySelectorAll('text')).toHaveLength(0);
    }
  });
});

describe('흑백에서 팀 구분 — 공격 방향 화살촉', () => {
  it('화살촉이 세로 중심선 기준 비대칭이다 — 좌우 반전하면 다른 모양이 된다', () => {
    const points = attackWedgePoints(6, 6, 4.6);
    // 대칭이라면 각 점의 반전(12 - x)이 점 집합 안에 그대로 있어야 한다.
    const mirrored = points.map(([x, y]) => [12 - x, y]);
    const isSameSet = mirrored.every((m) =>
      points.some((p) => Math.abs(p[0] - m[0]) < 1e-9 && p[1] === m[1]),
    );
    expect(isSameSet).toBe(false);
  });

  it('화살촉이 마커 폭 안에 들어간다 — 옆 마커와 겹치지 않는다', () => {
    for (const [cxMm, radiusMm] of [
      [PLAYER_MARKER.circle.widthMm / 2, 4.6],
    ] as const) {
      const points = attackWedgePoints(cxMm, cxMm, radiusMm);
      for (const [x] of points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(PLAYER_MARKER.circle.widthMm);
      }
    }
  });
});

describe('흑백에서 골키퍼 구분', () => {
  it('골키퍼 원형 마커는 필드 선수보다 원이 하나 더 있다 — 안쪽 테', () => {
    const player = svgOf('player-marker-circle').querySelectorAll('circle');
    const goalkeeper = svgOf('goalkeeper-marker-circle').querySelectorAll(
      'circle',
    );
    expect(goalkeeper.length).toBeGreaterThan(player.length);
  });
});

describe('등번호 가독성', () => {
  /** `docs/soccer-artwork.md` 6절과 같은 하한. */
  const LEGIBLE_MIN_MM = 2.5;

  it('필드 최소 배율(0.5)에서도 등번호가 2.5mm 위를 유지한다 — 두 세트 모두', () => {
    for (const setId of ['player-marker', 'goalkeeper-marker']) {
      const set = game.styleSets.find((s) => s.id === setId)!;
      const field = game.parts.find((p) => p.id === 'field')!;
      for (const variant of set.variants) {
        expect(
          variant.valueFontSizeMm * field.minScale,
          `${setId}/${variant.id}`,
        ).toBeGreaterThanOrEqual(LEGIBLE_MIN_MM);
      }
    }
  });
});

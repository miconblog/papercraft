/**
 * 선수 마커 아트워크 검증 (IDE-010)
 *
 * 이 이슈의 수용 기준 중 종이 없이 확인할 수 있는 것을 여기서 강제한다.
 * 실제로 인쇄해 흑백으로 뽑아 보는 것은 `IDE-010`에 ⚠︎로 남아 있다 — 프린터가
 * 없는 사유는 `IDE-002`와 같다.
 *
 * 자세가 여러 개가 된 뒤로는(2026-09-06) "자세를 더해도 판이 깨지지 않는가"가
 * 여기서 지켜야 할 것이다 — 그림이 마커 상자를 넘지 않는지, 자세가 좌우
 * 비대칭이라 방향이 읽히는지를 기하로 확인한다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games/registry';
import { slotMarker } from '@/lib/schema';
import { ARTWORK } from '../artwork';
import { attackWedgePoints } from '../artwork/player-markers';
import {
  GOALKEEPER_POSE,
  MARKER_POSES,
  markerArtworkId,
  PLAYER_MARKER,
  poseStyleSetId,
} from '../dimensions';

const game = getGame('soccer')!;

/** 자세 × 모양으로 나오는 선수 그림 파일. 빈 원 둘은 따로 붙인다. */
const FIGURE_ARTWORK_IDS = [...MARKER_POSES, GOALKEEPER_POSE].flatMap((pose) =>
  (['illustration', 'outline'] as const).map((mode) =>
    markerArtworkId(pose.id, mode),
  ),
);

const MARKER_ARTWORK_IDS = [
  'player-marker-circle',
  'goalkeeper-marker-circle',
  ...FIGURE_ARTWORK_IDS,
];

const MARKER_STYLE_SET_IDS = [...MARKER_POSES, GOALKEEPER_POSE].map((pose) =>
  poseStyleSetId(pose.id),
);

const svgOf = (id: string): Document =>
  new DOMParser().parseFromString(ARTWORK[id](), 'image/svg+xml');

/**
 * 도안 SVG에 찍힌 점을 전부 모은다 — `path`의 좌표쌍과 `circle`의 상하좌우
 * 끝점이다. 상자를 넘는지, 좌우 대칭인지를 이 목록으로 본다.
 */
const pointsOf = (id: string): Array<[number, number]> => {
  const doc = svgOf(id);
  const points: Array<[number, number]> = [];
  for (const node of doc.querySelectorAll('path')) {
    const nums = (node.getAttribute('d') ?? '')
      .split(/[^0-9.\-]+/)
      .filter((s) => s !== '')
      .map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      points.push([nums[i], nums[i + 1]]);
    }
  }
  for (const node of doc.querySelectorAll('circle')) {
    const cx = Number(node.getAttribute('cx'));
    const cy = Number(node.getAttribute('cy'));
    const r = Number(node.getAttribute('r'));
    points.push([cx - r, cy - r], [cx + r, cy + r]);
  }
  return points;
};

describe('마커 스타일 세트', () => {
  it('자세마다 세트가 하나씩이고, 세트가 달라도 변형 구성과 크기는 같다', () => {
    expect(game.styleSets.map((s) => s.id).sort()).toEqual(
      [...MARKER_STYLE_SET_IDS].sort(),
    );

    const reference = game.styleSets[0];
    for (const set of game.styleSets) {
      expect(
        set.variants.map((v) => v.id),
        set.id,
      ).toEqual(['circle', 'illustration', 'outline']);
      // 크기가 어긋나면 슬롯끼리 자세를 바꿔 끼울 때 겹침 판정이 달라진다.
      for (const [i, variant] of set.variants.entries()) {
        expect(variant.widthMm, `${set.id}/${variant.id}`).toBe(
          reference.variants[i].widthMm,
        );
        expect(variant.heightMm, `${set.id}/${variant.id}`).toBe(
          reference.variants[i].heightMm,
        );
      }
    }
  });

  it('모든 세트가 같은 선택 슬롯(marker-style)을 쓴다 — 하나를 고르면 스물두 명이 같이 바뀐다', () => {
    for (const set of game.styleSets) {
      expect(set.selectorSlotId, set.id).toBe('marker-style');
    }
  });

  it('골키퍼 슬롯만 골키퍼 세트를, 나머지는 자세 세트를 쓴다', () => {
    const players = game.slots.filter((s) => s.id.includes('-player-'));
    const fieldSetIds = MARKER_POSES.map((pose) => poseStyleSetId(pose.id));
    for (const slot of players) {
      const marker = slotMarker(slot)!;
      if (slot.tags.includes('goalkeeper')) {
        expect(marker.styleSetId, slot.id).toBe(
          poseStyleSetId(GOALKEEPER_POSE.id),
        );
      } else {
        expect(fieldSetIds, slot.id).toContain(marker.styleSetId);
      }
    }
  });

  it('한 팀 열한 명이 여러 자세로 선다 — 같은 그림이 줄지어 서지 않는다', () => {
    const home = game.slots.filter((s) => s.id.startsWith('home-player-'));
    expect(home).toHaveLength(11);
    const used = new Set(home.map((s) => slotMarker(s)!.styleSetId));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
});

describe('마커 아트워크', () => {
  it('커밋된 SVG가 모두 생성기와 같다', () => {
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
    for (const set of game.styleSets) {
      for (const variant of set.variants) {
        // 빈 원은 세트끼리 파일 하나를 나눠 쓴다 — 자세와 무관하기 때문이다.
        const id =
          variant.id === 'circle'
            ? set.id === poseStyleSetId(GOALKEEPER_POSE.id)
              ? 'goalkeeper-marker-circle'
              : 'player-marker-circle'
            : `${set.id}-${variant.id}`;
        const root = svgOf(id).documentElement;
        expect(root.getAttribute('width'), id).toBe(`${variant.widthMm}mm`);
        expect(root.getAttribute('height'), id).toBe(`${variant.heightMm}mm`);
      }
    }
  });

  /**
   * 파일 전부가 같은 레이어 id로 팀 색을 받는다. 렌더러가 이 id의 `fill`과
   * `stroke`를 둘 다 갈아 끼우므로(2026-09-05) 빈 원·윤곽선은 테두리로,
   * 실루엣은 채움으로 팀이 갈린다.
   */
  it('팀 색을 받는 레이어(pc-marker-team)가 있고 비어 있지 않다', () => {
    for (const id of MARKER_ARTWORK_IDS) {
      const layer = svgOf(id).getElementById('pc-marker-team');
      expect(layer, `${id}에 pc-marker-team 레이어가 없다`).not.toBeNull();
      expect(layer!.children.length, id).toBeGreaterThan(0);
    }
  });

  it('빈 원은 속을 흰색으로 못 박아 팀 색이 면을 덮지 않는다', () => {
    for (const id of ['player-marker-circle', 'goalkeeper-marker-circle']) {
      const doc = svgOf(id);
      const outer = doc.querySelector('circle')!;
      // 레이어의 채움을 물려받으면 아이가 칠할 면이 팀 색으로 메워진다.
      expect(outer.getAttribute('fill'), id).toBe('#ffffff');
      expect(
        Number(outer.getAttribute('stroke-width')),
        id,
      ).toBeGreaterThanOrEqual(0.6);
      // 테두리 색은 레이어가 준다 — 도형이 제 색을 박아 두면 팀 색이 안 먹는다.
      expect(outer.getAttribute('stroke'), id).toBeNull();
    }
  });

  it('실루엣은 채움으로, 윤곽선은 흰 속 + 테두리로 팀 색을 받는다', () => {
    for (const pose of [...MARKER_POSES, GOALKEEPER_POSE]) {
      const filled = svgOf(markerArtworkId(pose.id, 'illustration'));
      const filledLayer = filled.getElementById('pc-marker-team')!;
      expect(filledLayer.getAttribute('fill'), pose.id).not.toBe('none');
      // 실루엣은 색이 한 덩어리라 안쪽 경계가 보이면 안 된다.
      expect(filledLayer.getAttribute('stroke'), pose.id).toBe('none');

      const outline = svgOf(markerArtworkId(pose.id, 'outline'));
      const outlineLayer = outline.getElementById('pc-marker-team')!;
      expect(outlineLayer.getAttribute('stroke'), pose.id).not.toBe('none');
      for (const shape of outlineLayer.children) {
        // 속이 흰 종이로 남아야 아이가 칠할 면이 생긴다.
        expect(shape.getAttribute('fill'), `${pose.id}/${shape.tagName}`).toBe(
          '#ffffff',
        );
        expect(
          Number(shape.getAttribute('stroke-width')),
          pose.id,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('아트워크가 등번호를 직접 그려 넣지 않는다 — 슬롯 값은 렌더러가 얹는다', () => {
    for (const id of MARKER_ARTWORK_IDS) {
      expect(svgOf(id).querySelectorAll('text')).toHaveLength(0);
    }
  });
});

describe('자세가 판을 넘지 않는다', () => {
  /**
   * 그림이 마커 상자를 넘으면 이웃 마커와 겹친다 — 겹침 판정은 상자로만 하기
   * 때문이다(`styleSetBounds`). 윤곽선의 절반(0.28mm)까지는 봐준다.
   */
  it('모든 자세가 마커 상자(18×22mm) 안에 들어간다', () => {
    const { widthMm, heightMm } = PLAYER_MARKER.illustration;
    const slackMm = 0.3;
    for (const id of FIGURE_ARTWORK_IDS) {
      for (const [x, y] of pointsOf(id)) {
        expect(x, `${id}: x=${x}`).toBeGreaterThanOrEqual(-slackMm);
        expect(x, `${id}: x=${x}`).toBeLessThanOrEqual(widthMm + slackMm);
        expect(y, `${id}: y=${y}`).toBeGreaterThanOrEqual(-slackMm);
        expect(y, `${id}: y=${y}`).toBeLessThanOrEqual(heightMm + slackMm);
      }
    }
  });
});

describe('흑백에서 팀 구분 — 방향이 보이는가', () => {
  it('빈 원의 화살촉이 세로 중심선 기준 비대칭이다 — 좌우 반전하면 다른 모양이 된다', () => {
    const widthMm = PLAYER_MARKER.circle.widthMm;
    const points = attackWedgePoints(
      widthMm / 2,
      widthMm / 2,
      widthMm / 2 - 1.5,
    );
    // 대칭이라면 각 점의 반전(폭 - x)이 점 집합 안에 그대로 있어야 한다.
    const mirrored = points.map(([x, y]) => [widthMm - x, y]);
    const isSameSet = mirrored.every((m) =>
      points.some((p) => Math.abs(p[0] - m[0]) < 1e-9 && p[1] === m[1]),
    );
    expect(isSameSet).toBe(false);
  });

  it('화살촉이 마커 폭 안에 들어간다 — 옆 마커와 겹치지 않는다', () => {
    for (const [cxMm, radiusMm] of [
      [
        PLAYER_MARKER.circle.widthMm / 2,
        PLAYER_MARKER.circle.widthMm / 2 - 1.5,
      ],
    ] as const) {
      const points = attackWedgePoints(cxMm, cxMm, radiusMm);
      for (const [x] of points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(PLAYER_MARKER.circle.widthMm);
      }
    }
  });

  /**
   * 선수 그림에는 화살촉이 없다 — 자세가 방향을 말한다(2026-09-06). 그러려면
   * 자세가 좌우로 확실히 치우쳐야 한다. 대칭이면 원정 마커를 뒤집어도 홈과
   * 같아 보여 흑백에서 팀이 사라진다.
   */
  it('모든 자세가 세로 중심선 기준으로 확실히 치우쳐 있다', () => {
    const { widthMm } = PLAYER_MARKER.illustration;
    for (const id of FIGURE_ARTWORK_IDS) {
      const points = pointsOf(id);
      const mirrored = points.map(([x, y]) => [widthMm - x, y] as const);
      // 뒤집은 그림에서 제일 멀어진 점이 얼마나 어긋나는가. 좌우 대칭이면 0이다.
      const worst = Math.max(
        ...points.map(([x, y]) =>
          Math.min(...mirrored.map(([mx, my]) => Math.hypot(x - mx, y - my))),
        ),
      );
      expect(
        worst,
        `${id}: 뒤집었을 때 어긋남 ${worst.toFixed(2)}mm`,
      ).toBeGreaterThan(2);
    }
  });
});

describe('흑백에서 골키퍼 구분', () => {
  it('골키퍼 빈 원은 필드 선수보다 원이 하나 더 있다 — 안쪽 테', () => {
    const player = svgOf('player-marker-circle').querySelectorAll('circle');
    const goalkeeper = svgOf('goalkeeper-marker-circle').querySelectorAll(
      'circle',
    );
    expect(goalkeeper.length).toBeGreaterThan(player.length);
  });

  it('골키퍼 그림은 장갑만큼 도형이 더 많다 — 필드 선수와 실루엣이 다르다', () => {
    for (const mode of ['illustration', 'outline'] as const) {
      const keeper = svgOf(
        markerArtworkId(GOALKEEPER_POSE.id, mode),
      ).getElementById('pc-marker-team')!;
      const player = svgOf(
        markerArtworkId(MARKER_POSES[0].id, mode),
      ).getElementById('pc-marker-team')!;
      expect(keeper.children.length, mode).toBe(player.children.length + 2);
    }
  });
});

describe('등번호 가독성', () => {
  /** `docs/soccer-artwork.md` 6절과 같은 하한. */
  const LEGIBLE_MIN_MM = 2.5;

  it('필드 최소 배율(0.5)에서도 등번호가 2.5mm 위를 유지한다 — 모든 세트', () => {
    for (const set of game.styleSets) {
      const field = game.parts.find((p) => p.id === 'field')!;
      for (const variant of set.variants) {
        expect(
          variant.valueFontSizeMm * field.minScale,
          `${set.id}/${variant.id}`,
        ).toBeGreaterThanOrEqual(LEGIBLE_MIN_MM);
      }
    }
  });
});

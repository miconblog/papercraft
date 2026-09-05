/**
 * 축구 게임판 도안 검증 (IDE-004)
 *
 * 이 이슈의 수용 기준 중 **종이 없이 확인할 수 있는 것**을 여기서 강제한다.
 * 실물이 있어야 아는 것(튕기는 맛 · 표면 내구성 · 가독성 하한의 실측)은 이슈에
 * ⚠︎로 남아 있다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games/registry';
import { MARK_STYLES, findPart, slotMarker } from '@/lib/schema';
import { ARTWORK } from '../artwork';
import { ballCenters } from '../artwork/ball-markers';
import { GOAL_NET_ORIGINS, goalNetFaces } from '../artwork/goals';
import {
  RULES_CARD_TEXT_LIMIT_MM,
  layoutRulesCard,
} from '../artwork/rules-card';
import {
  BALL,
  BALL_COUNT,
  BOARD,
  FIELD,
  FIELD_CENTER_Y_MM,
  GOAL,
  GOAL_NET_SIZE,
  SHEETS,
} from '../dimensions';
import { PAPER_NOTE, RULES } from '../rules';

const game = getGame('soccer')!;
const partOf = (id: string) => findPart(game, id)!;

const svgOf = (partId: string): Document =>
  new DOMParser().parseFromString(ARTWORK[partId](), 'image/svg+xml');

const ruleText = RULES.map((block) => block.text).join('\n');

describe('도안 구조', () => {
  it('스키마 검증을 통과하고 보드·부속·조립물로 나뉜다', () => {
    expect(game.parts.filter((p) => p.kind === 'board')).toHaveLength(1);
    expect(
      game.parts.filter((p) => p.kind === 'cutout').length,
    ).toBeGreaterThan(0);
    expect(
      game.parts.filter((p) => p.kind === 'buildable').length,
    ).toBeGreaterThan(0);
  });

  it('모든 파트가 아트워크를 갖고, 커밋된 SVG가 생성기와 같다', () => {
    for (const part of game.parts) {
      expect(part.artwork, `${part.id}에 아트워크가 없다`).toBe(
        `/games/soccer/${part.id}.svg`,
      );
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'soccer', `${part.id}.svg`),
        'utf8',
      );
      expect(
        committed,
        `${part.id}.svg가 낡았다 — \`npm run artwork\`를 돌린다`,
      ).toBe(ARTWORK[part.id]());
    }
  });

  it('SVG 치수가 파트 치수와 같다 — 배율 100%가 곧 종이 위 mm다', () => {
    for (const part of game.parts) {
      const root = svgOf(part.id).documentElement;
      expect(root.getAttribute('width')).toBe(`${part.widthMm}mm`);
      expect(root.getAttribute('height')).toBe(`${part.heightMm}mm`);
      expect(root.getAttribute('viewBox')).toBe(
        `0 0 ${part.widthMm} ${part.heightMm}`,
      );
    }
  });

  it('배율 100%에서 운동장이 A4 크기다', () => {
    const field = partOf('field');
    expect([field.widthMm, field.heightMm].sort((a, b) => a - b)).toEqual([
      210, 297,
    ]);
    expect(BOARD.widthMm).toBe(297);
  });

  it('파트가 선언한 표시가 SVG 레이어로 실제로 있다', () => {
    for (const part of game.parts) {
      const doc = svgOf(part.id);
      for (const mark of part.marks) {
        const layer = doc.getElementById(MARK_STYLES[mark].layerId);
        expect(layer, `${part.id}에 ${mark} 레이어가 없다`).not.toBeNull();
        expect(
          layer!.children.length,
          `${part.id}의 ${mark} 레이어가 비어 있다`,
        ).toBeGreaterThan(0);
      }
      // 보드는 오리지도 접지도 않는다.
      if (part.kind === 'board') {
        for (const style of Object.values(MARK_STYLES)) {
          expect(doc.getElementById(style.layerId)).toBeNull();
        }
      }
    }
  });

  it('아트워크가 슬롯 값을 직접 그려 넣지 않는다', () => {
    // 팀 기본 이름이 SVG에 박혀 있으면 이름을 바꿔도 인쇄물이 안 바뀐다.
    for (const partId of ['field', 'score-sheet']) {
      expect(ARTWORK[partId]()).not.toContain('파랑 팀');
      expect(ARTWORK[partId]()).not.toContain('빨강 팀');
    }
  });
});

describe('골대 전개도', () => {
  const faces = goalNetFaces(0, 0);
  const face = (id: string) => faces.find((f) => f.id === id)!;

  it('접으면 실제로 세워진다 — 지붕이 옆벽 위에 얹히고 발이 바닥에 닿는다', () => {
    // 지붕의 깊이가 옆벽 깊이와 같아야 앞뒤로 어긋나지 않고 얹힌다.
    expect(face('roof').heightMm).toBe(face('wall-left').widthMm);
    expect(face('roof').heightMm).toBe(face('wall-right').widthMm);
    // 지붕 폭 = 뒷벽 폭 = 두 옆벽 사이 거리.
    expect(face('roof').widthMm).toBe(face('wall-back').widthMm);
    // 세 벽의 높이가 같아야 지붕이 기울지 않는다.
    const heights = new Set(
      ['wall-left', 'wall-back', 'wall-right'].map((id) => face(id).heightMm),
    );
    expect(heights.size).toBe(1);
    // 발은 옆벽과 같은 깊이라야 바깥으로 접었을 때 벽 전체를 받친다.
    expect(face('foot-left').widthMm).toBe(face('wall-left').widthMm);
    expect(face('foot-right').widthMm).toBe(face('wall-right').widthMm);
    // 풀칠탭은 옆벽 안쪽에 붙으므로 벽 높이를 넘으면 안 된다.
    for (const id of ['glue-tab-left', 'glue-tab-right']) {
      expect(face(id).widthMm).toBeLessThanOrEqual(face('wall-left').heightMm);
    }
  });

  it('면끼리 겹치지 않는다', () => {
    for (let a = 0; a < faces.length; a += 1) {
      for (let b = a + 1; b < faces.length; b += 1) {
        const [p, q] = [faces[a], faces[b]];
        const overlaps =
          p.xMm < q.xMm + q.widthMm &&
          q.xMm < p.xMm + p.widthMm &&
          p.yMm < q.yMm + q.heightMm &&
          q.yMm < p.yMm + p.heightMm;
        expect(overlaps, `${p.id}와 ${q.id}가 겹친다`).toBe(false);
      }
    }
  });

  it('두 벌이 시트 안에 들어가고 서로 겹치지 않는다', () => {
    const boxes = GOAL_NET_ORIGINS.map(([x, y]) => ({
      left: x,
      top: y,
      right: x + GOAL_NET_SIZE.widthMm,
      bottom: y + GOAL_NET_SIZE.heightMm,
    }));
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(SHEETS.goals.widthMm);
      expect(box.bottom).toBeLessThanOrEqual(SHEETS.goals.heightMm);
    }
    expect(boxes[0].right).toBeLessThan(boxes[1].left);
  });

  it('오림선·접는선·풀칠면이 모두 있다', () => {
    const doc = svgOf('goals');
    for (const mark of ['cut', 'fold-mountain', 'glue'] as const) {
      const layer = doc.getElementById(MARK_STYLES[mark].layerId)!;
      expect(layer.children.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('골라인 안쪽 골대 자리에 들어간다', () => {
    // 골대는 골 에어리어 안에 서야 필드 표시와 어긋나지 않는다.
    const field = partOf('field');
    const goalArea = { depthMm: 20, widthMm: 48 };
    expect(GOAL.depthMm).toBeLessThanOrEqual(goalArea.depthMm);
    expect(GOAL.mouthWidthMm).toBeLessThanOrEqual(goalArea.widthMm);
    expect(FIELD.xMm + GOAL.depthMm).toBeLessThan(field.widthMm / 2);
  });
});

describe('공 마커', () => {
  it('골대 입구보다 작아 실제로 골대 안에 들어간다', () => {
    expect(BALL.diameterMm).toBeLessThan(GOAL.mouthWidthMm);
    expect(BALL.diameterMm).toBeLessThan(GOAL.mouthHeightMm);
    // '뚜렷이 작게' — 입구 폭의 절반 아래.
    expect(BALL.diameterMm * 2).toBeLessThan(GOAL.mouthWidthMm);
  });

  it('골대와 같은 배율 범위를 갖는다 — 따로 뽑으면 크기 관계가 깨진다', () => {
    const goals = partOf('goals');
    const balls = partOf('ball-markers');
    expect(balls.minScale).toBe(goals.minScale);
    expect(balls.maxScale).toBe(goals.maxScale);
  });

  it('한 시트에 여러 개가 겹치지 않고 들어간다', () => {
    const centers = ballCenters();
    expect(centers).toHaveLength(BALL_COUNT);
    expect(BALL_COUNT).toBeGreaterThanOrEqual(12);

    const radiusMm = BALL.diameterMm / 2;
    for (const [x, y] of centers) {
      expect(x - radiusMm).toBeGreaterThanOrEqual(0);
      expect(y - radiusMm).toBeGreaterThanOrEqual(0);
      expect(x + radiusMm).toBeLessThanOrEqual(SHEETS.ballMarkers.widthMm);
      expect(y + radiusMm).toBeLessThanOrEqual(SHEETS.ballMarkers.heightMm);
    }
    for (let a = 0; a < centers.length; a += 1) {
      for (let b = a + 1; b < centers.length; b += 1) {
        const distanceMm = Math.hypot(
          centers[a][0] - centers[b][0],
          centers[a][1] - centers[b][1],
        );
        // 가위가 지나갈 여유까지 본다 — 오림선이 닿기만 해도 오리기 어렵다.
        expect(distanceMm).toBeGreaterThan(BALL.diameterMm + 2);
      }
    }
  });

  it('오림선이 개수만큼 있다', () => {
    const layer = svgOf('ball-markers').getElementById(
      MARK_STYLES.cut.layerId,
    )!;
    expect(layer.querySelectorAll('circle')).toHaveLength(BALL_COUNT);
  });
});

describe('선수 슬롯', () => {
  const playerSlots = game.slots.filter((s) => s.id.includes('-player-'));

  it('22개가 팀별로 구분되어 전부 선언되어 있다', () => {
    expect(playerSlots).toHaveLength(22);
    for (const teamId of ['home', 'away']) {
      const team = playerSlots.filter((s) => s.groupId === teamId);
      expect(team).toHaveLength(11);
      expect(team.filter((s) => s.tags.includes('goalkeeper'))).toHaveLength(1);
    }
  });

  it('마커가 필드 영역 안에 있고 골대 자리를 비워 둔다', () => {
    const field = partOf('field');
    const region = field.regions.find((r) => r.id === 'playable-field')!;
    const goalTopMm = FIELD_CENTER_Y_MM - GOAL.mouthWidthMm / 2;
    const goalBottomMm = FIELD_CENTER_Y_MM + GOAL.mouthWidthMm / 2;
    const markerHalfMm = 13 / 2; // 세트에서 가장 넓은 변형

    for (const slot of playerSlots) {
      const marker = slotMarker(slot)!;
      expect(marker.xMm).toBeGreaterThanOrEqual(region.rect.xMm);
      expect(marker.xMm).toBeLessThanOrEqual(
        region.rect.xMm + region.rect.widthMm,
      );

      const overlapsGoalMouth =
        marker.yMm > goalTopMm && marker.yMm < goalBottomMm;
      if (!overlapsGoalMouth) continue;
      // 골대가 놓이는 깊이 안으로 마커가 들어오면 안 된다.
      expect(
        marker.xMm - markerHalfMm,
        `${slot.id}가 홈 골대 자리를 침범한다`,
      ).toBeGreaterThanOrEqual(FIELD.xMm + GOAL.depthMm);
      expect(
        marker.xMm + markerHalfMm,
        `${slot.id}가 원정 골대 자리를 침범한다`,
      ).toBeLessThanOrEqual(FIELD.xMm + FIELD.widthMm - GOAL.depthMm);
    }
  });
});

describe('게임 방법', () => {
  it('카드를 넘치지 않는다', () => {
    const { bottomYMm } = layoutRulesCard();
    expect(bottomYMm).toBeLessThanOrEqual(RULES_CARD_TEXT_LIMIT_MM);
  });

  it('점수 계산 두 방식이 모두 선택지로 안내된다', () => {
    expect(ruleText).toContain('목표 점수제');
    expect(ruleText).toContain('시간제');
    expect(ruleText).toMatch(/시작 전에 하나를 고른다/);
  });

  it('기본 규칙임을 밝히고 바꿔도 된다고 안내한다', () => {
    expect(ruleText).toContain('기본 규칙');
    expect(ruleText).toMatch(/자유롭게 바꿔서 즐기세요/);
  });

  it('확인된 규칙이 빠짐없이 들어 있다', () => {
    expect(ruleText).toContain('최대 3번');
    expect(ruleText).toMatch(/다시 3번이 된다/);
    expect(ruleText).toMatch(/상대 선수에 닿으면/);
    expect(ruleText).toMatch(/슛은 공이 자기 팀 선수 위에 있을 때만/);
    expect(ruleText).toMatch(/패스 시도 도중에 슛으로 바꿀 수는 없다/);
  });

  it('아직 확인되지 않은 규칙을 단정하지 않는다', () => {
    // 아웃 처리·핸들링은 사용자 확인 전이라 하우스 룰 안내에만 나와야 한다.
    const houseRule = RULES.at(-1)!.text;
    expect(houseRule).toContain('핸들링');
    expect(houseRule).toContain('밖으로 나갔을 때');
    const others = RULES.slice(0, -1)
      .map((b) => b.text)
      .join('\n');
    expect(others).not.toContain('핸들링');
  });

  it('용지 안내가 들어 있다', () => {
    expect(PAPER_NOTE).toMatch(/g\/m²/);
    expect(ARTWORK['rules-card']()).toContain('120g/m²');
  });
});

describe('가독성 하한', () => {
  /** 종이에서 한글이 읽히는 하한으로 잡은 값. ⚠︎ 종이 실측으로 확정한다. */
  const LEGIBLE_MIN_MM = 2.5;

  /**
   * 그 파트를 쓰는 데 꼭 읽혀야 하는 가장 작은 글자와, 그 글자가 어디서 오는가.
   *
   * 운동장의 필수 글자는 **등번호**인데 그것은 슬롯 값이라 아트워크 SVG에 없다.
   * 렌더러가 마커 스타일이 정한 크기로 얹는다 — 그래서 SVG가 아니라 스타일
   * 세트를 봐야 한다. 예전에는 이 검사가 SVG만 보다가 운동장 제목(5mm)에
   * 우연히 걸려 통과했다. 제목을 빼자 드러났다.
   */
  const ESSENTIAL_FONT: Record<
    string,
    { sizeMm: number; from: 'artwork' | 'slot' }
  > = {
    field: { sizeMm: 5, from: 'slot' }, // 등번호
    'score-sheet': { sizeMm: 3.6, from: 'artwork' }, // 판 번호
    'rules-card': { sizeMm: 3, from: 'artwork' }, // 규칙 본문
    goals: { sizeMm: 3.2, from: 'artwork' }, // 조립 안내
    // 공 마커는 글자에 기대지 않는다.
  };

  it('minScale이 필수 글자를 2.5mm 위로 유지한다', () => {
    for (const part of game.parts) {
      const essential = ESSENTIAL_FONT[part.id];
      if (!essential) continue;
      expect(
        essential.sizeMm * part.minScale,
        `${part.id}의 minScale(${part.minScale})이 너무 낮다`,
      ).toBeGreaterThanOrEqual(LEGIBLE_MIN_MM);
    }
  });

  it('아트워크가 그리는 필수 글자가 하한 위에 있다', () => {
    for (const part of game.parts) {
      const essential = ESSENTIAL_FONT[part.id];
      if (!essential || essential.from !== 'artwork') continue;
      const sizes = [...svgOf(part.id).querySelectorAll('text')]
        .map((node) => Number(node.getAttribute('font-size')))
        .filter((size) => size >= essential.sizeMm);
      expect(
        sizes.length,
        `${part.id}에 필수 크기 글자가 없다`,
      ).toBeGreaterThan(0);
    }
  });

  it('렌더러가 얹는 필수 글자도 하한 위에 있다 — 운동장의 등번호', () => {
    const essential = ESSENTIAL_FONT.field;
    const variants = game.styleSets.flatMap((set) => set.variants);
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      expect(
        variant.valueFontSizeMm,
        `마커 변형 '${variant.id}'의 등번호가 작다`,
      ).toBeGreaterThanOrEqual(essential.sizeMm);
    }
  });
});

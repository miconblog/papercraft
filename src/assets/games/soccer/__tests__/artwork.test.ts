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
import {
  GOAL_NET_ORIGINS,
  goalNetFaces,
  goalRoofWindowRect,
} from '../artwork/goals';
import {
  BALL,
  BOARD,
  PLAYER_MARKER,
  FIELD,
  FIELD_CENTER_Y_MM,
  FIELD_MARKS,
  FIELD_RIGHT_MM,
  GOAL,
  GOAL_GUIDE,
  GOAL_NET_SIZE,
  GOAL_ROOF_WINDOW,
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
  const window = goalRoofWindowRect(0, 0);

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

  /**
   * 예전에는 여기서 실제 골대의 3:1(7.32×2.44m)을 지켰다. 그 비율로 잡은
   * 39×13mm를 아이와 종이로 뽑아 만들어 보니 크로스바가 지름 12mm 공 바로 1mm
   * 위에 걸려 골이 안 들어갔다(2026-09-06 사용자 지적). 이 공은 축척보다 19배
   * 크므로 실제 비율은 뜻이 없다 — 기준을 **공 지름**으로 바꿨다.
   */
  it('골문이 공 지름을 기준으로 넉넉하다', () => {
    // 크로스바 아래로 공 하나가 더 지나갈 여유. 골이 안 들어가던 원인이 여기였다.
    expect(GOAL.mouthHeightMm).toBeGreaterThanOrEqual(BALL.diameterMm * 2);
    // 폭은 공 넷이 나란히 설 만큼. 겨냥이 조금 빗나가도 들어간다.
    expect(GOAL.mouthWidthMm).toBeGreaterThanOrEqual(BALL.diameterMm * 4);
    // 그래도 정면에서 골대로 읽혀야 한다 — 세로로 선 상자면 골대가 아니다.
    expect(GOAL.mouthWidthMm / GOAL.mouthHeightMm).toBeGreaterThanOrEqual(1.5);
  });

  /**
   * 지붕 창이 이 골대의 존재 이유다 — 평면 프레임은 공이 순식간에 지나가 버려
   * 골인지 아닌지 보이지 않았다. 상자가 공을 세워 주고, 창이 그 공을 보여 준다.
   */
  it('지붕 창이 지붕 안에 있고 공이 보일 만큼 크다', () => {
    const roof = face('roof');
    expect(window.xMm).toBeGreaterThan(roof.xMm);
    expect(window.yMm).toBeGreaterThan(roof.yMm);
    expect(window.xMm + window.widthMm).toBeLessThan(roof.xMm + roof.widthMm);
    expect(window.yMm + window.heightMm).toBeLessThan(roof.yMm + roof.heightMm);
    // 창 짧은 변이 공 반지름보다 커야 위에서 공이 눈에 들어온다.
    expect(Math.min(window.widthMm, window.heightMm)).toBeGreaterThan(
      BALL.diameterMm / 2,
    );
    // 앞 테두리가 크로스바다 — 다른 변보다 굵어야 골대로 읽힌다.
    expect(GOAL_ROOF_WINDOW.frontBarMm).toBeGreaterThan(
      GOAL_ROOF_WINDOW.backBarMm,
    );
  });

  it('면끼리 겹치지 않는다', () => {
    const all = [...faces, window];
    for (let a = 0; a < all.length; a += 1) {
      for (let b = a + 1; b < all.length; b += 1) {
        const [p, q] = [all[a], all[b]];
        const overlaps =
          p.xMm < q.xMm + q.widthMm &&
          q.xMm < p.xMm + p.widthMm &&
          p.yMm < q.yMm + q.heightMm &&
          q.yMm < p.yMm + p.heightMm;
        // 창은 지붕 안에 뚫는 구멍이라 겹치는 게 정상이다.
        if (p.id === 'roof' || q.id === 'roof') {
          if (p.id === 'roof-window' || q.id === 'roof-window') continue;
        }
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
    // 오림선은 전개도 2벌의 바깥 윤곽과 지붕 창 2개.
    expect(doc.getElementById(MARK_STYLES.cut.layerId)!.children.length).toBe(
      4,
    );
  });

  it('골라인 바깥에 서고 필드를 한 뼘도 쓰지 않는다', () => {
    // 깊이가 종이 여백을 넘는 만큼은 책상 위에 놓인다. 종이 → 책상은 **내려가는**
    // 단차라 공이 걸리지 않는다 — 반대(책상 → 종이)였다면 이 값이 여백 안으로
    // 들어와야 한다.
    expect(GOAL.depthMm).toBeGreaterThan(BALL.diameterMm);
    // 골문이 골 에어리어 폭 안에 있어야 골대와 선이 맞물려 보인다.
    expect(GOAL.mouthWidthMm).toBeLessThanOrEqual(FIELD_MARKS.goalAreaWidthMm);
  });
});

describe('골대 자리 눈금', () => {
  /**
   * 골대가 골라인 바깥에 서면서 종이 위에 놓을 자리가 안 보이게 됐다. 눈금이
   * 없으면 가운데 맞추기가 눈대중이 된다(2026-09-05 사용자 요청).
   */
  const guideYs = [
    FIELD_CENTER_Y_MM - GOAL.mouthWidthMm / 2,
    FIELD_CENTER_Y_MM + GOAL.mouthWidthMm / 2,
  ];

  it('골포스트 자리와 골문 한가운데를 양 진영에 찍는다', () => {
    const lines = [...svgOf('field').querySelectorAll('line')].map((node) => ({
      x1: Number(node.getAttribute('x1')),
      y1: Number(node.getAttribute('y1')),
      x2: Number(node.getAttribute('x2')),
      y2: Number(node.getAttribute('y2')),
    }));
    for (const goalLineXMm of [FIELD.xMm, FIELD_RIGHT_MM]) {
      for (const yMm of guideYs) {
        const tick = lines.find(
          (l) => l.y1 === yMm && l.y2 === yMm && l.x1 !== l.x2,
        );
        expect(tick, `x=${goalLineXMm} y=${yMm} 눈금이 없다`).toBeDefined();
      }
    }
    // 가운데 눈금은 골포스트 눈금보다 짧아야 헷갈리지 않는다.
    expect(GOAL_GUIDE.centerInsideMm).toBeLessThan(
      GOAL_GUIDE.insideMm + GOAL_GUIDE.outsideMm,
    );
  });

  it('눈금이 종이 안에 들어가고 골 에어리어 선을 건드리지 않는다', () => {
    // 골라인 바깥으로 나가는 길이가 종이 여백을 넘으면 재단에서 잘린다.
    expect(GOAL_GUIDE.outsideMm).toBeLessThan(FIELD.xMm);
    // 눈금이 필드 안으로 들어오는 길이는 골 에어리어 깊이보다 훨씬 짧다 —
    // 놀 면에 선을 하나 더 그은 것처럼 보이면 안 된다.
    expect(GOAL_GUIDE.insideMm).toBeLessThan(FIELD_MARKS.goalAreaDepthMm / 4);
    // 눈금 y가 골 에어리어 폭 안이라야 골대가 그 구역에 놓인 것으로 보인다.
    for (const yMm of guideYs) {
      expect(Math.abs(yMm - FIELD_CENTER_Y_MM)).toBeLessThan(
        FIELD_MARKS.goalAreaWidthMm / 2,
      );
    }
  });
});

describe('공', () => {
  /**
   * 공 마커 시트는 출력물에서 뺐지만(2026-09-05) 지름은 남는다 — 골문 크기를
   * 정한 근거이자 준비물 안내에 나가는 값이다. 이 관계가 깨지면 준비한 공이
   * 골대에 안 들어간다.
   */
  it('골문보다 작아 실제로 골대 안으로 들어간다', () => {
    expect(BALL.diameterMm).toBeLessThan(GOAL.mouthWidthMm);
    expect(BALL.diameterMm).toBeLessThan(GOAL.mouthHeightMm);
    // '뚜렷이 작게' — 골문 폭의 4분의 1 아래.
    expect(BALL.diameterMm * 4).toBeLessThanOrEqual(GOAL.mouthWidthMm);
  });

  it('준비물 안내가 그 지름을 그대로 알려 준다', () => {
    // 시트를 안 뽑으므로 크기를 아는 길이 이 문장뿐이다.
    expect(game.supplies.join(' · ')).toContain(`${BALL.diameterMm}mm`);
    expect(ruleText).toContain(`${BALL.diameterMm}mm`);
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

  it('마커가 필드 영역 안에 있고 골라인을 넘지 않는다', () => {
    const field = partOf('field');
    const region = field.regions.find((r) => r.id === 'playable-field')!;
    // 세트에서 가장 넓은 변형. 숫자를 박아 두면 마커를 키워도 검사가 느슨한
    // 채로 통과한다 — 실제로 12 → 15 → 24mm로 커지는 동안 13이 남아 있었다.
    const markerHalfMm =
      Math.max(
        PLAYER_MARKER.circle.widthMm,
        PLAYER_MARKER.illustration.widthMm,
      ) / 2;

    for (const slot of playerSlots) {
      const marker = slotMarker(slot)!;
      expect(marker.xMm).toBeGreaterThanOrEqual(region.rect.xMm);
      expect(marker.xMm).toBeLessThanOrEqual(
        region.rect.xMm + region.rect.widthMm,
      );

      // 골대가 골라인 위에 서므로 마커가 골라인을 넘으면 골대와 부딪힌다.
      expect(
        marker.xMm - markerHalfMm,
        `${slot.id}가 홈 골라인을 넘는다`,
      ).toBeGreaterThanOrEqual(FIELD.xMm);
      expect(
        marker.xMm + markerHalfMm,
        `${slot.id}가 원정 골라인을 넘는다`,
      ).toBeLessThanOrEqual(FIELD.xMm + FIELD.widthMm);
    }
  });
});

describe('게임 방법', () => {
  it('도안 정의가 규칙을 들고 있다 — 소개 페이지가 이 값을 그린다', () => {
    // 인쇄물(`rules-card`)이 사라졌으므로 여기가 규칙의 유일한 자리다.
    expect(game.rules.length).toBe(RULES.length);
    expect(
      game.rules.filter((b) => b.kind === 'heading').length,
    ).toBeGreaterThan(0);
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

  it('용지 안내가 규칙 본문에 들어 있다', () => {
    // 규칙 카드가 사라졌으므로 이 글이 읽히는 곳도 규칙 본문뿐이다. 문구는
    // 사용자가 다듬는다(두꺼운 종이 → A4를 스케치북에 붙이기, 2026-09-06) —
    // 여기서는 그 글이 규칙에 실리는지만 본다.
    expect(PAPER_NOTE.length).toBeGreaterThan(0);
    expect(ruleText).toContain(PAPER_NOTE);
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
    goals: { sizeMm: 3.2, from: 'artwork' }, // 조립 안내
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

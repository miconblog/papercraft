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
import { GOAL_NET_ORIGINS, goalNetFaces, type Face } from '../artwork/goals';
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
  SHEETS,
} from '../dimensions';
import { GOAL_ASSEMBLY_STEPS, PAPER_NOTE, RULES } from '../rules';

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

  it('접으면 쟁반이 된다 — 벽 셋의 높이가 같고 바닥을 둘러싼다', () => {
    // 벽 셋의 높이가 같아야 쟁반 테두리가 기울지 않는다. 전개도에서 뒷벽은
    // 세로가, 옆벽은 가로가 벽 높이다.
    expect(face('wall-left').widthMm).toBe(face('wall-back').heightMm);
    expect(face('wall-right').widthMm).toBe(face('wall-back').heightMm);
    // 뒷벽 폭 = 바닥 폭 = 두 옆벽 사이 거리 = 골문 폭.
    expect(face('wall-back').widthMm).toBe(face('floor').widthMm);
    expect(face('floor').widthMm).toBe(GOAL.mouthWidthMm);
    // 옆벽 길이 = 바닥 깊이라야 앞뒤로 어긋나지 않는다.
    expect(face('wall-left').heightMm).toBe(face('floor').heightMm);
    expect(face('wall-right').heightMm).toBe(face('floor').heightMm);
  });

  /**
   * 뚜껑은 2026-09-08에 돌아왔다. 위가 뚫려 있으면 골포스트를 맞고 튄 공이 그대로
   * 밖으로 나간다는 사용자 지적이었다. 3번 구조의 지붕과 달리 뒷벽 위에 경첩처럼
   * 달려 앞으로 덮이고, 양옆 귀를 옆벽 바깥에 씌워 닫으므로 붙일 것이 없다.
   */
  it('뚜껑이 쟁반 위를 빈틈없이 덮는다', () => {
    const lid = face('lid');
    const floor = face('floor');
    // 뚜껑 깊이 = 바닥 깊이. 짧으면 앞이 열려 공이 나가고, 길면 골문 밖으로
    // 처마처럼 튀어나와 공이 들어오는 길을 막는다.
    expect(lid.heightMm).toBe(floor.heightMm);
    expect(lid.widthMm).toBe(floor.widthMm);
    // 뒷벽 위에 붙어 있어야 경첩이 된다 — 사이에 다른 면이 끼면 접는선이 는다.
    expect(lid.yMm + lid.heightMm).toBe(face('wall-back').yMm);
    // 귀는 뚜껑 깊이에서 모서리 홈만큼만 짧다 — 홈이 없으면 아래 모서리 탭에
    // 붙어 버려 뚜껑을 덮을 때 탭이 딸려 온다.
    for (const id of ['lid-flap-left', 'lid-flap-right']) {
      expect(face(id).heightMm).toBe(lid.heightMm - GOAL.cornerNotchMm);
      // 귀가 옆벽보다 깊게 내려오면 바닥에 닿아 뚜껑이 뜬다.
      expect(face(id).widthMm).toBeLessThan(GOAL.wallHeightMm);
    }
    // 귀가 모서리 탭보다 좁아야 전개도가 옆으로 넓어지지 않는다.
    expect(GOAL.lidFlapMm).toBeLessThan(GOAL.cornerTabMm);
  });

  /**
   * 이 골대에서 유일하게 "조립"이라 부를 만한 대목이다. 앞선 도안은 지붕을
   * 붙이려고 풀칠탭을 썼고(2026-09-05), 그 풀칠을 없애려다 옆벽에 칼집을 냈다가
   * 사용자가 물렀다(2026-09-06) — 칼집은 가위로 낼 수 없고 그럴 바에는 풀이
   * 낫다는 것이었다. 지금은 **겹이 탭을 무는 것**이 전부다.
   */
  it('풀도 칼도 없이 뒷모서리가 닫힌다 — 겹이 탭을 문다', () => {
    const tab = face('corner-tab-left');
    const hem = face('hem-left');
    // 탭은 뒷벽 높이에서 모서리 홈만큼만 짧다 — 홈이 없으면 아래 옆벽에 붙어
    // 버려 뒷벽과 옆벽을 동시에 세울 수 없다.
    expect(tab.heightMm).toBe(face('wall-back').heightMm - GOAL.cornerNotchMm);
    // 그래도 겹이 무는 윗머리는 덮어야 한다.
    expect(tab.heightMm).toBeGreaterThan(hem.widthMm);
    // 겹이 탭보다 짧아도 되지만, 물리려면 겹 너비만큼은 겹쳐야 한다.
    expect(tab.widthMm).toBeGreaterThan(hem.widthMm);
    // 겹은 옆벽 전체 길이를 덮어야 벽 윗머리가 고르게 두 겹이 된다.
    expect(hem.heightMm).toBe(face('wall-left').heightMm);
    // 겹이 벽보다 넓으면 접어 내렸을 때 바닥에 닿아 쟁반 안이 좁아진다.
    expect(hem.widthMm).toBeLessThan(face('wall-left').widthMm);
  });

  it('풀칠면도 칼집도 그리지 않는다', () => {
    // 도안 정의의 `marks`와 실제로 그리는 표시가 어긋나면 조립 안내에 있지도
    // 않은 설명이 따라 나온다.
    const doc = svgOf('goals');
    expect(doc.getElementById(MARK_STYLES.glue.layerId)).toBeNull();
    // 오림선은 전개도 2벌의 바깥 윤곽뿐이다 — 뚫을 곳이 하나도 없다.
    expect(doc.getElementById(MARK_STYLES.cut.layerId)!.children.length).toBe(
      2,
    );
  });

  /**
   * 입술이 이 구조의 핵심이다. 예전 상자에는 바닥이 없었는데, 바닥을 깔면 종이
   * 두께만큼 턱이 생겨 미끄러져 오는 공이 골문에서 걸린다는 이유였다. 바닥이
   * 그대로 앞으로 뻗어 나오면 그 턱이 아예 생기지 않는다.
   */
  it('입술이 바닥과 한 장으로 이어져 공이 넘을 턱이 없다', () => {
    const floor = face('floor');
    const lip = face('lip');
    // 좌우가 같은 자리에서 같은 폭으로 이어져야 접는선 없는 한 면이 된다.
    expect(lip.xMm).toBe(floor.xMm);
    expect(lip.widthMm).toBe(floor.widthMm);
    // 바닥 앞 끝에서 곧장 시작한다 — 사이에 다른 면이 끼면 접는선이 생긴다.
    expect(lip.yMm).toBe(floor.yMm + floor.heightMm);
    // 운동장 위에 얹혀 눈금까지 닿을 만큼은 길어야 한다.
    expect(lip.heightMm).toBeGreaterThan(BALL.diameterMm);
  });

  /**
   * 크기의 근거는 축척이 아니라 **사진 실측**이다(2026-09-06 사용자 요청).
   * 아이와 하는 종이 게임이라 실제 골대보다 커야 재미있다는 것이 요청의 요지였다.
   */
  it('실제 축척보다 뚜렷이 크다 — 종이 게임용으로 과장한 값이다', () => {
    // 실제 골문 7.32m를 이 판의 축척(2.85mm/m)으로 줄이면 20.9mm다.
    const trueScaleWidthMm = (7.32 * FIELD.widthMm) / 100;
    expect(GOAL.mouthWidthMm).toBeGreaterThan(trueScaleWidthMm * 3);
    // 그러면서도 골라인(필드 짧은 변)의 절반은 넘지 않아야 골대가 판을 먹지 않는다.
    expect(GOAL.mouthWidthMm).toBeLessThan(FIELD.heightMm / 2);
  });

  it('골문이 공 지름을 기준으로 넉넉하다', () => {
    // 앞이 통째로 열려 있고 그 위를 뚜껑 앞 모서리가 덮으므로, 벽 높이가 곧
    // 골문 높이이고 그 모서리가 크로스바다.
    expect(GOAL.wallHeightMm).toBeGreaterThanOrEqual(BALL.diameterMm * 2);
    // 폭은 공 넷이 나란히 설 만큼. 겨냥이 조금 빗나가도 들어간다.
    expect(GOAL.mouthWidthMm).toBeGreaterThanOrEqual(BALL.diameterMm * 4);
    // 바닥이 깊어야 들어온 공이 뒷벽에 맞고 도로 튀어 나오지 않는다.
    expect(GOAL.trayDepthMm).toBeGreaterThan(BALL.diameterMm * 2);
  });

  /**
   * **이 전개도에서 가장 조용히 틀리기 쉬운 곳이다.**
   *
   * 상자 모서리는 종이가 붙어 있는 채로는 접히지 않는다. 뚜껑 귀·모서리 탭·옆벽은
   * 전개도에서 위아래로 맞닿아 있는데 접히는 방향이 제각각이라, 이어져 있으면
   * 하나를 접을 때 나머지가 딸려 온다 — 처음 그렸을 때 실제로 그랬고 사용자가
   * "뒷벽과 옆벽을 동시에 세우려면 어딘가 오려야 하는 것 아니냐"고 짚었다
   * (2026-09-08).
   *
   * 그래서 **맞닿은 변은 접는선이거나 아예 떨어져 있거나 둘 중 하나**여야 한다.
   * 면을 하나 더할 때 이 규칙을 어기면 도안은 멀쩡해 보이는데 접히지 않는다.
   */
  it('맞닿은 변은 모두 접는선이다 — 붙어 있는 모서리가 없다', () => {
    // 접어야 하는 이음매. 이 밖의 접촉은 전부 잘못이다.
    const hinges = new Set([
      'lid|lid-flap-left',
      'lid|lid-flap-right',
      'lid|wall-back',
      'corner-tab-left|wall-back',
      'corner-tab-right|wall-back',
      'hem-left|wall-left',
      'hem-right|wall-right',
      'floor|wall-left',
      'floor|wall-right',
      'floor|wall-back',
      // 바닥과 입술은 접는선 없이 이어진 한 면이다.
      'floor|lip',
    ]);
    const sharedEdgeMm = (a: Face, b: Face): number => {
      const [ax1, ay1] = [a.xMm + a.widthMm, a.yMm + a.heightMm];
      const [bx1, by1] = [b.xMm + b.widthMm, b.yMm + b.heightMm];
      if (ay1 === b.yMm || by1 === a.yMm) {
        return Math.min(ax1, bx1) - Math.max(a.xMm, b.xMm);
      }
      if (ax1 === b.xMm || bx1 === a.xMm) {
        return Math.min(ay1, by1) - Math.max(a.yMm, b.yMm);
      }
      return 0;
    };
    for (let i = 0; i < faces.length; i += 1) {
      for (let j = i + 1; j < faces.length; j += 1) {
        const [a, b] = [faces[i], faces[j]];
        const key = [a.id, b.id].sort().join('|');
        const shared = sharedEdgeMm(a, b);
        if (hinges.has(key)) {
          expect(shared, `${key}는 접는선이라 맞닿아야 한다`).toBeGreaterThan(
            0,
          );
        } else {
          expect(
            shared,
            `${key}가 붙어 있어 접히지 않는다`,
          ).toBeLessThanOrEqual(0);
        }
      }
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

  /**
   * 접는 법 글을 소개 페이지로 옮기면서(2026-09-08 사용자 요청) 시트 폭이 비어
   * 두 벌이 나란히 들어간다. 골대 둘에 종이 한 장이 이 시트의 목표다.
   */
  it('두 벌이 한 장에 나란히 들어가고 사이가 벌어져 있다', () => {
    expect(GOAL_NET_ORIGINS).toHaveLength(2);
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
    // 나란히 놓는다. 사이가 붙어 있으면 가위가 들어갈 자리가 없다.
    expect(boxes[1].left - boxes[0].right).toBeGreaterThanOrEqual(4);
    // 아래에는 그림 도해가 들어갈 띠가 남아야 한다.
    expect(boxes[0].bottom).toBeLessThan(SHEETS.goals.heightMm - 30);
  });

  it('오림선과 접는선이 모두 있다', () => {
    const doc = svgOf('goals');
    // 골접기 벌마다 여덟 — 뚜껑·뒷벽·옆벽 둘·겹 둘·모서리 탭 둘.
    expect(
      doc.getElementById(MARK_STYLES['fold-valley'].layerId)!.children.length,
    ).toBe(16);
    // 산접기 벌마다 둘 — 뚜껑 귀뿐이다. 옆벽을 바깥에서 감싸야 들리지 않는다.
    expect(
      doc.getElementById(MARK_STYLES['fold-mountain'].layerId)!.children.length,
    ).toBe(4);
  });

  /**
   * 접는 순서가 시트에서 빠졌으므로(2026-09-08) 소개 페이지가 그 자리를
   * 대신해야 한다. 둘이 어긋나면 시트만 보고도, 페이지만 보고도 접을 수 없다.
   */
  it('접는 순서는 소개 페이지의 규칙에 들어 있다', () => {
    const headings = game.rules.filter((b) => b.kind === 'heading');
    expect(headings.map((h) => h.text)).toContain('골대 접는 법');
    // 시트가 페이지로 안내하는 문구도 실제 절 이름과 같아야 한다.
    expect(ARTWORK.goals()).toContain('골대 접는 법');
    for (const step of GOAL_ASSEMBLY_STEPS) {
      expect(game.rules).toContainEqual({ kind: 'step', text: step });
    }
  });

  it('골라인 밖에 놓이고 필드는 입술만 쓴다', () => {
    // 골문이 골 에어리어 폭 안에 있어야 골대와 선이 맞물려 보인다.
    expect(GOAL.mouthWidthMm).toBeLessThanOrEqual(FIELD_MARKS.goalAreaWidthMm);
    // 필드 안으로 들어오는 것은 입술뿐이고, 골 에어리어 깊이를 넘지 않아야
    // 골키퍼가 설 자리를 덮지 않는다.
    expect(GOAL.lipDepthMm).toBeLessThan(FIELD_MARKS.goalAreaDepthMm);
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
    expect(BALL.diameterMm).toBeLessThan(GOAL.wallHeightMm);
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

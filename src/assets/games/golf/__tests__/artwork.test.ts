/**
 * 골프 게임판 도안 검증 (IDE-030)
 *
 * 종이 없이 확인할 수 있는 것을 여기서 강제한다. 실물이 있어야 아는 것(연필로
 * 튕겼을 때 홀에 들어가는 맛 · 깃대가 실제로 서는지 · 가독성 하한의 실측)은
 * 이슈에 ⚠︎로 남는다.
 *
 * **규격을 어기지 않는지는 `parseGame`이 보고, 이 판으로 골프를 칠 수 있는지는
 * 여기가 본다.** 열여덟 장이 한 함수에서 나오므로 검사도 열여덟 장 전부에
 * 돌린다 — 한 홀만 맞는 코스는 한 홀만 칠 수 있다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games/registry';
import { findPart, isBoardLike, slotsOfPart } from '@/lib/schema';
import { ARTWORK } from '../artwork';
import { layoutHole } from '../artwork/hole';
import { ballCenters } from '../artwork/flag-and-ball';
import {
  clearanceFromPolygon,
  pointInPolygon,
  polylineLength,
  ribbon,
  smoothSpine,
  trimEnd,
  type Pt,
} from '../artwork/geometry';
import {
  COURSE,
  COURSE_AREA,
  COURSE_PAR,
  FLAG_SHEET,
  HOLES,
  IN_HOLES,
  OUT_HOLES,
  PLAYER_COUNT,
  SCORE_CARD,
  SCORE_TABLE_HEIGHT_MM,
  SCORE_TABLE_WIDTH_MM,
  TEE_Y_MM,
  BOARD,
  cupPoint,
  greenCenter,
  holePartId,
  sumPar,
  sumYards,
  type HoleSpec,
} from '../dimensions';
import { RULES } from '../rules';
import { termsForPar, termsLine } from '../scoring';
import { estimateTextWidthMm } from '../../../shared/svg';

const game = getGame('golf')!;
const partOf = (id: string) => findPart(game, id)!;
const layouts = HOLES.map(layoutHole);
const ruleText = RULES.map((block) => block.text).join('\n');

const inCourse = (p: Pt): boolean =>
  p.x >= COURSE_AREA.xMm &&
  p.x <= COURSE_AREA.xMm + COURSE_AREA.widthMm &&
  p.y >= COURSE_AREA.yMm &&
  p.y <= COURSE_AREA.yMm + COURSE_AREA.heightMm;

describe('도안 구조', () => {
  it('판 열여덟 장과 기록표가 낱장이고, 부속은 조립물 하나다', () => {
    expect(game.parts.filter((p) => p.kind === 'board')).toHaveLength(1);
    // 보드는 1번 홀이다 — 썸네일과 소개 페이지가 가리킬 대표 판이다.
    expect(game.parts[0].id).toBe(holePartId(1));
    expect(game.parts.filter((p) => p.kind === 'sheet')).toHaveLength(
      HOLES.length - 1 + 1,
    );
    expect(game.parts.filter((p) => p.kind === 'buildable')).toHaveLength(1);
    expect(game.parts.filter((p) => isBoardLike(p.kind))).toHaveLength(
      HOLES.length + 1,
    );
  });

  it('홀 판은 낱장이라 오림선도 접는선도 없다', () => {
    for (const hole of HOLES) {
      expect(partOf(holePartId(hole.number)).marks).toEqual([]);
    }
    expect(partOf('score-card').marks).toEqual([]);
  });

  it('모든 파트가 아트워크를 갖고, 커밋된 SVG가 생성기와 같다', () => {
    for (const part of game.parts) {
      expect(part.artwork, `${part.id}에 아트워크가 없다`).toBe(
        `/games/golf/${part.id}.svg`,
      );
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'golf', `${part.id}.svg`),
        'utf8',
      );
      expect(
        ARTWORK[part.id](),
        `${part.id}.svg가 생성기와 다르다 — npm run artwork golf`,
      ).toBe(committed);
    }
    // 생성기에만 있고 도안에 없는 파일이 남지 않는다.
    expect(Object.keys(ARTWORK).sort()).toEqual(
      game.parts.map((p) => p.id).sort(),
    );
  });

  it('홀 판은 배율 100%에서 A4 세로 한 장이다', () => {
    for (const hole of HOLES) {
      const part = partOf(holePartId(hole.number));
      expect([part.widthMm, part.heightMm]).toEqual([210, 297]);
      expect(part.orientation).toBe('portrait');
    }
  });
});

describe('코스', () => {
  it('열여덟 홀이 번호 순서대로 하나씩 있다', () => {
    expect(HOLES.map((h) => h.number)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('파 72다 — 전반 36 · 후반 36이고 파3 넷 · 파4 열 · 파5 넷이다', () => {
    expect(COURSE_PAR).toBe(72);
    expect(sumPar(OUT_HOLES)).toBe(36);
    expect(sumPar(IN_HOLES)).toBe(36);
    const count = (par: number) => HOLES.filter((h) => h.par === par).length;
    expect([count(3), count(4), count(5)]).toEqual([4, 10, 4]);
  });

  it('홀마다 이름이 다르다', () => {
    expect(new Set(HOLES.map((h) => h.name)).size).toBe(HOLES.length);
  });

  it('파가 클수록 판 위에서도 길다', () => {
    const byPar = (par: number) =>
      HOLES.filter((h) => h.par === par).map((h) =>
        polylineLength(smoothSpine(h.spine)),
      );
    const [p3, p4, p5] = [byPar(3), byPar(4), byPar(5)];
    expect(Math.max(...p3)).toBeLessThan(Math.min(...p4));
    expect(Math.max(...p4)).toBeLessThan(Math.min(...p5));
  });

  it('거리(야드)도 파를 따른다', () => {
    const byPar = (par: number) =>
      HOLES.filter((h) => h.par === par).map((h) => h.yards);
    expect(Math.max(...byPar(3))).toBeLessThan(Math.min(...byPar(4)));
    expect(Math.max(...byPar(4))).toBeLessThan(Math.min(...byPar(5)));
    expect(sumYards(HOLES)).toBe(sumYards(OUT_HOLES) + sumYards(IN_HOLES));
  });

  it('티는 열여덟 홀이 같은 자리다 — 판을 갈아 놓고 바로 친다', () => {
    for (const hole of HOLES) expect(hole.spine[0][1]).toBe(TEE_Y_MM);
  });

  it('물이 있는 홀이 넷 이상이다 — 열여덟 장이 다 같으면 재미가 없다', () => {
    const wet = HOLES.filter((h) => h.ponds.length > 0 || h.streams.length > 0);
    expect(wet.length).toBeGreaterThanOrEqual(4);
  });
});

describe('홀 판 배치', () => {
  it('코스의 모든 요소가 O.B. 선 안에 있다', () => {
    for (const layout of layouts) {
      const label = `${layout.hole.number}번 홀`;
      const groups: [string, Pt[]][] = [
        ['페어웨이', layout.fairway],
        ['칼라', layout.collar],
        ['티', layout.tee.corners],
        ...layout.bunkers.map((b, i): [string, Pt[]] => [`벙커${i}`, b]),
        ...layout.ponds.map((b, i): [string, Pt[]] => [`연못${i}`, b]),
        ...layout.streams.map((b, i): [string, Pt[]] => [`개울${i}`, b]),
      ];
      for (const [name, points] of groups) {
        expect(
          points.every(inCourse),
          `${label}의 ${name}이 코스 영역을 벗어난다`,
        ).toBe(true);
      }
      for (const tree of layout.trees) {
        expect(
          inCourse({ x: tree.x - tree.r, y: tree.y - tree.r }) &&
            inCourse({ x: tree.x + tree.r, y: tree.y + tree.r }),
          `${label}의 나무가 코스 영역을 벗어난다`,
        ).toBe(true);
      }
    }
  });

  it('홀은 그린 안에 있고 가장자리에서 홀 지름만큼 떨어져 있다', () => {
    for (const layout of layouts) {
      const label = `${layout.hole.number}번 홀`;
      expect(
        pointInPolygon(layout.green, layout.cup),
        `${label}의 홀이 그린 밖`,
      ).toBe(true);
      expect(
        clearanceFromPolygon(layout.green, layout.cup),
        `${label}의 홀이 그린 가장자리에 너무 붙었다`,
      ).toBe(0);
      const edge = Math.min(
        ...layout.green.map((p) =>
          Math.hypot(p.x - layout.cup.x, p.y - layout.cup.y),
        ),
      );
      expect(
        edge,
        `${label}의 홀이 그린 가장자리에 너무 붙었다`,
      ).toBeGreaterThan(COURSE.cupRadiusMm * 1.5);
    }
  });

  it('벙커가 그린을 덮지 않는다 — 모래와 그린은 닿을 뿐이다', () => {
    for (const layout of layouts) {
      for (const [i, bunker] of layout.bunkers.entries()) {
        expect(
          bunker.some((p) => pointInPolygon(layout.collar, p)),
          `${layout.hole.number}번 홀 벙커${i}가 그린 칼라를 덮는다`,
        ).toBe(false);
      }
    }
  });

  it('티 박스는 페어웨이 안에 있고 해저드와 겹치지 않는다', () => {
    for (const layout of layouts) {
      const label = `${layout.hole.number}번 홀`;
      for (const corner of layout.tee.corners) {
        expect(
          pointInPolygon(layout.fairway, corner),
          `${label}의 티가 페어웨이 밖으로 나간다`,
        ).toBe(true);
      }
      for (const hazard of [
        ...layout.bunkers,
        ...layout.ponds,
        ...layout.streams,
      ]) {
        expect(
          hazard.some((p) => pointInPolygon(layout.tee.corners, p)),
          `${label}의 해저드가 티와 겹친다`,
        ).toBe(false);
      }
    }
  });

  it('페어웨이 가장자리가 스스로를 넘지 않는다', () => {
    // 굽은 홀에서 곡률 반지름이 반폭보다 작으면 안쪽 가장자리가 뒤집힌다.
    // 종이에 뽑기 전에 알아야 하는 어긋남이라 여기서 본다.
    for (const hole of HOLES) {
      const spine = trimEnd(
        smoothSpine(hole.spine),
        Math.min(hole.green.rxMm, hole.green.ryMm) * 0.6,
      );
      const edge = ribbon(spine, hole.fairwayWidthMm).slice(0, spine.length);
      for (let i = 2; i < edge.length; i++) {
        const before = {
          x: edge[i - 1].x - edge[i - 2].x,
          y: edge[i - 1].y - edge[i - 2].y,
        };
        const after = {
          x: edge[i].x - edge[i - 1].x,
          y: edge[i].y - edge[i - 1].y,
        };
        expect(
          before.x * after.x + before.y * after.y,
          `${hole.number}번 홀의 페어웨이 가장자리가 ${i}번 점에서 역행한다`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('나무는 칠 자리를 침범하지 않는다', () => {
    for (const layout of layouts) {
      for (const tree of layout.trees) {
        const p = { x: tree.x, y: tree.y };
        expect(
          pointInPolygon(layout.fairway, p) || pointInPolygon(layout.green, p),
          `${layout.hole.number}번 홀의 나무가 페어웨이나 그린 위에 섰다`,
        ).toBe(false);
      }
    }
  });

  it('요청한 나무의 대부분이 실제로 심긴다', () => {
    for (const [i, layout] of layouts.entries()) {
      const asked = HOLES[i].forests.reduce((sum, f) => sum + f.count, 0);
      expect(
        layout.trees.length / asked,
        `${layout.hole.number}번 홀의 숲이 너무 성기다`,
      ).toBeGreaterThan(0.7);
    }
  });

  it('바닥 한 줄이 판 폭 안에 들어간다', () => {
    for (const par of [3, 4, 5]) {
      const line = `파 ${par} · ${termsLine(par)}`;
      expect(
        estimateTextWidthMm(line, 3.2),
        `파 ${par}의 바닥 줄이 판을 넘친다`,
      ).toBeLessThan(BOARD.widthMm - 12);
    }
  });
});

describe('점수의 이름', () => {
  it('한 타에 넣으면 무엇이든 홀인원이다', () => {
    for (const par of [3, 4, 5]) {
      const one = termsForPar(par).find((t) => t.strokes === 1);
      if (one) expect(one.label).toBe('홀인원');
    }
  });

  it('파는 곧 그 홀의 파와 같은 타수다', () => {
    for (const par of [3, 4, 5]) {
      expect(termsForPar(par).find((t) => t.label === '파')?.strokes).toBe(par);
    }
  });

  it('0타 이하의 이름은 없다', () => {
    for (const par of [3, 4, 5]) {
      expect(termsForPar(par).every((t) => t.strokes >= 1)).toBe(true);
    }
  });
});

describe('기록표', () => {
  it('표 두 벌과 합산 칸이 판 안에 앉는다', () => {
    expect(SCORE_CARD.tableXMm + SCORE_TABLE_WIDTH_MM).toBeLessThanOrEqual(
      SCORE_CARD.widthMm - SCORE_CARD.tableXMm + 0.001,
    );
    const inBottom = SCORE_CARD.inTableYMm + SCORE_TABLE_HEIGHT_MM;
    expect(inBottom).toBeLessThan(SCORE_CARD.sumBoxYMm);
    const sumBottom =
      SCORE_CARD.sumBoxYMm +
      SCORE_CARD.sumHeaderRowMm +
      SCORE_CARD.sumRowMm * PLAYER_COUNT;
    expect(sumBottom).toBeLessThan(SCORE_CARD.footerYMm);
    expect(SCORE_CARD.footerYMm).toBeLessThan(SCORE_CARD.heightMm);
  });

  it('전반 표와 후반 표가 겹치지 않는다', () => {
    expect(SCORE_CARD.outTableYMm + SCORE_TABLE_HEIGHT_MM).toBeLessThan(
      SCORE_CARD.inTableYMm,
    );
  });

  it('사람 이름 슬롯이 넷이고 저마다 세 자리에 찍힌다', () => {
    const players = game.slots.filter((s) => s.id.startsWith('player-'));
    expect(players).toHaveLength(PLAYER_COUNT);
    for (const slot of players) {
      expect(slot.placements).toHaveLength(3);
      // 이름은 기록표에만 나온다 — 홀 판에는 들어갈 자리가 없다.
      expect(slot.placements.every((p) => p.partId === 'score-card')).toBe(
        true,
      );
      expect(slot.default).toBe('');
    }
  });

  it('코스 이름은 홀 판 열여덟 장과 기록표에 함께 찍힌다', () => {
    const slot = game.slots.find((s) => s.id === 'course-name')!;
    expect(slot.placements).toHaveLength(HOLES.length + 1);
    for (const hole of HOLES) {
      expect(
        slot.placements.some((p) => p.partId === holePartId(hole.number)),
      ).toBe(true);
    }
  });

  it('홀 판에도 고칠 값이 하나는 있다 — 에디터가 빈 화면을 내지 않는다', () => {
    for (const hole of HOLES) {
      expect(slotsOfPart(game, holePartId(hole.number)).length).toBeGreaterThan(
        0,
      );
    }
  });
});

describe('깃대와 공', () => {
  it('오림선 안의 모든 것이 시트 안에 있다', () => {
    const { widthMm, heightMm, cutInsetMm } = FLAG_SHEET;
    for (const ball of ballCenters()) {
      expect(ball.x - FLAG_SHEET.ballRadiusMm).toBeGreaterThan(cutInsetMm);
      expect(ball.x + FLAG_SHEET.ballRadiusMm).toBeLessThan(
        widthMm - cutInsetMm,
      );
      expect(ball.y - FLAG_SHEET.ballRadiusMm).toBeGreaterThan(cutInsetMm);
      expect(ball.y + FLAG_SHEET.ballRadiusMm).toBeLessThan(
        heightMm - cutInsetMm,
      );
    }
    const top =
      FLAG_SHEET.poleFoldYMm - FLAG_SHEET.poleHeightMm - FLAG_SHEET.poleTabMm;
    const bottom =
      FLAG_SHEET.poleFoldYMm + FLAG_SHEET.poleHeightMm + FLAG_SHEET.poleTabMm;
    expect(top).toBeGreaterThan(cutInsetMm);
    expect(bottom).toBeLessThan(heightMm - cutInsetMm);
    for (const x of FLAG_SHEET.poleXsMm) {
      expect(x).toBeGreaterThan(cutInsetMm);
      expect(x + FLAG_SHEET.poleWidthMm + FLAG_SHEET.flagWidthMm).toBeLessThan(
        widthMm - cutInsetMm,
      );
    }
  });

  it('깃대 전개도가 제목 줄을 침범하지 않는다', () => {
    const top =
      FLAG_SHEET.poleFoldYMm - FLAG_SHEET.poleHeightMm - FLAG_SHEET.poleTabMm;
    expect(top).toBeGreaterThan(FLAG_SHEET.titleYMm + 6);
  });

  it('공이 홀 원보다 작다 — 들어갈 수 있어야 한다', () => {
    expect(FLAG_SHEET.ballRadiusMm).toBeLessThan(COURSE.cupRadiusMm);
  });

  it('사람 넷이 쳐도 잃어버릴 공이 남는다', () => {
    expect(ballCenters().length).toBeGreaterThanOrEqual(PLAYER_COUNT * 2);
  });
});

describe('게임 방법', () => {
  it('벌타가 붙는 세 가지를 모두 말한다', () => {
    for (const word of ['벙커', '물', 'O.B.']) {
      expect(ruleText).toContain(word);
    }
    expect(ruleText).toContain('1벌타');
  });

  it('덧셈 절차가 규칙에 적혀 있다', () => {
    expect(ruleText).toContain('OUT');
    expect(ruleText).toContain('IN');
    expect(ruleText).toContain('총타수');
    expect(ruleText).toContain(String(COURSE_PAR));
  });

  it('점수의 이름이 빠짐없이 나온다', () => {
    for (const label of [
      '홀인원',
      '알바트로스',
      '이글',
      '버디',
      '파',
      '보기',
    ]) {
      expect(ruleText).toContain(label);
    }
  });

  it('깃대는 홀 뒤에 세운다고 적혀 있다 — 앞에 세우면 길을 막는다', () => {
    expect(ruleText).toContain('홀 **뒤쪽**에 세운다');
  });
});

/** 홀 하나를 골라 좌표가 뜻대로 잡히는지 본다. */
describe('좌표 규약', () => {
  const hole: HoleSpec = HOLES[0];
  it('중심선의 첫 점이 티, 마지막 점이 그린 중심이다', () => {
    const layout = layoutHole(hole);
    expect([layout.tee.center.x, layout.tee.center.y]).toEqual([
      hole.spine[0][0],
      hole.spine[0][1],
    ]);
    expect([layout.greenCenter.x, layout.greenCenter.y]).toEqual([
      ...greenCenter(hole),
    ]);
  });

  it('홀은 그린 중심에서 적어 둔 만큼 치우쳐 있다', () => {
    const [cx, cy] = cupPoint(hole);
    const [gx, gy] = greenCenter(hole);
    expect([cx - gx, cy - gy]).toEqual([...hole.cup]);
  });
});

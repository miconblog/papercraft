/**
 * 야구 게임판 도안 검증 (IDE-014)
 *
 * 종이 없이 확인할 수 있는 것을 여기서 강제한다. 실물이 있어야 아는 것(튕기는
 * 맛 · 스탠드가 실제로 서는지 · 가독성 하한의 실측)은 이슈에 ⚠︎로 남는다.
 *
 * 축구 게임판의 같은 이름 파일과 대응한다 — 새 게임이 규격을 어기지 않는지는
 * `parseGame`이 보고, **그 게임으로 야구를 할 수 있는지**는 여기가 본다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { slotMarker, styleSetBounds } from '@/lib/schema';
import { ARTWORK } from '../artwork';
import { fittedShapes } from '../artwork/player-markers';
import {
  BASE_PATH_MM,
  BASES,
  COUNT_PANEL,
  BOARD,
  DEFENSE_POSITIONS,
  FIELD_MARKS,
  HOME,
  LINES,
  BATTER_POSES,
  DH_CARD,
  SCORE_TABLE,
  SCORE_TABLE_WIDTH_MM,
  ROSTER,
  ROSTER_BLOCK_HEIGHT_MM,
  ROSTER_GUIDE,
  ROSTER_TABLE_WIDTH_MM,
  SHEETS,
  STAND,
  STAND_BOX,
  STAND_BOX_NET_MM,
  STAND_CARDS,
  STAND_GRID,
  STAND_TEAMS,
  battingAverage,
  edgeCrossingYMm,
} from '../dimensions';
import { GOAL_NET_SIZE } from '@/assets/games/soccer/dimensions';
import {
  DIRT_COLOR,
  DOUBLE_LINE_COLOR,
  OUT_LINE_COLOR,
} from '../artwork/field';
import {
  BOX_ASSEMBLY_STEPS,
  ROSTER_STEPS,
  RULES,
  STAND_ASSEMBLY_STEPS,
} from '../rules';
import { BOX_SHEET_NOTES, STAND_CELLS, teamBands } from '../artwork/stands';
import { COLUMN_LABELS, ROSTER_NOTES } from '../artwork/roster';
import { estimateTextWidthMm } from '../../../shared/svg';

const game = getGame('baseball')!;

const svgOf = (partId: string): Document =>
  new DOMParser().parseFromString(ARTWORK[partId](), 'image/svg+xml');

const ruleText = RULES.map((block) => block.text).join('\n');

const defenseSlots = DEFENSE_POSITIONS.map((position) =>
  game.slots.find((s) => s.id === `defense-${position.id}`)!,
);

/** 겹침 판정 상자 — 세트에서 가장 큰 변형이다(스키마와 같은 기준). */
const MARKER = styleSetBounds(game.styleSets[0]);

/** 홈에서의 거리. 판정선이 전부 홈 중심 원호라 이 값 하나로 어느 구역인지 안다. */
const distanceFromHome = (xMm: number, yMm: number): number =>
  Math.hypot(xMm - HOME.xMm, yMm - HOME.yMm);

describe('도안 구조', () => {
  it('스키마 검증을 통과하고 보드·부속 둘·조립물로 나뉜다', () => {
    expect(game.parts.map((p) => [p.id, p.kind])).toEqual([
      ['field', 'board'],
      ['score-sheet', 'cutout'],
      // 2026-09-12 사용자 요청 — 선수별 타격을 적는 기록 용지.
      ['roster', 'cutout'],
      ['stands', 'buildable'],
    ]);
  });

  it('모든 파트가 아트워크를 갖고, 커밋된 SVG가 생성기와 같다', () => {
    for (const part of game.parts) {
      expect(part.artwork, `${part.id}에 아트워크가 없다`).toBe(
        `/games/baseball/${part.id}.svg`,
      );
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'baseball', `${part.id}.svg`),
        'utf8',
      );
      expect(
        committed,
        `${part.id}.svg가 낡았다 — \`npm run artwork baseball\`을 돌린다`,
      ).toBe(ARTWORK[part.id]());
    }
  });

  it('마커 아트워크가 자세마다 두 벌씩, 빈 원은 한 벌을 나눠 쓴다', () => {
    for (const set of game.styleSets) {
      for (const variant of set.variants) {
        const file = variant.artwork!.replace('/games/baseball/', '');
        expect(ARTWORK[file.replace('.svg', '')], file).toBeTypeOf('function');
      }
    }
    // 판에 서는 것이 수비뿐이라 빈 원도 하나다 — 타자 원은 타자를 그라운드에서
    // 빼면서 같이 없앴다(2026-09-08).
    const circles = new Set(
      game.styleSets.map(
        (set) => set.variants.find((v) => v.id === 'circle')!.artwork,
      ),
    );
    expect(circles.size).toBe(1);
  });
});

describe('야구장 — 판정선', () => {
  it('A4 세로다 — 부채꼴이 위로 길게 펼쳐진다', () => {
    // 2026-09-08 사용자 요청으로 가로에서 세로로 돌렸다. 담장까지가 멀수록
    // 공을 날려 보낼 거리가 길어지고, 그 길이가 곧 이 게임의 크기다.
    const board = game.parts.find((p) => p.kind === 'board')!;
    expect([board.widthMm, board.heightMm]).toEqual([210, 297]);
    expect(board.orientation).toBe('portrait');
  });

  it('내야 다이아몬드가 정규 규격이다 — 네 변이 같고 모서리가 직각이다', () => {
    type Pt = { readonly xMm: number; readonly yMm: number };
    const side = (a: Pt, b: Pt) => Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm);
    expect(side(BASES.home, BASES.first)).toBeCloseTo(BASE_PATH_MM, 6);
    expect(side(BASES.first, BASES.second)).toBeCloseTo(BASE_PATH_MM, 6);
    expect(side(BASES.second, BASES.third)).toBeCloseTo(BASE_PATH_MM, 6);
    expect(side(BASES.third, BASES.home)).toBeCloseTo(BASE_PATH_MM, 6);
    // 홈에서 1루와 3루가 ±45° — 파울라인이 직각으로 벌어진다.
    expect(BASES.first.xMm - HOME.xMm).toBeCloseTo(
      HOME.yMm - BASES.first.yMm,
      6,
    );
    expect(HOME.xMm - BASES.third.xMm).toBeCloseTo(
      HOME.yMm - BASES.third.yMm,
      6,
    );
    // 다이아몬드 전체가 종이 안에 있다 — "충분히 표현"의 하한은 종이 폭의 절반이다.
    expect(BASES.third.xMm).toBeGreaterThan(0);
    expect(BASES.first.xMm).toBeLessThan(BOARD.widthMm);
    expect(BASES.second.yMm).toBeGreaterThan(0);
    expect(BASES.first.xMm - BASES.third.xMm).toBeGreaterThan(
      BOARD.widthMm / 2,
    );
  });

  it('판정선이 홈에서 아웃선 < 2루타선 < 홈런선 차례이고, 홈런선 위에 띠가 남는다', () => {
    expect(LINES.outMm).toBeLessThan(FIELD_MARKS.moundDistanceMm);
    expect(LINES.doubleMm).toBeGreaterThan(
      distanceFromHome(BASES.second.xMm, BASES.second.yMm),
    );
    expect(LINES.homeRunMm).toBeGreaterThan(LINES.doubleMm);
    // 홈런선 꼭대기가 종이 안에 있고, 그 위로 공이 멈출 띠가 20mm 이상이다.
    const topMm = HOME.yMm - LINES.homeRunMm;
    expect(topMm).toBeGreaterThanOrEqual(20);
    // 2루타선·홈런선은 종이 좌우를 벗어나 잘린 채 그려진다 — "확장되는 나머지는
    // A4를 벗어나도 된다"(2026-09-08 사용자 요청).
    expect(edgeCrossingYMm(LINES.doubleMm)).not.toBeNull();
    expect(edgeCrossingYMm(LINES.homeRunMm)).not.toBeNull();
    expect(edgeCrossingYMm(LINES.outMm)).toBeNull();
  });

  it('아웃선·2루타선·내야 다이아몬드의 색이 서로 다르고 필드 색과도 다르다', () => {
    const doc = svgOf('field');
    const colors = new Set([DIRT_COLOR, OUT_LINE_COLOR, DOUBLE_LINE_COLOR]);
    expect(colors.size).toBe(3);
    for (const color of colors) {
      expect(
        doc.querySelectorAll(`[stroke="${color}"]`).length,
        color,
      ).toBeGreaterThan(0);
    }
    // 이름표도 같은 색이다 — 흑백에서 색이 사라져도 글자가 남는다.
    const textOf = (color: string) =>
      [...doc.querySelectorAll(`text[fill="${color}"]`)].map(
        (t) => t.textContent,
      );
    expect(textOf(OUT_LINE_COLOR)).toContain('아웃선');
    expect(textOf(DOUBLE_LINE_COLOR)).toContain('2루타선');
  });

  it('포수와 타자가 판에 없다 — 홈플레이트 언저리는 연필이 지나는 자리다', () => {
    // 2026-09-08 사용자 요청. 마커도 스탠드도 없고, 그룹도 수비 하나만 남는다.
    expect(DEFENSE_POSITIONS).toHaveLength(8);
    for (const gone of ['defense-catcher', 'batter']) {
      expect(
        game.slots.find((s) => s.id === gone),
        gone,
      ).toBeUndefined();
    }
    expect(game.groups.map((g) => g.id)).toEqual(['defense']);
    // 홈 언저리에 마커가 하나도 서지 않는다.
    for (const slot of defenseSlots) {
      const marker = slotMarker(slot)!;
      expect(distanceFromHome(marker.xMm, marker.yMm), slot.id).toBeGreaterThan(
        FIELD_MARKS.backstopRadiusMm,
      );
    }
  });

  it('홈 뒤 선(타석·포수 자리·백네트)은 야구장 그림으로 남는다', () => {
    // 사람만 뺐지 야구장을 지운 것이 아니다.
    const doc = svgOf('field');
    const rects = [...doc.querySelectorAll('rect')].map((r) =>
      Number(r.getAttribute('width')),
    );
    expect(rects).toContain(FIELD_MARKS.batterBoxWidthMm);
    expect(rects).toContain(FIELD_MARKS.catcherBoxWidthMm);
  });

  it('카운터가 S·O 두 줄에 동그라미 둘씩이다 — 볼 칸은 없다', () => {
    // 2026-09-08 사용자가 실제로 해 보고 줄였다: "B는 필요없고, S와 O만 있으면
    // 되고 카운트도 2개씩만". 셋째 스트라이크는 아웃, 셋째 아웃은 공수 교대라
    // 마지막 하나는 놓을 자리가 필요 없다.
    expect(COUNT_PANEL.rows.map((r) => r.letter)).toEqual(['S', 'O']);
    for (const row of COUNT_PANEL.rows) expect(row.dots, row.letter).toBe(2);

    const doc = svgOf('field');
    const letters = [...doc.querySelectorAll('text')].map(
      (t) => t.textContent ?? '',
    );
    expect(letters).toContain('S');
    expect(letters).toContain('O');
    expect(letters).not.toContain('B');
    // 그려진 동그라미도 넷이다 — 마운드·베이스와 달리 반지름이 카운터 값이다.
    const dots = [...doc.querySelectorAll('circle')].filter(
      (c) => Number(c.getAttribute('r')) === COUNT_PANEL.dotRadiusMm,
    );
    expect(dots).toHaveLength(4);
    // 규칙문도 볼을 세지 않는다.
    expect(ruleText).not.toContain('B 칸');
  });

  it('판정선 셋이 나머지 선보다 굵다', () => {
    // 이 셋이 곧 규칙이라, 내야 선·타석 같은 장식선과 무게가 같으면 판이 선
    // 무더기로 보인다(2026-09-08 사용자 지적).
    expect(FIELD_MARKS.judgeLineWidthMm).toBeGreaterThan(
      FIELD_MARKS.lineWidthMm,
    );
    const doc = svgOf('field');
    const judged = doc.querySelectorAll(
      `g[stroke-width="${FIELD_MARKS.judgeLineWidthMm}"] path, ` +
        `g[stroke-width="${FIELD_MARKS.judgeLineWidthMm}"] line`,
    );
    // 파울라인 둘 + 홈런선 + 2루타선 + 아웃선.
    expect(judged).toHaveLength(5);
  });

  it('판에 그려진 이름과 규칙문이 같은 말을 쓴다', () => {
    const board = svgOf('field').documentElement.textContent ?? '';
    for (const label of ['홈런선', '2루타선', '아웃선', '파울']) {
      expect(board, label).toContain(label);
    }
    // 타순표·아웃·주자 칸은 뺐다(2026-09-08 사용자 요청). 판에는 경기장뿐이다.
    for (const gone of ['공격진 벤치', '주자']) {
      expect(board, gone).not.toContain(gone);
    }
    for (const term of ['홈런선', '2루타선', '아웃선', '파울라인', '종이 밖']) {
      expect(ruleText, term).toContain(term);
    }
  });
});

describe('수비 시프트', () => {
  it('시프트마다 여덟 자리를 빠짐없이 한 번씩 배치한다', () => {
    expect(game.presets.length).toBeGreaterThanOrEqual(3);
    for (const preset of game.presets) {
      expect(preset.groupId).toBe('defense');
      const ids = preset.positions.map((p) => p.slotId).sort();
      expect(ids, preset.id).toEqual(defenseSlots.map((s) => s.id).sort());
    }
  });

  it('시프트마다 외야에 셋, 내야에 다섯이 선다 — 어느 쪽으로 쳐도 수비가 있다', () => {
    for (const preset of game.presets) {
      const outfield = preset.positions.filter(
        (p) => distanceFromHome(p.xMm, p.yMm) > LINES.doubleMm,
      );
      expect(outfield.length, preset.id).toBe(3);
      expect(preset.positions.length - outfield.length, preset.id).toBe(5);
      // 외야수는 홈런선 안쪽에 선다 — 그 너머는 공이 멈출 띠다.
      for (const p of outfield) {
        expect(
          distanceFromHome(p.xMm, p.yMm),
          `${preset.id}/${p.slotId}`,
        ).toBeLessThan(LINES.homeRunMm);
      }
    }
  });

  it('시프트의 마커가 종이 안에 있고 서로 겹치지 않는다', () => {
    const half = { x: MARKER.widthMm / 2, y: MARKER.heightMm / 2 };
    for (const preset of game.presets) {
      for (const pos of preset.positions) {
        expect(pos.xMm - half.x, `${preset.id}/${pos.slotId}`).toBeGreaterThan(
          0,
        );
        expect(pos.xMm + half.x, `${preset.id}/${pos.slotId}`).toBeLessThan(
          BOARD.widthMm,
        );
        expect(pos.yMm - half.y, `${preset.id}/${pos.slotId}`).toBeGreaterThan(
          0,
        );
        expect(pos.yMm + half.y, `${preset.id}/${pos.slotId}`).toBeLessThan(
          BOARD.heightMm,
        );
      }
      for (let a = 0; a < preset.positions.length; a += 1) {
        for (let b = a + 1; b < preset.positions.length; b += 1) {
          const p = preset.positions[a];
          const q = preset.positions[b];
          const apart =
            Math.abs(p.xMm - q.xMm) >= MARKER.widthMm ||
            Math.abs(p.yMm - q.yMm) >= MARKER.heightMm;
          expect(apart, `${preset.id}: ${p.slotId} · ${q.slotId}`).toBe(true);
        }
      }
    }
  });

  it('홈플레이트가 종이 아래 끝에 붙어 있다 — 하한은 백네트다', () => {
    // 2026-09-08 사용자 요청: "홈플레이트를 최대한 밑으로". 처음에는 포수 마커가
    // 하한이었는데, 포수를 판에서 빼면서 백네트 호가 물려받았다.
    expect(HOME.yMm + FIELD_MARKS.backstopRadiusMm).toBeLessThan(
      BOARD.heightMm,
    );
    expect(BOARD.heightMm - HOME.yMm).toBeLessThanOrEqual(25);
  });

  it('투수가 마운드에 선다', () => {
    const standard = game.presets.find((p) => p.id === 'standard')!;
    const at = (positionId: string) =>
      standard.positions.find((p) => p.slotId === `defense-${positionId}`)!;
    expect(at('pitcher').xMm).toBeCloseTo(HOME.xMm, 6);
    expect(HOME.yMm - at('pitcher').yMm).toBeCloseTo(
      FIELD_MARKS.moundDistanceMm,
      6,
    );
  });

  it('슬롯 이름표가 야구의 수비 번호를 그대로 쓴다 — 2번(포수)이 비어 있다', () => {
    const labels = defenseSlots.map((s) => s.label);
    expect(labels[0]).toBe('1. 투수');
    expect(labels[1]).toBe('3. 1루수');
    expect(labels.some((l) => l.startsWith('2.'))).toBe(false);
  });

  it('슬롯 기본 좌표가 기본 수비와 같다 — 첫 화면이 곧 쓸 수 있는 배치다', () => {
    const standard = game.presets.find((p) => p.id === 'standard')!;
    for (const slot of defenseSlots) {
      const marker = slotMarker(slot)!;
      const preset = standard.positions.find((p) => p.slotId === slot.id)!;
      expect([marker.xMm, marker.yMm], slot.id).toEqual([
        preset.xMm,
        preset.yMm,
      ]);
    }
  });
});

describe('스코어보드', () => {
  it('한 장에 표가 다섯 벌이고 서로 겹치지 않는다', () => {
    // 2026-09-08 사용자 요청: "지금 2판인데, 5판까지 그려줘". A5 가로에 두 벌이던
    // 것을 A4 세로로 늘려 남던 자리를 표로 채웠다.
    expect(SCORE_TABLE.topYMm).toHaveLength(5);
    const tableHeightMm = SCORE_TABLE.rowHeightMm * 3;
    for (let i = 1; i < SCORE_TABLE.topYMm.length; i += 1) {
      const gapMm =
        SCORE_TABLE.topYMm[i] - (SCORE_TABLE.topYMm[i - 1] + tableHeightMm);
      // 다음 표의 "n번째 판" 이름표(4mm 위)가 앉을 자리가 남는다.
      expect(gapMm, `${i}번째 사이`).toBeGreaterThan(4);
    }

    const doc = svgOf('score-sheet');
    const labels = [...doc.querySelectorAll('text')].map(
      (t) => t.textContent ?? '',
    );
    for (const [i] of SCORE_TABLE.topYMm.entries()) {
      expect(labels, `${i + 1}번째 판`).toContain(`${i + 1}번째 판`);
    }
    expect(labels.some((l) => l.includes('5판을 적을 수 있다'))).toBe(true);
  });

  it('표 다섯 벌과 안내문이 A4 세로 한 장 안에 들어간다', () => {
    const sheet = SHEETS.scoreSheet;
    expect([sheet.widthMm, sheet.heightMm]).toEqual([210, 297]);
    expect(SCORE_TABLE.xMm + SCORE_TABLE_WIDTH_MM).toBeLessThanOrEqual(
      sheet.widthMm - SCORE_TABLE.cutInsetMm,
    );
    // 마지막 표 아래로 안내문 한 줄이 들어가고도 오림선 안이다.
    const lastBottomMm =
      SCORE_TABLE.topYMm[SCORE_TABLE.topYMm.length - 1] +
      SCORE_TABLE.rowHeightMm * 3;
    expect(lastBottomMm + 6).toBeLessThan(
      sheet.heightMm - SCORE_TABLE.cutInsetMm,
    );

    const part = game.parts.find((p) => p.id === 'score-sheet')!;
    expect(part.orientation).toBe('portrait');
  });
});

/**
 * 선수 로스터 기록 용지 (2026-09-12 사용자 요청 — "1번부터 9번까지 선수 기록을
 * 적을수있는 기록용 용지 … 선수이름과 각 타석수만큼 기록칸 … 최종적으로 타율도").
 */
describe('선수 로스터', () => {
  const doc = svgOf('roster');
  const textContent = doc.documentElement.textContent ?? '';

  it('표가 두 벌 — 한 벌이 한 팀이고 한 장에 한 경기가 들어간다', () => {
    expect(ROSTER.blockTopYMm).toHaveLength(2);
    // 팀 이름과 날짜 자리가 표마다 하나씩이다.
    const labels = [...doc.querySelectorAll('text')].map(
      (node) => node.textContent ?? '',
    );
    expect(labels.filter((label) => label === '팀 이름')).toHaveLength(2);
    expect(labels.filter((label) => label === '날짜')).toHaveLength(2);
  });

  it('타순 아홉 줄과 타석 다섯 칸, 그리고 타수·안타·타율 열이 있다', () => {
    expect(ROSTER.rows).toBe(9);
    expect(ROSTER.atBats).toBe(5);
    expect(COLUMN_LABELS).toEqual([
      '타순',
      '선수 이름',
      '자리',
      '1타석',
      '2타석',
      '3타석',
      '4타석',
      '5타석',
      '타수',
      '안타',
      '타율',
    ]);
    const labels = [...doc.querySelectorAll('text')].map(
      (node) => node.textContent ?? '',
    );
    // 타순 번호는 미리 찍힌다 — 표 두 벌이니 1~9가 두 벌이다.
    for (let order = 1; order <= ROSTER.rows; order += 1) {
      expect(
        labels.filter((label) => label === String(order)).length,
        `${order}번`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('표가 스코어보드와 같은 폭이고 시트 안에 들어간다', () => {
    expect(ROSTER_TABLE_WIDTH_MM).toBe(SCORE_TABLE_WIDTH_MM);
    expect(ROSTER.xMm + ROSTER_TABLE_WIDTH_MM).toBeLessThanOrEqual(
      SHEETS.roster.widthMm - ROSTER.cutInsetMm,
    );
    const lastBlockBottom =
      ROSTER.blockTopYMm[ROSTER.blockTopYMm.length - 1] +
      ROSTER_BLOCK_HEIGHT_MM;
    expect(lastBlockBottom).toBeLessThan(ROSTER_GUIDE.topYMm);
    const guideBottom =
      ROSTER_GUIDE.topYMm +
      ROSTER_GUIDE.cellHeightMm * (ROSTER_GUIDE.maxAtBats + 1);
    expect(guideBottom).toBeLessThanOrEqual(
      SHEETS.roster.heightMm - ROSTER.cutInsetMm,
    );
  });

  it('타율을 야구 관례대로 적는다 — 앞의 0을 떼고 소수 셋째 자리까지', () => {
    expect(battingAverage(1, 3)).toBe('.333');
    expect(battingAverage(1, 4)).toBe('.250');
    expect(battingAverage(2, 5)).toBe('.400');
    expect(battingAverage(0, 4)).toBe('.000');
    expect(battingAverage(3, 3)).toBe('1.000');
    // 타석에 서지 않았거나 말이 안 되는 값은 계산하지 않는다.
    expect(battingAverage(0, 0)).toBe('—');
    expect(battingAverage(3, 2)).toBe('—');
  });

  it('조견표가 타수 다섯까지의 모든 조합을 적어 둔다 — 나눗셈을 종이가 대신한다', () => {
    for (let atBats = 1; atBats <= ROSTER_GUIDE.maxAtBats; atBats += 1) {
      for (let hits = 0; hits <= atBats; hits += 1) {
        expect(textContent, `${hits}/${atBats}`).toContain(
          battingAverage(hits, atBats),
        );
      }
    }
    expect(textContent).toContain('타율 조견표');
  });

  it('기호 범례가 용지와 게임 방법에서 같다', () => {
    for (const note of ROSTER_NOTES) expect(textContent).toContain(note);
    const steps = ROSTER_STEPS.join('\n');
    for (const mark of ['안타 ○', '2루타 ◎', '홈런 ☆', '아웃 ×']) {
      expect(steps, mark).toContain(mark);
    }
    expect(ruleText).toContain('타격 기록 적는 법');
    // 표 안은 비워 둔다 — 이름도 기호도 아이가 쓰는 자리다.
    expect(doc.getElementById('pc-slot')).not.toBeNull();
  });
});

describe('선수 스탠드', () => {
  const doc = svgOf('stands');
  const layer = (id: string) => doc.getElementById(id)!;

  it('한 줄이 한 팀 열이고 두 줄이면 스무 장이다 — 한 장에 양 팀이 다 있다', () => {
    // 2026-09-08 사용자 요청: 투수부터 야수 여덟에 포수, 그 오른쪽이 지명타자다.
    expect(STAND_CARDS.map((c) => c.label)).toEqual([
      '투수',
      '1루수',
      '2루수',
      '3루수',
      '유격수',
      '좌익수',
      '중견수',
      '우익수',
      '포수',
      '지명타자',
    ]);
    // 2026-09-12: 오른쪽 세로 칸을 보관함에 내주면서 7열 3행이 됐다. 줄이 곧
    // 팀이던 규칙은 끝났지만 팀은 여전히 이어 붙는다.
    const cards = STAND_CARDS.length * STAND_TEAMS.length;
    expect(cards).toBe(20);
    expect(STAND_CELLS).toHaveLength(cards);
    expect(STAND.columns * STAND.rows).toBeGreaterThanOrEqual(cards);
    for (const [i, cell] of STAND_CELLS.entries()) {
      expect(cell.team, `${i}`).toBe(Math.floor(i / STAND_CARDS.length));
      expect(cell.row).toBe(Math.floor(i / STAND.columns));
      expect(cell.column).toBe(i % STAND.columns);
    }
    // 팀은 끊기지 않고 이어진다 — 이름 띠는 줄이 바뀌거나 팀이 바뀔 때만 붙는다.
    expect(teamBands().length).toBeLessThanOrEqual(
      STAND.rows + STAND_TEAMS.length,
    );
    expect(layer('pc-cut').querySelectorAll('rect')).toHaveLength(cards);
    expect(layer('pc-fold-mountain').querySelectorAll('line')).toHaveLength(
      cards,
    );
  });

  /**
   * 선수 보관함 (2026-09-12 사용자 요청 — "선수들을 오려놓고 이곳저곳으로
   * 흩어져서 게임을 안할때 정리해둘 상자가 필요해", 같은 날 "뚜껑 필요없고
   * 축구 골대 전개도만큼 크게 … 선수들을 세워서 일렬로 차곡차곡").
   */
  describe('선수 보관함', () => {
    /** `M`·`L` 좌표만으로 전개도의 외곽 상자를 잰다. */
    const bounds = (d: string) => {
      const points = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
        Number(m[1]),
        Number(m[2]),
      ]);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
      };
    };
    const nets = [...layer('pc-cut').querySelectorAll('path')].map((node) =>
      bounds(node.getAttribute('d') ?? ''),
    );

    it('전개도가 하나다 — 뚜껑은 없다', () => {
      expect(nets).toHaveLength(1);
      expect(doc.documentElement.textContent ?? '').toContain(
        STAND_BOX.tray.label,
      );
      // 골접기 넷 + 풀칠 귀 넷.
      expect(layer('pc-fold-valley').querySelectorAll('line')).toHaveLength(4);
      expect(
        layer('pc-glue').querySelectorAll('line').length,
      ).toBeGreaterThanOrEqual(4);
    });

    it('접은 선수가 세워서 다 들어간다 — 벽이 선수 키보다 높다', () => {
      const tray = STAND_BOX.tray;
      // 접어 세운 카드는 카드 폭 × 한 면 높이다.
      expect(tray.depthMm).toBeGreaterThanOrEqual(STAND.faceHeightMm);
      expect(tray.innerWidthMm).toBeGreaterThan(STAND.cardWidthMm);
      // 접은 카드 스무 장이 일렬로 서면 30mm쯤이다 — 공과 동전까지 들어간다.
      expect(tray.innerLengthMm).toBeGreaterThan(
        STAND_CARDS.length * STAND_TEAMS.length * 1.5,
      );
      // 눕혀 담아도 된다 — 편 카드가 바닥에 든다.
      expect(tray.innerLengthMm).toBeGreaterThan(STAND.faceHeightMm * 2);
    });

    it('축구 골대 전개도만큼 크다', () => {
      const area = STAND_BOX_NET_MM.widthMm * STAND_BOX_NET_MM.heightMm;
      const goalArea = GOAL_NET_SIZE.widthMm * GOAL_NET_SIZE.heightMm;
      expect(area).toBeGreaterThan(goalArea * 0.7);
    });

    it('전개도가 카드 격자 오른쪽 칸에 서고 시트를 넘지 않는다', () => {
      const [net] = nets;
      const gridRightMm = STAND.sheetMarginMm + STAND_GRID.widthMm;
      expect(net.left).toBeGreaterThanOrEqual(gridRightMm + STAND_BOX.gapMm);
      expect(net.right).toBeLessThanOrEqual(SHEETS.stands.widthMm);
      expect(net.top).toBeGreaterThanOrEqual(0);
      expect(net.bottom).toBeLessThanOrEqual(SHEETS.stands.heightMm);
      expect(net.right - net.left).toBeCloseTo(STAND_BOX_NET_MM.widthMm, 6);
      expect(net.bottom - net.top).toBeCloseTo(STAND_BOX_NET_MM.heightMm, 6);
    });

    it('종이가 남지 않는다 — 격자와 보관함이 시트를 거의 채운다', () => {
      const sheetArea = SHEETS.stands.widthMm * SHEETS.stands.heightMm;
      const gridArea = STAND_GRID.widthMm * STAND_GRID.heightMm;
      const netArea = STAND_BOX_NET_MM.widthMm * STAND_BOX_NET_MM.heightMm;
      expect((gridArea + netArea) / sheetArea).toBeGreaterThan(0.75);
      // 격자와 보관함이 시트 높이·폭 안에서 서로 밀어내지 않는다.
      expect(
        STAND.sheetMarginMm +
          STAND_GRID.widthMm +
          STAND_BOX.gapMm +
          STAND_BOX_NET_MM.widthMm,
      ).toBeLessThanOrEqual(SHEETS.stands.widthMm);
      expect(STAND.headerHeightMm + STAND_GRID.heightMm).toBeLessThanOrEqual(
        SHEETS.stands.heightMm,
      );
    });

    it('만드는 법이 보관함 칸 폭 안에 들어간다', () => {
      for (const note of BOX_SHEET_NOTES) {
        expect(
          estimateTextWidthMm(note, STAND_BOX.noteFontMm),
          note,
        ).toBeLessThanOrEqual(STAND_BOX_NET_MM.widthMm + STAND_BOX.gapMm);
      }
      const text = doc.documentElement.textContent ?? '';
      for (const note of BOX_SHEET_NOTES) expect(text).toContain(note);
    });

    it('게임 방법에도 만드는 법이 있고 풀을 준비물로 부른다', () => {
      expect(BOX_ASSEMBLY_STEPS.join('\n')).toContain('풀');
      const ruleText = RULES.map((block) => block.text).join('\n');
      expect(ruleText).toContain('선수 보관함 만드는 법');
      expect(game.supplies.join(' ')).toContain('풀');
      const part = game.parts.find((p) => p.id === 'stands')!;
      expect(part.marks).toContain('glue');
      expect(part.marks).toContain('fold-valley');
    });
  });

  it('한 장으로 끝나므로 기본 인쇄 부수가 한 장이다', () => {
    const part = game.parts.find((p) => p.id === 'stands')!;
    expect(part.defaultCopies ?? 1).toBe(1);
  });

  it('시트가 A4 가로 한 장에 5mm 여백을 두고 들어간다', () => {
    expect(SHEETS.stands.widthMm).toBeLessThanOrEqual(297 - 2 * 5);
    expect(SHEETS.stands.heightMm).toBeLessThanOrEqual(210 - 2 * 5);
  });

  it('줄마다 팀 이름 띠가 있다 — 어느 줄을 어느 색으로 칠할지 종이가 말한다', () => {
    const text = doc.documentElement.textContent ?? '';
    for (const team of STAND_TEAMS) {
      expect(text, team).toContain(team);
    }
  });

  it('접는선이 카드를 정확히 반으로 가른다 — 두 면이 마주 봐야 선다', () => {
    const rects = [...layer('pc-cut').querySelectorAll('rect')];
    const folds = [...layer('pc-fold-mountain').querySelectorAll('line')];
    expect(rects).toHaveLength(folds.length);
    for (const [i, rect] of rects.entries()) {
      const topMm = Number(rect.getAttribute('y'));
      const heightMm = Number(rect.getAttribute('height'));
      expect(heightMm).toBeCloseTo(STAND.faceHeightMm * 2, 6);
      expect(Number(folds[i].getAttribute('y1'))).toBeCloseTo(
        topMm + heightMm / 2,
        6,
      );
      // 접는선은 카드 폭을 가로지른다.
      expect(Number(folds[i].getAttribute('x1'))).toBeCloseTo(
        Number(rect.getAttribute('x')),
        6,
      );
    }
  });

  it('카드가 시트 안에 들어가고 서로 닿지 않는다', () => {
    for (const rect of layer('pc-cut').querySelectorAll('rect')) {
      const xMm = Number(rect.getAttribute('x'));
      const yMm = Number(rect.getAttribute('y'));
      expect(xMm).toBeGreaterThanOrEqual(0);
      expect(yMm).toBeGreaterThanOrEqual(0);
      expect(xMm + Number(rect.getAttribute('width'))).toBeLessThanOrEqual(
        SHEETS.stands.widthMm,
      );
      expect(yMm + Number(rect.getAttribute('height'))).toBeLessThanOrEqual(
        SHEETS.stands.heightMm,
      );
    }
    expect(STAND.gapMm).toBeGreaterThan(0);
  });

  it('포지션 이름표가 줄마다 한 벌씩, 곧 두 벌씩 있다', () => {
    const labels = [...doc.querySelectorAll('text')].map(
      (node) => node.textContent ?? '',
    );
    for (const card of STAND_CARDS) {
      const count = labels.filter((label) => label === card.label).length;
      expect(count, card.label).toBe(STAND_TEAMS.length);
    }
  });

  it('카드마다 뒷면 타격 자세가 다르다 — 돌려 세우면 그대로 타순이다', () => {
    // 2026-09-08 사용자 요청: "뒷면에는 모두 방망이 들고 있는 타자로" · 지명타자가
    // 늘면서 아홉에서 열이 됐다.
    expect(BATTER_POSES).toHaveLength(STAND_CARDS.length);
    const backs = STAND_CARDS.map((c) => c.batterPoseId);
    expect(new Set(backs).size).toBe(STAND_CARDS.length);
    expect(backs).toEqual(BATTER_POSES.map((p) => p.id));
    // 앞면(수비)과 뒷면(타자)이 같은 자세인 카드는 없다.
    for (const card of STAND_CARDS) {
      expect(card.batterPoseId, card.label).not.toBe(card.poseId);
    }
  });

  it('타자 자세는 판 마커가 되지 않는다 — 타자는 그라운드에 없다', () => {
    const poses = new Set(game.styleSets.map((set) => set.id));
    for (const pose of BATTER_POSES) {
      expect(poses.has(`marker-${pose.id}`), pose.id).toBe(false);
      expect(ARTWORK[`marker-${pose.id}-outline`], pose.id).toBeUndefined();
    }
  });

  it('뒷면은 모두 방망이를 들었다 — 수비 자세보다 도형이 하나 많다', () => {
    // 도형 차례는 자세와 무관하게 같고(`figureShapes`), 배트만 조건부로 하나
    // 더 붙는다. 그래서 수비 자세보다 하나 많으면 방망이를 들었다는 뜻이다.
    const box = {
      widthMm: STAND.figureWidthMm,
      heightMm: STAND.figureHeightMm,
    };
    const fielderShapes = fittedShapes('pitch', box).length;
    for (const card of STAND_CARDS) {
      expect(fittedShapes(card.batterPoseId, box).length, card.label).toBe(
        fielderShapes + 1,
      );
    }
  });

  it('앞면은 지명타자만 타자다 — 나머지 아홉은 그 자리의 수비 자세다', () => {
    // 수비를 나가지 않는 자리라 수비 자세랄 것이 없다(2026-09-08). 타격 자세는
    // id가 `bat-`으로 시작한다는 규약을 쓴다.
    for (const pose of BATTER_POSES)
      expect(pose.id.startsWith('bat-')).toBe(true);
    for (const card of STAND_CARDS) {
      expect(card.poseId.startsWith('bat-'), card.label).toBe(
        card.id === DH_CARD.id,
      );
    }
    // 지명타자는 판에 슬롯이 없다 — 카드로만 있다.
    expect(game.slots.find((s) => s.id === DH_CARD.id)).toBeUndefined();
  });

  it('포수는 마스크와 보호 장비를 걸친다 — 도형이 열 개 더 붙는다', () => {
    // 2026-09-08 사용자 요청: "포수 마스크와 보호 장비를 끼고, 바른자세로
    // 정면으로 앉은 모습". 마스크(헬멧·그물테·살 둘)에서 모자 하나를 빼 셋,
    // 가슴 보호대(판·이음매 둘) 셋, 정강이 보호대(통·무릎 덮개) 넷이다.
    const box = {
      widthMm: STAND.figureWidthMm,
      heightMm: STAND.figureHeightMm,
    };
    const catcher = STAND_CARDS.find((c) => c.id === 'catcher')!;
    expect(
      fittedShapes(catcher.poseId, box).length -
        fittedShapes('pitch', box).length,
    ).toBe(10);
  });

  it('시트에 그려진 그림이 카드 열여덟 장 몫이다', () => {
    const box = {
      widthMm: STAND.figureWidthMm,
      heightMm: STAND.figureHeightMm,
    };
    const perTeam = STAND_CARDS.reduce(
      (sum, card) =>
        sum +
        fittedShapes(card.poseId, box).length +
        fittedShapes(card.batterPoseId, box).length,
      0,
    );
    const drawn = doc.querySelectorAll('#pc-art path, #pc-art circle').length;
    expect(drawn).toBe(perTeam * STAND_TEAMS.length);
  });
});

describe('게임 방법', () => {
  it('스탠드 접는 법이 풀도 칼도 부르지 않는다', () => {
    const steps = STAND_ASSEMBLY_STEPS.join('\n');
    expect(steps).toContain('산 모양');
    expect(steps).not.toMatch(/풀칠|칼로|칼집/);
    expect(game.supplies).not.toContain('풀');
  });

  it('판정 넷(아웃·파울·안타·2루타·홈런)이 모두 적혀 있다', () => {
    for (const term of ['아웃', '파울', '안타', '2루타', '홈런']) {
      expect(ruleText, term).toContain(term);
    }
  });
});

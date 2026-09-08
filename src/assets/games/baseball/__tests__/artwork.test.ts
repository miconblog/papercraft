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
import {
  BASE_PATH_MM,
  BASES,
  COUNT_PANEL,
  BATTER_POSITION,
  BATTING_AREA,
  BOARD,
  DEFENSE_POSITIONS,
  FIELD_MARKS,
  HOME,
  LINES,
  PLAY_AREA,
  SHEETS,
  STAND,
  edgeCrossingYMm,
} from '../dimensions';
import {
  DIRT_COLOR,
  DOUBLE_LINE_COLOR,
  OUT_LINE_COLOR,
} from '../artwork/field';
import { RULES, STAND_ASSEMBLY_STEPS } from '../rules';

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
  it('스키마 검증을 통과하고 보드·부속·조립물로 나뉜다', () => {
    expect(game.parts.filter((p) => p.kind === 'board')).toHaveLength(1);
    expect(game.parts.filter((p) => p.kind === 'cutout')).toHaveLength(1);
    expect(game.parts.filter((p) => p.kind === 'buildable')).toHaveLength(1);
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

  it('마커 아트워크가 자세마다 두 벌씩, 빈 원이 두 벌 있다', () => {
    for (const set of game.styleSets) {
      for (const variant of set.variants) {
        const file = variant.artwork!.replace('/games/baseball/', '');
        expect(ARTWORK[file.replace('.svg', '')], file).toBeTypeOf('function');
      }
    }
    // 수비 원과 타자 원은 서로 다른 파일이다 — 흑백에서 공수를 가르는 표식이다.
    const circles = new Set(
      game.styleSets.map(
        (set) => set.variants.find((v) => v.id === 'circle')!.artwork,
      ),
    );
    expect(circles.size).toBe(2);
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

  it('타자 기본 자리가 인쇄된 타석 안이다', () => {
    const marker = slotMarker(
      game.slots.find((s) => s.id === BATTER_POSITION.id)!,
    )!;
    const boxLeftMm =
      HOME.xMm - FIELD_MARKS.batterBoxGapMm - FIELD_MARKS.batterBoxWidthMm;
    expect(marker.xMm).toBeGreaterThanOrEqual(boxLeftMm);
    expect(marker.xMm).toBeLessThanOrEqual(
      boxLeftMm + FIELD_MARKS.batterBoxWidthMm,
    );
    expect(marker.regionId).toBe('batting-area');
    // 이동 범위도 타석 언저리로 묶여 있다 — 타자가 외야로 걸어가면 안 된다.
    expect(BATTING_AREA.widthMm).toBeLessThan(PLAY_AREA.widthMm / 2);
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
  it('시프트마다 아홉 자리를 빠짐없이 한 번씩 배치한다', () => {
    expect(game.presets.length).toBeGreaterThanOrEqual(3);
    for (const preset of game.presets) {
      expect(preset.groupId).toBe('defense');
      const ids = preset.positions.map((p) => p.slotId).sort();
      expect(ids, preset.id).toEqual(defenseSlots.map((s) => s.id).sort());
    }
  });

  it('시프트마다 외야에 셋, 내야에 여섯이 선다 — 어느 쪽으로 쳐도 수비가 있다', () => {
    for (const preset of game.presets) {
      const outfield = preset.positions.filter(
        (p) => distanceFromHome(p.xMm, p.yMm) > LINES.doubleMm,
      );
      expect(outfield.length, preset.id).toBe(3);
      expect(preset.positions.length - outfield.length, preset.id).toBe(6);
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

  it('홈플레이트가 종이 아래 끝에 붙어 있다 — 포수 발끝이 종이 끝이다', () => {
    // 2026-09-08 사용자 요청: "홈플레이트를 최대한 밑으로". 하한은 포수 마커다.
    const standard = game.presets.find((p) => p.id === 'standard')!;
    const catcher = standard.positions.find(
      (p) => p.slotId === 'defense-catcher',
    )!;
    expect(catcher.yMm + MARKER.heightMm / 2).toBeCloseTo(
      BOARD.heightMm - 1,
      0,
    );
    expect(BOARD.heightMm - HOME.yMm).toBeLessThanOrEqual(25);
  });

  it('투수는 마운드에, 포수는 홈 뒤에 선다', () => {
    const standard = game.presets.find((p) => p.id === 'standard')!;
    const at = (positionId: string) =>
      standard.positions.find((p) => p.slotId === `defense-${positionId}`)!;
    expect(at('pitcher').xMm).toBeCloseTo(HOME.xMm, 6);
    expect(HOME.yMm - at('pitcher').yMm).toBeCloseTo(
      FIELD_MARKS.moundDistanceMm,
      6,
    );
    expect(at('catcher').yMm).toBeGreaterThan(HOME.yMm);
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

describe('선수 스탠드', () => {
  const doc = svgOf('stands');
  const layer = (id: string) => doc.getElementById(id)!;

  it('카드 열 장에 오림선과 산접기가 한 벌씩이다', () => {
    const cards = STAND.columns * STAND.rows;
    expect(cards).toBe(DEFENSE_POSITIONS.length + 1);
    expect(layer('pc-cut').querySelectorAll('rect')).toHaveLength(cards);
    expect(layer('pc-fold-mountain').querySelectorAll('line')).toHaveLength(
      cards,
    );
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

  it('포지션 이름표가 열 장에 하나씩 있다', () => {
    const text = doc.documentElement.textContent ?? '';
    for (const position of [...DEFENSE_POSITIONS, BATTER_POSITION]) {
      expect(text, position.label).toContain(position.label);
    }
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

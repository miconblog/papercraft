/**
 * 실제 야구 규칙 — 수비 범위와 능력치 배분 (IDE-044)
 *
 * 종이 없이 확인할 수 있는 것을 여기서 강제한다. 실물이 있어야 아는 것(3mm
 * 글자가 읽히는가 · 옅은 면이 두껍지 않은가 · 예산 10mm가 재미있는가)은
 * 이슈에 ⚠︎로 남는다.
 *
 * 여기서 지키는 약속이 셋이다.
 *
 * 1. **기본 규칙 판은 한 획도 바뀌지 않는다** — 커밋된 `field.svg`와 바이트까지
 *    같다. 카탈로그 썸네일과 소개 페이지가 그 파일을 본다.
 * 2. **판에 적힌 말과 규칙문이 같은 상수에서 나온다** — 인쇄물과 설명이
 *    어긋나면 종이가 둘로 갈린다.
 * 3. **세 길(미리보기·인쇄·PDF)이 같은 그림이다** — 야구가 마커를 가진 첫
 *    동적 보드라 마커 얹기까지 함께 본다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { renderDynamicArtwork } from '@/lib/games/dynamic-artwork';
import {
  defaultCustomization,
  validateCustomization,
  validateSlotValue,
  type GameCustomization,
  type Slot,
} from '@/lib/schema';
import { composeExport } from '@/lib/print/compose';
import { defaultExportOptions } from '@/lib/print/options';
import { parseArtwork } from '@/lib/print/artwork';
import { renderPdf } from '@/lib/print/pdf';
import { ARTWORK } from '../artwork';
import {
  judgePanelFitsBoard,
  judgePanelInFoulTerritory,
} from '../artwork/rule-zones';
import {
  ABILITY_BUDGET_MM,
  ABILITY_SLOT_ID,
  BASE_PATH_MM,
  BOARD,
  BUNT_CALLS,
  DEFENSE_POSITIONS,
  DEFENSE_REACH,
  DEFENSE_SHIFTS,
  DOUBLE_PLAY_CALL,
  HOME,
  JUDGE_ORDER,
  LINE_DRIVE_SIDES,
  REAL_RULE_ZONES,
  RULE_SETS,
  RULE_SET_SLOT_ID,
  abilityRoomMm,
  defenseSlotId,
  judgeLine,
  lineDriveCall,
  reachMm,
} from '../dimensions';
import { RULES } from '../rules';

const game = getGame('baseball')!;
const FIELD = 'field';

const committedField = readFileSync(
  join(process.cwd(), 'public', 'games', 'baseball', 'field.svg'),
  'utf8',
);

const ruleText = RULES.map((block) => block.text).join('\n');

const abilitySlot = game.slots.find((s) => s.id === ABILITY_SLOT_ID)!;

/** 기본 수비 자리에 선 커스터마이즈. 능력치와 규칙만 갈아 끼운다. */
const boardWith = (
  ruleSet: string,
  ability: readonly number[] = DEFENSE_POSITIONS.map(() => 0),
  moved: Record<string, { xMm: number; yMm: number }> = {},
): GameCustomization => {
  const base = defaultCustomization(game);
  return {
    ...base,
    values: {
      ...base.values,
      [RULE_SET_SLOT_ID]: ruleSet,
      [ABILITY_SLOT_ID]: [...ability],
    },
    positions: { ...base.positions, ...moved },
  };
};

const render = (customization: GameCustomization): string =>
  renderDynamicArtwork(
    game,
    game.parts.find((p) => p.id === FIELD)!,
    customization,
  );

const parse = (svg: string): Document =>
  new DOMParser().parseFromString(svg, 'image/svg+xml');

/** 판에 그려진 점선 범위 원들 — 옅은 면(`pc-reach-wash`)이 아니라 테두리다. */
const reachCircles = (svg: string) =>
  [...parse(svg).querySelectorAll('#pc-zones circle')].map((c) => ({
    xMm: Number(c.getAttribute('cx')),
    yMm: Number(c.getAttribute('cy')),
    rMm: Number(c.getAttribute('r')),
  }));

const textsOf = (svg: string): string[] =>
  [...parse(svg).querySelectorAll('text')].map((t) => t.textContent ?? '');

describe('기본 규칙 — 한 획도 바뀌지 않는다', () => {
  it('아트워크 생성기가 커밋된 field.svg를 그대로 낸다', () => {
    expect(ARTWORK[FIELD]()).toBe(committedField);
  });

  it('동적 렌더러도 기본값에서는 같은 바이트다 — 썸네일과 미리보기가 갈리지 않는다', () => {
    expect(render(defaultCustomization(game))).toBe(committedField);
    expect(render(boardWith(RULE_SETS[0].id))).toBe(committedField);
  });

  it('기본 규칙 판에는 판정 영역이 하나도 없다', () => {
    const doc = parse(render(boardWith(RULE_SETS[0].id)));
    expect(doc.querySelector('#pc-zones')).toBeNull();
    expect(doc.querySelector('#pc-reach-wash')).toBeNull();
  });

  it('썸네일과 파트의 아트워크가 여전히 그 정적 파일을 가리킨다', () => {
    const field = game.parts.find((p) => p.id === FIELD)!;
    expect(field.dynamic).toEqual({});
    expect(field.artwork).toBe('/games/baseball/field.svg');
    expect(game.thumbnail).toBe(field.artwork);
  });
});

describe('수비 범위 — 수비수가 곧 영역이다', () => {
  const svg = render(boardWith('real'));

  it('수비 여덟에 원이 하나씩, 기본 반경은 내야 20 · 외야 28mm다', () => {
    const circles = reachCircles(svg);
    expect(circles).toHaveLength(DEFENSE_POSITIONS.length);
    for (const [i, position] of DEFENSE_POSITIONS.entries()) {
      const [xMm, yMm] = DEFENSE_SHIFTS[0].positions[i];
      expect(circles[i]).toEqual({
        xMm,
        yMm,
        rMm: DEFENSE_REACH[position.zone].baseMm,
      });
    }
  });

  it('옅은 면이 경기장 선 **아래**에 깔린다 — 흙 띠와 판정선을 덮지 않는다', () => {
    const layers = [...parse(svg).documentElement.children]
      .map((el) => el.getAttribute('id'))
      .filter((id): id is string => id !== null);
    expect(layers.indexOf('pc-reach-wash')).toBeLessThan(
      layers.indexOf('pc-art'),
    );
    expect(layers.indexOf('pc-art')).toBeLessThan(layers.indexOf('pc-zones'));
    // 마커는 늘 맨 위다 — 동적 보드에서도 규약이 그대로다.
    expect(layers[layers.length - 1]).toBe('pc-slot');
  });

  it('원 안에 판정이 적힌다 — 유격수·2루수만 병살이다', () => {
    const texts = textsOf(svg);
    const doublePlay = DEFENSE_POSITIONS.filter(
      (p) => 'doublePlay' in p && p.doublePlay,
    );
    expect(doublePlay.map((p) => p.label)).toEqual(['2루수', '유격수']);
    expect(texts.filter((t) => t === DOUBLE_PLAY_CALL)).toHaveLength(
      doublePlay.length,
    );
    // 투수 원에는 판정을 적지 않는다 — 아웃선 안과 한 덩어리다.
    expect(texts.filter((t) => t === DEFENSE_REACH.infield.call)).toHaveLength(
      DEFENSE_POSITIONS.filter(
        (p) => p.zone === 'infield' && !('doublePlay' in p),
      ).length - 1,
    );
    expect(texts.filter((t) => t === DEFENSE_REACH.outfield.call)).toHaveLength(
      DEFENSE_POSITIONS.filter((p) => p.zone === 'outfield').length,
    );
  });

  it('내야 상한 26mm면 3루수와 유격수 사이가 맞닿는다', () => {
    const third = DEFENSE_SHIFTS[0].positions[3];
    const shortstop = DEFENSE_SHIFTS[0].positions[4];
    const gapMm = Math.hypot(third[0] - shortstop[0], third[1] - shortstop[1]);
    expect(gapMm).toBeCloseTo(51.7, 1);
    expect(DEFENSE_REACH.infield.maxMm * 2).toBeGreaterThanOrEqual(gapMm);
  });

  it('외야는 상한까지 올려도 갭이 닫히지 않는다 — 아무리 두꺼워도 틈이 있다', () => {
    const left = DEFENSE_SHIFTS[0].positions[5];
    const center = DEFENSE_SHIFTS[0].positions[6];
    const gapMm = Math.hypot(left[0] - center[0], left[1] - center[1]);
    expect(gapMm).toBeCloseTo(72.8, 1);
    expect(DEFENSE_REACH.outfield.maxMm * 2).toBeLessThan(gapMm);
  });
});

describe('능력치 배분', () => {
  it('준 만큼 그 자리의 원이 커진다 — 중견수 +6이면 상한 34mm다', () => {
    const ability: number[] = DEFENSE_POSITIONS.map((p) =>
      p.id === 'center' ? 6 : p.id === 'shortstop' ? 4 : 0,
    );
    const circles = reachCircles(render(boardWith('real', ability)));
    const at = (id: string) =>
      circles[DEFENSE_POSITIONS.findIndex((p) => p.id === id)].rMm;
    expect(at('center')).toBe(DEFENSE_REACH.outfield.maxMm);
    expect(at('shortstop')).toBe(DEFENSE_REACH.infield.baseMm + 4);
    expect(at('pitcher')).toBe(DEFENSE_REACH.infield.baseMm);
  });

  it('준 자리에만 능력치를 적는다 — 배분 없는 판에 +0이 여덟 번 찍히지 않는다', () => {
    expect(
      textsOf(render(boardWith('real'))).some((t) => t.includes('+')),
    ).toBe(false);
    const ability: number[] = DEFENSE_POSITIONS.map((p) =>
      p.id === 'center' ? 6 : 0,
    );
    const texts = textsOf(render(boardWith('real', ability)));
    expect(texts).toContain('중견수 +6');
    expect(texts).toContain('유격수');
    expect(texts.filter((t) => t.includes('+'))).toHaveLength(1);
  });

  it('예산을 넘긴 값은 배분 없음으로 떨어진다 — 몰래 큰 원이 그려지지 않는다', () => {
    const tooMuch: number[] = DEFENSE_POSITIONS.map((p) =>
      p.zone === 'outfield' ? 6 : 0,
    );
    expect(tooMuch.reduce((a, b) => a + b, 0)).toBeGreaterThan(
      ABILITY_BUDGET_MM,
    );
    expect(render(boardWith('real', tooMuch))).toBe(render(boardWith('real')));
  });

  it('한 자리 상한은 기본에서 상한까지 — 내야도 외야도 6mm다', () => {
    expect(abilityRoomMm('infield')).toBe(6);
    expect(abilityRoomMm('outfield')).toBe(6);
    expect(reachMm('outfield', 99)).toBe(DEFENSE_REACH.outfield.maxMm);
    expect(reachMm('infield', -3)).toBe(DEFENSE_REACH.infield.baseMm);
  });
});

describe('능력치 슬롯 — 예산이 도안이 아는 값이다', () => {
  it('여덟 자리에 0~6mm, 합이 예산을 넘지 않는다', () => {
    expect(abilitySlot.kind).toBe('budget');
    const slot = abilitySlot as Extract<Slot, { kind: 'budget' }>;
    expect(slot.items.map((i) => i.id)).toEqual(
      DEFENSE_POSITIONS.map((p) => p.id),
    );
    expect(slot.total).toBe(ABILITY_BUDGET_MM);
    expect(new Set(slot.items.map((i) => i.max))).toEqual(new Set([6]));
  });

  it('예산을 넘기면 막고, 한 자리 상한을 넘겨도 막는다', () => {
    const ok = [0, 0, 4, 0, 6, 0, 0, 0];
    expect(validateSlotValue(abilitySlot, ok)).toBeNull();

    const overBudget = [0, 0, 6, 0, 6, 0, 0, 0];
    expect(validateSlotValue(abilitySlot, overBudget)).toContain(
      `${ABILITY_BUDGET_MM}mm`,
    );

    const overItem = [7, 0, 0, 0, 0, 0, 0, 0];
    expect(validateSlotValue(abilitySlot, overItem)).toContain('투수');

    expect(validateSlotValue(abilitySlot, [0, 0, 0])).toContain('8개');
    expect(validateSlotValue(abilitySlot, [0, 0, 0, 0, 0, 0, 0, -1])).toContain(
      '음수',
    );
    expect(
      validateSlotValue(abilitySlot, [0, 0, 0, 0, 0, 0, 0, 1.5]),
    ).toContain('정수');
  });

  it('예산을 넘긴 커스터마이즈는 내보내기 전에 걸린다', () => {
    const issues = validateCustomization(
      game,
      boardWith('real', [6, 6, 0, 0, 0, 0, 0, 0]),
    );
    expect(issues.map((i) => i.slotId)).toContain(ABILITY_SLOT_ID);
  });

  it('두 슬롯 다 판을 다시 그리게 하는 control 배치다', () => {
    for (const id of [RULE_SET_SLOT_ID, ABILITY_SLOT_ID]) {
      const slot = game.slots.find((s) => s.id === id)!;
      expect(slot.placements).toEqual([{ partId: FIELD, mode: 'control' }]);
    }
  });
});

describe('수비 자리를 옮기면 범위도 따라간다', () => {
  it('마커를 끈 자리에 원이 그려진다', () => {
    const moved = { [defenseSlotId('shortstop')]: { xMm: 80, yMm: 120 } };
    const circles = reachCircles(render(boardWith('real', undefined, moved)));
    const i = DEFENSE_POSITIONS.findIndex((p) => p.id === 'shortstop');
    expect(circles[i]).toEqual({
      xMm: 80,
      yMm: 120,
      rMm: DEFENSE_REACH.infield.baseMm,
    });
  });

  it('시프트를 바꾸면 여덟 개가 통째로 따라간다', () => {
    const noDoubles = DEFENSE_SHIFTS.find((s) => s.id === 'no-doubles')!;
    const moved = Object.fromEntries(
      DEFENSE_POSITIONS.map((position, i) => [
        defenseSlotId(position.id),
        { xMm: noDoubles.positions[i][0], yMm: noDoubles.positions[i][1] },
      ]),
    );
    const circles = reachCircles(render(boardWith('real', undefined, moved)));
    expect(circles.map((c) => [c.xMm, c.yMm])).toEqual(
      noDoubles.positions.map(([x, y]) => [x, y]),
    );
  });
});

describe('선상 2루타 · 번트', () => {
  const svg = render(boardWith('real'));

  it('선상 쐐기는 베이스 거리 바깥부터다 — 내야에 구른 공은 쐐기가 아니다', () => {
    expect(REAL_RULE_ZONES.lineDriveFromMm).toBe(BASE_PATH_MM);
    const arcs = [...parse(svg).querySelectorAll('#pc-zones path')];
    expect(arcs).toHaveLength(2);
    for (const arc of arcs) {
      const d = arc.getAttribute('d')!;
      // 시작점이 홈에서 정확히 베이스 거리만큼 떨어져 있다.
      const [, x, y] = /^M ([-\d.]+) ([-\d.]+)/.exec(d)!;
      expect(
        Math.hypot(Number(x) - HOME.xMm, Number(y) - HOME.yMm),
      ).toBeCloseTo(BASE_PATH_MM, 2);
      expect(d).toContain(`A ${BASE_PATH_MM} ${BASE_PATH_MM}`);
    }
  });

  it('쐐기 바깥 변이 종이 안에서 끝난다 — 인쇄 파서는 클립을 받지 않는다', () => {
    for (const seg of parse(svg).querySelectorAll('#pc-zones line')) {
      for (const [ax, ay] of [
        ['x1', 'y1'],
        ['x2', 'y2'],
      ] as const) {
        expect(Number(seg.getAttribute(ax))).toBeGreaterThanOrEqual(0);
        expect(Number(seg.getAttribute(ax))).toBeLessThanOrEqual(BOARD.widthMm);
        expect(Number(seg.getAttribute(ay))).toBeGreaterThanOrEqual(0);
        expect(Number(seg.getAttribute(ay))).toBeLessThanOrEqual(
          BOARD.heightMm,
        );
      }
    }
  });

  it('번트 칸이 아웃선 안을 30°로 가른다', () => {
    expect(REAL_RULE_ZONES.buntDeg).toBe(30);
    const texts = textsOf(svg);
    expect(texts.filter((t) => t === BUNT_CALLS.hit)).toHaveLength(2);
    expect(texts).toContain('번트 실패');
    // 선언 한 줄이 판에 있다 — 아웃선을 넘기면 스트라이크라는 것까지.
    expect(texts.some((t) => t.includes(BUNT_CALLS.tooHard))).toBe(true);
  });

  it('쐐기 이름표가 좌·우로 하나씩 있다', () => {
    const texts = textsOf(svg);
    for (const side of LINE_DRIVE_SIDES) {
      expect(texts).toContain(lineDriveCall(side));
    }
  });
});

describe('판정 차례 — 겹치는 자리가 하나로 읽힌다', () => {
  const svg = render(boardWith('real'));

  it('판과 규칙문에 같이 있고, 같은 상수에서 나온다', () => {
    const texts = textsOf(svg);
    for (const [i, step] of JUDGE_ORDER.entries()) {
      expect(texts).toContain(`${i + 1}. ${step.where}`);
      expect(texts).toContain(`→ ${step.call}`);
      expect(ruleText).toContain(judgeLine(step));
    }
  });

  it('판정 차례 칸이 파울 지역 안이고 판 밖으로 넘치지 않는다', () => {
    expect(judgePanelInFoulTerritory()).toBe(true);
    expect(judgePanelFitsBoard()).toBe(true);
  });

  it('판에 적힌 판정 문구가 규칙문에도 그대로 있다', () => {
    for (const call of [
      DEFENSE_REACH.infield.call,
      DEFENSE_REACH.outfield.call,
      DOUBLE_PLAY_CALL,
      BUNT_CALLS.hit,
      BUNT_CALLS.fail,
      lineDriveCall(LINE_DRIVE_SIDES[0]),
      lineDriveCall(LINE_DRIVE_SIDES[1]),
    ]) {
      expect(ruleText).toContain(call);
    }
  });

  it('규칙 이름이 규칙문과 만들기 화면 선택지에서 같다', () => {
    const slot = game.slots.find((s) => s.id === RULE_SET_SLOT_ID)!;
    expect(slot.kind).toBe('choice');
    const choice = slot as Extract<Slot, { kind: 'choice' }>;
    expect(choice.default).toBe(RULE_SETS[0].id);
    expect(choice.options.map((o) => o.label)).toEqual(
      RULE_SETS.map((s) => s.label),
    );
    expect(ruleText).toContain(RULE_SETS[1].label);
  });
});

describe('세 길이 같은 그림이다 — 미리보기 · 인쇄 · PDF', () => {
  const customization = boardWith('real', [0, 0, 4, 0, 6, 0, 0, 0]);

  it('인쇄 파서가 실제 규칙 판을 읽는다 — 크기가 파트 선언과 같다', () => {
    const artwork = parseArtwork(render(customization));
    expect(artwork.widthMm).toBe(BOARD.widthMm);
    expect(artwork.heightMm).toBe(BOARD.heightMm);
    // 기본 판보다 그릴 것이 많다 — 원 여덟과 그 판정, 쐐기, 번트 칸, 판정 차례.
    expect(artwork.items.length).toBeGreaterThan(
      parseArtwork(committedField).items.length + 20,
    );
  });

  it('마커를 가진 동적 보드가 PDF까지 나간다 — 야구가 처음이다', async () => {
    const doc = composeExport({
      game,
      customization,
      options: {
        ...defaultExportOptions(game),
        parts: [{ partId: FIELD, scale: 1, copies: 1 }],
      },
      loadArtwork: (ref) =>
        readFileSync(join(process.cwd(), 'public', ref), 'utf8'),
      renderArtwork: (part, c) => renderDynamicArtwork(game, part, c),
    });
    expect(doc.pages).toHaveLength(1);

    const basic = composeExport({
      game,
      customization: boardWith(RULE_SETS[0].id),
      options: {
        ...defaultExportOptions(game),
        parts: [{ partId: FIELD, scale: 1, copies: 1 }],
      },
      loadArtwork: (ref) =>
        readFileSync(join(process.cwd(), 'public', ref), 'utf8'),
      renderArtwork: (part, c) => renderDynamicArtwork(game, part, c),
    });
    // 마커 여덟은 두 규칙에서 똑같이 얹힌다 — 판정 영역만큼만 늘어난다.
    expect(doc.pages[0].items.length).toBeGreaterThan(
      basic.pages[0].items.length,
    );

    const bytes = await renderPdf(doc);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('마커 여덟이 판 위에 그대로 얹힌다', () => {
    const markerSlots = game.slots.filter((s) =>
      s.placements.some((p) => p.mode === 'marker' && p.partId === FIELD),
    );
    expect(markerSlots).toHaveLength(DEFENSE_POSITIONS.length);
    const doc = composeExport({
      game,
      customization,
      options: {
        ...defaultExportOptions(game),
        parts: [{ partId: FIELD, scale: 1, copies: 1 }],
      },
      loadArtwork: (ref) =>
        readFileSync(join(process.cwd(), 'public', ref), 'utf8'),
      renderArtwork: (part, c) => renderDynamicArtwork(game, part, c),
    });
    // 마커 아트워크(선수 그림)가 판에 들어왔다 — 동적 배경 위에 얹는 길이
    // 정적 파트와 같다.
    expect(doc.pages[0].items.length).toBeGreaterThan(100);
  });
});

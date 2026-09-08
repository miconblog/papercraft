/**
 * 윷놀이 도안 검증 (IDE-017)
 *
 * 종이 없이 확인할 수 있는 것을 여기서 강제한다. 실물이 있어야 아는 것(말이
 * 실제로 서는지 · 밭이 손가락에 충분히 넓은지 · 한 판이 적당한 길이인지)은
 * 이슈에 ⚠︎로 남는다.
 *
 * 앞선 세 게임의 같은 이름 파일과 대응한다 — 규격을 어기지 않는지는
 * `parseGame`이 보고, **이 판으로 윷놀이를 할 수 있는지**는 여기가 본다.
 * 윷놀이에서 그것은 곧 **경로**다: 출발점에서 지름길을 타든 안 타든 도착점까지
 * 이어지는가, 그 길이가 규칙문이 적은 수와 같은가.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { boardOf } from '@/lib/games/format';
import { slotsAffectingPart } from '@/lib/schema';
import { ARTWORK } from '../artwork';
import { layoutRulesSheet } from '../artwork/rules-sheet';
import {
  BANG_FIELD_ID,
  BOARD,
  CENTER,
  FIELD,
  FIELDS,
  OUTER_COUNT,
  RULES_SHEET,
  SHORTCUT_ENTRIES,
  SHORTCUT_STEPS,
  SIDES,
  START_FIELD_ID,
  TOKEN,
  TOKENS_PER_SIDE,
  TOKEN_CARD_HEIGHT_MM,
  TOKEN_SHEET,
  carryLabel,
  fieldRadiusMm,
  outerFieldId,
  routeFields,
  shortcutFieldId,
  sideLayerId,
  tokenCardOrigin,
} from '../dimensions';
import { RULES, THROW_VALUES } from '../rules';

const game = getGame('yut-nori')!;

const svgOf = (partId: string): Document =>
  new DOMParser().parseFromString(ARTWORK[partId](), 'image/svg+xml');

const ruleText = RULES.map((block) => block.text).join('\n');

describe('도안 구조', () => {
  it('스키마 검증을 통과하고 말판·말·게임 방법으로 나뉜다', () => {
    expect(game.parts.map((p) => p.kind)).toEqual([
      'board',
      'buildable',
      'cutout',
    ]);
    expect(game.players).toEqual({ min: 2, max: 4 });
  });

  it('모든 파트가 아트워크를 갖고, 커밋된 SVG가 생성기와 같다', () => {
    expect(Object.keys(ARTWORK).sort()).toEqual([
      'board',
      'rules-sheet',
      'tokens',
    ]);
    for (const part of game.parts) {
      expect(part.artwork, `${part.id}에 아트워크가 없다`).toBe(
        `/games/yut-nori/${part.id}.svg`,
      );
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'yut-nori', `${part.id}.svg`),
        'utf8',
      );
      expect(
        committed,
        `${part.id}.svg가 낡았다 — \`npm run artwork yut-nori\`를 돌린다`,
      ).toBe(ARTWORK[part.id]());
    }
  });

  /**
   * 정사각 보드는 `landscape`다. 검증이 `widthMm >= heightMm`를 가로로 읽으므로
   * (`lib/schema/parts.ts`) 규칙이 이미 그렇게 정해져 있었고 이 게임이 처음
   * 밟는다. 썸네일 자리를 잡는 `boardOf`가 그 치수를 그대로 쓴다.
   */
  it('말판이 정사각이고 가로로 선언돼 있다', () => {
    const board = boardOf(game);
    expect(board.widthMm).toBe(board.heightMm);
    expect(board.orientation).toBe('landscape');
    expect(board.widthMm).toBe(198);
  });

  /**
   * 말이 판 밖에서 시작하는 첫 게임이다. 마커도 프리셋도 스타일 세트도 없고,
   * **말판 파트에는 슬롯이 하나도 걸리지 않는다** — 에디터가 그 파트에서
   * 옵션 줄을 통째로 비우게 된다(`slotsAffectingPart`). 빈 화면 없이 열리는지는
   * 에디터 쪽 테스트가 본다.
   */
  it('판 위에 마커가 없다 — 프리셋·스타일 세트·판 슬롯이 모두 비어 있다', () => {
    expect(game.styleSets).toHaveLength(0);
    expect(game.presets).toHaveLength(0);
    expect(
      game.slots.every((s) => !s.placements.some((p) => p.mode === 'marker')),
    ).toBe(true);
    expect(slotsAffectingPart(game, 'board')).toHaveLength(0);
  });

  it('편 넷이 그룹 하나씩 — 이름 슬롯과 색 슬롯을 가리킨다', () => {
    expect(game.groups).toHaveLength(SIDES.length);
    for (const side of SIDES) {
      const group = game.groups.find((g) => g.id === `side-${side.id}`)!;
      const name = game.slots.find((s) => s.id === group.nameSlotId)!;
      const color = game.slots.find((s) => s.id === group.colorSlotId)!;
      expect(name.kind).toBe('text');
      expect(color.kind).toBe('color');
      expect(color.default).toBe(side.color);
      expect(
        color.placements.some(
          (p) => p.mode === 'paint' && p.layerId === sideLayerId(side.id),
        ),
      ).toBe(true);
    }
    // 색과 그림이 둘 다 달라야 흑백에서도 편이 갈린다(IDE-009).
    expect(new Set(SIDES.map((s) => s.color)).size).toBe(SIDES.length);
    expect(new Set(SIDES.map((s) => s.shape)).size).toBe(SIDES.length);
  });
});

describe('말판 — 밭 스물아홉', () => {
  it('전통 배치와 수가 맞는다 — 바깥 20 · 지름길 8 · 방 1', () => {
    expect(FIELDS).toHaveLength(29);
    expect(
      FIELDS.filter((f) => f.kind === 'outer' || f.kind === 'corner'),
    ).toHaveLength(OUTER_COUNT);
    expect(FIELDS.filter((f) => f.kind === 'shortcut')).toHaveLength(
      SHORTCUT_STEPS * 4,
    );
    expect(FIELDS.filter((f) => f.kind === 'bang')).toHaveLength(1);
    expect(new Set(FIELDS.map((f) => f.id)).size).toBe(FIELDS.length);
  });

  it('큰 밭이 다섯이고 네 모서리와 방이다', () => {
    const big = FIELDS.filter((f) => f.big).map((f) => f.id);
    expect(big.sort()).toEqual(
      ['o0', 'o5', 'o10', 'o15', BANG_FIELD_ID].sort(),
    );
  });

  it('밭이 서로 겹치지 않는다', () => {
    for (let a = 0; a < FIELDS.length; a += 1) {
      for (let b = a + 1; b < FIELDS.length; b += 1) {
        const left = FIELDS[a];
        const right = FIELDS[b];
        const gap =
          Math.hypot(left.xMm - right.xMm, left.yMm - right.yMm) -
          (fieldRadiusMm(left) + fieldRadiusMm(right));
        expect(gap, `${left.id}와 ${right.id}가 붙는다`).toBeGreaterThan(1);
      }
    }
  });

  it('모든 밭이 종이 안에 있다', () => {
    for (const field of FIELDS) {
      const r = fieldRadiusMm(field);
      expect(field.xMm - r, field.id).toBeGreaterThanOrEqual(0);
      expect(field.yMm - r, field.id).toBeGreaterThanOrEqual(0);
      expect(field.xMm + r, field.id).toBeLessThanOrEqual(BOARD.widthMm);
      expect(field.yMm + r, field.id).toBeLessThanOrEqual(BOARD.heightMm);
    }
  });

  /**
   * 좌표를 손으로 적지 않고 격자에서 계산했다는 것을 대칭으로 확인한다. 판
   * 중심을 축으로 180° 돌리면 밭 자리 집합이 자기 자신으로 돌아와야 한다 —
   * 어느 한 밭이라도 손으로 밀어 두면 이 검사가 깨진다.
   */
  it('밭 자리가 판 중심에 대해 180° 회전 대칭이다', () => {
    const key = (xMm: number, yMm: number) =>
      `${xMm.toFixed(3)},${yMm.toFixed(3)}`;
    const points = new Set(FIELDS.map((f) => key(f.xMm, f.yMm)));
    for (const field of FIELDS) {
      expect(
        points.has(key(2 * CENTER.xMm - field.xMm, 2 * CENTER.yMm - field.yMm)),
        `${field.id}의 맞은편 자리가 비었다`,
      ).toBe(true);
    }
  });

  it('SVG에 밭 스물아홉이 그려지고 큰 밭은 겹원이다', () => {
    const circles = [...svgOf('board').querySelectorAll('circle')];
    // 작은 밭은 원 하나, 큰 밭은 겹원이라 둘이다.
    expect(circles).toHaveLength(24 + 5 * 2);
    const radii = circles.map((c) => Number(c.getAttribute('r')));
    expect(radii.filter((r) => r === FIELD.smallRadiusMm)).toHaveLength(24);
    expect(radii.filter((r) => r === FIELD.bigRadiusMm)).toHaveLength(5);
  });

  it('바깥 밭에는 잇는 선이 없고 대각선 둘만 그린다', () => {
    // 선이 둘뿐이라 판에서 선으로 보이는 것은 지름길밖에 없다 — 그래서
    // 어디서 갈라지는지가 그림만 보고 읽힌다.
    const lines = [...svgOf('board').querySelectorAll('line')];
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) =>
        Number(l.getAttribute(k)),
      );
      // 마주 보는 모서리를 잇는다 — 가운데가 판 중심이다.
      expect((x1 + x2) / 2).toBeCloseTo(CENTER.xMm, 6);
      expect((y1 + y2) / 2).toBeCloseTo(CENTER.yMm, 6);
    }
  });

  it('출발점이 오른쪽 아래 모서리이고 출발·도착이 적혀 있다', () => {
    const start = FIELDS.find((f) => f.id === START_FIELD_ID)!;
    expect(start.xMm).toBeGreaterThan(CENTER.xMm);
    expect(start.yMm).toBeGreaterThan(CENTER.yMm);
    const labels = [...svgOf('board').querySelectorAll('text')].map(
      (t) => t.textContent,
    );
    expect(labels).toEqual(['출발', '도착']);
  });

  /** 밭 이름은 적지 않는다 — 지역마다 달라 하나를 고르면 틀린 쪽이 생긴다. */
  it('판에 밭 이름을 적지 않는다', () => {
    const svg = ARTWORK.board();
    for (const name of ['참먹이', '방', '쨀밭', '날밭', '뒷도']) {
      expect(svg.includes(`>${name}<`), `판에 밭 이름 '${name}'이 있다`).toBe(
        false,
      );
    }
  });
});

describe('경로 — 갈라지는 그래프', () => {
  const routes = {
    outer: routeFields(),
    shortcut: routeFields({ shortcutAt: 5 }),
    through: routeFields({ shortcutAt: 5, throughBang: true }),
    second: routeFields({ shortcutAt: 10 }),
  };

  it('지름길을 타든 안 타든 출발점에서 도착점까지 이어진다', () => {
    for (const [name, path] of Object.entries(routes)) {
      expect(path[0], name).toBe(START_FIELD_ID);
      expect(path[path.length - 1], name).toBe(START_FIELD_ID);
      // 중간에 출발점을 다시 밟지 않는다 — 밟으면 거기서 나야 한다.
      expect(path.slice(1, -1), name).not.toContain(START_FIELD_ID);
    }
  });

  it('길이가 20 · 11 · 16 · 16칸이다', () => {
    const steps = (path: readonly string[]) => path.length - 1;
    expect(steps(routes.outer)).toBe(20);
    expect(steps(routes.shortcut)).toBe(11);
    expect(steps(routes.through)).toBe(16);
    expect(steps(routes.second)).toBe(16);
  });

  /**
   * 어느 경로에도 없는 밭이 있으면 그 밭은 판에 그려져 있으면서 갈 수 없는
   * 자리다. 지름길 여덟이 두 갈래로 나뉘어 있어 눈으로는 잘 안 보인다.
   */
  it('네 경로를 합치면 스물아홉 밭이 빠짐없이 나온다', () => {
    const seen = new Set(Object.values(routes).flat());
    expect(seen.size).toBe(FIELDS.length);
    for (const field of FIELDS) {
      expect(seen.has(field.id), `${field.id}에 닿는 길이 없다`).toBe(true);
    }
  });

  it('지름길은 두 모서리에서만 갈라진다', () => {
    const entries = FIELDS.filter((f) =>
      f.edges.some((e) => e.kind === 'shortcut'),
    ).map((f) => f.id);
    expect(entries).toEqual(SHORTCUT_ENTRIES.map(outerFieldId));
    // 왼쪽 아래 모서리로는 들어가지 않는다 — 그쪽으로 들어가면 바깥으로 도는
    // 것보다 한 칸이 더 걸린다.
    expect(entries).not.toContain(outerFieldId(15));
  });

  it('방에 멈추면 참먹이 쪽으로, 지나치면 반대편 모서리로 나간다', () => {
    const bang = FIELDS.find((f) => f.id === BANG_FIELD_ID)!;
    expect(bang.edges.find((e) => e.kind === 'next')!.to).toBe(
      shortcutFieldId(0, SHORTCUT_STEPS),
    );
    expect(bang.edges.find((e) => e.kind === 'through')!.to).toBe(
      shortcutFieldId(15, SHORTCUT_STEPS),
    );
    expect(routes.shortcut).toContain(shortcutFieldId(0, 1));
    expect(routes.through).toContain(outerFieldId(15));
  });

  /** 규칙문이 적은 칸 수와 실제 경로가 어긋나면 규칙이 거짓말을 한다. */
  it('규칙문의 11칸·20칸이 실제 경로와 같다', () => {
    expect(ruleText).toContain(
      `가장 짧은 길은 ${routes.shortcut.length - 1}칸`,
    );
    expect(ruleText).toContain(`바깥으로만 돌면 ${routes.outer.length - 1}칸`);
  });
});

describe('말 — 텐트형 카드 열여섯', () => {
  const svg = svgOf('tokens');

  it('4편 × 말 넷이 오림선과 산접기로 난다', () => {
    const cuts = [...svg.querySelectorAll('#pc-cut rect')];
    const folds = [...svg.querySelectorAll('#pc-fold-mountain line')];
    expect(cuts).toHaveLength(SIDES.length * TOKENS_PER_SIDE);
    expect(folds).toHaveLength(SIDES.length * TOKENS_PER_SIDE);
    for (const cut of cuts) {
      expect(Number(cut.getAttribute('width'))).toBe(TOKEN.cardWidthMm);
      expect(Number(cut.getAttribute('height'))).toBe(TOKEN_CARD_HEIGHT_MM);
    }
  });

  it('카드가 서로 겹치지 않고 시트 안에 있다', () => {
    const boxes = SIDES.flatMap((_, sideIndex) =>
      Array.from({ length: TOKENS_PER_SIDE }, (_, tokenIndex) => ({
        ...tokenCardOrigin(sideIndex, tokenIndex),
        widthMm: TOKEN.cardWidthMm,
        heightMm: TOKEN_CARD_HEIGHT_MM,
      })),
    );
    for (const box of boxes) {
      expect(box.xMm).toBeGreaterThanOrEqual(0);
      expect(box.yMm).toBeGreaterThanOrEqual(TOKEN.headerHeightMm);
      expect(box.xMm + box.widthMm).toBeLessThanOrEqual(TOKEN_SHEET.widthMm);
      expect(box.yMm + box.heightMm).toBeLessThanOrEqual(TOKEN_SHEET.heightMm);
    }
    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        const overlap =
          boxes[a].xMm < boxes[b].xMm + boxes[b].widthMm &&
          boxes[b].xMm < boxes[a].xMm + boxes[a].widthMm &&
          boxes[a].yMm < boxes[b].yMm + boxes[b].heightMm &&
          boxes[b].yMm < boxes[a].yMm + boxes[a].heightMm;
        expect(overlap, `카드 ${a}와 ${b}가 겹친다`).toBe(false);
      }
    }
  });

  /** 밭보다 넓은 말은 이웃 밭을 가려 어느 밭에 선 말인지 다투게 된다. */
  it('말이 가장 작은 밭 안에 선다', () => {
    expect(TOKEN.cardWidthMm).toBeLessThan(FIELD.smallRadiusMm * 2);
  });

  it('편마다 색 레이어가 있고 그 안에 그림과 색 띠가 두 면씩 있다', () => {
    for (const side of SIDES) {
      const layer = svg.querySelector(`#${sideLayerId(side.id)}`)!;
      expect(layer, `${side.id}편 레이어가 없다`).not.toBeNull();
      expect(layer.getAttribute('fill')).toBe(side.color);
      // 말 넷 × (그림 1 + 색 띠 1) × 두 면.
      expect(layer.children).toHaveLength(TOKENS_PER_SIDE * 2 * 2);
    }
  });

  /**
   * 편 이름은 말 넷 × 두 면에 찍힌다. 위쪽 면은 접으면 뒤집히므로 배치가 미리
   * 180° 돌려 둔다 — 절반이 돌아 있어야 한다.
   */
  it('편 이름이 말 넷의 앞뒤 두 면에 앉고 절반이 180° 돌아 있다', () => {
    for (const side of SIDES) {
      const slot = game.slots.find((s) => s.id === `side-${side.id}-name`)!;
      expect(slot.placements).toHaveLength(TOKENS_PER_SIDE * 2);
      const rotated = slot.placements.filter(
        (p) => p.mode === 'text' && p.rotationDeg === 180,
      );
      expect(rotated).toHaveLength(TOKENS_PER_SIDE);
    }
  });

  /**
   * 업힌 수는 밑동의 숫자로 센다. 첫 말은 비어 있고(한 마리는 셀 것이 없다)
   * 나머지 셋이 2·3·4를 맡는다. 두 면에 다 찍히므로 편마다 여섯이다.
   */
  it('업기 숫자가 편마다 2·3·4 두 벌씩이고 첫 말은 비어 있다', () => {
    expect(
      Array.from({ length: TOKENS_PER_SIDE }, (_, i) => carryLabel(i)),
    ).toEqual(['', '2', '3', '4']);
    const numbers = [...svg.querySelectorAll('text')]
      .map((t) => t.textContent ?? '')
      .filter((v) => /^[234]$/.test(v));
    expect(numbers).toHaveLength(SIDES.length * 3 * 2);
    // 뒤집히는 면의 숫자는 돌려 그린다 — 세우면 양쪽에서 다 바로 읽힌다.
    const rotated = [...svg.querySelectorAll('text[transform]')];
    expect(rotated).toHaveLength(SIDES.length * 3);
  });
});

describe('게임 방법 부속', () => {
  it('두 단 조판이 시트를 넘치지 않는다', () => {
    const { overflow, columnBottomsMm, lines } = layoutRulesSheet();
    expect(overflow, '규칙이 시트를 넘친다 — 글자가 아니라 글을 줄인다').toBe(
      false,
    );
    for (const bottom of columnBottomsMm) {
      expect(bottom).toBeLessThanOrEqual(RULES_SHEET.heightMm);
    }
    // 두 단을 다 쓴다. 한 단으로 끝난다면 시트가 지나치게 크다는 뜻이다.
    expect(columnBottomsMm[1]).toBeGreaterThan(50);
    expect(lines.length).toBeGreaterThan(RULES.length);
  });

  it('절 제목이 자기 첫 항목과 같은 단에 있다', () => {
    const { lines } = layoutRulesSheet();
    const headings = new Set(
      RULES.filter((b) => b.kind === 'heading').map((b) => b.text),
    );
    for (const [i, placed] of lines.entries()) {
      if (!headings.has(placed.value)) continue;
      const next = lines[i + 1];
      expect(next, `'${placed.value}' 뒤에 항목이 없다`).toBeDefined();
      expect(next.xMm, `'${placed.value}'만 단 끝에 남았다`).toBeCloseTo(
        placed.xMm,
        6,
      );
    }
  });

  it('백도를 선택 규칙으로 적고, 규칙을 바꿔 놀아도 된다고 적는다', () => {
    expect(ruleText).toContain('백도');
    expect(ruleText).toContain('빼고 놀아도');
    expect(ruleText).toContain('자유롭게 바꿔서 즐기세요');
  });

  /** 규칙문을 손으로 고치다 "걸(4칸)"처럼 어긋나면 인쇄물이 틀린 규칙을 싣는다. */
  it('윷가락이 내는 다섯 값과 칸 수가 규칙문과 같다', () => {
    for (const value of THROW_VALUES) {
      expect(ruleText, value.name).toContain(`${value.name}(${value.steps}칸)`);
    }
    expect(THROW_VALUES.map((v) => v.bellies)).toEqual([1, 2, 3, 4, 0]);
  });
});

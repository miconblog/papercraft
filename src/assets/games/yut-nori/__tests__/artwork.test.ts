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
  BAEKDO_STICK_INDEX,
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
  STICK,
  STICK_CAP_HEIGHT_MM,
  STICK_CAP_REACH_MM,
  STICK_CAP_TOP_WIDTH_MM,
  STICK_COUNT,
  STICK_HEIGHT_MM,
  STICK_NET,
  STICK_ORIGIN,
  STICK_PANELS,
  STICK_SHEET,
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
  stickBalance,
  stickFolds,
  stickNetOutline,
  stickNetTopMm,
  stickPanelTopMm,
  tokenCardOrigin,
} from '../dimensions';
import {
  RULES,
  STICK_ASSEMBLY_STEPS,
  STICK_THROW_NOTE,
  THROW_VALUES,
} from '../rules';

const game = getGame('yut-nori')!;

const svgOf = (partId: string): Document =>
  new DOMParser().parseFromString(ARTWORK[partId](), 'image/svg+xml');

const ruleText = RULES.map((block) => block.text).join('\n');

describe('도안 구조', () => {
  it('스키마 검증을 통과하고 말판·말·윷가락·게임 방법으로 나뉜다', () => {
    expect(game.parts.map((p) => p.kind)).toEqual([
      'board',
      'buildable',
      'buildable',
      'cutout',
    ]);
    expect(game.players).toEqual({ min: 2, max: 4 });
  });

  it('모든 파트가 아트워크를 갖고, 커밋된 SVG가 생성기와 같다', () => {
    expect(Object.keys(ARTWORK).sort()).toEqual([
      'board',
      'rules-sheet',
      'sticks',
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

describe('윷가락 — 반육각기둥 넉 장 (IDE-018)', () => {
  const balance = stickBalance();
  const outlines = Array.from({ length: STICK_COUNT }, (_, i) =>
    stickNetOutline(STICK_ORIGIN.xMm, stickNetTopMm(i)),
  );
  const bboxOf = (points: ReadonlyArray<readonly [number, number]>) => ({
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])),
    maxY: Math.max(...points.map((p) => p[1])),
  });

  /** 광선 쏘기. 다각형 안이면 오른쪽으로 그은 반직선이 변을 홀수 번 지난다. */
  const inside = (
    points: ReadonlyArray<readonly [number, number]>,
    xMm: number,
    yMm: number,
  ): boolean => {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (
        yi > yMm !== yj > yMm &&
        xMm < ((xj - xi) * (yMm - yi)) / (yj - yi) + xi
      ) {
        hit = !hit;
      }
    }
    return hit;
  };

  /**
   * 실제 윷은 통나무를 반으로 쪼갠 것이다. 배가 등면의 **두 배**여야 정육각형을
   * 가로로 자른 절반이 되고, 그때 높이가 (√3/4)·배다. 이 관계가 깨지면 도안은
   * 여전히 그려지지만 더는 "반으로 쪼갠 윷"이 아니다.
   */
  it('단면이 정육각형의 아래 절반이다', () => {
    expect(STICK.bellyMm).toBe(STICK.backFaceMm * 2);
    expect(STICK_HEIGHT_MM).toBeCloseTo((Math.sqrt(3) / 4) * STICK.bellyMm, 9);
    // 등 세 면이 모두 같아야 굴러 멈추는 자리가 고르다.
    const backs = STICK_PANELS.filter((p) => p.outer && p.face !== 'belly');
    expect(backs).toHaveLength(3);
    expect(new Set(backs.map((p) => p.widthMm)).size).toBe(1);
  });

  /**
   * 띠 일곱이 **한 방향 나선**이다. 바깥 넷이 단면의 둘레를 이루고, 남은 셋이
   * 그대로 안으로 들어가 등 쪽에 포개진다 — 접는 방향이 여섯 줄 모두 같은 것이
   * 이 차례를 고른 이유다.
   */
  it('바깥 넷이 단면 둘레를 이루고 속대 셋이 등 안쪽으로 들어간다', () => {
    const outer = STICK_PANELS.filter((p) => p.outer);
    expect(outer.map((p) => p.id)).toEqual([
      'back-1',
      'back-2',
      'back-3',
      'belly',
    ]);
    expect(outer.reduce((sum, p) => sum + p.widthMm, 0)).toBe(
      STICK.bellyMm + STICK.backFaceMm * 3,
    );
    const liner = STICK_PANELS.filter((p) => !p.outer);
    expect(liner).toHaveLength(3);
    // 속대가 배에 한 조각도 놓이지 않아야 무게가 등 쪽으로 간다.
    expect(liner.every((p) => p.face !== 'belly')).toBe(true);
    // 갈고리는 모서리를 넘기만 하면 되므로 등면보다 짧다.
    expect(STICK.linerHookMm).toBeLessThan(STICK.backFaceMm);
    expect(STICK_NET.heightMm).toBe(
      STICK_PANELS.reduce((sum, p) => sum + p.widthMm, 0),
    );
  });

  /**
   * **이 도안에서 겹이 하는 일이 골대와 다르다.** 골대의 두 겹은 강성뿐이었지만,
   * 윷가락은 겹을 어디에 넣느냐가 곧 눈이 나오는 비율이다 — 배에 넣으면 무게중심이
   * 내려가 배를 깔고 눕기만 한다. 속대를 등 쪽에 넣어 무게중심을 올린 것이
   * 이 이슈의 핵심 결정이고, 그것이 지켜지는지를 여기서 본다.
   */
  it('속대가 무게중심을 등 쪽으로 올린다', () => {
    expect(balance.centroidYMm).toBeGreaterThan(balance.shellOnlyCentroidYMm);
    // 껍데기만이면 단면 높이의 절반 아래에 있다 — 배가 가장 넓은 면이라 그렇다.
    expect(balance.shellOnlyCentroidYMm).toBeLessThan(STICK_HEIGHT_MM / 2);
    // 속대를 넣으면 절반을 넘어선다.
    expect(balance.centroidYMm).toBeGreaterThan(STICK_HEIGHT_MM / 2);
    expect(balance.centroidYMm).toBeLessThan(STICK_HEIGHT_MM);
  });

  /**
   * 빗면에 얹히는 것이 "모서리로 서는" 자리인데, 무게중심이 빗면 위에서 마루 쪽
   * 끝에 바짝 붙어 있어 조금만 흔들려도 마루로 넘어간다. 넘어가면 배가 위다.
   */
  it('빗면에 얹혀도 마루 쪽으로 넘어간다 — 모서리로 서지 않는다', () => {
    expect(balance.slantTipsToCrest).toBe(true);
    // 마루 쪽 끝에서 1mm도 안 떨어져 있다. 여기가 벌어지면 빗면으로 선다.
    expect(balance.slantMarginMm).toBeGreaterThan(0);
    expect(balance.slantMarginMm).toBeLessThan(1.5);
  });

  /**
   * **던져 보는 것을 대신하지 않는다.** 여기서 지키는 것은 하나다 — 빗면의 몫이
   * 어디로 가든 배가 위로 오는 비율이 반반 언저리에 있을 여지가 남는가.
   * 구간이 0.5를 품지 못하면 그 단면은 던져 보나 마나 한쪽으로 쏠린다.
   */
  it('배가 위로 올 몫의 구간이 반반을 품는다', () => {
    expect(balance.crestOnlyShare).toBeLessThan(0.5);
    expect(balance.bellyUpShare).toBeGreaterThan(0.5);
    // 각도 넷을 더하면 한 바퀴다 — 셈이 틀리면 여기가 먼저 깨진다.
    expect(
      Object.values(balance.wedgeDeg).reduce((sum, v) => sum + v, 0),
    ).toBeCloseTo(360, 6);
  });

  /**
   * 마구리는 관 안쪽에 세워 단면을 붙든다. 단면보다 크면 안 들어가고, 윗변이
   * 마루와 같으면 헐거워 관이 찌그러진다 — 마구리 높이에서 자른 단면의 폭이
   * 곧 윗변이어야 딱 맞는다.
   */
  it('마구리가 단면에 맞고 탭이 속대 밑으로 들어간다', () => {
    expect(STICK_CAP_HEIGHT_MM).toBeLessThan(STICK_HEIGHT_MM);
    expect(STICK.capClearanceMm).toBeGreaterThan(0);
    // 마루보다 낮은 자리에서 자른 단면이라 윗변이 마루보다 넓다.
    expect(STICK_CAP_TOP_WIDTH_MM).toBeGreaterThan(STICK.backFaceMm);
    expect(STICK_CAP_TOP_WIDTH_MM).toBeLessThan(STICK.bellyMm);
    // 탭은 마루보다 좁아야 속대와 등 사이로 들어간다.
    expect(STICK.capTabWidthMm).toBeLessThan(STICK.backFaceMm);
    expect(STICK.capTabTaperMm * 2).toBeLessThan(STICK.capTabWidthMm);
  });

  /**
   * **골대와 달리 홈이 없다.** 마구리는 배 띠의 끝에만 붙어 있고 이웃한 등1·등3의
   * 끝과는 꼭짓점 하나로만 만난다 — 띠 블록 밖(`x < 원점`)에 있는 윤곽점의 y가
   * 모두 배 띠 안쪽이면 맞닿은 변이 없다는 뜻이다.
   */
  it('마구리가 이웃 띠와 변을 나누지 않는다 — 오릴 홈이 없다', () => {
    const topMm = stickNetTopMm(0);
    const bellyTop = topMm + stickPanelTopMm('belly');
    const bellyBottom = bellyTop + STICK.bellyMm;
    const outside = outlines[0].filter(
      ([x]) => x < STICK_ORIGIN.xMm || x > STICK_ORIGIN.xMm + STICK_NET.widthMm,
    );
    expect(outside.length).toBeGreaterThan(0);
    for (const [x, y] of outside) {
      expect(y, `${x},${y}가 배 띠 밖으로 나갔다`).toBeGreaterThan(bellyTop);
      expect(y).toBeLessThan(bellyBottom);
    }
  });

  /**
   * 접는선이 오림선 밖에 있으면 접을 종이가 없는 자리를 접으라고 그린 것이다.
   * 마구리·탭 밑동이 윤곽 사이에 끼어 있어 눈으로는 잘 안 보인다.
   */
  it('접는선이 모두 오림선 안에 있다', () => {
    for (let i = 0; i < STICK_COUNT; i += 1) {
      const folds = stickFolds(STICK_ORIGIN.xMm, stickNetTopMm(i));
      for (const fold of folds) {
        for (const t of [0.15, 0.5, 0.85]) {
          const x = fold.fromMm[0] + (fold.toMm[0] - fold.fromMm[0]) * t;
          const y = fold.fromMm[1] + (fold.toMm[1] - fold.fromMm[1]) * t;
          expect(
            inside(outlines[i], x, y),
            `${i}번 가락의 '${fold.label}'이 오림선 밖이다`,
          ).toBe(true);
        }
      }
    }
  });

  it('접는선이 열 줄 — 산 여덟에 골 둘이고 골접기는 탭 밑동뿐이다', () => {
    const folds = stickFolds(0, 0);
    expect(folds).toHaveLength(10);
    const valleys = folds.filter((f) => f.kind === 'fold-valley');
    expect(valleys).toHaveLength(2);
    expect(valleys.every((f) => f.label.includes('탭 밑동'))).toBe(true);
    expect(folds.filter((f) => f.kind === 'fold-mountain')).toHaveLength(8);

    const doc = svgOf('sticks');
    expect(doc.getElementById('pc-fold-mountain')!.children.length).toBe(
      8 * STICK_COUNT,
    );
    expect(doc.getElementById('pc-fold-valley')!.children.length).toBe(
      2 * STICK_COUNT,
    );
    // 오림선은 전개도 넉 장의 바깥 윤곽뿐이다 — 뚫을 곳이 하나도 없다.
    expect(doc.getElementById('pc-cut')!.children.length).toBe(STICK_COUNT);
    // 풀칠면이 없다. 도안 정의의 `marks`와 그리는 표시가 어긋나면 조립 안내에
    // 있지도 않은 설명이 따라 나온다.
    expect(doc.getElementById('pc-glue')).toBeNull();
    const part = game.parts.find((p) => p.id === 'sticks')!;
    expect([...part.marks].sort()).toEqual([
      'cut',
      'fold-mountain',
      'fold-valley',
    ]);
  });

  it('넉 장이 서로 겹치지 않고 시트 안에 있다', () => {
    for (const [i, points] of outlines.entries()) {
      const box = bboxOf(points);
      expect(box.minX, `${i}번`).toBeGreaterThan(0);
      expect(box.minY, `${i}번`).toBeGreaterThanOrEqual(STICK.headerHeightMm);
      expect(box.maxX, `${i}번`).toBeLessThan(STICK_SHEET.widthMm);
      expect(box.maxY, `${i}번`).toBeLessThan(STICK_SHEET.heightMm);
      // 도해 단을 침범하지 않는다.
      expect(box.maxX, `${i}번이 도해 단을 먹는다`).toBeLessThan(144);
    }
    for (let a = 0; a < outlines.length; a += 1) {
      for (let b = a + 1; b < outlines.length; b += 1) {
        const [p, q] = [bboxOf(outlines[a]), bboxOf(outlines[b])];
        const overlaps =
          p.minX < q.maxX &&
          q.minX < p.maxX &&
          p.minY < q.maxY &&
          q.minY < p.maxY;
        expect(overlaps, `${a}번과 ${b}번이 겹친다`).toBe(false);
        // 가위가 지나갈 폭이 남아야 한다.
        expect(Math.abs(p.minY - q.minY)).toBeGreaterThanOrEqual(STICK.gapMm);
      }
    }
    // 마구리가 띠 블록 밖으로 뻗는 만큼을 좌우에 다 두고도 시트 안이다.
    expect(STICK_ORIGIN.xMm).toBeGreaterThan(STICK_CAP_REACH_MM);
  });

  /**
   * **조립물이 두 장으로 쪼개지면 이어 붙인 자리에서 전개도가 어긋난다**(골대
   * 시트와 같은 판단). 인쇄 여백은 사용자가 고르는 값이라, 흔히 쓰는 여백까지는
   * 한 장을 지켜야 한다.
   */
  it('인쇄 여백 8mm까지 A4 세로 한 장이다', () => {
    const marginMm = 8;
    expect(STICK_SHEET.widthMm).toBeLessThanOrEqual(210 - marginMm * 2);
    expect(STICK_SHEET.heightMm).toBeLessThanOrEqual(297 - marginMm * 2);
    expect(game.parts.find((p) => p.id === 'sticks')!.orientation).toBe(
      'portrait',
    );
  });

  /**
   * 배는 민짜, 등에는 나뭇결이다. 쪼갠 통나무의 겉과 쪼갠 자리를 옮긴 대비이고,
   * **접기 전에도** 어느 띠가 배인지 이것으로 갈린다.
   */
  it('나뭇결이 등 세 면에만 있고 배 띠는 비어 있다', () => {
    const grains = [
      ...svgOf('sticks').querySelectorAll('#pc-art g line'),
    ] as SVGLineElement[];
    // 결 하나가 두 도막이다 — 한 줄로 이으면 괘선이 되어 접는선과 헷갈린다.
    expect(grains).toHaveLength(STICK_COUNT * 3 * STICK.grainLines * 2);
    for (const g of grains) {
      const yMm = Number(g.getAttribute('y1'));
      expect(Number(g.getAttribute('y2'))).toBe(yMm);
      const topMm = stickNetTopMm(
        Math.floor(
          (yMm - STICK_ORIGIN.yMm) / (STICK_NET.heightMm + STICK.gapMm),
        ),
      );
      const bellyTop = topMm + stickPanelTopMm('belly');
      const onBelly = yMm > bellyTop && yMm < bellyTop + STICK.bellyMm;
      expect(onBelly, `배 띠(${yMm})에 결이 있다`).toBe(false);
      // 속대는 안으로 숨는 면이라 잉크를 쓰지 않는다.
      expect(yMm).toBeLessThan(bellyTop);
    }
  });

  /**
   * 백도는 "그 가락만 배로 나왔을 때"라 표식이 **배 면**에 있어야 한다. 색을 쓰지
   * 않는 것은 흑백으로 뽑아도 나머지 셋과 갈려야 하기 때문이다(`IDE-009` 규약).
   */
  it('백도 표식이 한 장의 배에만 있고 흑백으로도 갈린다', () => {
    const svg = ARTWORK.sticks();
    const doc = svgOf('sticks');
    // 과녁은 겹동그라미다 — 어느 쪽으로 누워도 같은 모양이라 방향을 타지 않는다.
    const marks = [...doc.querySelectorAll('#pc-art circle')].filter(
      (c) => Number(c.getAttribute('r')) >= 2,
    );
    expect(marks).toHaveLength(2);
    const topMm = stickNetTopMm(BAEKDO_STICK_INDEX);
    const bellyTop = topMm + stickPanelTopMm('belly');
    for (const mark of marks) {
      const cy = Number(mark.getAttribute('cy'));
      expect(cy).toBeGreaterThan(bellyTop);
      expect(cy).toBeLessThan(bellyTop + STICK.bellyMm);
      // 흑백 출력에서도 남으려면 색이 아니라 잉크여야 한다.
      const paint = `${mark.getAttribute('fill')}${mark.getAttribute('stroke')}`;
      expect(/#(dc2626|1d4ed8|15803d|7e22ce)/.test(paint)).toBe(false);
    }
    // 글자는 양 끝에 하나씩 — 마주 앉은 사람도 읽는다.
    expect(svg.split('>백도<').length - 1).toBe(2);
    expect(BAEKDO_STICK_INDEX).toBeLessThan(STICK_COUNT);
  });

  /** 시트의 번호와 규칙문의 번호가 어긋나면 "1번 속대"를 시트에서 못 찾는다. */
  it('규칙문의 조립 순서가 시트의 번호와 같은 말을 쓴다', () => {
    expect(STICK_ASSEMBLY_STEPS).toHaveLength(4);
    for (const step of STICK_ASSEMBLY_STEPS) {
      expect(ruleText).toContain(step);
    }
    const steps = STICK_ASSEMBLY_STEPS.join('\n');
    for (const [number, name] of [
      ['1', '속대'],
      ['2', '마구리'],
      ['3', '탭'],
    ]) {
      expect(steps, name).toContain(`${number}번 ${name}`);
      expect(ARTWORK.sticks(), name).toContain(`${number} ${name}`);
    }
    // 종이 윷은 가벼워 맨 상에서 튄다 — 던지는 자리를 규칙문이 일러 준다.
    expect(ruleText).toContain(STICK_THROW_NOTE);
  });
});

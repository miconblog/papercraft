/**
 * 세계일주 게임판 도안 검증 (IDE-015 · IDE-016)
 *
 * 종이 없이 확인할 수 있는 것을 여기서 강제한다. 규격을 어기지 않는지는
 * `parseGame`이 보고, **그 판으로 세계일주를 할 수 있는지**는 여기가 본다 —
 * 프리셋 여섯이 각각 서울에서 서울로 이어지는 한 바퀴인가, 칸이 겹치지 않는가,
 * 번호 원이 도시의 실제 위치를 가리지 않는가, 값에서 그때 그린 판이 값과 맞는가.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import {
  defaultCustomization,
  dynamicSize,
  resolvePart,
  validateCustomization,
} from '@/lib/schema';
import { composeExport } from '@/lib/print/compose';
import {
  defaultExportOptions,
  validateExportOptions,
} from '@/lib/print/options';
import { renderPdf } from '@/lib/print/pdf';
import { renderDynamicArtwork } from '@/lib/games/dynamic-artwork';
import {
  CITIES,
  LEG_ORDER,
  PRESET_COUNTS,
  SPECIALS,
  citiesFor,
  cityById,
  resolveSpecials,
} from '../cities';
import {
  BOARD,
  CITY_MARKER,
  DICE,
  DYNAMIC_SIZE_STEPS,
  MAP,
  NOTE_BAND,
  PAPER_STEPS,
  PIECES_SHEET,
  TITLE_BAND,
  TOKEN,
  TOKEN_STYLES,
  frameFor,
  paperFor,
  tokenCenter,
} from '../dimensions';
import { estimateTextWidthMm } from '../../../shared/svg';
import { PIECES_NOTES, PIECES_NOTE_FONT_MM } from '../artwork/pieces';
import {
  ROBINSON_ASPECT,
  projectToMap,
  relativeLon,
  ringToMapPolygons,
  unwrapRing,
} from '../projection';
import { ARTWORK, renderBoard } from '../artwork';
import { renderBoardRoute, SPECIAL_COLORS } from '../artwork/board';
import { MAP_ONLY_FRAME as RENDERER_MAP_ONLY } from '../artwork/dynamic';
import { MAP_ONLY_FRAME } from '@/lib/schema';
import {
  apart,
  coversPoint,
  footprint,
  layoutCities,
  layoutRoute,
  solidBox,
} from '../artwork/layout';
import { landMaskFor } from '../artwork/landmask';
import { GLUE_TAB_COUNT, OPPOSITE_FACE_SUMS } from '../artwork/dice';
import { DICE_ASSEMBLY_STEPS, RULES } from '../rules';

const game = getGame('world-tour')!;
const board = game.parts.find((p) => p.kind === 'board')!;
const citiesSlot = game.slots.find((s) => s.id === 'cities')!;

const parse = (svg: string): Document =>
  new DOMParser().parseFromString(svg, 'image/svg+xml');
const svgOf = (partId: string): Document => parse(ARTWORK[partId]());
const boardOf = (count: (typeof PRESET_COUNTS)[number], mapOnly = false) =>
  parse(renderBoard(count, mapOnly));

const ruleText = RULES.map((block) => block.text).join('\n');

const withCities = (ids: readonly string[], frame: 'full' | 'map' = 'full') => {
  const base = defaultCustomization(game);
  return {
    ...base,
    values: { ...base.values, cities: [...ids], 'board-frame': frame },
  };
};

describe('도안 구조', () => {
  it('스키마 검증을 통과하고 게임판 · 말과 주사위 한 장으로 나뉜다', () => {
    // 말과 주사위는 한 장이다(2026-09-11 사용자 요청) — 따로면 종이가 두 장 나왔다.
    expect(game.parts.map((p) => [p.id, p.kind])).toEqual([
      ['board', 'board'],
      ['pieces', 'buildable'],
    ]);
    // 마커 슬롯이 없는 첫 게임이다 — 말은 놀이 중에 움직인다.
    expect(game.styleSets).toHaveLength(0);
    expect(game.presets).toHaveLength(0);
    expect(game.players).toEqual({ min: 2, max: 6 });
  });

  it('커밋된 SVG가 생성기와 같다 — 기본 판 · 말과 주사위', () => {
    expect(Object.keys(ARTWORK).sort()).toEqual(['board', 'pieces']);
    for (const id of Object.keys(ARTWORK)) {
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'world-tour', `${id}.svg`),
        'utf8',
      );
      expect(
        committed,
        `${id}.svg가 낡았다 — \`npm run artwork world-tour\`를 돌린다`,
      ).toBe(ARTWORK[id]());
    }
    for (const part of game.parts) {
      expect(part.artwork).toBe(`/games/world-tour/${part.id}.svg`);
    }
  });

  it('말 여섯이 그룹 하나씩 — 이름 슬롯과 색 슬롯을 가리킨다', () => {
    expect(game.groups).toHaveLength(6);
    for (const style of TOKEN_STYLES) {
      const group = game.groups.find((g) => g.id === `token-${style.id}`)!;
      const name = game.slots.find((s) => s.id === group.nameSlotId)!;
      const color = game.slots.find((s) => s.id === group.colorSlotId)!;
      expect(name.kind).toBe('text');
      expect(color.kind).toBe('color');
      expect(color.default).toBe(style.color);
      expect(
        color.placements.some(
          (p) => p.mode === 'paint' && p.layerId === `pc-token-${style.id}`,
        ),
      ).toBe(true);
    }
    expect(new Set(TOKEN_STYLES.map((s) => s.color)).size).toBe(6);
    expect(new Set(TOKEN_STYLES.map((s) => s.shape)).size).toBe(6);
  });
});

describe('도시와 경로', () => {
  it('도시 id가 유일하고 서울에서 시작하며 제주는 없다', () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    expect(CITIES[0].id).toBe('seoul');
    expect(CITIES[0].fixed).toBe(true);
    expect(CITIES.filter((c) => c.fixed)).toHaveLength(1);
    // 2026-09-08 사용자 결정 — 서울과 함께 적기엔 너무 조밀하다.
    expect(CITIES.some((c) => c.id === 'jeju' || c.name === '제주')).toBe(
      false,
    );
  });

  it('프리셋 여섯이 정확히 50·60·70·80·90·100개이고 중첩이다', () => {
    let previous = new Set<string>();
    for (const count of PRESET_COUNTS) {
      const route = citiesFor(count);
      expect(route.length, `프리셋 ${count}`).toBe(count);
      const ids = new Set(route.map((c) => c.id));
      for (const id of previous) expect(ids.has(id), id).toBe(true);
      previous = ids;
      expect(route[0].id).toBe('seoul');
    }
    // 토글 전용(rank 0) 도시도 있다.
    expect(CITIES.some((c) => c.rank === 0)).toBe(true);
  });

  it('구간이 사용자가 정한 차례대로 이어진다', () => {
    const legs = CITIES.map((c) => c.leg);
    let legIndex = 0;
    for (const leg of legs) {
      const i = LEG_ORDER.indexOf(leg);
      expect(i, leg).toBeGreaterThanOrEqual(legIndex);
      legIndex = i;
    }
    expect(new Set(legs)).toEqual(new Set(LEG_ORDER));
  });

  it('특수칸은 넷 — 급행·후퇴·다시·쉼 — 이고 호스트가 전부 50 프리셋에 있다', () => {
    // 2026-09-08 규칙 변경: "또"는 없고, 급행·후퇴는 주사위를 다시 굴려 그 수만큼
    // 앞·뒤로 간다. 목적지가 없으니 도시를 켜고 꺼도 아무것도 안 밀린다.
    const kinds = new Set(SPECIALS.map((s) => s.kind));
    expect(kinds).toEqual(new Set(['forward', 'back', 'restart', 'rest']));
    const base = new Set(citiesFor(50).map((c) => c.id));
    for (const special of SPECIALS) {
      expect(base.has(special.cityId), special.cityId).toBe(true);
    }
    expect(SPECIALS.some((s) => s.cityId === 'seoul')).toBe(false);
    expect(SPECIALS.filter((s) => s.kind === 'restart')).toHaveLength(1);
    for (const count of PRESET_COUNTS) {
      expect(resolveSpecials(citiesFor(count))).toHaveLength(SPECIALS.length);
    }
  });

  it('호스트가 꺼진 특수칸은 조용히 빠진다', () => {
    const withoutTokyo = citiesFor(50).filter((c) => c.id !== 'tokyo');
    expect(resolveSpecials(withoutTokyo)).toHaveLength(SPECIALS.length - 1);
  });
});

describe('투영', () => {
  it('지도 상자 높이가 로빈슨 가로세로비와 맞다', () => {
    expect(MAP.heightMm).toBeCloseTo(BOARD.widthMm / ROBINSON_ASPECT, 1);
    expect(TITLE_BAND.heightMm + MAP.heightMm + NOTE_BAND.heightMm).toBeCloseTo(
      BOARD.heightMm,
      6,
    );
  });

  it('태평양 중심이다 — 서울은 가운데 왼쪽, 뉴욕은 오른쪽 끝 가까이, 런던은 왼쪽 끝 가까이', () => {
    expect(relativeLon(150)).toBe(0);
    expect(relativeLon(-30)).toBe(-180);
    const seoul = projectToMap(126.98, 37.57, MAP);
    const newYork = projectToMap(-74, 40.7, MAP);
    const london = projectToMap(-0.13, 51.5, MAP);
    const honolulu = projectToMap(-157.9, 21.3, MAP);
    const center = MAP.xMm + MAP.widthMm / 2;
    expect(seoul.xMm).toBeLessThan(center);
    expect(seoul.xMm).toBeGreaterThan(center - 30);
    expect(honolulu.xMm).toBeGreaterThan(center);
    expect(newYork.xMm).toBeGreaterThan(MAP.xMm + MAP.widthMm * 0.8);
    expect(london.xMm).toBeLessThan(MAP.xMm + MAP.widthMm * 0.2);
    const lima = projectToMap(-77, -12, MAP);
    expect(seoul.xMm).toBeLessThan(honolulu.xMm);
    expect(honolulu.xMm).toBeLessThan(lima.xMm);
  });

  it('지도 끝에 걸친 고리는 두 조각이 되고, 극을 감싸는 고리는 대륙을 가르지 않는다', () => {
    const straddling = [
      [-40, 60],
      [-20, 60],
      [-20, 70],
      [-40, 70],
    ] as const;
    expect(ringToMapPolygons(straddling, MAP)).toHaveLength(2);

    const polar = Array.from(
      { length: 36 },
      (_, i) => [-180 + i * 10, -70] as const,
    );
    const unwrapped = unwrapRing(polar);
    expect(Math.abs(unwrapped[0][0])).toBe(180);
    expect(unwrapped[unwrapped.length - 1][1]).toBe(-90);
    const cap = ringToMapPolygons(polar, MAP);
    expect(cap.length).toBeGreaterThanOrEqual(1);
    for (const polygon of cap) {
      for (const [x, y] of polygon) {
        expect(x).toBeGreaterThanOrEqual(MAP.xMm - 1e-6);
        expect(x).toBeLessThanOrEqual(MAP.xMm + MAP.widthMm + 1e-6);
        expect(y).toBeLessThanOrEqual(MAP.yMm + MAP.heightMm + 1e-6);
        expect(y).toBeGreaterThan(projectToMap(0, -69, MAP).yMm);
      }
    }
  });
});

describe('종이 크기', () => {
  it('도시 수에 따라 A4 → A3 → A2로 커지고, 틀은 A4의 배율이다', () => {
    expect(paperFor(50).label).toBe('A4');
    expect(paperFor(60).label).toBe('A3');
    expect(paperFor(70).label).toBe('A3');
    expect(paperFor(80).label).toBe('A2');
    expect(paperFor(100).label).toBe('A2');
    expect(PAPER_STEPS.map((s) => s.sheets)).toEqual([1, 2, 4]);
    for (const count of PRESET_COUNTS) {
      const frame = frameFor(count);
      expect(
        frame.titleBand.heightMm + frame.map.heightMm + frame.noteBand.heightMm,
      ).toBeCloseTo(frame.board.heightMm, 6);
      expect(frame.map.widthMm).toBe(frame.board.widthMm);
      expect(frame.map.widthMm / frame.map.heightMm).toBeCloseTo(
        ROBINSON_ASPECT,
        2,
      );
      expect(
        (frame.board.widthMm * frame.board.heightMm) /
          (BOARD.widthMm * BOARD.heightMm),
      ).toBeCloseTo(frame.paper.sheets, 1);
      // 지도만이면 판이 곧 지도 상자다.
      const mapOnly = frameFor(count, true);
      expect(mapOnly.board.heightMm).toBe(mapOnly.map.heightMm);
      expect(mapOnly.map.yMm).toBe(0);
      expect(mapOnly.titleBand.heightMm).toBe(0);
    }
  });

  it('도안 정의의 크기 단계가 렌더러의 종이 표와 같다', () => {
    expect(board.dynamic?.sizeSteps).toEqual(DYNAMIC_SIZE_STEPS);
    for (const step of DYNAMIC_SIZE_STEPS) {
      const frame = frameFor(step.maxItems);
      expect([step.widthMm, step.heightMm]).toEqual([
        frame.board.widthMm,
        frame.board.heightMm,
      ]);
      expect(step.mapHeightMm).toBe(frame.map.heightMm);
    }
  });
});

describe('칸 배치', () => {
  for (const count of PRESET_COUNTS) {
    it(`도시 ${count}개 — 칸이 지도 안에 있고 서로 겹치지 않는다`, () => {
      const placed = layoutRoute(count);
      const map = frameFor(count).map;
      expect(placed).toHaveLength(count);
      const boxes = placed.map(footprint);
      for (const [i, box] of boxes.entries()) {
        const id = placed[i].city.id;
        expect(box.left, id).toBeGreaterThanOrEqual(map.xMm);
        expect(box.right, id).toBeLessThanOrEqual(map.xMm + map.widthMm);
        expect(box.top, id).toBeGreaterThanOrEqual(map.yMm);
        expect(box.bottom, id).toBeLessThanOrEqual(map.yMm + map.heightMm);
      }
      for (let a = 0; a < boxes.length; a += 1) {
        for (let b = a + 1; b < boxes.length; b += 1) {
          expect(
            apart(boxes[a], boxes[b]),
            `${placed[a].city.id} · ${placed[b].city.id}`,
          ).toBe(true);
        }
      }
    });
  }

  const displacements = (placed: ReturnType<typeof layoutRoute>): number[] =>
    placed.map((p) => Math.hypot(p.xMm - p.anchor.xMm, p.yMm - p.anchor.yMm));
  const average = (values: number[]): number =>
    values.reduce((a, b) => a + b, 0) / values.length;

  it('번호 원이 어느 도시의 실제 위치도 덮지 않는다 — 점이 곧 지리다', () => {
    for (const count of PRESET_COUNTS) {
      const placed = layoutRoute(count);
      for (const p of placed) {
        const solid = solidBox(p);
        for (const q of placed) {
          expect(
            coversPoint(solid, q.anchor, CITY_MARKER.anchorDotRadiusMm),
            `${count}: ${p.city.id}의 원이 ${q.city.id}의 점을 덮는다`,
          ).toBe(false);
        }
      }
    }
  });

  it('원은 대부분 바다에 앉고, 실제 위치에서 멀리 가지 않는다', () => {
    for (const count of PRESET_COUNTS) {
      const placed = layoutRoute(count);
      const mask = landMaskFor(frameFor(count).map);
      const atSea = placed.filter((p) => !mask.isLand(p.xMm, p.yMm)).length;
      expect(atSea / count, `${count}: 바다에 앉은 비율`).toBeGreaterThan(0.7);
      const d = displacements(placed);
      expect(Math.max(...d), `${count}: 최대 밀림`).toBeLessThan(30);
      expect(average(d), `${count}: 평균 밀림`).toBeLessThan(10);
    }
  });

  it('종이를 키우면 같은 도시들이 실제 위치 가까이 앉는다 — 배율로 키우는 것과 다른 점', () => {
    for (const count of [60, 70, 80, 90, 100] as const) {
      const route = citiesFor(count);
      const onA4 = average(
        displacements(layoutCities(route, frameFor(50).map)),
      );
      const onOwn = average(displacements(layoutRoute(count)));
      expect(onOwn, `${count}`).toBeLessThan(onA4);
    }
  });

  it('임의의 도시 목록도 같은 조건으로 놓인다 — 토글 편집이 주는 목록', () => {
    // 프리셋이 아닌 목록: 50개 묶음에서 여덟을 끄고 토글 전용 다섯을 켰다.
    const off = new Set([
      'guam',
      'lima',
      'chicago',
      'berlin',
      'lagos',
      'jerusalem',
      'mumbai',
      'darwin',
    ]);
    const route = [
      ...citiesFor(50).filter((c) => !off.has(c.id)),
      ...['medellin', 'boston', 'munich', 'yangon', 'busan'].map(cityById),
    ];
    const placed = layoutCities(route, frameFor(route.length).map);
    expect(placed).toHaveLength(route.length);
    const boxes = placed.map(footprint);
    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        expect(apart(boxes[a], boxes[b])).toBe(true);
      }
    }
  });

  it('풀의 도시를 전부 켜도 A2에 다 놓인다', () => {
    const placed = layoutCities(CITIES, frameFor(CITIES.length).map);
    expect(placed).toHaveLength(CITIES.length);
    expect(paperFor(CITIES.length).label).toBe('A2');
    const boxes = placed.map(footprint);
    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        expect(apart(boxes[a], boxes[b])).toBe(true);
      }
    }
  });

  it('같은 입력이면 같은 배치다 — 미리보기와 PDF가 같은 그림이어야 한다', () => {
    const a = layoutRoute(100).map((p) => [p.xMm, p.yMm]);
    const b = layoutRoute(100).map((p) => [p.xMm, p.yMm]);
    expect(a).toEqual(b);
  });
});

describe('게임판 SVG', () => {
  for (const count of PRESET_COUNTS) {
    it(`도시 ${count}개 판 — 도시 이름·번호·화살표·특수칸이 다 있다`, () => {
      const doc = boardOf(count);
      const textContent = doc.documentElement.textContent ?? '';
      const route = citiesFor(count);
      for (const city of route) {
        expect(textContent, city.name).toContain(city.name);
      }
      expect(textContent).toContain(`도시 ${count}개`);
      expect(textContent).toContain(paperFor(count).label);
      expect(textContent).toContain('출발');
      expect(doc.documentElement.getAttribute('width')).toBe(
        `${frameFor(count).board.widthMm}mm`,
      );
      const numbers = [...doc.querySelectorAll('#pc-cities text')]
        .map((t) => t.textContent ?? '')
        .filter((t) => /^\d+$/.test(t))
        .map(Number)
        .sort((x, y) => x - y);
      expect(numbers).toEqual(
        Array.from({ length: count - 1 }, (_, i) => i + 1),
      );
      expect(doc.querySelectorAll('#pc-route path')).toHaveLength(count);
      expect(doc.querySelectorAll('#pc-anchors circle')).toHaveLength(
        count * 2,
      );
      const chips = doc.querySelectorAll(
        Object.values(SPECIAL_COLORS)
          .map((c) => `#pc-cities rect[fill="${c}"]`)
          .join(', '),
      );
      expect(chips.length).toBe(resolveSpecials(route).length);
      // 번호 딸린 표식은 이제 없다 — 급행·후퇴는 주사위를 다시 굴린다.
      expect(textContent).not.toMatch(/급행 \d|후퇴 \d|또/);
    });
  }

  it('지도만 — 띠가 없고 판 높이가 지도 높이다', () => {
    const doc = boardOf(50, true);
    expect(doc.getElementById('pc-title')).toBeNull();
    expect(doc.getElementById('pc-note')).toBeNull();
    expect(doc.documentElement.getAttribute('height')).toBe(
      `${frameFor(50, true).map.heightMm}mm`,
    );
    // 칸은 그대로 다 있다.
    expect(doc.querySelectorAll('#pc-route path')).toHaveLength(50);
  });

  it('땅이 지도 상자 안에만 그려진다 — 렌더러가 클립을 받지 않는다', () => {
    for (const count of [50, 100] as const) {
      const map = frameFor(count).map;
      const doc = boardOf(count);
      const land = doc.querySelectorAll('#pc-land path');
      expect(land.length).toBeGreaterThan(100);
      const re = /[ML](-?[\d.]+) (-?[\d.]+)/g;
      for (const p of land) {
        const d = p.getAttribute('d') ?? '';
        let m: RegExpExecArray | null;
        while ((m = re.exec(d)) !== null) {
          const x = Number(m[1]);
          const y = Number(m[2]);
          expect(x).toBeGreaterThanOrEqual(map.xMm - 0.01);
          expect(x).toBeLessThanOrEqual(map.xMm + map.widthMm + 0.01);
          expect(y).toBeGreaterThanOrEqual(map.yMm - 0.01);
          expect(y).toBeLessThanOrEqual(map.yMm + map.heightMm + 0.01);
        }
      }
    }
  });

  it('범례가 특수칸 넷을 다 설명하고 "또"는 없다', () => {
    const textContent = svgOf('board').documentElement.textContent ?? '';
    for (const term of ['급행', '후퇴', '다시', '쉼', 'Natural Earth']) {
      expect(textContent, term).toContain(term);
    }
    expect(textContent).not.toContain('한 번 더 던진다');
    expect(textContent).not.toContain('제주');
  });
});

describe('값에서 그때 그리기 — 목록 슬롯과 동적 파트 (IDE-016)', () => {
  it('렌더러와 스키마가 "지도만" 값을 같은 글자로 안다', () => {
    expect(RENDERER_MAP_ONLY).toBe(MAP_ONLY_FRAME);
  });

  it('목록 슬롯이 도시 전부를 묶음별로 들고, 프리셋 여섯과 고정 서울이 있다', () => {
    expect(citiesSlot.kind).toBe('list');
    if (citiesSlot.kind !== 'list') return;
    expect(citiesSlot.options.map((o) => o.value)).toEqual(
      CITIES.map((c) => c.id),
    );
    expect(citiesSlot.fixed).toEqual(['seoul']);
    expect(citiesSlot.presets.map((p) => p.values.length)).toEqual([
      ...PRESET_COUNTS,
    ]);
    expect(citiesSlot.default).toEqual(citiesFor(50).map((c) => c.id));
    expect(board.dynamic?.listSlotId).toBe('cities');
    expect(board.dynamic?.frameSlotId).toBe('board-frame');
  });

  it('켠 도시 수에 따라 파트 크기가 바뀌고, 지도만이면 지도 높이다', () => {
    const base = defaultCustomization(game);
    expect(resolvePart(game, board, base).widthMm).toBe(297);
    const hundred = withCities(citiesFor(100).map((c) => c.id));
    expect(dynamicSize(board, hundred)).toMatchObject({
      widthMm: 594,
      heightMm: 420,
      itemCount: 100,
      mapOnly: false,
    });
    const mapOnly = withCities(
      citiesFor(60).map((c) => c.id),
      'map',
    );
    expect(dynamicSize(board, mapOnly)).toMatchObject({
      widthMm: 420,
      heightMm: frameFor(60, true).map.heightMm,
      mapOnly: true,
    });
  });

  it('값이 규격을 지키는지 — 서울을 빼거나 모르는 도시를 넣으면 막힌다', () => {
    const ok = withCities(['seoul', 'tokyo', 'honolulu', 'lima', 'santiago']);
    expect(validateCustomization(game, ok)).toEqual([]);
    const noSeoul = withCities([
      'tokyo',
      'honolulu',
      'lima',
      'santiago',
      'rio',
    ]);
    expect(validateCustomization(game, noSeoul).map((i) => i.message)).toEqual([
      expect.stringContaining('서울'),
    ]);
    const unknown = withCities(['seoul', 'atlantis', 'tokyo', 'lima', 'rio']);
    expect(validateCustomization(game, unknown)).not.toEqual([]);
    const tooFew = withCities(['seoul', 'tokyo']);
    expect(validateCustomization(game, tooFew)).not.toEqual([]);
  });

  it('임의의 도시 목록과 차례가 판에 그대로 나온다 — 번호는 목록 차례다', () => {
    const ids = ['seoul', 'paris', 'tokyo', 'cape-town', 'lima', 'busan'];
    const svg = renderDynamicArtwork(game, board, withCities(ids));
    const doc = parse(svg);
    const labels = [...doc.querySelectorAll('#pc-cities text')].map(
      (t) => t.textContent ?? '',
    );
    // 번호 1~5가 목록 차례로 붙는다: 파리 1, 도쿄 2, …
    for (const [i, id] of ids.slice(1).entries()) {
      const name = cityById(id).name;
      const at = labels.indexOf(name);
      expect(at, name).toBeGreaterThan(0);
      expect(labels[at - 1]).toBe(String(i + 1));
    }
    expect(doc.querySelectorAll('#pc-route path')).toHaveLength(ids.length);
    expect(doc.documentElement.textContent).toContain('도시 6개');
  });

  it('검색해서 더한 도시(옵션 밖)가 값의 이름·경위도로 그려진다', () => {
    const ljubljana = {
      id: 'ne-1',
      label: '류블랴나',
      data: { lon: 14.51, lat: 46.05 },
    };
    const customization = {
      ...defaultCustomization(game),
      values: {
        ...defaultCustomization(game).values,
        cities: ['seoul', 'tokyo', 'paris', ljubljana, 'rome', 'cairo'],
      },
    };
    expect(validateCustomization(game, customization)).toEqual([]);
    expect(citiesSlot.kind === 'list' && citiesSlot.custom).toBe(true);
    expect(citiesSlot.kind === 'list' && citiesSlot.search?.providerId).toBe(
      'world-cities',
    );
    const doc = parse(renderDynamicArtwork(game, board, customization));
    const labels = [...doc.querySelectorAll('#pc-cities text')].map(
      (t) => t.textContent ?? '',
    );
    expect(labels).toContain('류블랴나');
    expect(labels[labels.indexOf('류블랴나') - 1]).toBe('3');
    // 크기 단계는 항목 수를 센다 — 직접 더한 것도 하나다.
    expect(dynamicSize(board, customization).itemCount).toBe(6);
  });

  it('직접 더한 항목을 허용하지 않는 값 — 모양이 틀리면 막힌다', () => {
    const broken = {
      ...defaultCustomization(game),
      values: {
        ...defaultCustomization(game).values,
        cities: ['seoul', 'tokyo', 'paris', { id: 'x' }, 'rome'],
      },
    } as unknown as ReturnType<typeof defaultCustomization>;
    expect(validateCustomization(game, broken)).not.toEqual([]);
  });

  it('서울이 목록 가운데 있어도 서울부터 시작한다', () => {
    const doc = parse(
      renderBoardRoute({
        route: ['tokyo', 'lima', 'seoul', 'paris', 'cairo'].map(cityById),
      }),
    );
    const labels = [...doc.querySelectorAll('#pc-cities text')].map(
      (t) => t.textContent ?? '',
    );
    expect(labels.indexOf('출발')).toBeGreaterThanOrEqual(0);
    // 파리가 1, 카이로 2, 도쿄 3, 리마 4.
    expect(labels[labels.indexOf('파리') - 1]).toBe('1');
    expect(labels[labels.indexOf('도쿄') - 1]).toBe('3');
  });

  it(
    '100개 판을 지도만으로 고르면 인쇄물이 A2 폭·지도 높이로 짜이고 PDF까지 나온다',
    { timeout: 30_000 },
    async () => {
      const customization = withCities(
        citiesFor(100).map((c) => c.id),
        'map',
      );
      const options = {
        ...defaultExportOptions(game),
        parts: [{ partId: board.id, scale: 1, copies: 1 }],
      };
      expect(validateExportOptions(game, options, customization)).toEqual([]);
      const doc = composeExport({
        game,
        customization,
        options,
        loadArtwork: (ref) =>
          readFileSync(join(process.cwd(), 'public', ref), 'utf8'),
        renderArtwork: (part, values) =>
          renderDynamicArtwork(game, part, values),
      });
      expect(doc.parts[0].part.widthMm).toBe(594);
      expect(doc.parts[0].part.heightMm).toBe(frameFor(100, true).map.heightMm);
      expect(doc.pages.length).toBeGreaterThanOrEqual(4);
      const pdf = await renderPdf(doc);
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    },
  );

  it('동적 파트인데 렌더러가 없으면 합성이 실패한다 — 고른 도시가 빠진 채 뽑히면 안 된다', () => {
    expect(() =>
      composeExport({
        game,
        customization: defaultCustomization(game),
        options: {
          ...defaultExportOptions(game),
          parts: [{ partId: board.id, scale: 1, copies: 1 }],
        },
        loadArtwork: (ref) =>
          readFileSync(join(process.cwd(), 'public', ref), 'utf8'),
      }),
    ).toThrow(/렌더러/);
  });
});

describe('말과 주사위', () => {
  it('말 여섯 — 오림 원 여섯, 색 레이어 여섯', () => {
    const doc = svgOf('pieces');
    expect(
      doc.getElementById('pc-cut')!.querySelectorAll('circle'),
    ).toHaveLength(6);
    for (const style of TOKEN_STYLES) {
      const layer = doc.getElementById(`pc-token-${style.id}`)!;
      expect(layer, `pc-token-${style.id}`).not.toBeNull();
      expect(layer.getAttribute('fill')).toBe(style.color);
    }
  });

  it('주사위 — 오림선 하나, 접는선 열둘, 풀칠면 일곱, 마주 보는 면의 합이 7', () => {
    const doc = svgOf('pieces');
    expect(doc.getElementById('pc-cut')!.querySelectorAll('path')).toHaveLength(
      1,
    );
    expect(
      doc.getElementById('pc-fold-valley')!.querySelectorAll('line'),
    ).toHaveLength(12);
    expect(GLUE_TAB_COUNT).toBe(7);
    expect(
      doc.getElementById('pc-glue')!.querySelectorAll('line').length,
    ).toBeGreaterThan(GLUE_TAB_COUNT);
    expect(OPPOSITE_FACE_SUMS).toEqual([7, 7, 7]);
    expect(
      doc.querySelectorAll(`#pc-art circle[r="${DICE.pipRadiusMm}"]`),
    ).toHaveLength(21);
  });

  it('한 장 안에서 전개도와 말 여섯이 제목 띠 아래에 겹치지 않고 들어간다', () => {
    const margin = 3;
    const within = (box: { l: number; t: number; r: number; b: number }) =>
      box.l >= margin &&
      box.r <= PIECES_SHEET.widthMm - margin &&
      box.t >= PIECES_SHEET.headerHeightMm &&
      box.b <= PIECES_SHEET.heightMm - margin;
    const net = {
      l: DICE.originXMm,
      t: DICE.originYMm,
      r: DICE.originXMm + DICE.netWidthMm,
      b: DICE.originYMm + DICE.netHeightMm,
    };
    expect(within(net), '전개도').toBe(true);
    for (const style of TOKEN_STYLES) {
      const { xMm, yMm } = tokenCenter(style.id);
      const disc = {
        l: xMm - TOKEN.radiusMm,
        t: yMm - TOKEN.radiusMm,
        r: xMm + TOKEN.radiusMm,
        b: yMm + TOKEN.radiusMm,
      };
      expect(within(disc), `말 ${style.id}`).toBe(true);
      // 가위가 지나갈 틈 — 전개도 상자와 원판 사이.
      expect(disc.l - net.r, `말 ${style.id}`).toBeGreaterThanOrEqual(margin);
    }
    for (const note of PIECES_NOTES) {
      expect(
        estimateTextWidthMm(note, PIECES_NOTE_FONT_MM),
        note,
      ).toBeLessThanOrEqual(PIECES_SHEET.widthMm - 2 * margin);
    }
  });
});

describe('게임 방법', () => {
  it('특수칸 넷과 도착 규칙이 적혀 있고, "또"와 제주는 없다', () => {
    for (const term of [
      '급행',
      '후퇴',
      '다시',
      '쉼',
      '서울',
      '한 번 더 굴려',
    ]) {
      expect(ruleText, term).toContain(term);
    }
    expect(ruleText).not.toMatch(/또\(/);
    expect(ruleText).not.toContain('제주');
  });

  it('주사위 접는 법이 풀을 부른다 — 정육면체는 풀 없이 닫히지 않는다', () => {
    expect(DICE_ASSEMBLY_STEPS.join('\n')).toContain('풀');
    expect(game.supplies).toContain('풀');
  });
});

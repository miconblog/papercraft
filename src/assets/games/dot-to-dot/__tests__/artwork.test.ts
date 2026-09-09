/**
 * 점 잇기 도안 검증 (IDE-019)
 *
 * 종이 없이 확인할 수 있는 것을 여기서 강제한다. 규격을 어기지 않는지는
 * `parseGame`이 보고, **사진 한 장에서 뽑을 수 있는 종이가 나오는지**는 여기가
 * 본다 — 픽셀에서 시작해 점·번호가 찍힌 한 장까지, 그리고 사진이 서버 요청
 * 본문에 실리지 않는지까지.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { renderDynamicArtwork } from '@/lib/games/dynamic-artwork';
import {
  customizationBody,
  defaultCustomization,
  dynamicSourceSlots,
  resolvePart,
  validateCustomization,
  type GameCustomization,
  type SlotValue,
} from '@/lib/schema';
import { formatPlayers } from '@/lib/games/format';
import { parseArtwork } from '@/lib/print/artwork';
import { composeExport } from '@/lib/print/compose';
import {
  defaultExportOptions,
  validateExportOptions,
} from '@/lib/print/options';
import { renderPdf } from '@/lib/print/pdf';
import {
  dotCapacity,
  planDots,
  toPoints,
  traceOutline,
} from '@/lib/dot-to-dot';
import {
  blank,
  fillPolygon,
  starPoints,
} from '@/lib/dot-to-dot/__tests__/shapes';
import { ARTWORK } from '../artwork';
import { renderBoard } from '../artwork/board';
import { GUIDE_ON, GUIDE_SLOT_ID } from '../artwork/dynamic';
import {
  ANSWER,
  ART_AREA,
  BOARD,
  GUIDE_COLOR,
  METRICS,
  OUTLINE_BOX,
  SAMPLE_OUTLINE,
} from '../dimensions';
import { DOT_COUNT_RANGE } from '..';
import { PHOTO_TIP, RULES } from '../rules';

const game = getGame('dot-to-dot')!;
const board = game.parts.find((p) => p.kind === 'board')!;
const answer = game.parts.find((p) => p.kind === 'cutout')!;

const parse = (svg: string): Document =>
  new DOMParser().parseFromString(svg, 'image/svg+xml');

const withValues = (values: Record<string, SlotValue>): GameCustomization => {
  const base = defaultCustomization(game);
  return { ...base, values: { ...base.values, ...values } };
};

const ruleText = RULES.map((block) => block.text).join('\n');

describe('도안 구조', () => {
  it('스키마 검증을 통과하고 판 하나 · 완성 그림 하나로 나뉜다', () => {
    expect(game.parts).toHaveLength(2);
    expect(board.widthMm).toBe(190);
    expect(board.heightMm).toBe(277);
    expect(board.orientation).toBe('portrait');
    expect(answer.marks).toContain('cut');
    // 판 위에 놓고 시작하는 말이 없다 — 마커도 프리셋도 없다.
    expect(game.styleSets).toHaveLength(0);
    expect(game.presets).toHaveLength(0);
  });

  it('혼자 하는 첫 놀이다 — 카탈로그가 "1인용"으로 읽는다', () => {
    expect(game.players).toEqual({ min: 1, max: 1 });
    // 최소·최대가 같으면 한 번만 적는다. "1~1인용"이 나오면 안 된다.
    expect(formatPlayers(game.players)).toBe('1인용');
  });

  it('두 파트가 모두 동적이고, 크기 단계가 없다', () => {
    for (const part of game.parts) {
      expect(part.dynamic, part.id).toBeDefined();
      // 사진이 무엇이든 판은 한 장이다 — 세계일주와 다른 점이 이것이다.
      expect(part.dynamic?.sizeSteps, part.id).toBeUndefined();
      expect(part.dynamic?.listSlotId, part.id).toBeUndefined();
    }
    const custom = defaultCustomization(game);
    for (const part of game.parts) {
      const resolved = resolvePart(game, part, custom);
      expect(resolved.widthMm).toBe(part.widthMm);
      expect(resolved.heightMm).toBe(part.heightMm);
    }
  });

  it('그림을 바꾸는 슬롯이 판에 넷, 완성 그림에 둘이다', () => {
    expect(
      dynamicSourceSlots(game, board.id)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['detail', 'dot-count', 'guide-line', 'outline']);
    // 완성 그림에도 세부가 온다 — 어른이 볼 그림이라 눈·코가 있어야 사진을
    // 제대로 땄는지 확인이 된다(IDE-021).
    expect(
      dynamicSourceSlots(game, answer.id)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['detail', 'outline']);
  });

  it('커밋된 SVG가 생성기와 같다', () => {
    expect(Object.keys(ARTWORK).sort()).toEqual(['answer', 'board']);
    for (const id of Object.keys(ARTWORK)) {
      const committed = readFileSync(
        join(process.cwd(), 'public', 'games', 'dot-to-dot', `${id}.svg`),
        'utf8',
      );
      expect(
        committed,
        `${id}.svg가 낡았다 — \`npm run artwork dot-to-dot\`을 돌린다`,
      ).toBe(ARTWORK[id]());
    }
    for (const part of game.parts) {
      expect(part.artwork).toBe(`/games/dot-to-dot/${part.id}.svg`);
    }
  });

  it('슬롯이 다섯이고 점 개수는 5~100 정수다', () => {
    expect(game.slots.map((s) => s.id).sort()).toEqual([
      'detail',
      'dot-count',
      'guide-line',
      'outline',
      'title',
    ]);
    const count = game.slots.find((s) => s.id === 'dot-count')!;
    expect(count.kind).toBe('number');
    if (count.kind !== 'number') return;
    expect(count).toMatchObject({ ...DOT_COUNT_RANGE, integer: true });
    expect(count.default).toBe(20);
  });

  it('보기 그림이 판 안쪽 상자에 들어 있다', () => {
    const points = toPoints(SAMPLE_OUTLINE);
    expect(points.length).toBeGreaterThanOrEqual(30);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(OUTLINE_BOX.x - 0.01);
      expect(p.x).toBeLessThanOrEqual(OUTLINE_BOX.x + OUTLINE_BOX.width + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(OUTLINE_BOX.y - 0.01);
      expect(p.y).toBeLessThanOrEqual(
        OUTLINE_BOX.y + OUTLINE_BOX.height + 0.01,
      );
    }
  });
});

describe('판 그리기', () => {
  it('점 개수만큼 원과 숫자가 나온다', () => {
    for (const count of [10, 20, 50]) {
      const svg = parse(
        renderBoard({ outline: SAMPLE_OUTLINE, dotCount: count, guide: false }),
      );
      expect(svg.querySelectorAll('circle')).toHaveLength(count);
      const numbers = [...svg.querySelectorAll('text')]
        .map((t) => t.textContent ?? '')
        .filter((v) => /^\d+$/.test(v));
      expect(numbers).toHaveLength(count);
      expect(numbers.map(Number).sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, i) => i + 1),
      );
    }
  });

  it('세부 선은 그려지되 점도 번호도 받지 않는다 (IDE-021)', () => {
    const eye = [80, 90, 95, 90, 95, 105, 80, 105];
    const bare = parse(
      renderBoard({ outline: SAMPLE_OUTLINE, dotCount: 20, guide: false }),
    );
    const withDetail = parse(
      renderBoard({
        outline: SAMPLE_OUTLINE,
        detail: [eye],
        dotCount: 20,
        guide: false,
      }),
    );
    // 선 하나가 늘었을 뿐 — 점과 번호는 그대로다. 아이가 잇는 선은 여전히 하나라
    // 연필을 뗄 자리가 없다.
    expect(withDetail.querySelectorAll('path')).toHaveLength(
      bare.querySelectorAll('path').length + 1,
    );
    expect(withDetail.querySelectorAll('circle')).toHaveLength(
      bare.querySelectorAll('circle').length,
    );
    expect(withDetail.querySelectorAll('text')).toHaveLength(
      bare.querySelectorAll('text').length,
    );
  });

  it('세부를 주지 않으면 세부가 없던 판과 똑같다', () => {
    const bare = renderBoard({
      outline: SAMPLE_OUTLINE,
      dotCount: 20,
      guide: false,
    });
    const empty = renderBoard({
      outline: SAMPLE_OUTLINE,
      detail: [],
      dotCount: 20,
      guide: false,
    });
    expect(empty).toBe(bare);
  });

  it('시작 화살표와 "1로" 안내가 있다', () => {
    const svg = parse(
      renderBoard({ outline: SAMPLE_OUTLINE, dotCount: 20, guide: false }),
    );
    const texts = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(texts).toContain('시작');
    expect(texts).toContain('1로');
    // 삼각형 화살촉 하나. 안내선을 끄면 path는 이것뿐이다.
    expect(svg.querySelectorAll('path')).toHaveLength(1);
  });

  it('안내선을 켜면 옅은 회색 윤곽이 하나 더 깔린다', () => {
    const off = parse(
      renderBoard({ outline: SAMPLE_OUTLINE, dotCount: 20, guide: false }),
    );
    const on = parse(
      renderBoard({ outline: SAMPLE_OUTLINE, dotCount: 20, guide: true }),
    );
    expect(on.querySelectorAll('path')).toHaveLength(
      off.querySelectorAll('path').length + 1,
    );
    const guide = [...on.querySelectorAll('path')].find(
      (p) => p.getAttribute('stroke') === GUIDE_COLOR,
    );
    expect(guide).toBeDefined();
    expect(guide!.getAttribute('d')?.endsWith('Z')).toBe(true);
  });

  it('그린 크기가 파트 치수와 같다 — 미리보기 상자와 인쇄 타일이 어긋나지 않는다', () => {
    for (const part of game.parts) {
      const svg = renderDynamicArtwork(game, part, defaultCustomization(game));
      const measured = parseArtwork(svg);
      expect(measured.widthMm, part.id).toBeCloseTo(part.widthMm, 3);
      expect(measured.heightMm, part.id).toBeCloseTo(part.heightMm, 3);
      // 파서가 모르는 요소를 쓰면 여기서 예외로 터진다.
      expect(measured.items.length).toBeGreaterThan(0);
    }
  });

  it('점과 번호가 판 밖으로 나가지 않는다', () => {
    for (const count of [5, 20, 60, 100]) {
      const plan = planDots(SAMPLE_OUTLINE, count, { clampTo: ART_AREA });
      for (const dot of plan.dots) {
        expect(dot.labelXMm).toBeGreaterThanOrEqual(ART_AREA.x);
        expect(dot.labelXMm).toBeLessThanOrEqual(ART_AREA.x + ART_AREA.width);
        expect(dot.labelYMm).toBeGreaterThanOrEqual(ART_AREA.y);
        expect(dot.labelYMm).toBeLessThanOrEqual(ART_AREA.y + ART_AREA.height);
      }
    }
  });

  it('상한 안에서는 번호가 겹치지 않고, 상한에 걸리면 알린다', () => {
    const capacity = dotCapacity(SAMPLE_OUTLINE);
    // 둘레 ÷ 8mm다. 보기 그림은 여든 몇이라 "만 6세에게 50개"는 들어간다.
    expect(capacity).toBeGreaterThanOrEqual(50);
    for (const count of [10, 20, 50, capacity]) {
      const plan = planDots(SAMPLE_OUTLINE, count, { clampTo: ART_AREA });
      expect(plan.dots, `점 ${count}개`).toHaveLength(count);
      expect(plan.clamped, `점 ${count}개`).toBe(false);
      expect(plan.crowded, `점 ${count}개`).toBe(false);
    }

    // 슬롯의 최대치(100)는 둘레가 800mm를 넘는 윤곽에서만 다 들어간다. 못
    // 들어가면 조용히 줄이지 않고 최대치를 함께 돌려준다 — `IDE-020`이 그것을
    // 사용자에게 옮겨 적는다.
    const over = planDots(SAMPLE_OUTLINE, DOT_COUNT_RANGE.max, {
      clampTo: ART_AREA,
    });
    expect(over.dots).toHaveLength(capacity);
    expect(over.clamped).toBe(true);
    expect(over.capacity).toBe(capacity);
  });

  it('완성 그림은 부속 상자 안에 다시 맞춰 그린다', () => {
    const svg = parse(ARTWORK.answer());
    const outline = [...svg.querySelectorAll('path')].find(
      (p) => p.getAttribute('fill') === 'none',
    )!;
    const numbers = (outline.getAttribute('d') ?? '')
      .split(/[ML ]+/)
      .filter((v) => v !== '' && v !== 'Z')
      .map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(ANSWER.widthMm);
    expect(Math.max(...ys)).toBeLessThanOrEqual(ANSWER.heightMm);
    // 판보다 작은 종이라 판 좌표를 그대로 쓰면 넘친다.
    expect(Math.max(...ys)).toBeLessThan(BOARD.heightMm);
  });
});

describe('사진 한 장에서 종이 한 장까지', () => {
  const photo = fillPolygon(blank(300, 300), starPoints(150, 150, 130, 55, 5));

  it('사진과 점 개수를 넣으면 점·번호가 찍힌 A4 한 장이 나온다', async () => {
    const traced = traceOutline(photo, { fitTo: OUTLINE_BOX });
    expect(traced.ok).toBe(true);
    if (!traced.ok) return;

    const customization = withValues({
      outline: traced.outline,
      'dot-count': 24,
      title: '우리 강아지',
    });
    expect(validateCustomization(game, customization)).toEqual([]);

    const options = {
      ...defaultExportOptions(game),
      parts: [{ partId: board.id, scale: 1, copies: 1 }],
    };
    expect(validateExportOptions(game, options, customization)).toEqual([]);

    const document = composeExport({
      game,
      customization,
      options,
      loadArtwork: () => {
        throw new Error('동적 파트라 정적 파일을 읽을 일이 없다');
      },
      renderArtwork: (part, values) => renderDynamicArtwork(game, part, values),
    });
    // 100%에서 A4 한 장이다.
    expect(document.pages).toHaveLength(1);

    const pdf = await renderPdf(document);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('넣은 개수와 찍힌 점의 개수가 같다', () => {
    const traced = traceOutline(photo, { fitTo: OUTLINE_BOX });
    if (!traced.ok) throw new Error(traced.reason);
    for (const count of [8, 24, 60]) {
      const svg = parse(
        renderDynamicArtwork(
          game,
          board,
          withValues({ outline: traced.outline, 'dot-count': count }),
        ),
      );
      expect(svg.querySelectorAll('circle')).toHaveLength(count);
    }
  });

  it('이은 결과가 원본의 실루엣으로 읽힌다 — 별 꼭짓점 다섯이 점을 받는다', () => {
    const traced = traceOutline(photo, { fitTo: OUTLINE_BOX });
    if (!traced.ok) throw new Error(traced.reason);
    const plan = planDots(traced.outline, 20, { clampTo: ART_AREA });

    // 도형의 무게중심에서 잰 반지름이 최대치에 가까운 점이 꼭 다섯이다.
    const points = toPoints(traced.outline);
    const cx = points.reduce((a, p) => a + p.x, 0) / points.length;
    const cy = points.reduce((a, p) => a + p.y, 0) / points.length;
    const radii = plan.dots.map((d) => Math.hypot(d.xMm - cx, d.yMm - cy));
    const max = Math.max(...radii);
    expect(radii.filter((r) => r > max * 0.93)).toHaveLength(5);
  });

  it('사진이 서버로 갈 수 없다 — 요청 본문 규격이 좌표만 받는다', () => {
    const traced = traceOutline(photo, { fitTo: OUTLINE_BOX });
    if (!traced.ok) throw new Error(traced.reason);
    const customization = withValues({ outline: traced.outline });

    const parsed = customizationBody.parse(customization);
    const serialized = JSON.stringify(parsed);
    // 값에 오는 것은 수·글자·좌표뿐이다. 데이터 URL이나 바이트 배열이 낄 자리가
    // 없다 — 규격을 넓히면 여기서 걸린다.
    expect(serialized).not.toContain('data:image');
    expect(serialized).not.toContain('base64');
    const numbersOnly = (v: unknown): boolean =>
      typeof v === 'number' ||
      (Array.isArray(v) && v.every(numbersOnly)) ||
      typeof v === 'string';
    for (const value of Object.values(parsed.values)) {
      expect(numbersOnly(value)).toBe(true);
    }
    // 좌표 배열이 그대로 살아 왔는가.
    expect(parsed.values.outline).toEqual(traced.outline);
    // 점 100개짜리 윤곽에 세부 선까지 붙어도 몇 킬로바이트다.
    expect(serialized.length).toBeLessThan(30_000);
  });

  it('세부 선이 판과 완성 그림에 함께 실려 간다 (IDE-021)', () => {
    const eye = [80, 90, 95, 90, 95, 105, 80, 105];
    const customization = withValues({ detail: [eye] });
    expect(validateCustomization(game, customization)).toEqual([]);

    for (const part of game.parts) {
      const svg = renderDynamicArtwork(
        game,
        resolvePart(game, part, customization),
        customization,
      );
      // 세부 굵기(0.45mm)로 그어진 선이 정확히 하나다.
      expect(svg.match(/stroke-width="0.45"/g) ?? []).toHaveLength(1);
      // 크기는 그대로다 — 세부가 붙었다고 종이가 커지지 않는다.
      const measured = parseArtwork(svg);
      expect(measured.widthMm).toBe(part.widthMm);
      expect(measured.heightMm).toBe(part.heightMm);
    }
  });

  it('세부를 비우면 판에 세부 선이 하나도 없다', () => {
    const customization = withValues({ detail: [] });
    for (const part of game.parts) {
      const svg = renderDynamicArtwork(
        game,
        resolvePart(game, part, customization),
        customization,
      );
      expect(svg).not.toContain('stroke-width="0.45"');
    }
  });

  it('배경이 복잡한 사진에서 빈 판이 아니라 사유가 나온다', () => {
    const noisy = blank(300, 300);
    for (let i = 0; i < 9; i += 1) {
      fillPolygon(noisy, [
        [20 + (i % 3) * 100, 20 + Math.floor(i / 3) * 100],
        [90 + (i % 3) * 100, 20 + Math.floor(i / 3) * 100],
        [90 + (i % 3) * 100, 90 + Math.floor(i / 3) * 100],
        [20 + (i % 3) * 100, 90 + Math.floor(i / 3) * 100],
      ]);
    }
    const result = traceOutline(noisy, { fitTo: OUTLINE_BOX });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('scattered');
    expect(result.message).toContain('배경');
  });
});

describe('게임 방법', () => {
  it('시작·마지막 안내가 판의 글자와 같은 말을 쓴다', () => {
    expect(ruleText).toContain('시작');
    expect(ruleText).toContain('1로');
  });

  it('어른이 읽는 사진 고르는 요령이 있다', () => {
    expect(ruleText).toContain(PHOTO_TIP);
    expect(PHOTO_TIP).toContain('배경');
  });

  it('안내선을 켜는 값이 도안 선택지와 같다', () => {
    const slot = game.slots.find((s) => s.id === GUIDE_SLOT_ID)!;
    expect(slot.kind).toBe('choice');
    if (slot.kind !== 'choice') return;
    expect(slot.options.map((o) => o.value)).toContain(GUIDE_ON);

    const on = parse(
      renderDynamicArtwork(game, board, withValues({ [GUIDE_SLOT_ID]: 'on' })),
    );
    expect(
      [...on.querySelectorAll('path')].some(
        (p) => p.getAttribute('stroke') === GUIDE_COLOR,
      ),
    ).toBe(true);
  });

  it('준비물이 연필과 색연필이다', () => {
    expect(game.supplies).toEqual(['연필', '색연필']);
  });
});

describe('실측 출발값', () => {
  it('점 지름 1.8mm · 번호 3.2mm · 최소 간격 8mm', () => {
    expect(METRICS.dotDiameterMm).toBe(1.8);
    expect(METRICS.numberFontMm).toBe(3.2);
    expect(METRICS.minGapMm).toBe(8);
  });

  it('배율 하한에서도 번호가 2.5mm보다 크다', () => {
    expect(METRICS.numberFontMm * board.minScale).toBeGreaterThan(2.5);
  });
});

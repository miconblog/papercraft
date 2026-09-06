/**
 * 커스터마이즈 값이 인쇄물에 그대로 들어가는지.
 *
 * 화면 미리보기와 인쇄물이 어긋나면 미리보기가 거짓말을 한 것이다 — 두 쪽이
 * 같은 규칙(`src/lib/customization/render.ts`)을 쓰는지 여기서 확인한다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { defaultCustomization, type GameDefinition } from '@/lib/schema';
import { composeExport, partDraws } from '../compose';
import type { Draw, PathDraw, TextDraw } from '../draw';
import { defaultExportOptions } from '../options';

const game = getGame('soccer') as GameDefinition;
const field = game.parts.find((p) => p.id === 'field')!;
const loadArtwork = (ref: string) =>
  readFileSync(join(process.cwd(), 'public', ref), 'utf8');

const texts = (items: readonly Draw[]) =>
  items.filter((i): i is TextDraw => i.kind === 'text');
const paths = (items: readonly Draw[]) =>
  items.filter((i): i is PathDraw => i.kind === 'path');

const withValues = (values: Record<string, string | number>) => {
  const c = defaultCustomization(game);
  return { ...c, values: { ...c.values, ...values } };
};

describe('partDraws', () => {
  it('등번호가 운동장에 그대로 들어간다', () => {
    const items = partDraws(
      game,
      withValues({ 'home-player-9': 77 }),
      field,
      loadArtwork,
    );
    expect(texts(items).map((t) => t.text)).toContain('77');
  });

  it('값은 그것이 놓인 파트에만 들어간다 — 등번호는 운동장에, 점수 기록칸에는 없다', () => {
    const scoreSheet = game.parts.find((p) => p.id === 'score-sheet')!;
    const items = partDraws(
      game,
      withValues({ 'home-player-9': 77 }),
      scoreSheet,
      loadArtwork,
    );
    expect(texts(items).map((t) => t.text)).not.toContain('77');
  });

  /**
   * 팀 색 슬롯이 사라지면서(2026-09-05) 축구 도안에는 `paint` 배치가 하나도
   * 남지 않았다. 그 규약 자체는 스키마·렌더러에 그대로 있고
   * (`paintOverrides`), 밝기에 따른 글자색은 `readableTextColor` 단위
   * 테스트가 지킨다(`components/editor/__tests__/svgOverlay.test.ts`).
   */
  it('등번호를 넣으면 마커 위에 글자로 얹힌다', () => {
    const items = partDraws(
      game,
      withValues({ 'home-player-9': '9' }),
      field,
      loadArtwork,
    );
    expect(texts(items).some((t) => t.text === '9')).toBe(true);
  });

  it('등번호가 비어 있으면 글자를 얹지 않는다 — 아이가 직접 쓰는 자리다', () => {
    const items = partDraws(
      game,
      defaultCustomization(game),
      field,
      loadArtwork,
    );
    expect(texts(items).filter((t) => t.text === '')).toHaveLength(0);
  });

  /**
   * 사용자가 마커를 돌린 각도는 인쇄물에도 그대로 나가야 한다 — 미리보기에서
   * 방향을 맞춰 놓고 뽑았는데 종이에서 제자리로 돌아오면 화면이 거짓말이 된다.
   * 축은 **마커 중심**이라 회전해도 중심 좌표는 움직이지 않는다.
   */
  it('마커를 돌리면 그 각도로 그려지고 중심은 그대로다', () => {
    const c = defaultCustomization(game);
    const at = { xMm: 120, yMm: 60 };
    const upright = partDraws(
      game,
      { ...c, positions: { ...c.positions, 'home-player-9': at } },
      field,
      loadArtwork,
    );
    const turned = partDraws(
      game,
      {
        ...c,
        positions: {
          ...c.positions,
          'home-player-9': { ...at, rotationDeg: 90 },
        },
      },
      field,
      loadArtwork,
    );

    const spanOf = (items: Draw[]) => {
      const xs = paths(items).flatMap((p) =>
        p.commands.flatMap((cmd) => ('x' in cmd ? [cmd.x] : [])),
      );
      const ys = paths(items).flatMap((p) =>
        p.commands.flatMap((cmd) => ('y' in cmd ? [cmd.y] : [])),
      );
      return {
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
    };

    // 그림이 달라졌는데(돌았는데) 가운데는 제자리다.
    expect(JSON.stringify(turned)).not.toBe(JSON.stringify(upright));
    expect(spanOf(turned).cx).toBeCloseTo(spanOf(upright).cx, 6);
    expect(spanOf(turned).cy).toBeCloseTo(spanOf(upright).cy, 6);
  });

  it('마커를 옮기면 그 좌표에 그려진다 — 기준점은 마커 중심이다', () => {
    const c = withValues({ 'home-player-9': '9' });
    const moved = {
      ...c,
      positions: { ...c.positions, 'home-player-9': { xMm: 120, yMm: 60 } },
    };
    const marker = texts(partDraws(game, moved, field, loadArtwork)).find(
      (t) => t.text === '9',
    )!;
    expect(marker.xMm).toBe(120);
    expect(marker.yMm).toBe(60);
  });

  it('마커 스타일을 바꾸면 그 변형의 아트워크로 그린다', () => {
    const circle = partDraws(
      game,
      withValues({ 'marker-style': 'circle' }),
      field,
      loadArtwork,
    );
    const illustration = partDraws(
      game,
      withValues({ 'marker-style': 'illustration' }),
      field,
      loadArtwork,
    );
    expect(paths(illustration).length).toBeGreaterThan(paths(circle).length);
  });

  it('도안 크기가 파트 선언과 다르면 알린다', () => {
    expect(() =>
      partDraws(
        game,
        defaultCustomization(game),
        field,
        () => '<svg viewBox="0 0 100 100"></svg>',
      ),
    ).toThrow(/도안 크기가 파트 선언과 다르다/);
  });
});

describe('composeExport', () => {
  const compose = (
    parts: Array<{ partId: string; scale: number; copies: number }>,
    includeGuide = false,
  ) =>
    composeExport({
      game,
      customization: defaultCustomization(game),
      options: { ...defaultExportOptions(game), parts, includeGuide },
      loadArtwork,
    });

  it('페이지 변환이 배율과 타일 이동을 함께 담는다', () => {
    const doc = compose([{ partId: 'field', scale: 2, copies: 1 }]);
    const plan = doc.parts[0].plan;
    doc.pages.forEach((page, i) => {
      const tile = plan.tiles[i];
      expect(page.transform.scale).toBe(2);
      expect(page.transform.txMm).toBe(tile.dstXMm - tile.srcXMm);
      expect(page.transform.tyMm).toBe(tile.dstYMm - tile.srcYMm);
      // 도안은 타일 영역 밖으로 나가지 않는다.
      expect(page.clip).toEqual({
        xMm: tile.dstXMm,
        yMm: tile.dstYMm,
        widthMm: tile.srcWMm,
        heightMm: tile.srcHMm,
      });
    });
  });

  it('이웃한 두 장은 같은 도안 좌표를 정확히 겹침만큼 어긋나게 놓는다', () => {
    const doc = compose([{ partId: 'field', scale: 2, copies: 1 }]);
    const plan = doc.parts[0].plan;
    const [first, second] = doc.pages;
    const at = (page: (typeof doc.pages)[number], xMm: number) =>
      page.transform.txMm + page.transform.scale * xMm;
    // 도안 x=100mm는 1번·2번 장 모두에 든다. 두 장의 용지 위 자리 차이는
    // 타일 이동량과 같아야 한다 — 이것이 어긋나면 붙였을 때 선이 끊긴다.
    expect(at(first, 100) - at(second, 100)).toBeCloseTo(
      plan.tiles[1].srcXMm - plan.tiles[0].srcXMm,
      9,
    );
  });

  it('벌 수만큼 같은 페이지가 반복되고 한 벌씩 이어 붙는다', () => {
    const doc = compose([{ partId: 'score-sheet', scale: 1, copies: 3 }]);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0].items).toBe(doc.pages[1].items);
    expect(doc.pages[0].marks).not.toEqual(doc.pages[1].marks);
  });

  it('도안이 선언한 순서대로 담는다 — 보드가 먼저다', () => {
    const doc = compose([
      { partId: 'score-sheet', scale: 1, copies: 1 },
      { partId: 'field', scale: 1, copies: 1 },
    ]);
    expect(doc.parts.map((p) => p.part.id)).toEqual(['field', 'score-sheet']);
  });

  it('조립 안내는 맨 앞에 오고, 안 넣을 수도 있다', () => {
    const withGuide = compose([{ partId: 'field', scale: 1, copies: 1 }], true);
    const without = compose([{ partId: 'field', scale: 1, copies: 1 }], false);
    expect(withGuide.pages.length - without.pages.length).toBeGreaterThan(0);
    expect(withGuide.pages[0].clip).toBeNull();
    expect(
      texts(withGuide.pages[0].marks).some((t) => t.text.includes('조립 안내')),
    ).toBe(true);
  });
});

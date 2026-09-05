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
import { readableTextColor } from '@/lib/customization/render';
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

  it('팀 이름은 그것이 놓인 파트에 들어간다', () => {
    const scoreSheet = game.parts.find((p) => p.id === 'score-sheet')!;
    const items = partDraws(
      game,
      withValues({ 'home-name': '초록 번개' }),
      scoreSheet,
      loadArtwork,
    );
    expect(texts(items).map((t) => t.text)).toContain('초록 번개');
    // 운동장에는 팀 이름을 두지 않는다 — 놀 면을 넓혔다(IDE-010).
    const board = partDraws(
      game,
      withValues({ 'home-name': '초록 번개' }),
      field,
      loadArtwork,
    );
    expect(texts(board).map((t) => t.text)).not.toContain('초록 번개');
  });

  it('팀 색이 도안 레이어와 마커에 함께 반영된다', () => {
    const items = partDraws(
      game,
      withValues({ 'home-color': '#15803d' }),
      field,
      loadArtwork,
    );
    // 보드 위쪽 팀 색 막대(pc-team-home)와 마커 아트워크(pc-marker-fill) 양쪽.
    expect(
      paths(items).filter((p) => p.fill === '#15803d').length,
    ).toBeGreaterThan(1);
  });

  it('마커 위 등번호는 배경 밝기에 따라 색이 바뀐다', () => {
    const dark = partDraws(
      game,
      withValues({ 'home-color': '#111111' }),
      field,
      loadArtwork,
    );
    const light = partDraws(
      game,
      withValues({ 'home-color': '#f5f5f5' }),
      field,
      loadArtwork,
    );
    const numberFill = (items: Draw[]) =>
      texts(items).find((t) => t.text === '9')!.fill;
    expect(numberFill(dark)).toBe(readableTextColor('#111111'));
    expect(numberFill(light)).toBe(readableTextColor('#f5f5f5'));
    expect(numberFill(dark)).not.toBe(numberFill(light));
  });

  it('마커를 옮기면 그 좌표에 그려진다 — 기준점은 마커 중심이다', () => {
    const c = defaultCustomization(game);
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
    const doc = compose([{ partId: 'ball-markers', scale: 1, copies: 3 }]);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0].items).toBe(doc.pages[1].items);
    expect(doc.pages[0].marks).not.toEqual(doc.pages[1].marks);
  });

  it('도안이 선언한 순서대로 담는다 — 보드가 먼저다', () => {
    const doc = compose([
      { partId: 'ball-markers', scale: 1, copies: 1 },
      { partId: 'field', scale: 1, copies: 1 },
    ]);
    expect(doc.parts.map((p) => p.part.id)).toEqual(['field', 'ball-markers']);
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

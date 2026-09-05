/**
 * 만들어진 PDF의 치수를 잰다.
 *
 * `IDE-002` 검증의 결론은 "페이지 상자가 pt 단위 절대 크기라 사용자 인쇄
 * 설정이 끼어들지 못한다"였다. 그 전제가 실제 산출물에서 지켜지는지 보는
 * 테스트다 — 여기가 틀리면 종이 실측도 틀린다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { defaultCustomization, type GameDefinition } from '@/lib/schema';
import { composeExport } from '../compose';
import { A4, mmToPt, ptToMm } from '../geometry';
import { defaultExportOptions, type PartSelection } from '../options';
import { renderPdf } from '../pdf';
import { planTiles } from '../tile';

const game = getGame('soccer') as GameDefinition;
const customization = defaultCustomization(game);
const loadArtwork = (ref: string) =>
  readFileSync(join(process.cwd(), 'public', ref), 'utf8');

const build = async (parts: PartSelection[], includeGuide = false) => {
  const options = { ...defaultExportOptions(game), parts, includeGuide };
  const doc = composeExport({ game, customization, options, loadArtwork });
  const bytes = await renderPdf(doc);
  return { doc, bytes, pdf: await PDFDocument.load(bytes) };
};

const sel = (partId: string, scale = 1, copies = 1): PartSelection => ({
  partId,
  scale,
  copies,
});

describe('PDF 산출', () => {
  it('모든 페이지의 용지 크기가 A4다 — 소수 셋째 자리까지', async () => {
    for (const scale of [0.5, 1, 2]) {
      const { pdf } = await build([sel('field', scale)]);
      for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        const sides = [ptToMm(width), ptToMm(height)].sort((a, b) => a - b);
        expect(sides[0]).toBeCloseTo(A4.widthMm, 3);
        expect(sides[1]).toBeCloseTo(A4.heightMm, 3);
      }
    }
  });

  it('A4 210×297mm는 pt로 정확히 595.276×841.89다', () => {
    expect(mmToPt(A4.widthMm)).toBeCloseTo(595.2755905511812, 9);
    expect(mmToPt(A4.heightMm)).toBeCloseTo(841.8897637795277, 9);
  });

  it('배율마다 타일 계획이 정한 만큼 장이 나온다', async () => {
    for (const [scale, expected] of [
      [0.5, 1],
      [1, 2],
      [2, 8],
    ] as const) {
      const { pdf } = await build([sel('field', scale)]);
      expect(pdf.getPageCount()).toBe(expected);
      expect(
        planTiles({
          partWidthMm: 297 * scale,
          partHeightMm: 210 * scale,
        }).total,
      ).toBe(expected);
    }
  });

  it('벌 수를 3으로 주면 같은 보드가 3벌 나온다', async () => {
    const one = await build([sel('field', 1, 1)]);
    const three = await build([sel('field', 1, 3)]);
    expect(three.pdf.getPageCount()).toBe(one.pdf.getPageCount() * 3);
  });

  it('보드와 부속을 따로 뽑을 수 있고 부속만도 된다', async () => {
    const board = await build([sel('field')]);
    const accessories = await build([
      sel('score-sheet'),
      sel('rules-card'),
      sel('goals'),
      sel('ball-markers', 1, 2),
    ]);
    expect(board.doc.parts.map((p) => p.part.id)).toEqual(['field']);
    expect(accessories.doc.parts.map((p) => p.part.id)).toEqual([
      'score-sheet',
      'rules-card',
      'goals',
      'ball-markers',
    ]);
    // 부속만 뽑아도 보드가 딸려 오지 않는다.
    expect(accessories.pdf.getPageCount()).toBe(5);
  });

  it('조립 안내 시트가 맨 앞에 붙는다', async () => {
    const withGuide = await build([sel('field', 2)], true);
    const without = await build([sel('field', 2)], false);
    expect(withGuide.pdf.getPageCount()).toBeGreaterThan(
      without.pdf.getPageCount(),
    );
    expect(withGuide.doc.pages[0].clip).toBeNull();
  });

  it('벡터라 파일이 작다 — 래스터 안(IDE-002 §8.4)의 25MB와 대비된다', async () => {
    const { bytes } = await build([sel('field')]);
    expect(bytes.length).toBeLessThan(400 * 1024);
  });

  it('PDF 제목에 게임과 파트 이름이 남는다', async () => {
    const { pdf } = await build([sel('field')]);
    expect(pdf.getTitle()).toContain('축구 게임판');
    expect(pdf.getTitle()).toContain('운동장');
  });
});

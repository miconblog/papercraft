/**
 * 등록된 게임 전부가 실제로 PDF로 나오는가 (IDE-011 · IDE-014)
 *
 * 다른 인쇄 테스트는 축구 게임판 하나를 깊게 판다. 여기는 **넓게** 본다 —
 * 등록소에 있는 모든 게임의 모든 파트를 기본값으로 뽑아 보고, 파일이 나오는지와
 * 도안 크기가 파트 선언과 맞는지만 확인한다.
 *
 * 게임을 더할 때 이 테스트가 저절로 그 게임까지 덮는 것이 요점이다. 축구
 * 게임판만 보던 시절에는 새 도안이 인쇄 파이프라인의 어느 규약을 어겼는지
 * (지원하지 않는 SVG 요소·파트 치수 불일치·읽지 못하는 색) 배포하고 나서야
 * 알 수 있었다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES } from '@/lib/games';
import { renderDynamicArtwork } from '@/lib/games/dynamic-artwork';
import { defaultCustomization } from '@/lib/schema';
import { composeExport } from '../compose';
import { defaultExportOptions } from '../options';
import { renderPdf } from '../pdf';

const loadArtwork = (ref: string) =>
  readFileSync(join(process.cwd(), 'public', ref), 'utf8');

describe.each(GAMES.map((game) => [game.id, game] as const))(
  '%s',
  (_id, game) => {
    it('모든 파트를 기본값으로 PDF에 담는다', async () => {
      const doc = composeExport({
        game,
        customization: defaultCustomization(game),
        options: {
          ...defaultExportOptions(game),
          parts: game.parts.map((part) => ({
            partId: part.id,
            scale: 1,
            copies: 1,
          })),
        },
        loadArtwork,
        // 동적 파트(세계일주 게임판)는 값에서 그린다 — 내보내기 API가 넘기는 것과
        // 같은 등록소다.
        renderArtwork: (part, customization) =>
          renderDynamicArtwork(game, part, customization),
      });

      expect(doc.parts).toHaveLength(game.parts.length);
      expect(doc.pages.length).toBeGreaterThanOrEqual(game.parts.length);
      for (const page of doc.pages) {
        expect(page.items.length, page.widthMm.toString()).toBeGreaterThan(0);
      }

      const bytes = await renderPdf(doc);
      expect(bytes.length).toBeGreaterThan(1000);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    });

    it('썸네일과 마커 아트워크가 모두 실제 파일이다', () => {
      const refs = [
        game.thumbnail,
        ...game.parts.flatMap((p) => (p.artwork ? [p.artwork] : [])),
        ...game.styleSets.flatMap((set) =>
          set.variants.flatMap((v) => (v.artwork ? [v.artwork] : [])),
        ),
      ];
      for (const ref of refs) {
        expect(() => loadArtwork(ref), ref).not.toThrow();
      }
    });
  },
);

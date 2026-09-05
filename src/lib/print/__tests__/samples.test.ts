/**
 * 검증용 견본 PDF 산출 — 평소에는 건너뛴다.
 *
 *     npm run print:samples          # out/print-samples/ 에 PDF를 만든다
 *     npm run print:verify           # 위를 만든 뒤 Ghostscript·ImageMagick으로 잰다
 *
 * `IDE-002`가 남긴 종이 실측 체크리스트(`spikes/print-pipeline/README.md`)를
 * 이 구현으로 다시 돌릴 때 쓴다. 사람이 종이에 뽑아 자로 재기 전에, 여기서
 * 나온 PDF를 화면과 디지털 실측으로 먼저 걸러 낸다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGame } from '@/lib/games';
import { defaultCustomization, type GameDefinition } from '@/lib/schema';
import { composeExport, partDraws } from '../compose';
import { defaultExportOptions, type PartSelection } from '../options';
import { renderPdf } from '../pdf';
import { FIELD, FIELD_MARKS } from '@/assets/games/soccer/dimensions';
import { FIELD_LINE_COLOR } from '@/assets/games/soccer/artwork/svg';
import { probeDocument } from '../probe';

const enabled = process.env.PRINT_SAMPLES === '1';
const OUT_DIR = join(process.cwd(), 'out', 'print-samples');

const game = getGame('soccer') as GameDefinition;
const loadArtwork = (ref: string) =>
  readFileSync(join(process.cwd(), 'public', ref), 'utf8');

const sel = (partId: string, scale = 1, copies = 1): PartSelection => ({
  partId,
  scale,
  copies,
});

describe.skipIf(!enabled)('견본 PDF', () => {
  it('배율별 보드 · 부속 · 탐침 시트를 만든다', async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const customization = defaultCustomization(game);
    const write = async (name: string, bytes: Uint8Array) => {
      writeFileSync(join(OUT_DIR, `${name}.pdf`), bytes);
      console.log(`${name}.pdf  ${(bytes.length / 1024).toFixed(1)}KB`);
    };

    const cases: Array<[string, PartSelection[], boolean]> = [
      ['board-50', [sel('field', 0.5)], false],
      ['board-100', [sel('field', 1)], true],
      ['board-200', [sel('field', 2)], true],
      [
        'accessories-100',
        game.parts.filter((p) => p.kind !== 'board').map((p) => sel(p.id)),
        true,
      ],
      ['board-100-x3', [sel('field', 1, 3)], true],
    ];
    for (const [name, parts, includeGuide] of cases) {
      const doc = composeExport({
        game,
        customization,
        options: { ...defaultExportOptions(game), parts, includeGuide },
        loadArtwork,
      });
      await write(name, await renderPdf(doc));
    }

    // 실측용 한 벌 — 배율마다 ① 안내 없는 타일본 ② 타일 없이 한 장에 그린
    // 기준본 ③ 타일 계획. `scripts/print-verify.sh`가 셋을 맞춰 본다.
    const field = game.parts.find((p) => p.id === 'field')!;
    const items = partDraws(game, customization, field, loadArtwork);

    for (const scale of [0.5, 1, 2]) {
      const label = `measure-${Math.round(scale * 100)}`;
      const doc = composeExport({
        game,
        customization,
        options: {
          ...defaultExportOptions(game),
          parts: [sel('field', scale)],
          includeGuide: false,
        },
        loadArtwork,
      });
      await write(`${label}-tiles`, await renderPdf(doc));
      await write(
        `${label}-reference`,
        await renderPdf({
          title: `기준 시트 ${label}`,
          parts: [],
          pages: [
            {
              widthMm: field.widthMm * scale,
              heightMm: field.heightMm * scale,
              clip: null,
              transform: { scale, txMm: 0, tyMm: 0 },
              items,
              marks: [],
            },
          ],
        }),
      );
      writeFileSync(
        join(OUT_DIR, `${label}-plan.json`),
        JSON.stringify(doc.parts[0].plan, null, 1),
      );
      expect(doc.pages.length).toBe(doc.parts[0].plan.total);
    }

    await write(
      'printer-margin-probe',
      await renderPdf(probeDocument({ currentMarginMm: 6 })),
    );

    // 실측 스크립트가 "무엇이 어디에 있어야 하는가"를 도안에서 받아 가게 한다.
    // 값을 스크립트에 적어 두면 도안을 고칠 때마다 조용히 어긋난다.
    writeFileSync(
      join(OUT_DIR, 'measure-target.json'),
      JSON.stringify(
        {
          note: '초록 필드 라인(터치라인)의 배율 100% 기준 좌표. scripts/print-verify.sh가 읽는다.',
          xMm: FIELD.xMm,
          yMm: FIELD.yMm,
          widthMm: FIELD.widthMm,
          heightMm: FIELD.heightMm,
          lineWidthMm: FIELD_MARKS.lineWidthMm,
          inkColor: FIELD_LINE_COLOR,
        },
        null,
        1,
      ),
    );
  }, 120_000);
});

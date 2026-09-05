/**
 * 내보내기 — 커스터마이즈한 도안을 벡터 PDF로 만들어 내려준다 (IDE-007)
 *
 * **서버에서 만든다**(`docs/print-spec.md` §3). 4.4MB짜리 한글 폰트를 사용자가
 * 내려받지 않아도 되고, 브라우저가 무엇이든 같은 바이트가 나온다 — "지원 브라우저
 * 전부에서 내보내기가 성공한다"를 브라우저별로 검증하는 대신 구조로 없앤 것이다.
 */
import { readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { z } from 'zod';
import { getGame } from '@/lib/games';
import { validateCustomization } from '@/lib/schema';
import { composeExport, outOfRegionSlots } from '@/lib/print/compose';
import {
  contentDisposition,
  exportFilename,
  groupLabelFor,
} from '@/lib/print/filename';
import {
  blockingIssues,
  exportOptions,
  validateExportOptions,
} from '@/lib/print/options';
import { renderPdf } from '@/lib/print/pdf';

export const runtime = 'nodejs';

/** 도안 자산은 `public/` 아래에 있다. 경로는 게임 정의에서 오므로 신뢰할 수 있다. */
const PUBLIC_DIR = join(process.cwd(), 'public');

const loadArtwork = (assetRef: string): string => {
  const file = normalize(join(PUBLIC_DIR, assetRef));
  if (!file.startsWith(PUBLIC_DIR)) {
    throw new Error(`도안 자산 경로가 public 밖을 가리킨다: ${assetRef}`);
  }
  return readFileSync(file, 'utf8');
};

const requestBody = z.object({
  customization: z.object({
    gameId: z.string(),
    values: z.record(z.string(), z.union([z.string(), z.number()])),
    positions: z.record(
      z.string(),
      z.object({ xMm: z.number(), yMm: z.number() }),
    ),
  }),
  options: exportOptions,
});

const badRequest = (messages: string[]) =>
  Response.json({ messages }, { status: 400 });

export async function POST(
  request: Request,
  context: RouteContext<'/api/games/[id]/export'>,
) {
  const { id } = await context.params;
  const game = getGame(id);
  if (!game)
    return Response.json({ messages: ['없는 게임이다'] }, { status: 404 });

  const parsed = requestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message));
  }
  const { customization, options } = parsed.data;

  const customizationIssues = validateCustomization(game, customization);
  if (customizationIssues.length > 0) {
    return badRequest(
      customizationIssues.map((i) => `${i.slotId}: ${i.message}`),
    );
  }
  const blocked = blockingIssues(validateExportOptions(game, options));
  if (blocked.length > 0) return badRequest(blocked.map((i) => i.message));

  // 여기까지 왔는데 좌표가 영역 밖이면 도안 쪽 규칙이 어긋난 것이다.
  const strayed = outOfRegionSlots(game, customization);
  if (strayed.length > 0) {
    return badRequest([`슬롯 좌표가 영역 밖이다: ${strayed.join(', ')}`]);
  }

  const document = composeExport({
    game,
    customization,
    options,
    loadArtwork,
  });
  const pdf = await renderPdf(document);
  const filename = exportFilename({
    gameId: game.id,
    selections: options.parts,
    groupLabel: groupLabelFor(game, options.parts),
  });

  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(filename),
      'Content-Length': String(pdf.length),
      // 같은 값으로 다시 눌렀을 때 오래된 파일이 나오면 안 된다.
      'Cache-Control': 'no-store',
    },
  });
}

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
import { afterResponse } from '@/lib/analytics/after';
import { recordEvent } from '@/lib/analytics/record';
import { getGame } from '@/lib/games';
import { isGameVisible } from '@/lib/games/release';
import { renderDynamicArtwork } from '@/lib/games/dynamic-artwork';
import { validateCustomization } from '@/lib/schema';
import { customizationBody } from '@/lib/schema';
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
  customization: customizationBody,
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
  // 오픈 전 게임은 없는 게임과 **똑같이** 답한다 (IDE-022). 화면은 `proxy.ts` 가
  // 막지만 여기가 바이트가 실제로 나가는 자리라 스스로 한 번 더 본다. 관리자
  // 세션이면 통과한다 — 공개 전에 실물로 확인해야 날짜를 정한다.
  if (!game || !(await isGameVisible(id, request.headers)))
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
  const blocked = blockingIssues(
    validateExportOptions(game, options, customization),
  );
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
    renderArtwork: (part, values) => renderDynamicArtwork(game, part, values),
  });
  const pdf = await renderPdf(document);
  const filename = exportFilename({
    gameId: game.id,
    selections: options.parts,
    groupLabel: groupLabelFor(game, options.parts),
  });

  // 다운로드는 **서버가 직접** 센다 (IDE-013). 브라우저 이벤트에 맡기면
  // 차단기에 막히거나 저장 직후 탭을 닫는 사람만큼이 통째로 빠진다.
  //
  // 응답 바이트가 다 나간 뒤에 돈다 — 집계가 느리든 죽어 있든 사용자가 PDF 를
  // 받는 시간에는 영향이 없다.
  afterResponse(async () => {
    await recordEvent({
      type: 'download',
      url: `/games/${game.id}/print`,
      referrer: request.headers.get('referer'),
      headers: request.headers,
      gameId: game.id,
    });
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

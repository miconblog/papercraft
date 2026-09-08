/**
 * 동적 파트의 SVG (IDE-016 2단계)
 *
 * 만들기 화면의 미리보기가 목록 슬롯(켠 도시·차례)이나 틀 슬롯(지도만)이
 * 바뀔 때마다 여기서 판을 받는다. 내보내기가 PDF에 넣는 것과 **같은 렌더러**다.
 *
 * POST인 이유는 값이 도시 id 100개라 URL에 담기 길기 때문이다. 캐시하지
 * 않는다 — 같은 값이면 같은 그림이지만 그 판별은 브라우저가 못 한다.
 */
import { z } from 'zod';
import { getGame } from '@/lib/games';
import { renderDynamicArtwork } from '@/lib/games/dynamic-artwork';
import { resolvePart, validateCustomization } from '@/lib/schema';
import { customizationBody } from '@/lib/schema';
import { parseArtwork } from '@/lib/print/artwork';

export const runtime = 'nodejs';

const requestBody = z.object({
  partId: z.string(),
  customization: customizationBody,
});

const badRequest = (messages: string[]) =>
  Response.json({ messages }, { status: 400 });

export async function POST(
  request: Request,
  context: RouteContext<'/api/games/[id]/artwork'>,
) {
  const { id } = await context.params;
  const game = getGame(id);
  if (!game)
    return Response.json({ messages: ['없는 게임이다'] }, { status: 404 });

  const parsed = requestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return badRequest(parsed.error.issues.map((i) => i.message));
  const { partId, customization } = parsed.data;

  const issues = validateCustomization(game, customization);
  if (issues.length > 0)
    return badRequest(issues.map((i) => `${i.slotId}: ${i.message}`));

  const part = game.parts.find((p) => p.id === partId);
  if (!part) return badRequest([`없는 파트다: ${partId}`]);
  if (!part.dynamic) return badRequest([`동적 파트가 아니다: ${partId}`]);

  const resolved = resolvePart(game, part, customization);
  const svg = renderDynamicArtwork(game, resolved, customization);

  // 그린 크기가 스키마가 계산한 크기와 같아야 한다 — 다르면 미리보기 상자와
  // 인쇄 타일이 어긋난다. 여기서 잡아야 사용자에게 가기 전에 드러난다.
  const measured = parseArtwork(svg);
  if (
    Math.abs(measured.widthMm - resolved.widthMm) > 0.01 ||
    Math.abs(measured.heightMm - resolved.heightMm) > 0.01
  ) {
    return Response.json(
      {
        messages: [
          `렌더러가 그린 크기(${measured.widthMm}×${measured.heightMm}mm)가 파트 크기(${resolved.widthMm}×${resolved.heightMm}mm)와 다르다`,
        ],
      },
      { status: 500 },
    );
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

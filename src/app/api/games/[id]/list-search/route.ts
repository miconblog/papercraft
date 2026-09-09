/**
 * 목록 슬롯 검색 (IDE-016)
 *
 *     GET /api/games/world-tour/list-search?slot=cities&q=류블랴나
 *
 * 슬롯이 검색을 허용하는지(`search.providerId`)는 도안 정의가 말하고, 실제
 * 찾기는 서버 제공자(`lib/games/list-search.ts`)가 한다. 결과는 옵션 id이거나
 * 값에 실릴 새 항목이다.
 */
import { getGame } from '@/lib/games';
import { isGameVisible } from '@/lib/games/release';
import { searchListOptions } from '@/lib/games/list-search';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: RouteContext<'/api/games/[id]/list-search'>,
) {
  const { id } = await context.params;
  const game = getGame(id);
  // 오픈 전 게임은 없는 게임과 **똑같이** 답한다 (IDE-022). 화면은 `proxy.ts` 가
  // 막지만 여기가 바이트가 실제로 나가는 자리라 스스로 한 번 더 본다. 관리자
  // 세션이면 통과한다 — 공개 전에 실물로 확인해야 날짜를 정한다.
  if (!game || !(await isGameVisible(id, request.headers)))
    return Response.json({ messages: ['없는 게임이다'] }, { status: 404 });

  const url = new URL(request.url);
  const slotId = url.searchParams.get('slot') ?? '';
  const query = (url.searchParams.get('q') ?? '').trim();
  const slot = game.slots.find((s) => s.id === slotId);
  if (!slot || slot.kind !== 'list' || !slot.search) {
    return Response.json(
      { messages: [`검색할 수 있는 목록 슬롯이 아니다: ${slotId}`] },
      { status: 400 },
    );
  }
  if (query.length === 0) return Response.json({ results: [] });

  const results = searchListOptions(slot.search.providerId, query);
  if (results === null) {
    return Response.json(
      { messages: [`검색 제공자가 없다: ${slot.search.providerId}`] },
      { status: 500 },
    );
  }
  return Response.json(
    { results },
    { headers: { 'Cache-Control': 'private, max-age=3600' } },
  );
}

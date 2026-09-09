import 'server-only';

/**
 * 열려 있는 게임만 (IDE-022)
 *
 * 목록을 그리는 곳은 `GAMES` 대신 이걸 쓴다. 등록소는 그대로다 — 빠지는 것은
 * **아직 오픈 시각이 안 된 게임**뿐이고, 오픈일을 지정하지 않은 게임은 지금까지와
 * 똑같이 나온다.
 *
 * `@/lib/games` 에서 다시 내보내지 않는다. 이 파일은 서버 전용인데 그 배럴은
 * 클라이언트 컴포넌트도 읽는다.
 */
import type { GameDefinition } from '@/lib/schema';
import { GAMES } from './registry';
import { isOpen, releasesForRender } from './release';

export async function openGames(
  now: number = Date.now(),
): Promise<GameDefinition[]> {
  const releases = await releasesForRender();
  return GAMES.filter((game) => isOpen(releases, game.id, now));
}

/**
 * 게임 등록소 (IDE-003)
 *
 * 도안은 `src/assets/games/<게임 id>/index.ts`에 두고, 여기에 import 한 줄을
 * 더해 등록한다. 검증은 **모듈을 읽는 순간** 일어나므로, 규격을 어긴 도안은
 * 개발 서버·빌드·테스트 어디서든 즉시 예외로 터진다.
 */
import {
  parseGame,
  type GameDefinition,
  type GameDefinitionInput,
} from '@/lib/schema';
import soccer from '@/assets/games/soccer';

const definitions: GameDefinitionInput[] = [soccer];

function registerAll(inputs: GameDefinitionInput[]): readonly GameDefinition[] {
  const games = inputs.map((definition) => parseGame(definition));
  const seen = new Set<string>();
  for (const game of games) {
    if (seen.has(game.id))
      throw new Error(`게임 id가 중복 등록됐다: ${game.id}`);
    seen.add(game.id);
  }
  return Object.freeze(games);
}

export const GAMES = registerAll(definitions);

export const getGame = (id: string): GameDefinition | undefined =>
  GAMES.find((game) => game.id === id);

/** 카탈로그(IDE-005)가 정적 경로를 만들 때 쓴다. */
export const gameIds = (): string[] => GAMES.map((game) => game.id);

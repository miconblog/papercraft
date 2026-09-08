/**
 * 도안 SVG 산출 (IDE-004 · IDE-014)
 *
 * `src/assets/games/<게임 id>/artwork/`의 생성기를 돌려 `public/games/<게임 id>/`에
 * 쓴다. 산출물은 저장소에 커밋한다 — 런타임에 도안을 그리지 않고 파일을 읽는다.
 *
 *     npm run artwork            모든 게임
 *     npm run artwork baseball   한 게임만
 *
 * 커밋된 SVG가 생성기와 어긋나면 게임마다 있는 `artwork.test.ts`가 잡는다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTWORK as baseball } from '../src/assets/games/baseball/artwork/index.ts';
import { ARTWORK as soccer } from '../src/assets/games/soccer/artwork/index.ts';
import { ARTWORK as worldTour } from '../src/assets/games/world-tour/artwork/index.ts';

/** 게임 id → 파트 id별 생성기. 새 게임을 더할 때 여기 한 줄을 더한다. */
const ARTWORK_BY_GAME: Record<
  string,
  Readonly<Record<string, () => string>>
> = { soccer, baseball, 'world-tour': worldTour };

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const requested = process.argv.slice(2);
const unknown = requested.filter((id) => !(id in ARTWORK_BY_GAME));
if (unknown.length > 0) {
  throw new Error(
    `등록되지 않은 게임이다: ${unknown.join(', ')} ` +
      `(가능: ${Object.keys(ARTWORK_BY_GAME).join(', ')})`,
  );
}
const gameIds = requested.length > 0 ? requested : Object.keys(ARTWORK_BY_GAME);

for (const gameId of gameIds) {
  const outDir = join(repoRoot, 'public', 'games', gameId);
  await mkdir(outDir, { recursive: true });

  console.log(`# ${gameId}`);
  for (const [partId, render] of Object.entries(ARTWORK_BY_GAME[gameId])) {
    const svg = render();
    await writeFile(join(outDir, `${partId}.svg`), svg, 'utf8');
    console.log(`  ${partId}.svg  ${(svg.length / 1024).toFixed(1)}KB`);
  }
}

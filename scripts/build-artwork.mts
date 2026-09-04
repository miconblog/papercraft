/**
 * 도안 SVG 산출 (IDE-004)
 *
 * `src/assets/games/soccer/artwork/`의 생성기를 돌려 `public/games/soccer/`에
 * 쓴다. 산출물은 저장소에 커밋한다 — 런타임에 도안을 그리지 않고 파일을 읽는다.
 *
 *     npm run artwork
 *
 * 커밋된 SVG가 생성기와 어긋나면 테스트(`artwork.test.ts`)가 잡는다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTWORK } from '../src/assets/games/soccer/artwork/index.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'public', 'games', 'soccer');

await mkdir(outDir, { recursive: true });

for (const [partId, render] of Object.entries(ARTWORK)) {
  const svg = render();
  const file = join(outDir, `${partId}.svg`);
  await writeFile(file, svg, 'utf8');
  console.log(`${partId}.svg  ${(svg.length / 1024).toFixed(1)}KB`);
}

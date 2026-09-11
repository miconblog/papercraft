/**
 * 세계일주 게임판 아트워크 (IDE-015 · IDE-016)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/world-tour/<id>.svg`이고
 * `npm run artwork world-tour`로 다시 만든다.
 *
 * 게임판은 **기본 판(도시 50개, A4) 하나만** 정적으로 둔다 — 카탈로그 썸네일이
 * 그것을 쓴다. 실제 판은 만들기 화면의 도시 목록에서 그때 그린다
 * (`./dynamic.ts`) — 켠 도시와 차례가 사람마다 다르므로 미리 만들어 둘 수 없다.
 */
import { DEFAULT_COUNT } from '../cities.ts';
import { renderBoard } from './board.ts';
import { renderPieces } from './pieces.ts';

export { renderBoard, renderPieces };
export { renderWorldTourArtwork } from './dynamic.ts';

export const ARTWORK: Readonly<Record<string, () => string>> = {
  board: () => renderBoard(DEFAULT_COUNT),
  pieces: renderPieces,
};

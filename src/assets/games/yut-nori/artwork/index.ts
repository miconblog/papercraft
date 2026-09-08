/**
 * 윷놀이 아트워크 (IDE-017)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/yut-nori/<파트 id>.svg`이고
 * `npm run artwork yut-nori`로 다시 만든다. 저장소에 커밋된 SVG가 도안 정의의
 * `artwork` 경로가 가리키는 실제 파일이다.
 *
 * 마커 아트워크가 없다 — 말이 판 밖에서 시작하는 게임이라 판 위에 놓인 마커가
 * 하나도 없다(`IDE-017` 배경). 파일 넷이 곧 인쇄물 넷이다.
 */
import { renderBoard } from './board.ts';
import { renderRulesSheet } from './rules-sheet.ts';
import { renderSticks } from './sticks.ts';
import { renderTokens } from './tokens.ts';

export { artworkPath } from '../dimensions.ts';

export const ARTWORK: Readonly<Record<string, () => string>> = {
  board: renderBoard,
  tokens: renderTokens,
  sticks: renderSticks,
  'rules-sheet': renderRulesSheet,
};

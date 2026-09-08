/**
 * 점 잇기 아트워크 (IDE-019)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/dot-to-dot/<파트 id>.svg`이고
 * `npm run artwork dot-to-dot`으로 다시 만든다.
 *
 * **여기서 나오는 파일은 기본값 한 벌뿐이다.** 두 파트가 다 동적이라(사용자가
 * 넣은 사진에서 그림이 나온다) 실제 인쇄물은 `./dynamic.ts`가 그때 그린다.
 * 그래도 정적 파일을 두는 이유는 셋이다 — 카탈로그 썸네일, 소개 페이지, 그리고
 * **생성기가 깨졌을 때 산출 SVG의 차이로 그것을 알아채는 것**(게임마다 있는
 * `artwork.test.ts`).
 */
import { renderDefaultAnswer } from './answer.ts';
import { renderDefaultBoard } from './board.ts';

export { artworkPath } from '../dimensions.ts';

export const ARTWORK: Readonly<Record<string, () => string>> = {
  board: renderDefaultBoard,
  answer: renderDefaultAnswer,
};

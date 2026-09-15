/**
 * 골프 게임판 아트워크 (IDE-030)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/golf/<파트 id>.svg`이고
 * `npm run artwork golf`로 다시 만든다.
 *
 * **스무 장이 나온다** — 홀 판 열여덟, 기록표 하나, 부속 하나. 홀 판 목록을
 * 손으로 적지 않고 `HOLES`에서 만드는 것은 홀을 더하거나 뺄 때 고칠 자리를
 * 하나로 두기 위해서다(축구의 자세별 마커가 같은 방식이다).
 */
import { HOLE_ARTWORK } from './hole.ts';
import { renderScoreCard } from './score-card.ts';
import { renderFlagAndBall } from './flag-and-ball.ts';

export { artworkPath } from '../dimensions.ts';
export { layoutHole, renderHole } from './hole.ts';

export const ARTWORK: Readonly<Record<string, () => string>> = {
  ...HOLE_ARTWORK,
  'score-card': renderScoreCard,
  'flag-and-ball': renderFlagAndBall,
};

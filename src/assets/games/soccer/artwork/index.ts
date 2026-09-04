/**
 * 축구 게임판 아트워크 (IDE-004)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/soccer/<파트 id>.svg`이고
 * `npm run artwork`로 다시 만든다. 저장소에 커밋된 SVG가 도안 정의의
 * `artwork` 경로가 가리키는 실제 파일이다.
 */
import { renderBallMarkers } from './ball-markers.ts';
import { renderField } from './field.ts';
import { renderGoals } from './goals.ts';
import {
  renderGoalkeeperMarkerCircle,
  renderGoalkeeperMarkerIllustration,
  renderPlayerMarkerCircle,
  renderPlayerMarkerIllustration,
} from './player-markers.ts';
import { renderRulesCard } from './rules-card.ts';
import { renderScoreSheet } from './score-sheet.ts';

export { artworkPath } from '../dimensions.ts';

export const ARTWORK: Readonly<Record<string, () => string>> = {
  field: renderField,
  'score-sheet': renderScoreSheet,
  'rules-card': renderRulesCard,
  goals: renderGoals,
  'ball-markers': renderBallMarkers,
  'player-marker-circle': renderPlayerMarkerCircle,
  'player-marker-illustration': renderPlayerMarkerIllustration,
  'goalkeeper-marker-circle': renderGoalkeeperMarkerCircle,
  'goalkeeper-marker-illustration': renderGoalkeeperMarkerIllustration,
};

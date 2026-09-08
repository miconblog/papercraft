/**
 * 야구 게임판 아트워크 (IDE-014)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/baseball/<파트 id>.svg`이고
 * `npm run artwork baseball`로 다시 만든다. 저장소에 커밋된 SVG가 도안 정의의
 * `artwork` 경로가 가리키는 실제 파일이다.
 *
 * 선수 그림은 **자세 × 모양**으로 불어난다 — 자세 일곱에 실루엣·윤곽선 두 벌씩
 * 열넷이다. 목록을 손으로 적지 않고 자세 표(`../dimensions.ts`)에서 만들어,
 * 자세를 더하면 파일도 저절로 따라 나온다. 빈 원은 자세와 무관해 파일 둘을
 * 모든 세트가 나눠 쓴다(수비·타자).
 */
import {
  BATTER_CIRCLE_ARTWORK_ID,
  BATTER_POSE,
  FIELDER_CIRCLE_ARTWORK_ID,
  FIELDER_POSES,
} from '../dimensions.ts';
import { renderField } from './field.ts';
import {
  figureArtworkId,
  renderBatterMarkerCircle,
  renderFielderMarkerCircle,
  renderFigure,
  type FigureMode,
} from './player-markers.ts';
import { renderScoreSheet } from './score-sheet.ts';
import { renderStands } from './stands.ts';

export { artworkPath } from '../dimensions.ts';

const FIGURE_MODES: readonly FigureMode[] = ['illustration', 'outline'];

const figureArtwork = (): Record<string, () => string> =>
  Object.fromEntries(
    [...FIELDER_POSES, BATTER_POSE].flatMap((pose) =>
      FIGURE_MODES.map(
        (mode) =>
          [
            figureArtworkId(pose.id, mode),
            () => renderFigure(pose.id, mode),
          ] as const,
      ),
    ),
  );

export const ARTWORK: Readonly<Record<string, () => string>> = {
  field: renderField,
  'score-sheet': renderScoreSheet,
  stands: renderStands,
  [FIELDER_CIRCLE_ARTWORK_ID]: renderFielderMarkerCircle,
  [BATTER_CIRCLE_ARTWORK_ID]: renderBatterMarkerCircle,
  ...figureArtwork(),
};

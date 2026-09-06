/**
 * 축구 게임판 아트워크 (IDE-004)
 *
 * 파트 id → SVG 문자열. 산출물은 `public/games/soccer/<파트 id>.svg`이고
 * `npm run artwork`로 다시 만든다. 저장소에 커밋된 SVG가 도안 정의의
 * `artwork` 경로가 가리키는 실제 파일이다.
 *
 * 선수 마커는 **자세 × 모양**으로 불어난다(IDE-010, 2026-09-06) — 자세마다
 * 실루엣·윤곽선 두 벌이라 파일이 열넷이다. 목록을 손으로 적지 않고 자세
 * 표(`player-markers.ts`의 `PLAYER_POSES`)에서 만들어, 자세를 더하면 파일도
 * 저절로 따라 나온다.
 *
 * 게임 방법(`rules-card`)과 공 마커(`ball-markers`)는 **출력물에서 뺐다**
 * (2026-09-05 사용자 요청). 규칙은 소개 페이지가 도안 정의의 `rules`를 읽어
 * 그리고, 공은 준비물로 돌렸다 — 생성기도 함께 지웠으므로 되살리려면 그때
 * 커밋을 되짚는다.
 */
import { renderField } from './field.ts';
import { renderGoals } from './goals.ts';
import {
  figureArtworkId,
  GOALKEEPER_POSE,
  PLAYER_POSES,
  renderFigure,
  renderGoalkeeperMarkerCircle,
  renderPlayerMarkerCircle,
  type FigureMode,
} from './player-markers.ts';
import { renderScoreSheet } from './score-sheet.ts';

export { artworkPath } from '../dimensions.ts';

const FIGURE_MODES: readonly FigureMode[] = ['illustration', 'outline'];

const figureArtwork = (): Record<string, () => string> =>
  Object.fromEntries(
    [...PLAYER_POSES, GOALKEEPER_POSE].flatMap((pose) =>
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
  goals: renderGoals,
  // 빈 원은 자세와 무관하다 — 자세 세트 전부가 이 파일 하나를 나눠 쓴다.
  'player-marker-circle': renderPlayerMarkerCircle,
  'goalkeeper-marker-circle': renderGoalkeeperMarkerCircle,
  ...figureArtwork(),
};

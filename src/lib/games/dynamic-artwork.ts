/**
 * 동적 아트워크 렌더러 등록소 (IDE-016 2단계)
 *
 * 파트에 `dynamic`이 있으면 아트워크는 정적 파일이 아니라 **값에서 그때 그린
 * SVG**다. 도안 정의는 데이터라 함수를 실을 수 없으므로 게임 id → 렌더러를
 * 여기서 잇는다.
 *
 * **서버에서만 부른다.** 렌더러가 해안선 데이터(243KB)와 배치 계산을 끌고
 * 들어오므로 클라이언트 번들에 넣지 않는다 — 미리보기는
 * `/api/games/[id]/artwork`로 받고, 내보내기(`/api/games/[id]/export`)는 같은
 * 함수를 직접 부른다. 두 길이 같은 함수라 화면과 PDF가 같은 그림이다.
 */
import type { GameCustomization, GameDefinition, Part } from '@/lib/schema';
import { renderDotToDotArtwork } from '@/assets/games/dot-to-dot/artwork/dynamic';
import { renderWorldTourArtwork } from '@/assets/games/world-tour/artwork/dynamic';

type Renderer = (
  partId: string,
  customization: GameCustomization,
) => string | null;

const RENDERERS: Readonly<Record<string, Renderer>> = {
  'world-tour': renderWorldTourArtwork,
  'dot-to-dot': renderDotToDotArtwork,
};

export function renderDynamicArtwork(
  game: GameDefinition,
  part: Part,
  customization: GameCustomization,
): string {
  const svg = RENDERERS[game.id]?.(part.id, customization) ?? null;
  if (svg === null) {
    throw new Error(
      `동적 파트 '${game.id}/${part.id}'를 그릴 렌더러가 없다 — lib/games/dynamic-artwork.ts에 등록한다`,
    );
  }
  return svg;
}

/** 이 게임에 동적 파트 렌더러가 있는가. 테스트가 쓴다. */
export const hasDynamicRenderer = (gameId: string): boolean =>
  gameId in RENDERERS;

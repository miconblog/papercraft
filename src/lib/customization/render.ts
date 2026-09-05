/**
 * 커스터마이즈 값을 도안 위에 얹을 때 쓰는 규칙 (IDE-007)
 *
 * 화면 미리보기(`BoardPreview`)와 인쇄 렌더러(`src/lib/print`)가 **같은 답**을
 * 내야 한다. 미리보기에서 흰 글씨였던 등번호가 인쇄물에서 검은 글씨로 나오면
 * 미리보기가 거짓말을 한 것이다. 그래서 두 쪽이 공유하는 규칙만 여기 모았다 —
 * 프레임워크에 기대지 않는 순수 함수다.
 */
import type { GameCustomization, GameDefinition } from '@/lib/schema';

/**
 * 마커 아트워크가 팀 색을 받는 레이어 id.
 *
 * 파트 레벨의 `pc-team-<그룹 id>`와 달리 스키마 검증이 닿지 않는 관례다 —
 * `IDE-010`(`artwork/player-markers.ts`)이 정하고 "렌더러가 이 id로 채워 넣는다"고
 * 문서에 남겨 둔 계약이다.
 */
export const MARKER_FILL_LAYER_ID = 'pc-marker-fill';

/** 마커 색을 못 찾았을 때의 중간 회색. 흑백으로 뽑아도 도형이 남는다. */
export const FALLBACK_MARKER_COLOR = '#9ca3af';

/** 어두운 배경엔 흰 글자, 밝은 배경엔 검은 글자 — 마커 위 등번호가 늘 읽히게. */
export function readableTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

/**
 * 이 슬롯의 마커를 좌우로 뒤집어 그릴지. 그룹이 선언한다(`group.mirrorMarkers`).
 *
 * 미리보기와 인쇄물이 같은 답을 내야 하는 값이라 여기 둔다 — 화면에서는 왼쪽을
 * 보던 마커가 인쇄물에서 오른쪽을 보면 어느 팀인지가 뒤바뀐다.
 */
export function markerMirrored(
  game: GameDefinition,
  groupId: string | undefined,
): boolean {
  return game.groups.find((g) => g.id === groupId)?.mirrorMarkers ?? false;
}

/** 슬롯이 속한 그룹의 색 슬롯 값. 그룹이 없거나 색 슬롯이 없으면 중간 회색. */
export function groupColorOf(
  game: GameDefinition,
  customization: GameCustomization,
  groupId: string | undefined,
): string {
  const group = game.groups.find((g) => g.id === groupId);
  const colorSlotId = group?.colorSlotId;
  const value = colorSlotId ? customization.values[colorSlotId] : undefined;
  return typeof value === 'string' ? value : FALLBACK_MARKER_COLOR;
}

/**
 * 파트 하나에 적용할 레이어 색. `paint` 배치를 레이어 id로 모은다 —
 * 도안 SVG를 읽는 쪽이 이 표만 보면 된다.
 */
export function paintOverrides(
  game: GameDefinition,
  customization: GameCustomization,
  partId: string,
): Record<string, { fill?: string; stroke?: string }> {
  const overrides: Record<string, { fill?: string; stroke?: string }> = {};
  for (const slot of game.slots) {
    for (const placement of slot.placements) {
      if (placement.mode !== 'paint' || placement.partId !== partId) continue;
      const value = customization.values[slot.id];
      if (typeof value !== 'string') continue;
      overrides[placement.layerId] = {
        ...overrides[placement.layerId],
        [placement.property]: value,
      };
    }
  }
  return overrides;
}

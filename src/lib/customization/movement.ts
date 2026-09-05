/**
 * 마커를 손으로 옮길 때의 규칙 (IDE-012)
 *
 * 프리셋(전술 대형)은 출발점일 뿐이고, 사용자는 적용한 뒤 마커를 원하는 자리로
 * 옮긴다(`docs/game-authoring.md` 배치 프리셋). 어디까지 갈 수 있는지는 도안이
 * 정한다 — 슬롯이 가리키는 영역(`regionId`) 안이고, 마커가 파트 밖으로
 * 비어져 나가지 않는 곳까지다.
 *
 * 순수 함수로 둔 이유는 **화면과 검증이 같은 경계를 써야** 하기 때문이다.
 * 드래그가 허용한 자리를 저장 검증(`validateCustomization`)이 거부하면 사용자가
 * 만든 값이 조용히 버려진다.
 */
import {
  findPart,
  findRegion,
  slotMarker,
  styleSetBounds,
  type GameDefinition,
  type Slot,
  type SlotPoint,
} from '@/lib/schema';

export interface MoveBounds {
  readonly minXMm: number;
  readonly maxXMm: number;
  readonly minYMm: number;
  readonly maxYMm: number;
}

/**
 * 이 슬롯의 마커가 갈 수 있는 범위. 옮길 수 없는 슬롯이면 `null`이다.
 *
 * 영역 판정은 **마커 중심**으로 한다(`containsPoint`와 같은 기준). 거기에
 * 파트 경계에 대해서만 마커 반크기를 더 물린다 — 중심이 파트 안이어도 마커가
 * 종이 밖으로 잘려 나가면 인쇄물에서 반쪽이 된다.
 */
export function markerBounds(
  game: GameDefinition,
  slot: Slot,
): MoveBounds | null {
  const marker = slotMarker(slot);
  if (!marker) return null;
  const part = findPart(game, marker.partId);
  if (!part) return null;

  const styleSet = game.styleSets.find((s) => s.id === marker.styleSetId);
  const size = styleSet
    ? styleSetBounds(styleSet)
    : { widthMm: 0, heightMm: 0 };
  const halfWidthMm = size.widthMm / 2;
  const halfHeightMm = size.heightMm / 2;

  const region = findRegion(part, marker.regionId);
  const area = region?.rect ?? {
    xMm: 0,
    yMm: 0,
    widthMm: part.widthMm,
    heightMm: part.heightMm,
  };

  return {
    minXMm: Math.max(area.xMm, halfWidthMm),
    maxXMm: Math.min(area.xMm + area.widthMm, part.widthMm - halfWidthMm),
    minYMm: Math.max(area.yMm, halfHeightMm),
    maxYMm: Math.min(area.yMm + area.heightMm, part.heightMm - halfHeightMm),
  };
}

/**
 * 범위 안으로 끌어당긴다. 범위가 뒤집혀 있으면(마커가 영역보다 큰 도안)
 * 가운데로 모은다 — 그런 도안에서도 좌표가 NaN이 되지는 않게.
 */
export const clampToBounds = (
  bounds: MoveBounds,
  point: SlotPoint,
): SlotPoint => ({
  xMm:
    bounds.minXMm > bounds.maxXMm
      ? (bounds.minXMm + bounds.maxXMm) / 2
      : Math.min(Math.max(point.xMm, bounds.minXMm), bounds.maxXMm),
  yMm:
    bounds.minYMm > bounds.maxYMm
      ? (bounds.minYMm + bounds.maxYMm) / 2
      : Math.min(Math.max(point.yMm, bounds.minYMm), bounds.maxYMm),
});

/** 소수점이 길어지면 저장값만 지저분해진다. 0.1mm면 인쇄에서 충분히 곱다. */
export const roundPoint = (point: SlotPoint): SlotPoint => ({
  xMm: Math.round(point.xMm * 10) / 10,
  yMm: Math.round(point.yMm * 10) / 10,
});

/** 슬롯 하나를 옮긴 결과 좌표. 범위 밖이면 경계에 붙는다. */
export function movedPoint(
  game: GameDefinition,
  slot: Slot,
  point: SlotPoint,
): SlotPoint {
  const bounds = markerBounds(game, slot);
  return roundPoint(bounds ? clampToBounds(bounds, point) : point);
}

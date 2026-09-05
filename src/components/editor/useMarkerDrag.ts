'use client';

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { SlotPoint } from '@/lib/schema';

/**
 * 미리보기 위에서 마커를 끌어 옮기는 조작 (IDE-012)
 *
 * 포인터 이벤트 하나로 마우스·터치·펜을 함께 받는다. 끄는 동안 포인터를
 * 붙잡아(`setPointerCapture`) 미리보기 밖으로 나가도 계속 따라오게 한다 —
 * 안 그러면 빠르게 끌 때 마커가 중간에 떨어진다.
 *
 * **누른 자리와 마커 중심의 차이를 기억한다.** 그러지 않으면 마커를 잡는 순간
 * 중심이 포인터로 튀어, 가장자리를 잡았을 때 배치가 흐트러진다.
 *
 * 끌지 않고 누르기만 한 것은 클릭으로 돌려준다(`onTap`) — 미리보기의 마커를
 * 눌러 그 입력으로 이동하는 기존 조작(IDE-006)을 드래그가 잡아먹지 않게 한다.
 */
export interface MarkerDragOptions {
  /** 파트 로컬 mm로 옮긴 자리. 경계 처리는 부르는 쪽이 한다. */
  onMove: (slotId: string, point: SlotPoint) => void;
  onTap: (slotId: string) => void;
  /** 파트 크기(mm). 화면 픽셀을 도안 좌표로 되돌릴 때 쓴다. */
  partWidthMm: number;
  partHeightMm: number;
}

/** 이만큼 움직이지 않았으면 끈 것이 아니라 누른 것으로 본다(CSS px). */
const TAP_SLOP_PX = 4;

interface DragState {
  readonly slotId: string;
  readonly pointerId: number;
  /** 마커 중심 − 포인터. 파트 mm 단위. */
  readonly grabOffsetXMm: number;
  readonly grabOffsetYMm: number;
  readonly startClientX: number;
  readonly startClientY: number;
}

export function useMarkerDrag({
  onMove,
  onTap,
  partWidthMm,
  partHeightMm,
}: MarkerDragOptions) {
  const surfaceRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  // 끄는 중인 슬롯. 커서와 강조 표시에만 쓴다 — 좌표는 부모가 들고 있다.
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);

  /**
   * 화면 좌표 → 파트 mm.
   *
   * 미리보기 상자가 파트와 같은 가로세로비(`aspectRatio`)라 viewBox가 상자를
   * 정확히 채운다. 그래서 단순 비례로 되돌릴 수 있다.
   */
  const toPartMm = (clientX: number, clientY: number): SlotPoint | null => {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      xMm: ((clientX - rect.left) / rect.width) * partWidthMm,
      yMm: ((clientY - rect.top) / rect.height) * partHeightMm,
    };
  };

  const handlePointerDown =
    (slotId: string, point: SlotPoint) =>
    (event: ReactPointerEvent<SVGGElement>) => {
      // 주 버튼만. 오른쪽 버튼 메뉴로 마커가 딸려 가면 안 된다.
      if (event.button !== 0) return;
      const at = toPartMm(event.clientX, event.clientY);
      if (!at) return;

      event.preventDefault();
      dragRef.current = {
        slotId,
        pointerId: event.pointerId,
        grabOffsetXMm: point.xMm - at.xMm,
        grabOffsetYMm: point.yMm - at.yMm,
        startClientX: event.clientX,
        startClientY: event.clientY,
      };
      movedRef.current = false;
      setDraggingSlotId(slotId);
      // jsdom처럼 포인터 캡처가 없는 환경도 있다 — 없으면 그냥 넘어간다.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

  const handlePointerMove = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const at = toPartMm(event.clientX, event.clientY);
    if (!at) return;

    if (
      Math.abs(event.clientX - drag.startClientX) > TAP_SLOP_PX ||
      Math.abs(event.clientY - drag.startClientY) > TAP_SLOP_PX
    ) {
      movedRef.current = true;
    }
    onMove(drag.slotId, {
      xMm: at.xMm + drag.grabOffsetXMm,
      yMm: at.yMm + drag.grabOffsetYMm,
    });
  };

  const endDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDraggingSlotId(null);
    if (!movedRef.current) onTap(drag.slotId);
  };

  return {
    surfaceRef,
    draggingSlotId,
    /** 마커 `<g>`에 그대로 펼쳐 붙인다. */
    markerHandlers: (slotId: string, point: SlotPoint) => ({
      onPointerDown: handlePointerDown(slotId, point),
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    }),
  };
}

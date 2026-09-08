'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * 미리보기 확대·축소·이동 — 지도 앱과 같은 손맛 (IDE-016)
 *
 * 세계일주 게임판은 A4 한 장에 도시 50개, A2에 100개라 화면 미리보기에서는
 * 칸이 손톱만 하다. 사용자가 "구글맵과 같은 지도 UX"를 요구했다(2026-09-08):
 *
 * - 휠 — 커서 자리를 중심으로 확대·축소. 휠이 페이지를 스크롤하지 않는다.
 * - 빈 곳 드래그 — 이동. 마커 위에서 시작한 드래그는 마커를 옮기는 것이라 여기서
 *   받지 않는다(`data-marker`).
 * - 두 손가락 — 핀치 확대·축소와 이동을 함께.
 * - 더블클릭 — 그 자리를 중심으로 두 배.
 * - `+` `-` `0` 키와 화면 버튼.
 *
 * 변환은 CSS `translate(tx, ty) scale(s)`이고 원점은 상자의 왼쪽 위다. 배율 1이
 * 상자에 꼭 맞는 크기이며 그 아래로는 안 줄인다 — 판이 상자보다 작아지면 여백만
 * 남는다. 이동은 판이 상자를 늘 덮도록 묶는다 — 판을 화면 밖으로 밀어낼 수 없다.
 *
 * 이 훅은 게임을 모른다. 마커 드래그(`useMarkerDrag`)와 같이 쓰이며, 그쪽은
 * 화면 좌표를 surface의 실제 사각형으로 되돌리므로 확대해도 그대로 맞는다.
 */
export interface Viewport {
  readonly scale: number;
  readonly txPx: number;
  readonly tyPx: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** 휠 한 눈금의 배율 변화. 100px 델타에 약 1.28배 — 지도 앱들의 감각이다. */
const WHEEL_SENSITIVITY = 0.0025;
const BUTTON_STEP = 1.5;
/** 이만큼 움직이지 않았으면 끈 것이 아니라 누른 것이다(CSS px). */
const DRAG_SLOP_PX = 3;

const IDENTITY: Viewport = { scale: 1, txPx: 0, tyPx: 0 };

const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** 판이 상자를 늘 덮도록 이동을 묶는다. */
const clampViewport = (
  next: Viewport,
  widthPx: number,
  heightPx: number,
): Viewport => {
  const scale = clampScale(next.scale);
  const minTx = widthPx - widthPx * scale;
  const minTy = heightPx - heightPx * scale;
  return {
    scale,
    txPx: Math.min(0, Math.max(minTx, next.txPx)),
    tyPx: Math.min(0, Math.max(minTy, next.tyPx)),
  };
};

/** (px, py)를 화면상 제자리에 둔 채 배율만 바꾼다. */
const zoomedAt = (
  current: Viewport,
  nextScale: number,
  pxPx: number,
  pyPx: number,
): Viewport => {
  const scale = clampScale(nextScale);
  const ratio = scale / current.scale;
  return {
    scale,
    txPx: pxPx - (pxPx - current.txPx) * ratio,
    tyPx: pyPx - (pyPx - current.tyPx) * ratio,
  };
};

interface PointerRecord {
  x: number;
  y: number;
}

interface Gesture {
  /** 한 손가락 이동. */
  readonly kind: 'pan';
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startViewport: Viewport;
  moved: boolean;
}

interface Pinch {
  readonly kind: 'pinch';
  readonly startDistance: number;
  readonly startMidX: number;
  readonly startMidY: number;
  readonly startViewport: Viewport;
}

export interface UseMapViewportOptions {
  /** 꺼져 있으면 아무 조작도 받지 않고 항등 변환만 돌려준다. */
  enabled?: boolean;
}

export function useMapViewport({ enabled = true }: UseMapViewportOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>(IDENTITY);
  // 제스처 계산은 최신 값을 동기적으로 읽어야 해서 ref에도 둔다. 렌더 중에는
  // 손대지 않고 `apply`에서만 갱신한다 — 둘은 언제나 같다.
  const viewportRef = useRef<Viewport>(IDENTITY);
  const pointersRef = useRef(new Map<number, PointerRecord>());
  const gestureRef = useRef<Gesture | Pinch | null>(null);
  const [panning, setPanning] = useState(false);

  const size = () => {
    const el = containerRef.current;
    return el
      ? { w: el.clientWidth || 1, h: el.clientHeight || 1 }
      : { w: 1, h: 1 };
  };

  const apply = useCallback((next: Viewport) => {
    const { w, h } = size();
    const clamped = clampViewport(next, w, h);
    viewportRef.current = clamped;
    setViewport(clamped);
  }, []);

  /** 컨테이너 안 좌표(px). */
  const localPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect
      ? { x: clientX - rect.left, y: clientY - rect.top }
      : { x: 0, y: 0 };
  };

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      const current = viewportRef.current;
      const { w, h } = size();
      const center = at ?? { x: w / 2, y: h / 2 };
      apply(zoomedAt(current, current.scale * factor, center.x, center.y));
    },
    [apply],
  );

  const zoomIn = useCallback(() => zoomBy(BUTTON_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / BUTTON_STEP), [zoomBy]);
  const reset = useCallback(() => apply(IDENTITY), [apply]);

  // 휠은 기본이 페이지 스크롤이라 `preventDefault`가 필요한데, React의 onWheel은
  // passive라 막을 수 없다. 직접 건다.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
      zoomBy(factor, localPoint(event.clientX, event.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [enabled, zoomBy]);

  const isOnMarker = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest('[data-marker]') !== null;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0 || isOnMarker(event.target)) return;
    const point = localPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pointers = [...pointersRef.current.values()];
    if (pointers.length >= 2) {
      const [a, b] = pointers;
      gestureRef.current = {
        kind: 'pinch',
        startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startMidX: (a.x + b.x) / 2,
        startMidY: (a.y + b.y) / 2,
        startViewport: viewportRef.current,
      };
      setPanning(true);
      return;
    }
    // 배율 1에서는 옮길 것이 없다 — 그래도 누른 것은 기억해 핀치로 이어질 수 있게 한다.
    gestureRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      startViewport: viewportRef.current,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const record = pointersRef.current.get(event.pointerId);
    if (!record) return;
    const point = localPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      const pointers = [...pointersRef.current.values()];
      if (pointers.length < 2) return;
      const [a, b] = pointers;
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const zoomed = zoomedAt(
        gesture.startViewport,
        gesture.startViewport.scale * (distance / gesture.startDistance),
        gesture.startMidX,
        gesture.startMidY,
      );
      apply({
        ...zoomed,
        txPx: zoomed.txPx + (midX - gesture.startMidX),
        tyPx: zoomed.tyPx + (midY - gesture.startMidY),
      });
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;
    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;
    if (
      !gesture.moved &&
      Math.abs(dx) <= DRAG_SLOP_PX &&
      Math.abs(dy) <= DRAG_SLOP_PX
    )
      return;
    if (!gesture.moved) {
      gesture.moved = true;
      setPanning(true);
    }
    apply({
      ...gesture.startViewport,
      txPx: gesture.startViewport.txPx + dx,
      tyPx: gesture.startViewport.tyPx + dy,
    });
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setPanning(false);
      return;
    }
    // 두 손가락에서 하나를 떼면 남은 손가락으로 이동을 잇는다.
    const [remainingId, remaining] = [...pointersRef.current.entries()][0];
    gestureRef.current = {
      kind: 'pan',
      pointerId: remainingId,
      startX: remaining.x,
      startY: remaining.y,
      startViewport: viewportRef.current,
      moved: true,
    };
  };

  const onDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || isOnMarker(event.target)) return;
    zoomBy(2, localPoint(event.clientX, event.clientY));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomOut();
    } else if (event.key === '0') {
      event.preventDefault();
      reset();
    }
  };

  return {
    containerRef,
    viewport: enabled ? viewport : IDENTITY,
    panning,
    zoomIn,
    zoomOut,
    reset,
    canZoomIn: viewport.scale < MAX_SCALE - 1e-9,
    canZoomOut: viewport.scale > MIN_SCALE + 1e-9,
    /** 컨테이너 `<div>`에 그대로 펼쳐 붙인다. */
    containerHandlers: enabled
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp: onPointerEnd,
          onPointerCancel: onPointerEnd,
          onDoubleClick,
          onKeyDown,
        }
      : {},
    /** 판 레이어(배경 + 오버레이)를 감싸는 요소에 준다. */
    stageStyle: {
      transform: `translate(${viewport.txPx}px, ${viewport.tyPx}px) scale(${viewport.scale})`,
      transformOrigin: '0 0',
    } as const,
  };
}

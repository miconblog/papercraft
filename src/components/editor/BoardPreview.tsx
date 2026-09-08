'use client';

import { useEffect, useRef, useState } from 'react';
import {
  resolveVariant,
  slotsOfPart,
  styleSetBounds,
  type GameCustomization,
  type GameDefinition,
  type Part,
  type SlotPoint,
} from '@/lib/schema';
import {
  groupColorOf,
  markerMirrored,
  MARKER_TEAM_LAYER_ID,
  markerValueColor,
} from '@/lib/customization/render';
import { extractSvgInner, paintLayer, stripOuterSvgSize } from './svgOverlay';
import { slotFieldId } from './SlotField';
import { useMarkerDrag } from './useMarkerDrag';
import { useMapViewport } from './useMapViewport';
import { ROTATION_STEP_DEG, rotatedPoint } from '@/lib/customization/movement';

/**
 * 도안 미리보기 — 파트 SVG 위에 커스터마이즈 값을 얹어 실시간으로 보여준다
 * (IDE-006)
 *
 * 배경은 아트워크 SVG를 그대로 fetch해 넣고(팀 색만 레이어 fill을 바꿔 칠한다),
 * 텍스트·마커 슬롯은 같은 viewBox의 오버레이 `<svg>`로 그 위에 겹친다. 오버레이
 * 쪽을 누르면 해당 입력으로 스크롤·포커스를 옮긴다 — 미리보기와 폼을 잇는
 * 유일한 통로다.
 *
 * **부르는 쪽이 `key={part.id}`를 준다.** 파트가 바뀌면 이전 파트의 배경이
 * 잠깐이라도 남지 않게 컴포넌트를 통째로 다시 마운트한다 — effect 안에서
 * 상태를 곧장 초기화하는 대신 마운트 자체를 새로 하는 쪽을 택했다.
 */
export interface BoardPreviewProps {
  game: GameDefinition;
  part: Part;
  customization: GameCustomization;
  /**
   * 미리보기를 눌러 폼 입력으로 이동할 수 있는지. 인쇄 화면처럼 옆에 폼이
   * 없는 곳에서는 꺼서 누를 수 있는 것처럼 보이지 않게 한다.
   */
  interactive?: boolean;
  /**
   * 마커를 끌어 옮겼을 때. 주지 않으면 드래그가 꺼진다 — 인쇄 미리보기처럼
   * 보기만 하는 곳에서는 마커가 움직이면 안 된다.
   *
   * 좌표를 어디까지 허용할지는 **받는 쪽이 정한다**(`movedPoint`). 화면이
   * 제 나름대로 잘라 내면 저장 검증과 어긋날 수 있다.
   */
  onMoveSlot?: (slotId: string, point: SlotPoint) => void;
}

const textAnchorOf = { start: 'start', center: 'middle', end: 'end' } as const;

/**
 * 마커 아트워크 원문 캐시. url → SVG 문자열.
 *
 * `key={part.id}`로 파트를 바꿀 때마다 이 컴포넌트가 통째로 다시 마운트되는데
 * (위 주석 참고), 마커 아트워크는 파트가 아니라 게임 전체에 속해 바뀌지 않는다.
 * 컴포넌트 로컬 상태로만 두면 파트를 오갈 때마다 같은 파일을 다시 fetch하고
 * 다시 파싱한다 — 브라우저 HTTP 캐시가 네트워크 왕복은 줄여도 파싱·리렌더
 * 비용은 그대로다. 모듈 레벨 캐시로 한 번만 받는다.
 */
const markerArtworkCache = new Map<string, string>();

/** 테스트 전용 — 모듈 레벨 캐시는 테스트 파일 안에서도 유지되므로 초기화한다. */
export function __resetMarkerArtworkCacheForTests(): void {
  markerArtworkCache.clear();
}

export function BoardPreview({
  game,
  part,
  customization,
  interactive = true,
  onMoveSlot,
}: BoardPreviewProps) {
  const [background, setBackground] = useState<string | null>(null);
  // 마커 스타일 변형(원형·일러스트 등)의 아트워크 원문. 경로 → SVG 문자열.
  // 로드되기 전이거나 실패한 변형은 원 + 값 텍스트로 대체한다(아래 렌더링).
  const [markerArtwork, setMarkerArtwork] = useState<Record<string, string>>(
    () => Object.fromEntries(markerArtworkCache),
  );

  useEffect(() => {
    const urls = new Set<string>();
    for (const set of game.styleSets) {
      for (const variant of set.variants) {
        if (variant.artwork) urls.add(variant.artwork);
      }
    }
    const missing = [...urls].filter((url) => !markerArtworkCache.has(url));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (url) => {
          try {
            const res = await fetch(url);
            return [url, await res.text()] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      for (const entry of entries) {
        if (entry) markerArtworkCache.set(entry[0], entry[1]);
      }
      setMarkerArtwork(Object.fromEntries(markerArtworkCache));
    })();
    return () => {
      cancelled = true;
    };
  }, [game]);

  // 동적 파트(세계일주 게임판)는 값에서 그때 그린다 — 목록·틀 슬롯이 바뀔 때만
  // 서버에 다시 청한다. 나머지 값(말 이름·색)은 그림과 무관하므로 키에 넣지
  // 않고, 요청 본문은 ref로 최신 값을 쓴다.
  const customizationRef = useRef(customization);
  useEffect(() => {
    customizationRef.current = customization;
  });
  const dynamicKey = part.dynamic
    ? JSON.stringify([
        customization.values[part.dynamic.listSlotId],
        part.dynamic.frameSlotId
          ? customization.values[part.dynamic.frameSlotId]
          : null,
      ])
    : null;

  useEffect(() => {
    if (!part.dynamic) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/${game.id}/artwork`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partId: part.id,
            customization: customizationRef.current,
          }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const svg = await res.text();
        if (!controller.signal.aborted) setBackground(svg);
      } catch {
        // 중단됐거나 서버가 없다(테스트) — 배경 없이 오버레이만 남는다.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [game.id, part.id, part.dynamic, dynamicKey]);

  useEffect(() => {
    if (!part.artwork || part.dynamic) return;
    let cancelled = false;
    // 상대 경로 fetch가 지원되지 않는 환경(테스트의 jsdom 등)도 있어
    // 동기·비동기 실패를 한 번에 잡는다 — 실패하면 "불러오는 중" 표시만
    // 남고 에디터 자체는 계속 동작한다.
    (async () => {
      try {
        const res = await fetch(part.artwork!);
        const svg = await res.text();
        if (!cancelled) setBackground(svg);
      } catch {
        // 무시한다 — 배경은 없어도 오버레이(값 반영)는 계속 동작한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [part.artwork, part.dynamic]);

  const paintedBackground = (() => {
    if (!background) return null;
    let svg = stripOuterSvgSize(background);
    for (const slot of slotsOfPart(game, part.id)) {
      for (const placement of slot.placements) {
        if (placement.mode !== 'paint' || placement.partId !== part.id)
          continue;
        const value = customization.values[slot.id];
        if (typeof value === 'string') {
          svg = paintLayer(svg, placement.layerId, value);
        }
      }
    }
    return svg;
  })();

  const focusSlotField = (slotId: string) => {
    if (!interactive) return;
    const field = document.getElementById(slotFieldId(slotId));
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus();
  };

  const draggable = onMoveSlot !== undefined;

  /**
   * 마커를 누르면 **제 중심을 축으로 돌린다**(2026-09-05 사용자 요청).
   *
   * 예전에는 눌렀을 때 그 슬롯의 입력창으로 커서가 갔는데(IDE-006), 배치를
   * 손보는 동안 화면이 자꾸 입력 쪽으로 튀어 방해가 됐다. 마커를 만지는 조작은
   * 미리보기 안에서 끝나야 한다 — 지금 마커에 남은 조작은 옮기기와 돌리기뿐이다.
   *
   * 한 번에 45°씩 도는 것은 여덟 방향이면 달리는 자세를 고르기에 충분하고,
   * 그보다 잘게 나누면 원하는 각도까지 여러 번 눌러야 하기 때문이다.
   */
  const rotateSlot = (slotId: string, point: SlotPoint, deltaDeg: number) => {
    onMoveSlot?.(slotId, rotatedPoint(point, deltaDeg));
  };

  // 확대·축소·이동 — 지도 앱과 같은 손맛(IDE-016). 보기 전용 미리보기(인쇄 화면)
  // 에서는 끈다 — 타일 경계 오버레이가 이 상자 밖에 있어 함께 움직이지 않는다.
  const {
    containerRef,
    viewport,
    panning,
    zoomIn,
    zoomOut,
    reset: resetZoom,
    canZoomIn,
    canZoomOut,
    containerHandlers,
    stageStyle,
  } = useMapViewport({ enabled: interactive });

  const { surfaceRef, draggingSlotId, markerHandlers } = useMarkerDrag({
    onMove: (slotId, point) => onMoveSlot?.(slotId, point),
    onTap: (slotId, point, shiftKey) =>
      rotateSlot(
        slotId,
        point,
        shiftKey ? -ROTATION_STEP_DEG : ROTATION_STEP_DEG,
      ),
    partWidthMm: part.widthMm,
    partHeightMm: part.heightMm,
  });

  /**
   * 화살표 키로 옮기고 `r`로 돌린다. 드래그·클릭만 두면 키보드로는 배치를
   * 바꿀 수 없다 — 마커가 `role="button"`이지만 SVG `<g>`는 네이티브 버튼이
   * 아니라 Enter·Space가 저절로 클릭이 되지 않으므로 여기서 함께 받는다.
   */
  const nudge = (
    slotId: string,
    point: SlotPoint,
    event: React.KeyboardEvent<SVGGElement>,
  ) => {
    if (
      event.key === 'r' ||
      event.key === 'R' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      rotateSlot(
        slotId,
        point,
        event.shiftKey ? -ROTATION_STEP_DEG : ROTATION_STEP_DEG,
      );
      return;
    }
    const stepMm = event.shiftKey ? 5 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-stepMm, 0],
      ArrowRight: [stepMm, 0],
      ArrowUp: [0, -stepMm],
      ArrowDown: [0, stepMm],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    onMoveSlot?.(slotId, {
      ...point,
      xMm: point.xMm + move[0],
      yMm: point.yMm + move[1],
    });
  };

  const zoomed = viewport.scale > 1;

  return (
    <div
      ref={containerRef}
      className={
        'relative w-full overflow-hidden rounded-lg border border-border bg-paper ' +
        (interactive
          ? panning
            ? 'cursor-grabbing'
            : zoomed
              ? 'cursor-grab'
              : 'cursor-zoom-in'
          : '')
      }
      style={{
        aspectRatio: `${part.widthMm} / ${part.heightMm}`,
        // 브라우저의 스크롤·핀치가 우리 제스처를 가로채지 못하게 — 지도 앱과 같다.
        touchAction: interactive ? 'none' : undefined,
      }}
      role={interactive ? 'group' : undefined}
      aria-label={
        interactive
          ? `${part.title} 미리보기 — 휠이나 +·- 키로 확대·축소, 빈 곳을 끌어서 이동, 0 키로 원래 크기`
          : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      {...containerHandlers}
    >
      {/* 배경과 마커 오버레이를 한 무대에 놓고 무대를 통째로 확대·이동한다 —
          둘이 따로 움직이면 마커가 판에서 미끄러진다. */}
      <div className="absolute inset-0" style={stageStyle}>
        {paintedBackground ? (
          <div
            className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            // 도안 SVG는 우리 빌드 파이프라인이 만드는 정적 자산이다 — 사용자
            // 입력이 아니라 신뢰할 수 있는 마크업이다.
            dangerouslySetInnerHTML={{ __html: paintedBackground }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-paper-foreground">
            미리보기를 불러오는 중이다…
          </div>
        )}

        <svg
          ref={surfaceRef}
          viewBox={`0 0 ${part.widthMm} ${part.heightMm}`}
          className="absolute inset-0 h-full w-full"
        >
          {slotsOfPart(game, part.id).map((slot) =>
            slot.placements
              .filter((pl) => pl.partId === part.id)
              .map((placement, i) => {
                const value = customization.values[slot.id];
                const key = `${slot.id}-${i}`;

                if (placement.mode === 'text') {
                  return (
                    <text
                      key={key}
                      x={placement.xMm}
                      y={placement.yMm}
                      fontSize={placement.fontSizeMm}
                      textAnchor={textAnchorOf[placement.align]}
                      dominantBaseline="central"
                      transform={
                        placement.rotationDeg
                          ? `rotate(${placement.rotationDeg} ${placement.xMm} ${placement.yMm})`
                          : undefined
                      }
                      fill="#1a1a1a"
                      className={interactive ? 'cursor-pointer' : undefined}
                      onClick={() => focusSlotField(slot.id)}
                    >
                      {String(value)}
                    </text>
                  );
                }

                if (placement.mode === 'marker') {
                  const point = customization.positions[slot.id] ?? {
                    xMm: placement.xMm,
                    yMm: placement.yMm,
                  };
                  const styleSet = game.styleSets.find(
                    (s) => s.id === placement.styleSetId,
                  );
                  if (!styleSet) return null;
                  const variant = resolveVariant(
                    game,
                    styleSet.id,
                    customization,
                  );
                  const bounds = styleSetBounds(styleSet);
                  const radiusMm =
                    Math.min(bounds.widthMm, bounds.heightMm) / 2;
                  const fill = groupColorOf(game, customization, slot.groupId);
                  const isGoalkeeper = slot.tags.includes('goalkeeper');
                  const rawArtwork = variant.artwork
                    ? markerArtwork[variant.artwork]
                    : undefined;
                  const artworkInner = rawArtwork
                    ? extractSvgInner(
                        // 채움과 테두리를 둘 다 칠한다 — 빈 원은 테두리로,
                        // 일러스트는 채움으로 팀 색을 받는다.
                        paintLayer(
                          paintLayer(rawArtwork, MARKER_TEAM_LAYER_ID, fill),
                          MARKER_TEAM_LAYER_ID,
                          fill,
                          'stroke',
                        ),
                      )
                    : null;

                  // 반대편으로 공격하는 팀은 마커를 뒤집는다 — 화살촉이 공격
                  // 방향을 가리킨다. 인쇄물도 같은 규칙을 쓴다(`compose.ts`).
                  const mirrored = markerMirrored(game, slot.groupId);

                  const dragging = draggingSlotId === slot.id;

                  return (
                    <g
                      key={key}
                      // 마커 위에서 시작한 포인터는 판 이동이 아니라 마커 끌기다
                      // (`useMapViewport`가 이 표식을 보고 비켜 준다).
                      data-marker=""
                      // 끌어 옮길 수 있으면 그렇게 보여야 한다. 드래그가 꺼진
                      // 곳(인쇄 미리보기)에서는 아무 커서도 주지 않는다.
                      className={
                        draggable
                          ? dragging
                            ? 'cursor-grabbing'
                            : 'cursor-grab'
                          : interactive
                            ? 'cursor-pointer'
                            : undefined
                      }
                      // 브라우저 기본 제스처(스크롤·확대)가 드래그를 가로채지
                      // 못하게 한다. 터치에서 특히 중요하다.
                      style={draggable ? { touchAction: 'none' } : undefined}
                      tabIndex={draggable ? 0 : undefined}
                      role={draggable ? 'button' : undefined}
                      aria-label={
                        draggable
                          ? `${slot.label} 마커 — 가로 ${point.xMm}mm, 세로 ${point.yMm}mm, ${point.rotationDeg ?? 0}° 회전. ` +
                            '끌거나 화살표 키로 옮기고, 눌러서 또는 r 키로 돌린다'
                          : undefined
                      }
                      onKeyDown={
                        draggable
                          ? (event) => nudge(slot.id, point, event)
                          : undefined
                      }
                      {...(draggable ? markerHandlers(slot.id, point) : {})}
                    >
                      {/* 끄는 동안 잡은 마커를 도드라지게 — 겹쳐 선 마커 사이에서
                        무엇을 옮기고 있는지 보이게 한다. */}
                      {dragging && (
                        <circle
                          cx={point.xMm}
                          cy={point.yMm}
                          r={Math.max(variant.widthMm, variant.heightMm) * 0.72}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={0.6}
                          strokeDasharray="2 1.5"
                        />
                      )}
                      {artworkInner ? (
                        // 실제 마커 아트워크(원형·일러스트) — 기준점이 중심이므로
                        // 좌상단으로 옮겨 그린다(`docs/game-authoring.md`).
                        <g
                          transform={
                            `translate(${point.xMm}, ${point.yMm})` +
                            // 회전은 **뒤집기 앞**에 온다. 뒤에 두면 원정 마커가
                            // 반대 방향으로 돌아, 같은 각도를 줘도 두 팀이 서로
                            // 다르게 선다. 인쇄 렌더러도 같은 차례다(`compose.ts`).
                            (point.rotationDeg
                              ? ` rotate(${point.rotationDeg})`
                              : '') +
                            (mirrored ? ' scale(-1, 1)' : '') +
                            ` translate(${-variant.widthMm / 2}, ${-variant.heightMm / 2})`
                          }
                          dangerouslySetInnerHTML={{ __html: artworkInner }}
                        />
                      ) : (
                        // 아트워크를 아직 못 불러왔거나 없을 때의 대체 표시.
                        <>
                          <circle
                            cx={point.xMm}
                            cy={point.yMm}
                            r={radiusMm}
                            fill={fill}
                            stroke="#1a1a1a"
                            strokeWidth={0.4}
                          />
                          {isGoalkeeper && (
                            <circle
                              cx={point.xMm}
                              cy={point.yMm}
                              r={radiusMm * 0.6}
                              fill="none"
                              stroke="#1a1a1a"
                              strokeWidth={0.3}
                            />
                          )}
                        </>
                      )}
                      {/* 빈 값이면 글자를 얹지 않는다 — 인쇄 렌더러와 같은
                        규칙이다(`lib/print/compose.ts`). 축구 게임판의 등번호는
                        기본이 비어 있고, 아이가 종이에 직접 쓴다. */}
                      {String(value ?? '') !== '' && (
                        <text
                          x={point.xMm}
                          y={point.yMm}
                          fontSize={variant.valueFontSizeMm}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={markerValueColor(variant, fill)}
                        >
                          {String(value)}
                        </text>
                      )}
                    </g>
                  );
                }

                return null;
              }),
          )}
        </svg>
      </div>

      {interactive && (
        <div
          className="absolute bottom-2 right-2 flex flex-col overflow-hidden rounded-md border border-border bg-paper/95 shadow-sm"
          role="group"
          aria-label="미리보기 확대·축소"
          // 버튼 위에서 누른 것은 판 이동이 아니다.
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="확대"
            title="확대 (+)"
            disabled={!canZoomIn}
            onClick={zoomIn}
            className="size-8 text-base leading-none outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-40"
          >
            +
          </button>
          <button
            type="button"
            aria-label="축소"
            title="축소 (−)"
            disabled={!canZoomOut}
            onClick={zoomOut}
            className="size-8 border-t border-border text-base leading-none outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-40"
          >
            −
          </button>
          {zoomed && (
            <button
              type="button"
              aria-label="원래 크기"
              title="원래 크기 (0)"
              onClick={resetZoom}
              className="size-8 border-t border-border text-xs leading-none outline-none hover:bg-muted focus-visible:bg-muted"
            >
              ⤢
            </button>
          )}
        </div>
      )}
    </div>
  );
}

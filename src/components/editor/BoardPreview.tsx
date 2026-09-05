'use client';

import { useEffect, useState } from 'react';
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
  MARKER_FILL_LAYER_ID,
  readableTextColor,
} from '@/lib/customization/render';
import { extractSvgInner, paintLayer, stripOuterSvgSize } from './svgOverlay';
import { slotFieldId } from './SlotField';
import { useMarkerDrag } from './useMarkerDrag';

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

  useEffect(() => {
    if (!part.artwork) return;
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
  }, [part.artwork]);

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
  const { surfaceRef, draggingSlotId, markerHandlers } = useMarkerDrag({
    onMove: (slotId, point) => onMoveSlot?.(slotId, point),
    onTap: focusSlotField,
    partWidthMm: part.widthMm,
    partHeightMm: part.heightMm,
  });

  /** 화살표 키로 옮긴다. 드래그만 두면 키보드로는 배치를 바꿀 수 없다. */
  const nudge = (
    slotId: string,
    point: SlotPoint,
    event: React.KeyboardEvent<SVGGElement>,
  ) => {
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
      xMm: point.xMm + move[0],
      yMm: point.yMm + move[1],
    });
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/15"
      style={{ aspectRatio: `${part.widthMm} / ${part.heightMm}` }}
    >
      {paintedBackground ? (
        <div
          className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          // 도안 SVG는 우리 빌드 파이프라인이 만드는 정적 자산이다 — 사용자
          // 입력이 아니라 신뢰할 수 있는 마크업이다.
          dangerouslySetInnerHTML={{ __html: paintedBackground }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
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
                const radiusMm = Math.min(bounds.widthMm, bounds.heightMm) / 2;
                const fill = groupColorOf(game, customization, slot.groupId);
                const isGoalkeeper = slot.tags.includes('goalkeeper');
                const rawArtwork = variant.artwork
                  ? markerArtwork[variant.artwork]
                  : undefined;
                const artworkInner = rawArtwork
                  ? extractSvgInner(
                      paintLayer(rawArtwork, MARKER_FILL_LAYER_ID, fill),
                    )
                  : null;

                // 반대편으로 공격하는 팀은 마커를 뒤집는다 — 화살촉이 공격
                // 방향을 가리킨다. 인쇄물도 같은 규칙을 쓴다(`compose.ts`).
                const mirrored = markerMirrored(game, slot.groupId);

                const dragging = draggingSlotId === slot.id;

                return (
                  <g
                    key={key}
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
                        ? `${slot.label} 마커 — 가로 ${point.xMm}mm, 세로 ${point.yMm}mm. 끌거나 화살표 키로 옮긴다`
                        : undefined
                    }
                    onKeyDown={
                      draggable
                        ? (event) => nudge(slot.id, point, event)
                        : undefined
                    }
                    {...(draggable
                      ? markerHandlers(slot.id, point)
                      : { onClick: () => focusSlotField(slot.id) })}
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
                    <text
                      x={point.xMm}
                      y={point.yMm}
                      fontSize={variant.valueFontSizeMm}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={readableTextColor(fill)}
                    >
                      {String(value)}
                    </text>
                  </g>
                );
              }

              return null;
            }),
        )}
      </svg>
    </div>
  );
}

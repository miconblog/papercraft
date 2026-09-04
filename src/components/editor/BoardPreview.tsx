'use client';

import { useEffect, useState } from 'react';
import {
  resolveVariant,
  slotsOfPart,
  styleSetBounds,
  type GameCustomization,
  type GameDefinition,
  type Part,
} from '@/lib/schema';
import {
  extractSvgInner,
  paintLayer,
  readableTextColor,
  stripOuterSvgSize,
} from './svgOverlay';
import { slotFieldId } from './SlotField';

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
}

const textAnchorOf = { start: 'start', center: 'middle', end: 'end' } as const;

/**
 * 마커 아트워크가 팀 색을 받는 레이어 id. 파트 레벨 `pc-team-<그룹 id>`와
 * 달리 스키마 검증이 닿지 않는 관례다 — `IDE-010`(`player-markers.ts`)이
 * 정하고 "렌더러가 이 id로 채워 넣는다"고 문서에 남겨 둔 계약이다.
 */
const MARKER_FILL_LAYER_ID = 'pc-marker-fill';

/** 슬롯이 속한 그룹의 색 슬롯 값. 그룹이 없거나 색 슬롯이 없으면 중간 회색. */
function groupColorOf(
  game: GameDefinition,
  customization: GameCustomization,
  groupId: string | undefined,
): string {
  const group = game.groups.find((g) => g.id === groupId);
  const colorSlotId = group?.colorSlotId;
  const value = colorSlotId ? customization.values[colorSlotId] : undefined;
  return typeof value === 'string' ? value : '#9ca3af';
}

export function BoardPreview({ game, part, customization }: BoardPreviewProps) {
  const [background, setBackground] = useState<string | null>(null);
  // 마커 스타일 변형(원형·일러스트 등)의 아트워크 원문. 경로 → SVG 문자열.
  // 로드되기 전이거나 실패한 변형은 원 + 값 텍스트로 대체한다(아래 렌더링).
  const [markerArtwork, setMarkerArtwork] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    const urls = new Set<string>();
    for (const set of game.styleSets) {
      for (const variant of set.variants) {
        if (variant.artwork) urls.add(variant.artwork);
      }
    }
    if (urls.size === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        [...urls].map(async (url) => {
          try {
            const res = await fetch(url);
            return [url, await res.text()] as const;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setMarkerArtwork(
          Object.fromEntries(entries.filter((e) => e !== null)),
        );
      }
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
    const field = document.getElementById(slotFieldId(slotId));
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus();
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
                    className="cursor-pointer"
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

                return (
                  <g
                    key={key}
                    className="cursor-pointer"
                    onClick={() => focusSlotField(slot.id)}
                  >
                    {artworkInner ? (
                      // 실제 마커 아트워크(원형·일러스트) — 기준점이 중심이므로
                      // 좌상단으로 옮겨 그린다(`docs/game-authoring.md`).
                      <g
                        transform={`translate(${point.xMm - variant.widthMm / 2}, ${point.yMm - variant.heightMm / 2})`}
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

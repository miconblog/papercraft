/**
 * 도안 + 커스터마이즈 + 배율 → 시트 (IDE-007)
 *
 * 렌더러는 여기서 나온 페이지 목록만 받는다. 게임을 알 필요도, 배율을 다시
 * 계산할 필요도 없다.
 *
 * 좌표는 두 갈래다 — `items`는 **파트 로컬 mm**(배율 적용 전)이고 `marks`는
 * **용지 절대 mm**다. 배율과 타일 이동은 `transform` 하나가 맡는다.
 */
import {
  findRegion,
  resolveVariant,
  slotsOfPart,
  styleSetBounds,
  type GameCustomization,
  type GameDefinition,
  type Part,
  type Slot,
} from '@/lib/schema';
import {
  groupColorOf,
  markerMirrored,
  MARKER_FILL_LAYER_ID,
  paintOverrides,
  readableTextColor,
} from '@/lib/customization/render';
import { parseArtwork } from './artwork';
import { assemblyGuidePages } from './assembly';
import {
  INK,
  mirrorDrawsX,
  path,
  text,
  transformDraws,
  type Draw,
} from './draw';
import { scaleLabel } from './geometry';
import { circlePath } from './path';
import { tileMarks } from './sheetMarks';
import { planTiles, type TilePlan } from './tile';
import type { ExportOptions, PartSelection } from './options';

/** `public/games/…` 자산 경로를 SVG 원문으로 바꿔 주는 함수. */
export type LoadArtwork = (assetRef: string) => string;

export interface ExportPage {
  readonly widthMm: number;
  readonly heightMm: number;
  /** 도안을 잘라 내는 용지 위 사각형. `null`이면 자르지 않는다(안내 시트). */
  readonly clip: {
    readonly xMm: number;
    readonly yMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
  } | null;
  /** 파트 로컬 mm → 용지 mm. 배율과 타일 이동이 여기 다 들어 있다. */
  readonly transform: { scale: number; txMm: number; tyMm: number };
  readonly items: readonly Draw[];
  readonly marks: readonly Draw[];
}

export interface PartExportPlan {
  readonly part: Part;
  readonly scale: number;
  readonly copies: number;
  readonly plan: TilePlan;
}

export interface ExportDocument {
  readonly title: string;
  readonly pages: readonly ExportPage[];
  readonly parts: readonly PartExportPlan[];
}

export interface ComposeInput {
  readonly game: GameDefinition;
  readonly customization: GameCustomization;
  readonly options: ExportOptions;
  readonly loadArtwork: LoadArtwork;
}

const textAnchorOf = { start: 'start', center: 'middle', end: 'end' } as const;

/**
 * 파트 하나를 그리기 목록으로. 배경 도안 위에 커스터마이즈 값을 얹는다.
 *
 * 미리보기(`BoardPreview`)와 같은 규칙을 쓴다 — 팀 색 레이어, 마커 색,
 * 등번호 글자색이 전부 `src/lib/customization/render.ts`에서 온다.
 */
export function partDraws(
  game: GameDefinition,
  customization: GameCustomization,
  part: Part,
  loadArtwork: LoadArtwork,
): Draw[] {
  const items: Draw[] = [];

  if (part.artwork) {
    const artwork = parseArtwork(loadArtwork(part.artwork), {
      paint: paintOverrides(game, customization, part.id),
    });
    if (
      Math.abs(artwork.widthMm - part.widthMm) > 0.01 ||
      Math.abs(artwork.heightMm - part.heightMm) > 0.01
    ) {
      throw new Error(
        `도안 크기가 파트 선언과 다르다: ${part.id}는 ${part.widthMm}×${part.heightMm}mm인데 ` +
          `아트워크는 ${artwork.widthMm}×${artwork.heightMm}mm다`,
      );
    }
    items.push(...artwork.items);
  }

  for (const slot of slotsOfPart(game, part.id)) {
    for (const placement of slot.placements) {
      if (placement.partId !== part.id) continue;
      const value = customization.values[slot.id];
      if (value === undefined) continue;

      if (placement.mode === 'text') {
        items.push(
          text(
            String(value),
            placement.xMm,
            placement.yMm,
            placement.fontSizeMm,
            {
              anchor: textAnchorOf[placement.align],
              baseline: 'central',
              fill: INK,
              maxWidthMm: placement.maxWidthMm ?? null,
              rotationDeg: placement.rotationDeg,
            },
          ),
        );
      } else if (placement.mode === 'marker') {
        items.push(
          ...markerDraws(game, customization, slot, placement, loadArtwork),
        );
      }
    }
  }
  return items;
}

function markerDraws(
  game: GameDefinition,
  customization: GameCustomization,
  slot: Slot,
  placement: Extract<Slot['placements'][number], { mode: 'marker' }>,
  loadArtwork: LoadArtwork,
): Draw[] {
  const point = customization.positions[slot.id] ?? {
    xMm: placement.xMm,
    yMm: placement.yMm,
  };
  const styleSet = game.styleSets.find((s) => s.id === placement.styleSetId);
  if (!styleSet) return [];
  const variant = resolveVariant(game, styleSet.id, customization);
  const fill = groupColorOf(game, customization, slot.groupId);
  const items: Draw[] = [];

  if (variant.artwork) {
    const artwork = parseArtwork(loadArtwork(variant.artwork), {
      paint: { [MARKER_FILL_LAYER_ID]: { fill } },
    });
    // 반대편으로 공격하는 팀은 마커를 뒤집는다 — 화살촉이 공격 방향을 가리킨다.
    const shaped = markerMirrored(game, slot.groupId)
      ? mirrorDrawsX(artwork.items, variant.widthMm)
      : artwork.items;
    // 마커의 기준점은 **중심**이다(IDE-010). 좌상단으로 옮겨 놓는다.
    items.push(
      ...transformDraws(shaped, {
        scale: 1,
        rotationDeg: 0,
        txMm: point.xMm - variant.widthMm / 2,
        tyMm: point.yMm - variant.heightMm / 2,
      }),
    );
  } else {
    // 아트워크가 없는 도안을 위한 대체 표시 — 미리보기와 같은 모양이다.
    const bounds = styleSetBounds(styleSet);
    const radiusMm = Math.min(bounds.widthMm, bounds.heightMm) / 2;
    items.push(
      path(circlePath(point.xMm, point.yMm, radiusMm), {
        fill,
        stroke: INK,
        strokeMm: 0.4,
      }),
    );
    if (slot.tags.includes('goalkeeper')) {
      items.push(
        path(circlePath(point.xMm, point.yMm, radiusMm * 0.6), {
          fill: null,
          stroke: INK,
          strokeMm: 0.3,
        }),
      );
    }
  }

  items.push(
    text(
      String(customization.values[slot.id]),
      point.xMm,
      point.yMm,
      variant.valueFontSizeMm,
      {
        anchor: 'middle',
        baseline: 'central',
        fill: readableTextColor(fill),
        // 마커 밖으로 삐져나가지 않게. 두 자리 등번호가 원을 넘지 않는다.
        maxWidthMm: variant.widthMm * 0.8,
      },
    ),
  );
  return items;
}

/** 파트 선택 하나를 페이지 목록으로. 여러 벌이면 한 벌씩 이어 붙인다. */
function partPages(
  game: GameDefinition,
  part: Part,
  selection: PartSelection,
  options: ExportOptions,
  items: readonly Draw[],
): { plan: TilePlan; pages: ExportPage[] } {
  const plan = planTiles({
    partWidthMm: part.widthMm * selection.scale,
    partHeightMm: part.heightMm * selection.scale,
    marginMm: options.marginMm,
    overlapMm: options.overlapMm,
  });

  const pages: ExportPage[] = [];
  for (let copy = 1; copy <= selection.copies; copy++) {
    for (const tile of plan.tiles) {
      pages.push({
        widthMm: plan.pageWidthMm,
        heightMm: plan.pageHeightMm,
        clip: {
          xMm: tile.dstXMm,
          yMm: tile.dstYMm,
          widthMm: tile.srcWMm,
          heightMm: tile.srcHMm,
        },
        transform: {
          scale: selection.scale,
          txMm: tile.dstXMm - tile.srcXMm,
          tyMm: tile.dstYMm - tile.srcYMm,
        },
        items,
        marks: tileMarks({
          plan,
          tile,
          sheetLabel: `${game.title} · ${part.title}`,
          scaleLabel: scaleLabel(selection.scale),
          copy:
            selection.copies > 1
              ? { index: copy, total: selection.copies }
              : null,
        }),
      });
    }
  }
  return { plan, pages };
}

export function composeExport({
  game,
  customization,
  options,
  loadArtwork,
}: ComposeInput): ExportDocument {
  const parts: PartExportPlan[] = [];
  const pages: ExportPage[] = [];

  // 도안이 선언한 순서대로 낸다 — 보드가 먼저고 부속이 뒤다.
  const ordered = game.parts
    .map((part) => ({
      part,
      selection: options.parts.find((s) => s.partId === part.id),
    }))
    .filter(
      (entry): entry is { part: Part; selection: PartSelection } =>
        entry.selection !== undefined,
    );

  for (const { part, selection } of ordered) {
    const items = partDraws(game, customization, part, loadArtwork);
    const { plan, pages: partPageList } = partPages(
      game,
      part,
      selection,
      options,
      items,
    );
    parts.push({
      part,
      scale: selection.scale,
      copies: selection.copies,
      plan,
    });
    pages.push(...partPageList);
  }

  const guide = options.includeGuide
    ? assemblyGuidePages({ game, parts, options })
    : [];

  return {
    title: `${game.title} — ${parts.map((p) => p.part.title).join(' · ')}`,
    // 안내가 먼저다. 뒷장을 뽑기 전에 몇 장이 나오는지·어떻게 붙이는지 읽는다.
    pages: [...guide, ...pages],
    parts,
  };
}

/** 슬롯 좌표가 영역을 벗어났는지 — 내보내기 전에 마지막으로 본다. */
export const outOfRegionSlots = (
  game: GameDefinition,
  customization: GameCustomization,
): string[] =>
  game.slots
    .filter((slot) => {
      const marker = slot.placements.find((p) => p.mode === 'marker');
      if (!marker) return false;
      const part = game.parts.find((p) => p.id === marker.partId);
      const region = part ? findRegion(part, marker.regionId) : undefined;
      const point = customization.positions[slot.id];
      if (!region || !point) return false;
      return (
        point.xMm < region.rect.xMm ||
        point.yMm < region.rect.yMm ||
        point.xMm > region.rect.xMm + region.rect.widthMm ||
        point.yMm > region.rect.yMm + region.rect.heightMm
      );
    })
    .map((slot) => slot.id);

/**
 * 내보내기 요청 (IDE-007)
 *
 * 에디터에서 만든 값(`GameCustomization`)과 함께 서버로 넘어가는 것. 클라이언트가
 * 보내는 값이므로 서버에서 다시 검증한다 — 배율 하한은 도안이 정하고
 * (`part.minScale`, IDE-004), 그 아래는 글자가 읽히지 않아 막는다.
 */
import { z } from 'zod';
import type { GameDefinition, Part } from '@/lib/schema';
import {
  DEFAULT_OVERLAP_MM,
  DEFAULT_PRINTER_MARGIN_MM,
  MAX_PRINTER_MARGIN_MM,
  MIN_PRINTER_MARGIN_MM,
} from './geometry';
import { planTiles } from './tile';

/** 한 번에 만들 수 있는 최대 장수. 실수로 3000%를 넣어도 서버가 버티게. */
export const MAX_PAGES = 200;
/** 배율 상한. 이 위는 장수가 감당이 안 된다. */
export const MAX_SCALE = 20;
/** 한 파트를 몇 벌까지 반복해 뽑을 수 있는가. */
export const MAX_COPIES = 20;

export const partSelection = z.strictObject({
  partId: z.string(),
  /** 1 = 100%. */
  scale: z.number().positive().max(MAX_SCALE),
  /** 같은 파트를 몇 벌 반복해 넣을지. */
  copies: z.number().int().min(1).max(MAX_COPIES),
});
export type PartSelection = z.infer<typeof partSelection>;

export const exportOptions = z.strictObject({
  parts: z.array(partSelection).min(1),
  /** 프린터의 인쇄 불가 여백. 사용자가 탐침 시트로 재서 낮출 수 있다. */
  marginMm: z
    .number()
    .min(MIN_PRINTER_MARGIN_MM)
    .max(MAX_PRINTER_MARGIN_MM)
    .default(DEFAULT_PRINTER_MARGIN_MM),
  overlapMm: z.number().min(0).max(50).default(DEFAULT_OVERLAP_MM),
  /** 조립 안내 시트를 첫 장에 넣을지. */
  includeGuide: z.boolean().default(true),
});
export type ExportOptions = z.infer<typeof exportOptions>;

export interface OptionIssue {
  readonly partId: string | null;
  readonly message: string;
  /** `true`면 내보내기를 막는다. `false`면 알리되 진행한다. */
  readonly blocking: boolean;
}

/** 파트 하나의 기본 선택값. 도안이 정한 기본 배율·기본 벌 수를 그대로 쓴다. */
export const defaultSelection = (part: Part): PartSelection => ({
  partId: part.id,
  scale: part.defaultScale,
  copies: part.defaultCopies,
});

export const defaultExportOptions = (game: GameDefinition): ExportOptions => ({
  parts: game.parts.map(defaultSelection),
  marginMm: DEFAULT_PRINTER_MARGIN_MM,
  overlapMm: DEFAULT_OVERLAP_MM,
  includeGuide: true,
});

/**
 * 고른 값이 도안의 제약을 지키는지. 빈 배열이면 그대로 뽑아도 된다.
 *
 * 하한 아래는 **막는다** — 등번호가 2.5mm 밑으로 내려가면 인쇄물이 못 쓰게 된다
 * (IDE-004가 파트마다 잰 값이 `minScale`이다). 상한 위는 알리기만 한다. 크게
 * 뽑는 것 자체는 이 제품이 하려던 일이고, 대가는 장수뿐이다.
 */
export function validateExportOptions(
  game: GameDefinition,
  options: ExportOptions,
): OptionIssue[] {
  const issues: OptionIssue[] = [];
  const seen = new Set<string>();
  let pages = 0;

  for (const selection of options.parts) {
    const part = game.parts.find((p) => p.id === selection.partId);
    if (!part) {
      issues.push({
        partId: selection.partId,
        message: '도안에 없는 파트다',
        blocking: true,
      });
      continue;
    }
    if (seen.has(part.id)) {
      issues.push({
        partId: part.id,
        message: '같은 파트를 두 번 골랐다',
        blocking: true,
      });
    }
    seen.add(part.id);

    if (selection.scale < part.minScale) {
      issues.push({
        partId: part.id,
        message: `${part.title}은(는) 배율 ${pct(part.minScale)}보다 작게 뽑으면 글자가 읽히지 않는다`,
        blocking: true,
      });
      continue;
    }
    if (selection.scale > part.maxScale) {
      issues.push({
        partId: part.id,
        message: `${part.title}의 권장 상한은 배율 ${pct(part.maxScale)}다 — 더 키우면 장수가 크게 늘어난다`,
        blocking: false,
      });
    }

    try {
      pages +=
        planTiles({
          partWidthMm: part.widthMm * selection.scale,
          partHeightMm: part.heightMm * selection.scale,
          marginMm: options.marginMm,
          overlapMm: options.overlapMm,
        }).total * selection.copies;
    } catch (error) {
      issues.push({
        partId: part.id,
        message: error instanceof Error ? error.message : '타일 계산 실패',
        blocking: true,
      });
    }
  }

  if (pages > MAX_PAGES) {
    issues.push({
      partId: null,
      message: `한 번에 ${MAX_PAGES}장까지만 만든다 — 지금 설정은 ${pages}장이다`,
      blocking: true,
    });
  }
  return issues;
}

export const blockingIssues = (issues: readonly OptionIssue[]): OptionIssue[] =>
  issues.filter((i) => i.blocking);

const pct = (scale: number): string => `${Math.round(scale * 1000) / 10}%`;

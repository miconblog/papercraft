/**
 * 오림선 · 접는선 · 풀칠면 표시 규약 (IDE-003)
 *
 * 도안 SVG는 이 표시들을 **정해진 레이어 id** 안에 그린다. 렌더러(IDE-007)는
 * 레이어 id로 찾아 아래 스타일을 입히므로, 도안 쪽에서 선 굵기·파선을 직접
 * 정하지 않는다. 그래야 배율이 바뀌어도 표시가 같은 두께로 남는다.
 *
 * 굵기·파선 간격은 mm다. 배율을 적용해도 표시선은 굵기를 유지한다 —
 * 200%로 뽑았다고 오림선이 두 배로 굵어지면 자를 자리가 흐려진다.
 */
import { z } from 'zod';

export const markKind = z.enum(['cut', 'fold-mountain', 'fold-valley', 'glue']);
export type MarkKind = z.infer<typeof markKind>;

export interface MarkStyle {
  /** 도안 SVG에서 이 표시를 담는 레이어(그룹) id. */
  readonly layerId: string;
  readonly label: string;
  readonly strokeMm: number;
  /** SVG stroke-dasharray와 같은 뜻. 실선이면 null. */
  readonly dashMm: readonly number[] | null;
  readonly color: string;
  /** 사용자가 인쇄물에서 이 표시를 어떻게 읽어야 하는지. 조립 안내에 그대로 쓴다. */
  readonly instruction: string;
}

export const MARK_STYLES: Readonly<Record<MarkKind, MarkStyle>> = Object.freeze(
  {
    cut: {
      layerId: 'pc-cut',
      label: '오림선',
      strokeMm: 0.25,
      dashMm: null,
      color: '#000000',
      instruction: '실선을 따라 자른다.',
    },
    'fold-mountain': {
      layerId: 'pc-fold-mountain',
      label: '산접기',
      strokeMm: 0.2,
      dashMm: [4, 1.2, 0.6, 1.2],
      color: '#000000',
      instruction: '일점쇄선은 인쇄면이 바깥으로 오게 접는다.',
    },
    'fold-valley': {
      layerId: 'pc-fold-valley',
      label: '골접기',
      strokeMm: 0.2,
      dashMm: [3, 1.5],
      color: '#000000',
      instruction: '파선은 인쇄면이 안으로 오게 접는다.',
    },
    glue: {
      layerId: 'pc-glue',
      label: '풀칠면',
      strokeMm: 0.15,
      dashMm: [1, 1],
      color: '#000000',
      instruction: '빗금 친 면에 풀을 발라 맞은편에 붙인다.',
    },
  },
);

export const isFoldMark = (kind: MarkKind): boolean => kind.startsWith('fold-');

/** 슬롯 자리를 도안에서 비워 두는 레이어. 아트워크가 값을 직접 그려 넣지 않는다. */
export const SLOT_LAYER_ID = 'pc-slot';

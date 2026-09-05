/**
 * 렌더러가 받는 그리기 목록 (IDE-007)
 *
 * 도안 SVG도, 타일 표식도, 조립 안내도 전부 이 두 종류로 내려온다. 렌더러는
 * 여기 있는 것만 그릴 줄 알면 되고, 새 게임이 늘어도 렌더러는 그대로다.
 */
import type { MarkKind } from '@/lib/schema';
import {
  applyTransform,
  mirrorPathX,
  transformPath,
  type PathCommand,
  type Transform,
} from './path';

export type LineCap = 'butt' | 'round' | 'square';
export type TextAnchor = 'start' | 'middle' | 'end';
/** `alphabetic`은 y가 베이스라인, `central`은 y가 글자 상자의 세로 중심이다. */
export type TextBaseline = 'alphabetic' | 'central';

export interface PathDraw {
  readonly kind: 'path';
  readonly commands: readonly PathCommand[];
  /** `null`이면 칠하지 않는다 — SVG의 `fill="none"`. */
  readonly fill: string | null;
  readonly stroke: string | null;
  readonly strokeMm: number;
  readonly dashMm: readonly number[] | null;
  readonly lineCap: LineCap;
  /**
   * 배율을 먹지 않는 선. 오림선·접는선·풀칠면이 여기 해당한다 —
   * 200%로 뽑았다고 오림선이 0.5mm로 굵어지면 자를 자리가 흐려진다
   * (`docs/game-authoring.md` 표시 규약).
   */
  readonly fixedStroke: boolean;
  /** 이 도형이 속한 표시 종류. 조립 안내가 무엇을 설명할지 정할 때 쓴다. */
  readonly mark: MarkKind | null;
}

export interface TextDraw {
  readonly kind: 'text';
  readonly text: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly sizeMm: number;
  readonly anchor: TextAnchor;
  readonly baseline: TextBaseline;
  readonly bold: boolean;
  readonly fill: string;
  /** 넘치면 글자 크기를 줄여 맞춘다. `null`이면 제한하지 않는다. */
  readonly maxWidthMm: number | null;
  readonly rotationDeg: number;
}

export type Draw = PathDraw | TextDraw;

export const INK = '#1a1a1a';
export const BLACK = '#000000';

export const path = (
  commands: readonly PathCommand[],
  style: Partial<Omit<PathDraw, 'kind' | 'commands'>> = {},
): PathDraw => ({
  kind: 'path',
  commands,
  fill: null,
  stroke: BLACK,
  strokeMm: 0.2,
  dashMm: null,
  lineCap: 'butt',
  fixedStroke: false,
  mark: null,
  ...style,
});

export const text = (
  value: string,
  xMm: number,
  yMm: number,
  sizeMm: number,
  style: Partial<
    Omit<TextDraw, 'kind' | 'text' | 'xMm' | 'yMm' | 'sizeMm'>
  > = {},
): TextDraw => ({
  kind: 'text',
  text: value,
  xMm,
  yMm,
  sizeMm,
  anchor: 'start',
  baseline: 'central',
  bold: false,
  fill: INK,
  maxWidthMm: null,
  rotationDeg: 0,
  ...style,
});

/** 그리기 목록 전체를 옮긴다. 마커 아트워크를 슬롯 자리에 놓을 때 쓴다. */
export function transformDraws(items: readonly Draw[], t: Transform): Draw[] {
  return items.map((item) => {
    if (item.kind === 'path') {
      return {
        ...item,
        commands: transformPath(item.commands, t),
        // 표시선은 배율을 먹지 않는다 — 위 `fixedStroke` 설명 참고.
        strokeMm: item.fixedStroke ? item.strokeMm : item.strokeMm * t.scale,
      };
    }
    const [xMm, yMm] = applyTransform(t, item.xMm, item.yMm);
    return {
      ...item,
      xMm,
      yMm,
      sizeMm: item.sizeMm * t.scale,
      maxWidthMm: item.maxWidthMm === null ? null : item.maxWidthMm * t.scale,
      rotationDeg: item.rotationDeg + t.rotationDeg,
    };
  });
}

/**
 * 그리기 목록을 세로 중심선 기준으로 뒤집는다.
 *
 * 방향이 있는 마커 아트워크를 반대편 팀에 쓸 때 필요하다(`group.mirrorMarkers`).
 * 거울 반전은 닮음 변환이 아니라 `transformDraws`로는 안 된다 — 원호의 회전
 * 방향(`sweep`)이 뒤집히기 때문이다.
 *
 * **글자는 뒤집지 않는다.** 자리만 옮기고 정렬을 좌우로 바꾼다 — 뒤집힌 글자는
 * 읽을 수 없으니 반전의 뜻이 도형과 다르다.
 */
export function mirrorDrawsX(items: readonly Draw[], widthMm: number): Draw[] {
  const flip = (x: number) => widthMm - x;
  return items.map((item) => {
    if (item.kind === 'path') {
      return { ...item, commands: mirrorPathX(item.commands, widthMm) };
    }
    const anchor: TextAnchor =
      item.anchor === 'start'
        ? 'end'
        : item.anchor === 'end'
          ? 'start'
          : 'middle';
    return {
      ...item,
      xMm: flip(item.xMm),
      anchor,
      rotationDeg: -item.rotationDeg,
    };
  });
}

/**
 * 완성 그림 부속 — 다 이었을 때 나오는 실루엣 (IDE-019)
 *
 * **어른이 먼저 보는 종이다.** 사진에서 윤곽을 제대로 땄는지 뽑기 전에 확인
 * 하는 용도이고, 아이에게 먼저 보이면 놀이가 끝난다. 그래서 판에 얹지 않고
 * 따로 뽑는 파트로 뗐다.
 *
 * 판과 같은 가로세로비의 절반 크기라, 다 이은 판 위에 겹쳐 보면 같은 모양이
 * 나와야 한다.
 */
import {
  applyFit,
  fitTransform,
  toFlat,
  toPoints,
} from '../../../../lib/dot-to-dot/index.ts';
import {
  ANSWER,
  ANSWER_BOX,
  ANSWER_STROKE_MM,
  DETAIL_STROKE_MM,
  SAMPLE_DETAIL,
  SAMPLE_OUTLINE,
  TYPE,
} from '../dimensions.ts';
import { ANSWER_NOTE } from '../rules.ts';
import { outlinePath } from './board.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  markLayer,
  path,
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

export interface AnswerInput {
  /** 판 좌표(mm)의 윤곽. 이 부속의 상자로 다시 맞춰 넣는다. */
  readonly outline: readonly number[];
  /** 미리 그려 두는 세부 선 (IDE-021). 윤곽과 **같은 변환**으로 함께 옮긴다. */
  readonly detail?: ReadonlyArray<readonly number[]>;
}

export const renderAnswer = (input: AnswerInput): string => {
  // 값은 판(190×277) 좌표로 저장돼 있다. 부속은 크기가 다르므로 다시 맞춘다 —
  // 그냥 축소하면 판의 빈 여백까지 함께 줄어들어 실루엣이 종이 가운데를 벗어난다.
  //
  // 변환은 **윤곽이 정하고 세부가 그것을 따른다.** 세부를 따로 맞춰 넣으면
  // 눈이 종이를 가득 채운다.
  const fit = fitTransform(toPoints(input.outline), ANSWER_BOX);
  const move = (flat: readonly number[]): number[] =>
    toFlat(toPoints(flat).map((p) => applyFit(fit, p.x, p.y)));
  const fitted = move(input.outline);
  const detail = (input.detail ?? [])
    .filter((ring) => ring.length >= 6)
    .map(move);
  const inset = TYPE.cutInsetMm;

  return svgDocument({
    widthMm: ANSWER.widthMm,
    heightMm: ANSWER.heightMm,
    title: '완성 그림',
    children: [
      markLayer('cut', [
        rect(
          inset,
          inset,
          ANSWER.widthMm - inset * 2,
          ANSWER.heightMm - inset * 2,
        ),
      ]),
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        path(outlinePath(fitted), {
          fill: 'none',
          stroke: INK_COLOR,
          'stroke-width': ANSWER_STROKE_MM,
          'stroke-linejoin': 'round',
        }),
        ...detail.map((ring) =>
          path(outlinePath(ring), {
            fill: 'none',
            stroke: INK_COLOR,
            'stroke-width': DETAIL_STROKE_MM,
            'stroke-linejoin': 'round',
          }),
        ),
        text(
          ANSWER_NOTE,
          ANSWER.widthMm / 2,
          TYPE.answerNoteYMm,
          TYPE.answerNoteFontMm,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
      ]),
    ],
  });
};

/** `npm run artwork`가 쓰는 기본 부속 — 보기 그림의 실루엣이다. */
export const renderDefaultAnswer = (): string =>
  renderAnswer({ outline: SAMPLE_OUTLINE, detail: SAMPLE_DETAIL });

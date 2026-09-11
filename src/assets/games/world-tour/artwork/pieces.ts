/**
 * 조립물 파트 — 말과 주사위 (IDE-015)
 *
 * 말 여섯(`./tokens.ts`)과 종이 주사위 전개도(`./dice.ts`)를 A6 가로 한 장에
 * 담는다. 둘 다 두꺼운 종이에 뽑는 작은 부속인데 파트가 따로라 종이가 두 장
 * 나왔다(2026-09-11 사용자 요청으로 합쳤다).
 *
 * 표시 레이어는 id가 하나씩이라 두 조각의 오림선을 한 `pc-cut`에 모은다.
 * 주사위의 접는선·풀칠면이 있으니 파트는 조립물이다.
 */
import { PIECES_SHEET } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  group,
  markLayer,
  svgDocument,
  text,
} from '../../../shared/svg.ts';
import { renderDiceNet } from './dice.ts';
import { renderTokenDiscs } from './tokens.ts';

/** 제목 띠의 안내 두 줄. 테스트가 시트 폭 안에 드는지 본다. */
export const PIECES_NOTES = [
  '두꺼운 종이에 뽑는다. 말은 원을 따라 오린다 — 한 사람이 하나씩, 2–6명.',
  '주사위는 바깥 실선을 오리고 파선을 안으로 접어, 빗금 면에 풀을 발라 붙인다.',
] as const;

export const PIECES_NOTE_FONT_MM = 2.6;

export const renderPieces = (): string => {
  const dice = renderDiceNet();
  const tokens = renderTokenDiscs();
  const cx = PIECES_SHEET.widthMm / 2;

  return svgDocument({
    widthMm: PIECES_SHEET.widthMm,
    heightMm: PIECES_SHEET.heightMm,
    title: '세계일주 주사위놀이 · 말과 주사위',
    children: [
      markLayer('cut', [dice.cut, ...tokens.cuts]),
      markLayer('fold-valley', dice.folds),
      markLayer('glue', dice.glue),
      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('말과 주사위', cx, 7.5, 5, {
          'text-anchor': 'middle',
          'font-weight': 'bold',
        }),
        ...PIECES_NOTES.map((note, i) =>
          text(note, cx, 12.5 + i * 3.6, PIECES_NOTE_FONT_MM, {
            'text-anchor': 'middle',
            fill: RULE_COLOR,
          }),
        ),
        ...dice.pips,
        ...tokens.bodies,
      ]),
    ],
  });
};

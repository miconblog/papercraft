/**
 * 부속 — 공 (IDE-030 · IDE-032)
 *
 * 처음에는 깃대 두 벌이 함께 있는 한 장이었다. 사용자가 한 라운드 쳐 보고
 * 뺐다(2026-09-15) — "깃대는 필요 없을것 같아". 홀이 어디인지는 판에 그려진
 * 깃발 그림으로 충분했고, 세워 둔 종이 깃대는 공에 밀려 넘어지기만 했다.
 *
 * 그래서 이 시트는 **공만 담는다.** 접을 것이 없으니 조립물이 아니라 오림용
 * 부속이고, 깃대가 빠진 만큼 종이도 작아졌다(210×148 → 100×100).
 */
import { BALL_SHEET } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  markLayer,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const B = BALL_SHEET;

/** 공 원판의 중심들. 테스트가 판 안에 있는지 본다. */
export const ballCenters = (): { x: number; y: number }[] => {
  const step = B.ballRadiusMm * 2 + B.ballGapMm;
  const centers: { x: number; y: number }[] = [];
  for (let row = 0; row < B.ballRows; row++) {
    for (let col = 0; col < B.ballColumns; col++) {
      centers.push({
        x: B.ballOriginXMm + step * col,
        y: B.ballOriginYMm + step * row,
      });
    }
  }
  return centers;
};

export const renderBalls = (): string => {
  const balls = ballCenters();

  return svgDocument({
    widthMm: B.widthMm,
    heightMm: B.heightMm,
    title: '골프 게임판 · 공',
    children: [
      markLayer(
        'cut',
        balls.map((b) => circle(b.x, b.y, B.ballRadiusMm)),
      ),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('공', B.titleXMm, B.titleYMm, B.titleFontMm, {
          'text-anchor': 'start',
          'font-weight': 'bold',
        }),
        text(
          `두꺼운 종이에 뽑아 오려 쓴다. ${balls.length}개가 들어 있다.`,
          B.titleXMm,
          B.titleYMm + 6,
          B.noteFontMm,
          { fill: RULE_COLOR, 'text-anchor': 'start' },
        ),

        // 가운데 점 하나로 어디를 튕길지 본다.
        ...balls.flatMap((b) => [
          circle(b.x, b.y, B.ballRadiusMm - 1.2, {
            fill: 'none',
            stroke: RULE_COLOR,
            'stroke-width': 0.3,
          }),
          circle(b.x, b.y, 0.8, { fill: RULE_COLOR, stroke: 'none' }),
        ]),
      ]),

      '<g id="pc-slot" />',
    ],
  });
};

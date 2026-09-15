/**
 * 부속 — 깃대와 공 (IDE-030)
 *
 * 깃대는 **A자로 세우는 종이 텐트**다. 축구 골대(IDE-004)에서 배운 것을
 * 그대로 따랐다 — 풀도 칼도 쓰지 않고, 접는 선은 세 종류를 넘지 않는다.
 * 꼭대기 한 줄을 산접기로 접어 등을 맞추고, 양 끝 탭을 바깥으로 꺾어 바닥에
 * 눕히면 선다.
 *
 * **홀 뒤에 세운다.** 홀 안이나 앞에 세우면 공이 들어갈 길을 막는다. 깃대가
 * 하는 일은 멀리서 홀이 어디인지 보여 주는 것 하나뿐이다.
 *
 * 공은 지름 12mm 원판 여덟이다. 여덟인 것은 넷이 치고도 잃어버릴 몫이 남아야
 * 하기 때문이다.
 */
import { FLAG_SHEET } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  group,
  line,
  markLayer,
  path,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const F = FLAG_SHEET;

/** 텐트 한 벌의 y 경계. 가운데가 꼭대기이고 위아래로 한 면씩 펼쳐진다. */
const poleEdges = () => {
  const foldY = F.poleFoldYMm;
  return {
    foldY,
    topBase: foldY - F.poleHeightMm,
    bottomBase: foldY + F.poleHeightMm,
    topTabEdge: foldY - F.poleHeightMm - F.poleTabMm,
    bottomTabEdge: foldY + F.poleHeightMm + F.poleTabMm,
  };
};

/** 텐트 한 벌의 오림선 — 탭과 깃발 둘이 튀어나온 실루엣 하나다. */
function poleOutline(xMm: number): string {
  const { foldY, topTabEdge, bottomTabEdge } = poleEdges();
  const right = xMm + F.poleWidthMm;
  const tipX = right + F.flagWidthMm;
  const upperFlagTop = foldY - F.flagInsetMm - F.flagHeightMm;
  const upperFlagBottom = foldY - F.flagInsetMm;
  const lowerFlagTop = foldY + F.flagInsetMm;
  const lowerFlagBottom = foldY + F.flagInsetMm + F.flagHeightMm;

  return path(
    [
      `M${xMm} ${topTabEdge}`,
      `L${right} ${topTabEdge}`,
      `L${right} ${upperFlagTop}`,
      `L${tipX} ${(upperFlagTop + upperFlagBottom) / 2}`,
      `L${right} ${upperFlagBottom}`,
      `L${right} ${lowerFlagTop}`,
      `L${tipX} ${(lowerFlagTop + lowerFlagBottom) / 2}`,
      `L${right} ${lowerFlagBottom}`,
      `L${right} ${bottomTabEdge}`,
      `L${xMm} ${bottomTabEdge}`,
      'Z',
    ].join(' '),
  );
}

const poleFolds = (xMm: number) => {
  const { foldY, topBase, bottomBase } = poleEdges();
  return {
    mountain: [line(xMm, foldY, xMm + F.poleWidthMm, foldY)],
    valley: [
      line(xMm, topBase, xMm + F.poleWidthMm, topBase),
      line(xMm, bottomBase, xMm + F.poleWidthMm, bottomBase),
    ],
  };
};

/** 세운 뒤 밖에서 보이는 그림 — 깃발과 기둥. */
function poleArt(xMm: number): string[] {
  const { foldY, topBase, bottomBase } = poleEdges();
  const right = xMm + F.poleWidthMm;
  const tipX = right + F.flagWidthMm;
  // 기둥은 몸통 한가운데가 아니라 깃발 쪽 변 가까이 선다 — 가운데에 그으면
  // 기둥과 깃발이 떨어져 보여 깃대가 아니라 막대 옆의 삼각형이 된다.
  const pole = right - 2.5;

  // 채움은 오림선보다 조금 안쪽이다 — 같은 크기로 칠하면 검은 면이 오림선을
  // 덮어 어디를 자를지 보이지 않는다.
  const flag = (top: number) =>
    path(
      `M${right - 0.2} ${top + 0.7} L${tipX - 1.4} ${top + F.flagHeightMm / 2} L${right - 0.2} ${top + F.flagHeightMm - 0.7} Z`,
      { fill: INK_COLOR, stroke: 'none' },
    );

  return [
    flag(foldY - F.flagInsetMm - F.flagHeightMm),
    flag(foldY + F.flagInsetMm),
    // 기둥 — 두 면에 하나씩. 접어 세우면 양쪽에서 깃대가 보인다.
    line(pole, topBase + 3, pole, foldY - F.flagInsetMm - F.flagHeightMm, {
      stroke: INK_COLOR,
      'stroke-width': 0.6,
    }),
    line(pole, foldY + F.flagInsetMm + F.flagHeightMm, pole, bottomBase - 3, {
      stroke: INK_COLOR,
      'stroke-width': 0.6,
    }),
  ];
}

/**
 * 세운 모습 도해 — 글 대신 그림으로 (축구 골대 시트와 같은 선택).
 *
 * 접는 순서는 소개 페이지의 「깃대 세우기」 절에 있다. 시트에는 **다 접으면
 * 어떤 모양이 되는지**만 둔다 — 종이에 글을 채우면 오릴 자리가 준다.
 */
function standDiagram(): string[] {
  const apexX = 162;
  const apexY = 96;
  const footY = 128;
  const half = 13;
  const tab = 9;
  const flagH = 8;
  const flagW = 12;
  return [
    line(apexX, apexY, apexX - half, footY, {
      stroke: INK_COLOR,
      'stroke-width': 0.5,
    }),
    line(apexX, apexY, apexX + half, footY, {
      stroke: INK_COLOR,
      'stroke-width': 0.5,
    }),
    // 바깥으로 꺾어 눕힌 탭 둘. 이것이 바닥에 닿아 깃대가 선다.
    line(apexX - half, footY, apexX - half - tab, footY, {
      stroke: INK_COLOR,
      'stroke-width': 0.5,
    }),
    line(apexX + half, footY, apexX + half + tab, footY, {
      stroke: INK_COLOR,
      'stroke-width': 0.5,
    }),
    path(
      `M${apexX} ${apexY} L${apexX + flagW} ${apexY + flagH / 2} L${apexX} ${apexY + flagH} Z`,
      { fill: INK_COLOR, stroke: 'none' },
    ),
    // 바닥 — 책상이다.
    line(apexX - half - tab - 4, footY, apexX + half + tab + 4, footY, {
      stroke: RULE_COLOR,
      'stroke-width': 0.3,
      'stroke-dasharray': '2 1.5',
    }),
    text('다 접으면 이런 모양', apexX, footY + 6, F.noteFontMm, {
      fill: RULE_COLOR,
      'text-anchor': 'middle',
    }),
  ];
}

/** 공 원판의 중심들. 테스트가 판 안에 있는지 본다. */
export const ballCenters = (): { x: number; y: number }[] => {
  const step = F.ballRadiusMm * 2 + F.ballGapMm;
  const centers: { x: number; y: number }[] = [];
  for (let row = 0; row < F.ballRows; row++) {
    for (let col = 0; col < F.ballColumns; col++) {
      centers.push({
        x: F.ballOriginXMm + step * col,
        y: F.ballOriginYMm + step * row,
      });
    }
  }
  return centers;
};

export const renderFlagAndBall = (): string => {
  const balls = ballCenters();
  const folds = F.poleXsMm.map(poleFolds);

  return svgDocument({
    widthMm: F.widthMm,
    heightMm: F.heightMm,
    title: '골프 게임판 · 깃대와 공',
    children: [
      markLayer('cut', [
        ...F.poleXsMm.map(poleOutline),
        ...balls.map((b) => circle(b.x, b.y, F.ballRadiusMm)),
      ]),
      markLayer(
        'fold-mountain',
        folds.flatMap((f) => f.mountain),
      ),
      markLayer(
        'fold-valley',
        folds.flatMap((f) => f.valley),
      ),

      group({ id: ART_LAYER_ID, fill: INK_COLOR, stroke: 'none' }, [
        text('깃대와 공', F.titleXMm, F.titleYMm, F.titleFontMm, {
          'text-anchor': 'start',
          'font-weight': 'bold',
        }),
        text(
          '깃대는 꼭대기 한 줄을 산접기로 접고 양 끝 탭을 바깥으로 꺾어 세운다. 홀 뒤에 놓는다.',
          F.titleXMm,
          F.titleYMm + 6,
          F.noteFontMm,
          { fill: RULE_COLOR, 'text-anchor': 'start' },
        ),

        ...F.poleXsMm.flatMap(poleArt),
        ...standDiagram(),

        // 공 — 가운데 점 하나로 어디를 튕길지 본다. 두꺼운 종이에 뽑으면 더 잘
        // 미끄러진다. 넷이 쳐도 잃어버릴 몫이 남게 열둘을 넣었다.
        ...balls.flatMap((b) => [
          circle(b.x, b.y, F.ballRadiusMm - 1.2, {
            fill: 'none',
            stroke: RULE_COLOR,
            'stroke-width': 0.3,
          }),
          circle(b.x, b.y, 0.8, { fill: RULE_COLOR, stroke: 'none' }),
        ]),
        text(
          `공 ${balls.length}개`,
          F.ballOriginXMm +
            ((F.ballColumns - 1) * (F.ballRadiusMm * 2 + F.ballGapMm)) / 2,
          F.ballOriginYMm - F.ballRadiusMm - 5,
          3.2,
          { fill: RULE_COLOR, 'text-anchor': 'middle' },
        ),
      ]),

      '<g id="pc-slot" />',
    ],
  });
};

/**
 * 조립물 파트 — 종이 윷가락 넉 장 (IDE-018)
 *
 * 실제 윷은 통나무를 반으로 쪼갠 반원기둥이다. 종이로는 곡면을 감으면 눌리므로
 * **정육각형의 아래 절반**으로 근사한다 — 평평한 배 한 면과 등 세 면이고, 접는
 * 선이 전부 직선이라 자 없이 손톱으로 접힌다(2026-09-08 결정).
 *
 * 전개도 한 벌:
 *
 * ```
 *   ┌──────────────────────┐   ← 등1        ┐
 *   ├──────────────────────┤   ← 등2 · 마루 │ 관 바깥. 인쇄면이 밖으로 온다
 *   ├──────────────────────┤   ← 등3        │
 *  ╱├──────────────────────┤╲  ← 배         ┘   (양 끝에 마구리 2 + 탭 3)
 *  ╲├──────────────────────┤╱
 *   ├──────────────────────┤   ← 속대 1     ┐
 *   ├──────────────────────┤   ← 속대 1     │ 그대로 안으로 말려 들어간다
 *   └──────────────────────┘   ← 갈고리     ┘
 * ```
 *
 * **띠 일곱이 한 방향으로 감기는 나선이다.** 등1에서 배까지가 관 바깥이고, 배에서
 * 모서리를 한 번 더 돌면 종이가 안으로 들어가 속대가 된다. 접는 방향이 여섯 줄
 * 모두 같아 "전부 같은 쪽으로 만다" 한 줄로 설명이 끝난다 — 골대가 "전부 골접기"
 * 였던 것과 같은 이유로 고른 차례다.
 *
 * **속대는 강성만이 아니라 무게중심을 옮기는 장치다.** 종이 한 겹짜리 관은 가벼워
 * 튀고 쥐면 찌그러진다는 것이 이슈의 출발이었는데(골대 뚜껑을 두 겹으로 되돌린
 * 것과 같은 지적), 윷가락은 여기에 하나가 더 걸린다 — **겹을 배에 넣으면 무게중심이
 * 내려가 배를 깔고 눕기만 한다.** 그래서 속대를 등 쪽에 넣었다. 얼마나 옮겼는지는
 * `stickBalance()`가 세고 도안 테스트가 지킨다.
 *
 * **풀도 칼도 쓰지 않는다.** 잠금은 셋이다 —
 * `1번 속대`가 이음매(배–등1 모서리)를 안에서 가로질러 받치고 갈고리로 모서리
 * 하나를 더 넘어가 스스로 갇힌다. `2번 마구리`가 관 끝에서 단면을 붙들어 이음매가
 * 밀려나지 못하게 하고, 그 `3번 탭`이 속대 밑으로 들어가 마구리를 붙든다.
 * 하나를 당겨도 나머지가 잡으니 던져도 벌어지지 않는다.
 *
 * **홈이 없다.** 골대는 뚜껑 귀·모서리 탭·옆벽이 전개도에서 위아래로 맞닿아 홈을
 * 넷 파야 했는데, 여기 마구리는 배 띠의 끝에만 붙어 이웃 띠와 꼭짓점 하나로만
 * 만난다 — 접을 때 서로를 잡아당길 변이 아예 없다.
 */
import {
  BAEKDO_STICK_INDEX,
  STICK,
  STICK_CAP_HEIGHT_MM,
  STICK_COUNT,
  STICK_DIAGRAM,
  STICK_HEIGHT_MM,
  STICK_NET,
  STICK_ORIGIN,
  STICK_PANELS,
  STICK_FACE_NUMBERS,
  STICK_SHEET,
  stickFolds,
  stickNetOutline,
  stickNetTopMm,
  stickPanelTopMm,
} from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  RULE_COLOR,
  circle,
  estimateTextWidthMm,
  group,
  line,
  markLayer,
  num,
  path,
  rect,
  svgDocument,
  text,
} from '../../../shared/svg.ts';

const polygon = (points: ReadonlyArray<readonly [number, number]>): string =>
  `${points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
    .join(' ')} Z`;

const thin = { fill: 'none', stroke: RULE_COLOR, 'stroke-width': 0.3 };
const bold = { fill: 'none', stroke: INK_COLOR, 'stroke-width': 0.55 };

/** 띠 `id`의 세로 한가운데. 이름과 번호가 여기 앉는다. */
const bandCenterYMm = (topMm: number, id: string): number => {
  const panel = STICK_PANELS.find((p) => p.id === id)!;
  return topMm + stickPanelTopMm(id) + panel.widthMm / 2;
};

/**
 * 글자. 뒤에 흰 바탕을 깐다 — 등 면에는 나뭇결이 깔려 있어 그냥 얹으면 읽히지
 * 않는다(골대의 면 이름과 같은 수법).
 */
const label = (
  value: string,
  xMm: number,
  yMm: number,
  sizeMm: number,
  options: { readonly flip?: boolean; readonly ink?: string } = {},
): string[] => {
  const widthMm = estimateTextWidthMm(value, sizeMm);
  const transform = options.flip
    ? `rotate(180 ${num(xMm)} ${num(yMm)})`
    : undefined;
  return [
    rect(
      xMm - widthMm / 2 - 0.6,
      yMm - sizeMm * 0.72,
      widthMm + 1.2,
      sizeMm * 1.44,
      { fill: '#ffffff', stroke: 'none', ...(transform ? { transform } : {}) },
    ),
    text(value, xMm, yMm, sizeMm, {
      fill: options.ink ?? RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
      ...(transform ? { transform } : {}),
    }),
  ];
};

/**
 * 나뭇결 — 등 세 면에만 친다.
 *
 * 배는 민짜로 두고 등에만 결을 쳐서, **접기 전에도 접고 나서도** 어느 면이 배인지
 * 한눈에 갈린다(이슈의 "배·등 인쇄"). 쪼갠 통나무의 겉이 등이고 쪼갠 자리가
 * 배라는 실물의 대비를 그대로 옮긴 것이다.
 *
 * **끊어 그린다.** 한 줄로 이으면 자로 그은 괘선이 되어 접는선과 헷갈리고 종이가
 * 노트처럼 보인다. 결마다 끊기는 자리를 달리 두면 같은 잉크로 나뭇결이 된다.
 * 굵기는 0.15mm — 접는선(파선 0.2)보다 가늘어 섞이지 않는다.
 */
const grain = (originXMm: number, topMm: number): string[] => {
  const strokes: string[] = [];
  const lengthMm = STICK_NET.widthMm - STICK.grainInsetMm * 2;
  for (const panel of STICK_PANELS) {
    if (!panel.outer || panel.face === 'belly') continue;
    const bandTop = topMm + stickPanelTopMm(panel.id);
    for (let i = 0; i < STICK.grainLines; i += 1) {
      const yMm = bandTop + (panel.widthMm * (i + 1)) / (STICK.grainLines + 1);
      const leftMm = originXMm + STICK.grainInsetMm;
      // 결마다 다른 자리에서 한 번 끊는다. 끊긴 폭도 조금씩 다르다.
      const breakAt = leftMm + lengthMm * (0.32 + 0.16 * (i % 3));
      const gapMm = 5 + (i % 2) * 4;
      strokes.push(
        line(leftMm, yMm, breakAt, yMm),
        line(breakAt + gapMm, yMm, leftMm + lengthMm, yMm),
      );
    }
  }
  return strokes;
};

/**
 * 백도 표식 — 넷 중 한 가락의 **배 면**에만 들어간다.
 *
 * 백도는 "그 가락만 배로 나오고 나머지 셋이 등일 때"라, 표식은 **배가 위로 왔을
 * 때 보여야** 한다. 그래서 등이 아니라 배에 찍는다.
 *
 * 과녁(겹동그라미)으로 그린 것은 **어느 쪽으로 누워도 같은 모양**이기 때문이다.
 * 던진 가락은 좌우가 뒤집혀 떨어지므로 방향이 있는 그림은 절반은 거꾸로 읽힌다.
 * 글자는 그래서 양 끝에 하나씩, 한쪽을 180° 돌려 넣는다.
 *
 * 색을 쓰지 않는다 — 흑백으로 뽑아도 나머지 셋과 갈려야 한다는 것이 수용 기준이다
 * (`IDE-009`가 축구 팀 색에서 확인한 것과 같은 규약).
 */
const baekdoMark = (originXMm: number, topMm: number): string[] => {
  const cxMm = originXMm + STICK_NET.widthMm / 2;
  const cyMm = bandCenterYMm(topMm, 'belly');
  return [
    circle(cxMm, cyMm, 5, {
      fill: 'none',
      stroke: INK_COLOR,
      'stroke-width': 0.9,
    }),
    circle(cxMm, cyMm, 2.4, { fill: INK_COLOR, stroke: 'none' }),
    ...label('백도', cxMm - 22, cyMm, 3.4, { ink: INK_COLOR }),
    ...label('백도', cxMm + 22, cyMm, 3.4, { ink: INK_COLOR, flip: true }),
  ];
};

/** 면 이름과 번호. 맞물리는 셋은 이름이 아니라 번호로 부른다(골대와 같은 약속). */
const faceLabels = (originXMm: number, topMm: number): string[] => {
  const x0 = originXMm;
  const midXMm = x0 + STICK_NET.widthMm / 2;
  const numberAt = (value: string, xMm: number, yMm: number) =>
    label(value, xMm, yMm, STICK.numberFontMm, { ink: INK_COLOR });

  const cyMm = bandCenterYMm(topMm, 'belly');
  return [
    ...label('등', x0 + 20, bandCenterYMm(topMm, 'back-1'), STICK.labelFontMm),
    ...label(
      '등 · 마루',
      midXMm,
      bandCenterYMm(topMm, 'back-2'),
      STICK.labelFontMm,
    ),
    ...label('등', x0 + 20, bandCenterYMm(topMm, 'back-3'), STICK.labelFontMm),
    // 배는 양 끝에 하나씩, 한쪽을 돌려 둔다 — 던진 가락은 좌우가 뒤집혀 떨어진다.
    ...label('배', x0 + 18, cyMm, STICK.labelFontMm),
    ...label('배', x0 + STICK_NET.widthMm - 18, cyMm, STICK.labelFontMm, {
      flip: true,
    }),

    ...numberAt(
      STICK_FACE_NUMBERS.liner,
      x0 + 9,
      bandCenterYMm(topMm, 'liner-1'),
    ),
    ...label(
      '속대 — 안으로 말려 들어가 등 두 면에 포개진다',
      midXMm,
      bandCenterYMm(topMm, 'liner-1'),
      STICK.labelFontMm,
    ),
    ...numberAt(
      STICK_FACE_NUMBERS.liner,
      x0 + 9,
      bandCenterYMm(topMm, 'liner-2'),
    ),
    ...label(
      '속대',
      midXMm,
      bandCenterYMm(topMm, 'liner-2'),
      STICK.labelFontMm,
    ),
    ...label(
      `${STICK_FACE_NUMBERS.liner} 갈고리 — 모서리 하나를 더 넘겨 문다`,
      midXMm,
      bandCenterYMm(topMm, 'liner-hook'),
      2.2,
    ),

    // 마구리와 탭은 배 띠 밖으로 뻗은 자리에 있다.
    ...numberAt(STICK_FACE_NUMBERS.cap, x0 - STICK_CAP_HEIGHT_MM / 2, cyMm),
    ...numberAt(
      STICK_FACE_NUMBERS.cap,
      x0 + STICK_NET.widthMm + STICK_CAP_HEIGHT_MM / 2,
      cyMm,
    ),
    ...numberAt(
      STICK_FACE_NUMBERS.tab,
      x0 - STICK_CAP_HEIGHT_MM - STICK.capTabMm / 2,
      cyMm,
    ),
    ...numberAt(
      STICK_FACE_NUMBERS.tab,
      x0 + STICK_NET.widthMm + STICK_CAP_HEIGHT_MM + STICK.capTabMm / 2,
      cyMm,
    ),
  ];
};

/**
 * 단면 그림 — 도해가 쓰는 사다리꼴. `baseYMm`이 바닥 선이다.
 *
 * `bellyUp`이면 배가 위다(마루로 누운 가락). `scale`은 mm당 배율 — 실제 단면이
 * 16×6.9mm뿐이라 그대로 그리면 도해에서 아무것도 안 보인다.
 */
const sectionPath = (
  cxMm: number,
  baseYMm: number,
  scale: number,
  bellyUp: boolean,
): string => {
  const halfBelly = (STICK.bellyMm / 2) * scale;
  const halfCrest = (STICK.backFaceMm / 2) * scale;
  const hMm = STICK_HEIGHT_MM * scale;
  return bellyUp
    ? polygon([
        [cxMm - halfBelly, baseYMm - hMm],
        [cxMm + halfBelly, baseYMm - hMm],
        [cxMm + halfCrest, baseYMm],
        [cxMm - halfCrest, baseYMm],
      ])
    : polygon([
        [cxMm - halfBelly, baseYMm],
        [cxMm + halfBelly, baseYMm],
        [cxMm + halfCrest, baseYMm - hMm],
        [cxMm - halfCrest, baseYMm - hMm],
      ]);
};

/**
 * 조립 도해 넉 장 — 전개도 오른쪽 단에 세로로 붙는다.
 *
 * 글로만 적힌 "속대를 말아 넣는다"는 어느 것이 어디로 들어가는지 알려 주지 않는다.
 * 단면 한 컷이면 그게 끝난다 — 골대가 잠금을 그림으로 설명한 것과 같은 판단이다.
 *
 * 컷마다 배율이 다르다. 실제 단면이 16×6.9mm뿐이라 도해에서는 키워야 보이고,
 * 키우는 정도는 그 컷이 무엇을 보이려는가에 따라 다르다.
 */
const assemblyDiagrams = (): string[] => {
  const cxMm = STICK_DIAGRAM.leftMm + STICK_DIAGRAM.widthMm / 2;
  const topOf = (i: number) =>
    STICK_DIAGRAM.topMm + i * (STICK_DIAGRAM.heightMm + STICK_DIAGRAM.gapMm);
  const caption = (value: string, i: number) =>
    text(value, cxMm, topOf(i) + STICK_DIAGRAM.heightMm - 2, 2.6, {
      fill: INK_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
    });
  const note = (value: string, xMm: number, yMm: number, sizeMm = 2.2) =>
    text(value, xMm, yMm, sizeMm, {
      fill: RULE_COLOR,
      stroke: 'none',
      'text-anchor': 'middle',
    });

  // ① 단면 — 다 접으면 무엇이 되는가. 치수를 시트에서 여기 한 번만 적는다.
  const s1 = 2.2;
  const base1 = topOf(0) + 34;
  const one = [
    path(sectionPath(cxMm, base1, s1, false), bold),
    path(
      `M ${num(cxMm - (STICK.bellyMm / 2) * s1)} ${num(base1 + 3.5)} H ${num(cxMm + (STICK.bellyMm / 2) * s1)}`,
      thin,
    ),
    note(
      `등 ${num(STICK.backFaceMm)}씩`,
      cxMm,
      base1 - STICK_HEIGHT_MM * s1 - 3,
    ),
    note(`배 ${num(STICK.bellyMm)}`, cxMm, base1 + 6.5),
    note(
      `높이 ${STICK_HEIGHT_MM.toFixed(1)} · 길이 ${num(STICK.lengthMm)}`,
      cxMm,
      base1 + 10.5,
    ),
    caption('① 다 접으면 이 단면이 된다', 0),
  ];

  // ② 감는 차례 — 종이가 배를 지나 그대로 안으로 들어간다는 것이 요점이다.
  //    속대는 단면 안쪽에 바짝 붙는 선으로 그리고, 갈고리만 왼쪽 빗면으로 내린다.
  const s2 = 1.9;
  const base2 = topOf(1) + 32;
  const halfBelly2 = (STICK.bellyMm / 2) * s2;
  const halfCrest2 = (STICK.backFaceMm / 2) * s2;
  const h2 = STICK_HEIGHT_MM * s2;
  const insetMm = 1.2;
  const two = [
    path(sectionPath(cxMm, base2, s2, false), bold),
    // 속대 — 이음매(배–등1 모서리)에서 시작해 등1·마루 안쪽을 지나 등3 모서리를
    // 넘는다. 넘어간 끝이 갈고리다.
    path(
      [
        `M ${num(cxMm + halfBelly2 - 2.2)} ${num(base2 - 0.9)}`,
        `L ${num(cxMm + halfCrest2 - 0.7)} ${num(base2 - h2 + insetMm)}`,
        `L ${num(cxMm - halfCrest2 + 0.7)} ${num(base2 - h2 + insetMm)}`,
        `L ${num(cxMm - halfCrest2 - (halfBelly2 - halfCrest2) * 0.3)} ${num(base2 - h2 * 0.7 + insetMm)}`,
      ].join(' '),
      { ...bold, 'stroke-width': 0.45 },
    ),
    // 이음매 — 등1의 자유변이 여기서 맞대어지고 속대가 그 밑을 가로지른다.
    circle(cxMm + halfBelly2, base2, 1.3, thin),
    path(
      `M ${num(cxMm + halfBelly2 - 1.4)} ${num(base2 + 1.6)} L ${num(cxMm + 7)} ${num(base2 + 3.4)}`,
      thin,
    ),
    note('이음매', cxMm + 8.5, base2 + 5.4),
    note(STICK_FACE_NUMBERS.liner, cxMm, base2 - h2 + 4.4, 2.6),
    // 갈고리는 왼쪽 빗면 위에 있어 글자를 옆에 두면 선에 겹친다 — 배 밑으로
    // 내리고 지시선을 건다. 이음매와 좌우 대칭이 되어 읽는 차례도 분명해진다.
    path(
      `M ${num(cxMm - 9)} ${num(base2 + 3.4)} L ${num(cxMm - halfCrest2 - (halfBelly2 - halfCrest2) * 0.3)} ${num(base2 - h2 * 0.7 + insetMm + 0.8)}`,
      thin,
    ),
    note('갈고리', cxMm - 9, base2 + 5.4),
    caption('② 같은 쪽으로 말면 속대가 안으로', 1),
  ];

  /**
   * ③ 마구리 — **옆에서 자른** 그림이다. 탭이 속대 *밑으로* 들어간다는 것이
   * 요점이라 끝에서 본 그림으로는 전달되지 않는다.
   *
   * 종이 두께는 실제 치수로 그릴 수 없다(0.2mm대라 선 굵기에 묻힌다). 마구리와
   * 마루 사이 틈을 눈에 보이게 벌려 그린 도해다 — 실제 틈은 `capClearanceMm`다.
   */
  const base3 = topOf(2) + 34;
  const bodyMm = 34;
  const leftMm = cxMm - bodyMm / 2;
  const wallMm = 22;
  const linerGapMm = 3.4;
  const three = [
    path(`M ${num(leftMm)} ${num(base3)} H ${num(leftMm + bodyMm)}`, bold),
    path(
      `M ${num(leftMm)} ${num(base3 - wallMm)} H ${num(leftMm + bodyMm)}`,
      bold,
    ),
    // 속대 — 마루 바로 밑에 깔려 있다.
    path(
      `M ${num(leftMm + 1)} ${num(base3 - wallMm + linerGapMm)} H ${num(leftMm + bodyMm)}`,
      { ...thin, stroke: INK_COLOR, 'stroke-width': 0.45 },
    ),
    // 마구리 — 배 끝에서 세운다. 마루에 닿기 조금 전에서 멈춘다.
    path(
      `M ${num(leftMm)} ${num(base3)} V ${num(base3 - wallMm + linerGapMm * 2)}`,
      bold,
    ),
    // 탭 — 마구리 위에서 꺾여 속대 **밑으로** 들어간다.
    path(
      `M ${num(leftMm)} ${num(base3 - wallMm + linerGapMm * 2)} H ${num(leftMm + 10)}`,
      bold,
    ),
    path(
      `M ${num(leftMm + 12)} ${num(base3 - wallMm + linerGapMm * 2)} H ${num(leftMm + 20)}`,
      thin,
    ),
    path(
      `M ${num(leftMm + 18)} ${num(base3 - wallMm + linerGapMm * 2 - 1.1)} L ${num(leftMm + 20.4)} ${num(base3 - wallMm + linerGapMm * 2)} L ${num(leftMm + 18)} ${num(base3 - wallMm + linerGapMm * 2 + 1.1)}`,
      thin,
    ),
    note('마루', leftMm + bodyMm - 5, base3 - wallMm - 2.4),
    note(
      STICK_FACE_NUMBERS.liner,
      leftMm + bodyMm - 5,
      base3 - wallMm + 6.4,
      2.6,
    ),
    note(STICK_FACE_NUMBERS.cap, leftMm - 2.8, base3 - wallMm / 2, 2.6),
    note(
      STICK_FACE_NUMBERS.tab,
      leftMm + 5,
      base3 - wallMm + linerGapMm * 2 + 3,
      2.6,
    ),
    note('배', leftMm + bodyMm - 5, base3 - 2.6),
    caption('③ 마구리를 세우고 탭을 속대 밑으로', 2),
  ];

  // ④ 읽는 법 — 배가 위인 가락과 등이 위인 가락. 눈은 배가 몇이냐로만 갈린다.
  const s4 = 1.3;
  const base4 = topOf(3) + 30;
  const spreadMm = 12.5;
  const four = [
    path(sectionPath(cxMm - spreadMm, base4, s4, true), bold),
    path(sectionPath(cxMm + spreadMm, base4, s4, false), bold),
    // 등이 위인 쪽에만 결이 보인다 — 시트의 인쇄와 같은 대비다.
    ...[0, 1].map((i) =>
      path(
        `M ${num(cxMm + spreadMm - 2.6)} ${num(base4 - STICK_HEIGHT_MM * s4 + 1.2 + i * 1.6)} H ${num(cxMm + spreadMm + 2.6)}`,
        { ...thin, 'stroke-width': 0.2 },
      ),
    ),
    note('배', cxMm - spreadMm, base4 + 4),
    note('등', cxMm + spreadMm, base4 + 4),
    note('배가 몇이냐로 도·개·걸·윷·모', cxMm, base4 + 9),
    note('넉 장 가운데 하나만 배에 백도 과녁', cxMm, base4 + 13),
    caption('④ 배가 위면 배 · 등이 위면 등', 3),
  ];

  return [...one, ...two, ...three, ...four];
};

export const renderSticks = (): string => {
  const cuts: string[] = [];
  const mountains: string[] = [];
  const valleys: string[] = [];
  const grains: string[] = [];
  const art: string[] = [];

  for (let index = 0; index < STICK_COUNT; index += 1) {
    const topMm = stickNetTopMm(index);
    cuts.push(path(polygon(stickNetOutline(STICK_ORIGIN.xMm, topMm))));
    for (const fold of stickFolds(STICK_ORIGIN.xMm, topMm)) {
      const drawn = line(
        fold.fromMm[0],
        fold.fromMm[1],
        fold.toMm[0],
        fold.toMm[1],
      );
      (fold.kind === 'fold-mountain' ? mountains : valleys).push(drawn);
    }
    grains.push(...grain(STICK_ORIGIN.xMm, topMm));
    art.push(
      ...faceLabels(STICK_ORIGIN.xMm, topMm),
      ...(index === BAEKDO_STICK_INDEX
        ? baekdoMark(STICK_ORIGIN.xMm, topMm)
        : []),
    );
  }

  const centerXMm = STICK_SHEET.widthMm / 2;

  return svgDocument({
    widthMm: STICK_SHEET.widthMm,
    heightMm: STICK_SHEET.heightMm,
    title: '윷놀이 · 윷가락 전개도',
    children: [
      markLayer('cut', cuts),
      markLayer('fold-mountain', mountains),
      // 골접기는 탭 밑동 둘뿐이다. 방향이 반대인 유일한 선이라 층을 따로 두어야
      // 렌더러가 다른 표시선을 입힌다.
      markLayer('fold-valley', valleys),

      group({ id: ART_LAYER_ID, fill: 'none', stroke: 'none' }, [
        text('윷가락 전개도 · 4개', centerXMm, 9, 5, {
          'text-anchor': 'middle',
          'font-weight': 700,
          fill: INK_COLOR,
        }),
        text(
          `단면 배 ${num(STICK.bellyMm)} · 등 ${num(STICK.backFaceMm)}mm씩 · 길이 ${num(STICK.lengthMm)}mm — 풀도 칼도 쓰지 않는다`,
          centerXMm,
          14.5,
          2.6,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
        // 번호와 이름의 대응. 전개도에는 숫자만 적혀 있으므로(골대와 같은 약속)
        // 이 한 줄이 없으면 조립 순서 글의 "1번 속대"를 시트에서 찾을 수 없다.
        text(
          `숫자는 무는 차례 — ${STICK_FACE_NUMBERS.liner} 속대 · ${STICK_FACE_NUMBERS.cap} 마구리 · ${STICK_FACE_NUMBERS.tab} 탭 · 일점쇄선은 산접기, 파선(탭 밑동 둘)만 골접기`,
          centerXMm,
          19,
          2.6,
          { 'text-anchor': 'middle', fill: RULE_COLOR },
        ),
        group(
          { stroke: RULE_COLOR, 'stroke-width': 0.15, fill: 'none' },
          grains,
        ),
        ...art,
        ...assemblyDiagrams(),
      ]),
    ],
  });
};

/**
 * 선수 마커 아트워크 — 원형 · 일러스트 두 벌, 각각 필드 선수·골키퍼용 (IDE-010)
 *
 * 마커 하나 = 스타일 세트(`player-marker` · `goalkeeper-marker`) × 변형(`circle` ·
 * `illustration`) 조합이다. 네 파일 다 기준점이 **마커 중심**이고, 원형은
 * `PLAYER_MARKER.circle`, 일러스트는 `PLAYER_MARKER.illustration` 크기를 쓴다 —
 * 두 세트가 크기를 공유해야 필드 선수 ↔ 골키퍼 슬롯을 바꿔도 겹침 판정과 프리셋
 * 좌표가 그대로 통한다.
 *
 * ## 흑백에서 팀과 골키퍼를 구분하는 법
 *
 * 사용자가 고르는 팀 색은 자유 입력이라(`hexColor`), 두 팀이 명도가 비슷한 색을
 * 고르면 흑백에서 구분되지 않는다. 그래서 색에 기대지 않는 두 표식을 아트워크
 * 자체에 박아 둔다:
 *
 * - **팀** — 마커 오른쪽에 화살촉(공격 방향 표시)을 붙인다. 홈은 그대로,
 *   원정은 세로 중심선 기준으로 **좌우 반전**해 쓴다 — 대형 좌표를
 *   `mirrorPositions`로 뒤집는 것과 같은 이치다(`docs/soccer-artwork.md` 참고).
 *   반전은 렌더러(`IDE-006`·`IDE-007`)가 원정 마커에 `scale(-1, 1)`을 걸어
 *   한다 — 이 파일은 파일을 두 벌 만들지 않고 **비대칭 도형 하나**만 낸다.
 * - **골키퍼** — 안쪽에 테를 하나 더 둘러(과녁 모양) 필드 선수와 다른 실루엣을
 *   만든다. 팀 화살촉은 골키퍼도 똑같이 붙는다 — 골키퍼도 팀 구분은 필요하다.
 *
 * 등번호는 여기서 그리지 않는다. 슬롯 값이라 렌더러가 `valueFontSizeMm` 크기로
 * 얹는다(`docs/game-authoring.md` — "아트워크가 값을 직접 그려 넣지 않는다").
 *
 * 팀 색을 받을 레이어 id는 `pc-marker-fill`이다. `pc-team-<그룹 id>`(보드·점수
 * 기록칸이 쓰는 파트 레벨 규약)와 달리 이 레이어는 **파트가 아니라 마커
 * 아트워크에 있어** 아직 검증기가 닿지 않는다 — 렌더러를 만들 때(`IDE-006`)
 * 이 id로 채워 넣는다.
 */
import { PLAYER_MARKER } from '../dimensions.ts';
import {
  ART_LAYER_ID,
  INK_COLOR,
  circle,
  group,
  num,
  path,
  svgDocument,
} from './svg.ts';

/** 팀 색을 받을 레이어. 지금은 사람 눈에 구분되는 중간 회색을 기본값으로 둔다. */
const MARKER_FILL_LAYER_ID = 'pc-marker-fill';
const MARKER_FILL_PLACEHOLDER = '#9ca3af';

const CIRCLE = PLAYER_MARKER.circle;
const ILLUSTRATION = PLAYER_MARKER.illustration;

const point = (
  cxMm: number,
  cyMm: number,
  rMm: number,
  angleDeg: number,
): readonly [number, number] => {
  const rad = (angleDeg * Math.PI) / 180;
  return [cxMm + rMm * Math.cos(rad), cyMm + rMm * Math.sin(rad)];
};

/**
 * 공격 방향 화살촉의 세 꼭짓점 — 밑변 둘은 원 위, 꼭지점은 그보다 살짝
 * 바깥이다. 마커 폭 안(12mm)에 들어가도록 반지름을 눌러 잡았다.
 *
 * 테스트가 이 좌표로 "화살촉이 세로 중심선 기준 비대칭인가"를 확인한다 —
 * 대칭이면 좌우 반전해도 원정 마커가 홈과 똑같이 보여 팀이 구분되지 않는다.
 */
export const attackWedgePoints = (
  cxMm: number,
  cyMm: number,
  circleRadiusMm: number,
): ReadonlyArray<readonly [number, number]> => [
  point(cxMm, cyMm, circleRadiusMm, -22),
  point(cxMm, cyMm, circleRadiusMm + 1.1, 0),
  point(cxMm, cyMm, circleRadiusMm, 22),
];

const wedgePath = (
  cxMm: number,
  cyMm: number,
  circleRadiusMm: number,
): string => {
  const [a, b, c] = attackWedgePoints(cxMm, cyMm, circleRadiusMm);
  return path(
    `M ${num(a[0])} ${num(a[1])} L ${num(b[0])} ${num(b[1])} L ${num(c[0])} ${num(c[1])} Z`,
    { fill: INK_COLOR, stroke: 'none' },
  );
};

/** 원형 변형 하나를 짓는다. `ringRadiusMm`이 있으면 안쪽에 테를 더해 골키퍼로 만든다. */
const renderCircleVariant = (title: string, ringRadiusMm?: number): string => {
  const cxMm = CIRCLE.widthMm / 2;
  const cyMm = CIRCLE.heightMm / 2;
  const radiusMm = 4.6;

  return svgDocument({
    widthMm: CIRCLE.widthMm,
    heightMm: CIRCLE.heightMm,
    title,
    children: [
      group({ id: ART_LAYER_ID }, [
        group({ id: MARKER_FILL_LAYER_ID, fill: MARKER_FILL_PLACEHOLDER }, [
          circle(cxMm, cyMm, radiusMm, {
            stroke: INK_COLOR,
            'stroke-width': 0.4,
          }),
        ]),
        ...(ringRadiusMm
          ? [
              circle(cxMm, cyMm, ringRadiusMm, {
                fill: 'none',
                stroke: INK_COLOR,
                'stroke-width': 0.4,
              }),
            ]
          : []),
        wedgePath(cxMm, cyMm, radiusMm),
      ]),
    ],
  });
};

export const renderPlayerMarkerCircle = (): string =>
  renderCircleVariant('축구 게임판 · 선수 마커 · 원형');

export const renderGoalkeeperMarkerCircle = (): string =>
  renderCircleVariant('축구 게임판 · 골키퍼 마커 · 원형', 2.6);

/**
 * 일러스트 변형의 몸통·머리 좌표. 옛 인쇄본을 참고하지 않고 새로 그린, 달리는
 * 자세의 단순 픽토그램이다(`docs/soccer-artwork.md` 9절) — 다리·팔이 한쪽으로
 * 쏠려 있어 그 자체로 비대칭이고, 화살촉과 같은 방향(오른쪽)을 본다.
 */
const illustrationFigure = (glovesMm: boolean): string[] => {
  const cxMm = ILLUSTRATION.widthMm / 2;
  const headCyMm = 3.4;
  const headRMm = 1.7;

  const shapes: string[] = [
    // 머리
    circle(cxMm, headCyMm, headRMm, { stroke: 'none' }),
    // 몸통 — 어깨가 넓고 허리가 좁은 사다리꼴, 살짝 앞으로 기운 실루엣.
    path(
      `M ${num(cxMm - 2.3)} ${num(5.2)} L ${num(cxMm + 2.6)} ${num(5.6)} ` +
        `L ${num(cxMm + 1.7)} ${num(10.5)} L ${num(cxMm - 1.6)} ${num(10.2)} Z`,
      { stroke: 'none' },
    ),
    // 앞으로 뻗은 팔 — 진행 방향(오른쪽)으로 든다.
    path(
      `M ${num(cxMm + 1.9)} ${num(6)} L ${num(cxMm + 4.3)} ${num(7.2)} ` +
        `L ${num(cxMm + 3.7)} ${num(8.1)} L ${num(cxMm + 1.6)} ${num(7.1)} Z`,
      { stroke: 'none' },
    ),
    // 뒤로 뻗은 팔.
    path(
      `M ${num(cxMm - 2)} ${num(6)} L ${num(cxMm - 3.6)} ${num(8.3)} ` +
        `L ${num(cxMm - 2.8)} ${num(8.8)} L ${num(cxMm - 1.5)} ${num(6.6)} Z`,
      { stroke: 'none' },
    ),
    // 앞다리(내딛는 다리) — 오른쪽 앞으로.
    path(
      `M ${num(cxMm + 1.3)} ${num(10.3)} L ${num(cxMm + 3.4)} ${num(13.6)} ` +
        `L ${num(cxMm + 2.3)} ${num(14.2)} L ${num(cxMm + 0.3)} ${num(10.8)} Z`,
      { stroke: 'none' },
    ),
    // 뒷다리(차는 다리) — 왼쪽 뒤로 굽는다.
    path(
      `M ${num(cxMm - 1.4)} ${num(10.3)} L ${num(cxMm - 2.2)} ${num(13.2)} ` +
        `L ${num(cxMm - 0.8)} ${num(13.6)} L ${num(cxMm - 0.2)} ${num(10.6)} Z`,
      { stroke: 'none' },
    ),
  ];

  if (glovesMm) {
    // 골키퍼 장갑 — 양손 끝에 작은 네모를 더한다. 팔 실루엣과 겹치되 살짝
    // 커서 윤곽이 비어져 나오게 잡았다.
    shapes.push(
      path(
        `M ${num(cxMm + 3.5)} ${num(6.6)} L ${num(cxMm + 4.9)} ${num(7.3)} ` +
          `L ${num(cxMm + 4.4)} ${num(8.4)} L ${num(cxMm + 3)} ${num(7.7)} Z`,
        { stroke: 'none' },
      ),
      path(
        `M ${num(cxMm - 3.4)} ${num(7.9)} L ${num(cxMm - 4.4)} ${num(9)} ` +
          `L ${num(cxMm - 3.4)} ${num(9.6)} L ${num(cxMm - 2.4)} ${num(8.5)} Z`,
        { stroke: 'none' },
      ),
    );
  }

  return shapes;
};

const renderIllustrationVariant = (title: string, glovesMm: boolean): string =>
  svgDocument({
    widthMm: ILLUSTRATION.widthMm,
    heightMm: ILLUSTRATION.heightMm,
    title,
    children: [
      group({ id: ART_LAYER_ID }, [
        group({ id: MARKER_FILL_LAYER_ID, fill: MARKER_FILL_PLACEHOLDER }, [
          ...illustrationFigure(glovesMm),
        ]),
        wedgePath(ILLUSTRATION.widthMm / 2, ILLUSTRATION.heightMm - 1.6, 1.6),
      ]),
    ],
  });

export const renderPlayerMarkerIllustration = (): string =>
  renderIllustrationVariant('축구 게임판 · 선수 마커 · 일러스트', false);

export const renderGoalkeeperMarkerIllustration = (): string =>
  renderIllustrationVariant('축구 게임판 · 골키퍼 마커 · 일러스트', true);

/**
 * 나만의 홀 — 값에서 그때 그리는 판 (IDE-031)
 *
 * 열여덟 홀은 저장소 안에 좌표가 있지만 이 판은 **사용자가 판 위에서 끈
 * 손잡이**에서 나온다. 점 잇기(IDE-019)와 같은 자리에 선다 — 파트가
 * `dynamic`이고, 미리보기는 `/api/games/golf/artwork`로 받고 내보내기는 같은
 * 함수를 직접 부른다. 두 길이 같은 함수라 화면과 PDF가 같은 그림이다.
 *
 * **그리는 것은 `renderHole` 하나다.** 커스텀 홀도 미리 그린 열여덟 홀과 똑같이
 * 생겨야 하므로, 값에서 만드는 것은 그림이 아니라 `HoleSpec`이다. 판의 생김새를
 * 두 곳에서 그리면 한쪽만 고쳤을 때 "내가 만든 홀만 다르게 생긴" 일이 된다.
 */
// 별칭(`@/`)이 아니라 상대 경로다 — `npm run artwork`가 이 파일을 node로 곧장
// 읽어 정적 한 벌을 뽑기 때문이다(다른 아트워크 파일도 같은 규약이다).
import type {
  GameCustomization,
  SlotValue,
} from '../../../../lib/schema/index.ts';
import { pointsOf } from '../../../../lib/schema/points.ts';
import {
  COURSE_AREA,
  CUSTOM_HOLE,
  CUSTOM_HOLE_DEFAULTS,
  PANEL,
  yardsForLength,
  type EllipseSpec,
  type HoleSpec,
  type Xy,
} from '../dimensions.ts';
import { polylineLength, pt, smoothSpine } from './geometry.ts';
import { renderHole } from './hole.ts';

export const CUSTOM_SLOT = {
  number: 'custom-number',
  name: 'custom-name',
  par: 'custom-par',
  width: 'custom-width',
  path: 'custom-path',
  bunkers: 'custom-bunkers',
  ponds: 'custom-ponds',
  card: 'custom-card',
} as const;

/** 벙커와 연못의 크기. 고를 것이 많으면 짓기가 일이 되므로 고정이다. */
export const HAZARD_SIZE = {
  bunker: { rxMm: 11, ryMm: 7 },
  pond: { rxMm: 26, ryMm: 16 },
} as const;

const num = (
  values: Record<string, SlotValue>,
  id: string,
  fallback: number,
) => {
  const raw = values[id];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
};

const str = (
  values: Record<string, SlotValue>,
  id: string,
  fallback: string,
) => {
  const raw = values[id];
  return typeof raw === 'string' && raw.trim() !== '' ? raw : fallback;
};

const flatPairs = (value: SlotValue | undefined, fallback: number[]): Xy[] => {
  const points = pointsOf(value);
  const source = points.length > 0 ? points : pointsOf(fallback);
  return source.map((p) => [p.xMm, p.yMm] as Xy);
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * 해저드를 코스 안으로 붙든다.
 *
 * 상자가 이미 대부분을 막지만, 벙커는 반지름만큼 더 밀려날 수 있다. 값이
 * 사람 손에서 오는 판에서는 **마지막 붙듦이 그리는 쪽에 있어야** 한다 —
 * 검증으로 막으면 끌다 말고 오류를 보게 된다.
 */
const insideCourse = (center: Xy, size: { rxMm: number; ryMm: number }): Xy => [
  clamp(
    center[0],
    COURSE_AREA.xMm + size.rxMm + 1,
    COURSE_AREA.xMm + COURSE_AREA.widthMm - size.rxMm - 1,
  ),
  clamp(
    center[1],
    COURSE_AREA.yMm + size.ryMm + 1,
    COURSE_AREA.yMm + COURSE_AREA.heightMm - size.ryMm - 1,
  ),
];

const hazard = (
  centers: readonly Xy[],
  size: { rxMm: number; ryMm: number },
  rotate: boolean,
): EllipseSpec[] =>
  centers.map((center, i) => {
    const [xMm, yMm] = insideCourse(center, size);
    return {
      xMm,
      yMm,
      rxMm: size.rxMm,
      ryMm: size.ryMm,
      // 모래밭이 모두 같은 각도로 누워 있으면 찍어 낸 것처럼 보인다. 차례에서
      // 나오는 값이라 같은 값이면 같은 그림이다.
      rotDeg: rotate ? ((i % 3) - 1) * 22 : 0,
    };
  });

/**
 * 커스터마이즈 값 → 홀 하나.
 *
 * 값이 비었거나 모양이 틀리면 기본값으로 메운다. 이 함수는 서버 렌더러와
 * 아트워크 생성기가 함께 부르므로 **어떤 값이 와도 판 하나는 나와야 한다** —
 * 그리다 마는 것보다 기본 홀이 낫다.
 */
export function customHoleSpec(values: Record<string, SlotValue>): HoleSpec {
  const path = flatPairs(values[CUSTOM_SLOT.path], CUSTOM_HOLE_DEFAULTS.path);
  const spine =
    path.length >= 2 ? path : flatPairs(undefined, CUSTOM_HOLE_DEFAULTS.path);
  const lengthMm = polylineLength(smoothSpine(spine).map((p) => pt(p.x, p.y)));

  return {
    number: Math.round(
      num(values, CUSTOM_SLOT.number, CUSTOM_HOLE_DEFAULTS.number),
    ),
    par: Math.round(num(values, CUSTOM_SLOT.par, CUSTOM_HOLE_DEFAULTS.par)),
    name: str(values, CUSTOM_SLOT.name, CUSTOM_HOLE_DEFAULTS.name),
    yards: yardsForLength(lengthMm),
    spine,
    fairwayWidthMm: clamp(
      num(values, CUSTOM_SLOT.width, CUSTOM_HOLE_DEFAULTS.fairwayWidthMm),
      CUSTOM_HOLE.widthRangeMm.min,
      CUSTOM_HOLE.widthRangeMm.max,
    ),
    green: CUSTOM_HOLE.green,
    cup: CUSTOM_HOLE.cup,
    bunkers: hazard(
      flatPairs(values[CUSTOM_SLOT.bunkers], CUSTOM_HOLE_DEFAULTS.bunkers),
      HAZARD_SIZE.bunker,
      true,
    ),
    ponds: hazard(
      flatPairs(values[CUSTOM_SLOT.ponds], []),
      HAZARD_SIZE.pond,
      false,
    ),
    streams: [],
    // 숲은 적지 않는다 — 코스 영역에 성기게 흩는 몫(`scatterCount`)만으로도
    // 빈 러프가 메워지고, 심을 자리를 사람이 또 정하게 하면 짓기가 길어진다.
    forests: [],
    panel: cardCorner(values),
  };
}

/** 카드 좌상단. 상자 밖으로 나가지 않게 붙든다. */
function cardCorner(values: Record<string, SlotValue>): Xy {
  const [corner] = flatPairs(
    values[CUSTOM_SLOT.card],
    CUSTOM_HOLE_DEFAULTS.card,
  );
  const box = CUSTOM_HOLE.cardBox;
  return [
    clamp(corner?.[0] ?? box.xMm, box.xMm, box.xMm + box.widthMm),
    clamp(corner?.[1] ?? box.yMm, box.yMm, box.yMm + box.heightMm),
  ];
}

/** 카드가 판 안에 들어가는지. 테스트가 쓴다. */
export const cardFitsBoard = (corner: Xy): boolean =>
  corner[0] >= 0 &&
  corner[1] >= 0 &&
  corner[0] + PANEL.widthMm <= COURSE_AREA.xMm + COURSE_AREA.widthMm &&
  corner[1] + PANEL.heightMm <= COURSE_AREA.yMm + COURSE_AREA.heightMm;

/** 동적 파트 렌더러. `lib/games/dynamic-artwork.ts`가 게임 id로 잇는다. */
export function renderGolfArtwork(
  partId: string,
  customization: GameCustomization,
): string | null {
  if (partId !== CUSTOM_HOLE.partId) return null;
  return renderHole(customHoleSpec(customization.values));
}

/** 기본값으로 그린 한 벌. 카탈로그와 소개 페이지가 쓰는 정적 파일이다. */
export const renderCustomHoleDefault = (): string =>
  renderHole(
    customHoleSpec({
      [CUSTOM_SLOT.path]: [...CUSTOM_HOLE_DEFAULTS.path],
      [CUSTOM_SLOT.bunkers]: [...CUSTOM_HOLE_DEFAULTS.bunkers],
      [CUSTOM_SLOT.ponds]: [...CUSTOM_HOLE_DEFAULTS.ponds],
      [CUSTOM_SLOT.card]: [...CUSTOM_HOLE_DEFAULTS.card],
      [CUSTOM_SLOT.number]: CUSTOM_HOLE_DEFAULTS.number,
      [CUSTOM_SLOT.name]: CUSTOM_HOLE_DEFAULTS.name,
      [CUSTOM_SLOT.par]: CUSTOM_HOLE_DEFAULTS.par,
      [CUSTOM_SLOT.width]: CUSTOM_HOLE_DEFAULTS.fairwayWidthMm,
    }),
  );

/**
 * 사진 한 장 → 윤곽선 하나, 아니면 사유 (IDE-019)
 *
 * `image.ts`와 `trace.ts`를 한 줄로 잇고 **실패를 판정한다.**
 *
 * 배경이 복잡하거나 대비가 낮은 사진은 여기서 실패한다. 그때 **빈 판을 조용히
 * 내지 않는 것**이 이 파일의 일이다 — 무엇이 잘못됐는지(`reason`)와 사람에게
 * 보일 한 줄(`message`)을 함께 돌려주고, 그것을 "무엇을 하면 되는지"로 옮겨
 * 적는 것은 `IDE-020`이다.
 */
import {
  area,
  bounds,
  clockwise,
  toFlat,
  type FlatOutline,
  type Point,
} from './geometry.ts';
import { traceDetail } from './detail.ts';
import { prepareImage, toMask, type Mask, type RgbaImage } from './image.ts';
import {
  chaikin,
  largestContour,
  simplify,
  simplifyEpsilon,
  traceContours,
} from './trace.ts';

/** 윤곽을 앉힐 사각형. 도안에서는 mm, 테스트에서는 아무 단위여도 된다. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type OutlineFailure =
  /** 딸 윤곽이 없다. 단색에 가까운 사진이다. */
  | 'empty'
  /** 피사체가 판을 채우기에 너무 작다. */
  | 'too-small'
  /** 화면 거의 전체가 한 덩어리로 잡혔다 — 대비가 낮다. */
  | 'flooded'
  /** 비슷한 크기의 조각이 여럿이다 — 배경이 복잡하다. */
  | 'scattered';

/** 실패한 결과. 윤곽만 딸 때도, 세부까지 함께 딸 때도 모양이 같다. */
export interface OutlineFail {
  readonly ok: false;
  readonly reason: OutlineFailure;
  readonly message: string;
}

export type OutlineResult =
  { readonly ok: true; readonly outline: FlatOutline } | OutlineFail;

/** 가장 큰 윤곽이 사진에서 차지해야 하는 최소 넓이. 이보다 작으면 형태가 안 읽힌다. */
export const MIN_AREA_RATIO = 0.04;
/** 이보다 크면 배경까지 한 덩어리로 잡힌 것이다. */
export const MAX_AREA_RATIO = 0.92;
/** 큰 조각들 가운데 1등이 차지해야 하는 몫. 못 넘기면 피사체를 못 고른 것이다. */
export const MIN_DOMINANCE = 0.5;
/** 1등의 이 비율을 넘는 조각을 "큰 조각"으로 센다. */
const SIGNIFICANT_RATIO = 0.08;
/** 큰 조각이 이보다 많으면 배경이 복잡한 사진이다. */
export const MAX_PIECES = 6;
/** 단순화 뒤 남은 점이 이보다 적으면 형태라고 할 수 없다. */
export const MIN_VERTICES = 8;

const MESSAGES: Record<OutlineFailure, string> = {
  empty:
    '사진에서 윤곽을 찾지 못했다. 배경과 피사체의 밝기 차이가 거의 없는 사진이다.',
  'too-small':
    '피사체가 너무 작다. 아이나 인형이 화면을 절반쯤 채우게 가까이서 찍은 사진이 잘 된다.',
  flooded:
    '사진 거의 전체가 한 덩어리로 잡혔다. 역광이거나 배경과 피사체의 밝기가 비슷하다.',
  scattered:
    '비슷한 크기의 덩어리가 여럿이라 어느 것이 피사체인지 고르지 못했다. 배경이 단순한 곳에서 찍은 사진이 잘 된다.',
};

const fail = (reason: OutlineFailure): OutlineFail => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
});

export interface TraceOptions {
  /** 긴 변을 이만큼으로 줄인다. */
  readonly maxSide?: number;
  /** 가우시안 흐리기 세기. 0이면 흐리지 않는다. */
  readonly sigma?: number;
  /** 임계값을 직접 준다. 없으면 Otsu가 정한다. */
  readonly threshold?: number;
  /**
   * Otsu가 정한 임계값을 이만큼 민다(`IDE-020`의 슬라이더). 음수면 어두운 쪽,
   * 양수면 밝은 쪽까지 피사체로 본다. `threshold`를 함께 주면 무시된다.
   */
  readonly thresholdOffset?: number;
  /** 결과를 이 사각형에 비율 그대로 맞춰 넣는다. 없으면 화소 좌표 그대로다. */
  readonly fitTo?: Box;
}

/**
 * 마스크에서 윤곽 하나를 딴다. 사진을 거치지 않는 자리(테스트·재계산)가 쓴다.
 *
 * 판정 차례가 곧 사용자에게 할 말의 차례다 — "아무것도 없다" → "너무 작다" →
 * "다 잡혔다" → "어느 것인지 모르겠다".
 */
export function outlineFromMask(
  mask: Mask,
  options: { fitTo?: Box } = {},
): OutlineResult {
  const contours = traceContours(mask);
  if (contours.length === 0) return fail('empty');

  const largest = largestContour(contours);
  if (!largest) return fail('empty');

  const imageArea = mask.width * mask.height;
  const largestArea = area(largest);
  if (largestArea / imageArea < MIN_AREA_RATIO) return fail('too-small');
  if (largestArea / imageArea > MAX_AREA_RATIO) return fail('flooded');

  // 큰 조각이 여럿이면 어느 것이 피사체인지 고른 근거가 없다. 1등의 몫과
  // 조각 수를 함께 보는 것은 둘이 다른 실패를 잡기 때문이다 — 몫은 "비등한
  // 둘"을, 조각 수는 "잘게 흩어진 배경"을 잡는다.
  let significantArea = 0;
  let pieces = 0;
  for (const contour of contours) {
    const a = area(contour);
    if (a >= largestArea * SIGNIFICANT_RATIO) {
      significantArea += a;
      pieces += 1;
    }
  }
  if (pieces > MAX_PIECES) return fail('scattered');
  if (largestArea / significantArea < MIN_DOMINANCE) return fail('scattered');

  const smoothed = chaikin(largest);
  const simplified = simplify(smoothed, simplifyEpsilon(smoothed));
  if (simplified.length < MIN_VERTICES) return fail('empty');

  const oriented = clockwise(simplified);
  const placed = options.fitTo ? fitOutline(oriented, options.fitTo) : oriented;
  return { ok: true, outline: toFlat(placed) };
}

/**
 * 사진 한 장 → 윤곽선. 브라우저는 `<canvas>`의 `ImageData`를 그대로 넣는다.
 *
 * **사진은 여기서 끝난다.** 나가는 것은 좌표뿐이고 원본 픽셀은 어디에도 남지
 * 않는다 — 아이 사진을 서버에 보내지 않기로 한 결정(2026-09-08)이 이 경계다.
 */
export function traceOutline(
  image: RgbaImage,
  options: TraceOptions = {},
): OutlineResult {
  if (image.width < 2 || image.height < 2) return fail('empty');
  const mask = toMask(image, {
    maxSide: options.maxSide,
    sigma: options.sigma,
    threshold: options.threshold,
    thresholdOffset: options.thresholdOffset,
  });
  return outlineFromMask(mask, { fitTo: options.fitTo });
}

/**
 * 윤곽을 상자에 맞춰 넣을 때 쓰는 **닮음 변환** — 배율 하나와 이동 두 개다.
 *
 * `fitOutline`이 이것을 곧장 점에 먹이지만 따로 꺼내 두는 이유는 **사진도 같은
 * 변환으로 옮겨야** 하기 때문이다(IDE-020의 원본 대조 보기). 윤곽만 상자에
 * 앉히고 사진은 제 좌표에 두면 둘이 겹쳐 보이지 않아 대조가 되지 않는다.
 */
export interface FitTransform {
  readonly scale: number;
  /** 변환 전 좌표에서 빼는 기준점 — 윤곽의 좌상단이다. */
  readonly minX: number;
  readonly minY: number;
  /** 변환 뒤 더하는 상자 안 기준점. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/** 항등 변환. 넓이가 0인 윤곽(점 하나·직선)에서 쓴다. */
const IDENTITY_FIT: FitTransform = {
  scale: 1,
  minX: 0,
  minY: 0,
  offsetX: 0,
  offsetY: 0,
};

export function fitTransform(points: readonly Point[], box: Box): FitTransform {
  const b = bounds(points);
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  if (width <= 0 || height <= 0) return IDENTITY_FIT;

  const scale = Math.min(box.width / width, box.height / height);
  return {
    scale,
    minX: b.minX,
    minY: b.minY,
    offsetX: box.x + (box.width - width * scale) / 2,
    offsetY: box.y + (box.height - height * scale) / 2,
  };
}

/** 변환 하나를 점 하나에. 사진의 네 귀퉁이도 이걸로 옮긴다. */
export const applyFit = (t: FitTransform, x: number, y: number): Point => ({
  x: t.offsetX + (x - t.minX) * t.scale,
  y: t.offsetY + (y - t.minY) * t.scale,
});

/**
 * 윤곽선 하나 **더하기 세부 선 여럿** (IDE-021)
 *
 * `traceOutline`과 같은 사진에서 같은 마스크로 둘을 함께 낸다. 따로 두 번 부르면
 * 이진화가 두 번 돌 뿐 아니라, 사이에 밝기 설정이 어긋나면 세부가 윤곽과 다른
 * 그림에서 나온다.
 *
 * **좌표는 화소 그대로다.** 상자에 맞춰 넣는 것은 부르는 쪽이 하는데, 그래야
 * 윤곽에서 구한 변환 하나를 세부에도 사진에도 똑같이 먹일 수 있다(IDE-020의
 * 원본 대조 보기가 그 변환을 쓴다).
 */
export interface PictureOptions {
  readonly maxSide?: number;
  readonly sigma?: number;
  readonly threshold?: number;
  readonly thresholdOffset?: number;
  /** 밝기를 몇 단 더 나눠 세부를 딸지. 0이면 세부가 없다. */
  readonly detailLevels?: number;
}

export type PictureResult =
  | {
      readonly ok: true;
      readonly outline: FlatOutline;
      /** 아이가 잇지 않고 판에 미리 그려 두는 선들. 없으면 빈 배열이다. */
      readonly detail: FlatOutline[];
    }
  | OutlineFail;

export function tracePicture(
  image: RgbaImage,
  options: PictureOptions = {},
): PictureResult {
  if (image.width < 2 || image.height < 2) return fail('empty');
  const { gray, mask } = prepareImage(image, {
    maxSide: options.maxSide,
    sigma: options.sigma,
    threshold: options.threshold,
    thresholdOffset: options.thresholdOffset,
  });

  const traced = outlineFromMask(mask);
  if (!traced.ok) return traced;

  const detail = traceDetail(gray, mask, {
    levels: options.detailLevels ?? 0,
  }).map((ring) => toFlat(ring));

  return { ok: true, outline: traced.outline, detail };
}

/**
 * 윤곽을 사각형 안에 **비율 그대로** 맞춰 넣고 가운데 둔다.
 *
 * 판은 늘 190×277 세로 한 장인데(보드 파트는 정확히 1개다) 사진은 가로일 수
 * 있다. 그때 위아래가 비는 것을 그대로 둔다 — 늘여 맞추면 아이 얼굴이 길어진다.
 * 사진을 돌려 넣는 선택지는 `IDE-020`이 준다.
 */
export function fitOutline(points: readonly Point[], box: Box): Point[] {
  const t = fitTransform(points, box);
  if (t === IDENTITY_FIT) return [...points];
  return points.map((p) => applyFit(t, p.x, p.y));
}

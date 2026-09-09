/**
 * 점 잇기 도안 파이프라인 (IDE-019)
 *
 * 사진 픽셀에서 점·번호까지를 **순수 함수**로만 잇는다. DOM에도 서버에도 매지
 * 않아 브라우저(에디터의 사진 패널)와 서버 렌더러
 * (`src/assets/games/dot-to-dot/artwork/`)가 같은 코드를 쓴다.
 *
 *     ImageData → traceOutline → outline(number[] · mm) → planDots → SVG
 *
 * 가운데의 `outline`이 **커스터마이즈에 실려 오가는 유일한 값**이다. 사진은
 * 브라우저에서 끝나고 서버로 가지 않는다.
 *
 * **`./browser.ts`는 여기서 다시 내보내지 않는다**(IDE-020). 사진 파일을 읽고
 * 줄이고 돌리는 일만은 `<canvas>`에 매여 있어, 실수로 서버 코드가 끌어다 쓰면
 * Node에서 터진다 — 문 하나를 따로 낸다.
 */
export {
  binarize,
  downscale,
  gaussianBlur,
  prepareImage,
  MAX_SIDE_PX,
  MAX_THRESHOLD_OFFSET,
  otsuThreshold,
  toGray,
  toMask,
  type GrayImage,
  type Mask,
  type RgbaImage,
} from './image.ts';

export {
  erodeMask,
  multiThresholds,
  traceDetail,
  DETAIL_MAX_AREA_RATIO,
  DETAIL_MAX_POINTS,
  DETAIL_MAX_RINGS,
  DETAIL_MIN_AREA_RATIO,
  MAX_DETAIL_LEVELS,
  type DetailOptions,
} from './detail.ts';

export {
  arcTable,
  area,
  bounds,
  clockwise,
  distance,
  outwardNormal,
  perimeter,
  pointAt,
  signedArea,
  tangentAt,
  toFlat,
  toPoints,
  type FlatOutline,
  type Point,
} from './geometry.ts';

export {
  chaikin,
  largestContour,
  simplify,
  simplifyEpsilon,
  traceContours,
} from './trace.ts';

export {
  applyFit,
  fitOutline,
  fitTransform,
  outlineFromMask,
  traceOutline,
  tracePicture,
  MAX_AREA_RATIO,
  MAX_PIECES,
  MIN_AREA_RATIO,
  MIN_DOMINANCE,
  MIN_VERTICES,
  type Box,
  type FitTransform,
  type OutlineFail,
  type OutlineFailure,
  type OutlineResult,
  type PictureOptions,
  type PictureResult,
  type TraceOptions,
} from './outline.ts';

export {
  dotCapacity,
  planDots,
  DOT_METRICS,
  MIN_DOTS,
  type Dot,
  type DotOptions,
  type DotPlan,
} from './dots.ts';

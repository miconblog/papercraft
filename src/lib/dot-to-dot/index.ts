/**
 * 점 잇기 도안 파이프라인 (IDE-019)
 *
 * 사진 픽셀에서 점·번호까지를 **순수 함수**로만 잇는다. DOM에도 서버에도 매지
 * 않아 브라우저(`IDE-020`의 `<canvas>`)와 서버 렌더러
 * (`src/assets/games/dot-to-dot/artwork/`)가 같은 코드를 쓴다.
 *
 *     ImageData → traceOutline → outline(number[] · mm) → planDots → SVG
 *
 * 가운데의 `outline`이 **커스터마이즈에 실려 오가는 유일한 값**이다. 사진은
 * 브라우저에서 끝나고 서버로 가지 않는다.
 */
export {
  binarize,
  downscale,
  gaussianBlur,
  MAX_SIDE_PX,
  otsuThreshold,
  toGray,
  toMask,
  type GrayImage,
  type Mask,
  type RgbaImage,
} from './image.ts';

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
  fitOutline,
  outlineFromMask,
  traceOutline,
  MAX_AREA_RATIO,
  MAX_PIECES,
  MIN_AREA_RATIO,
  MIN_DOMINANCE,
  MIN_VERTICES,
  type Box,
  type OutlineFailure,
  type OutlineResult,
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

/**
 * 단위 변환과 용지 상수 (IDE-007)
 *
 * 값의 출처는 `docs/print-spec.md` §1·§4·§5다. 스파이크
 * (`spikes/print-pipeline/lib/geometry.mjs`)에서 옮겨 왔다.
 *
 * 도안 좌표는 전부 **mm**이고 원점은 좌상단, y는 아래로 증가한다(SVG·CSS와 같다).
 * PDF는 원점이 좌하단이라 렌더러가 y를 뒤집는다 — 도안 데이터는 뒤집지 않는다.
 */

export const MM_PER_IN = 25.4;
/** PDF 사용자 단위. */
export const PT_PER_IN = 72;
/** CSS 절대 길이 기준. */
export const CSS_PX_PER_IN = 96;

export const mmToPt = (mm: number): number => (mm / MM_PER_IN) * PT_PER_IN;
export const ptToMm = (pt: number): number => (pt / PT_PER_IN) * MM_PER_IN;
export const mmToCssPx = (mm: number): number =>
  (mm / MM_PER_IN) * CSS_PX_PER_IN;

/** A4. 배율 100%에서 운동장이 정확히 이 크기다(`docs/print-spec.md` §2). */
export const A4 = Object.freeze({ widthMm: 210, heightMm: 297 });

/**
 * 가정용 프린터의 인쇄 불가 여백. 기종마다 다르므로 사용자가 낮출 수 있게 둔다.
 * 6mm는 잉크젯·레이저 공통으로 안전한 쪽에 잡은 기본값이다(§4).
 */
export const DEFAULT_PRINTER_MARGIN_MM = 6;
/** 사용자가 자기 프린터 값을 재서 넣을 수 있는 범위. */
export const MIN_PRINTER_MARGIN_MM = 0;
export const MAX_PRINTER_MARGIN_MM = 20;

/** 타일 겹침 폭 — 손으로 오려 붙일 때 필요한 여유(§5). */
export const DEFAULT_OVERLAP_MM = 10;

/** 가정용 프린터에서 끊기지 않는 최소 선 굵기(§6). */
export const MIN_STROKE_MM = 0.12;

/**
 * 장 번호·인쇄 안내가 들어가는 하단 띠의 **희망 폭**.
 *
 * 떼어 두지 않으면 표식이 도안 위로 올라타거나(가운데 정렬이라 위아래 여유가
 * 0이 되는 배율이 있다) 인쇄되지 않는 여백으로 밀려난다. 7mm는 두 줄
 * (장 번호 · 인쇄 안내)이 들어가는 최소치다.
 *
 * **장수를 늘리지는 않는다.** 띠는 도안을 놓고 남은 여유에서만 가져간다 —
 * 여유가 없으면 띠가 줄고, 아예 없으면 표식을 빼고 도안을 살린다. 띠 때문에
 * 종이가 한 장 더 드는 쪽이 훨씬 나쁘다.
 */
export const STAMP_BAND_MM = 7;

/**
 * "A4 한 장 맞춤" 프리셋의 배율(§4).
 *
 * 100%가 아니다 — 운동장이 A4와 같은 크기라 인쇄 불가 여백에 걸리기 때문에,
 * 한 장에 담으려면 인쇄 가능 영역만큼 줄여야 한다. UI가 이 사실을 밝힌다.
 */
export const fitToOnePageScale = (
  partWidthMm: number,
  partHeightMm: number,
  marginMm: number = DEFAULT_PRINTER_MARGIN_MM,
): number => {
  const live = [
    { w: A4.widthMm - 2 * marginMm, h: A4.heightMm - 2 * marginMm },
    { w: A4.heightMm - 2 * marginMm, h: A4.widthMm - 2 * marginMm },
  ];
  return Math.max(
    ...live.map((l) => Math.min(l.w / partWidthMm, l.h / partHeightMm)),
  );
};

/** 배율을 사람이 읽는 퍼센트로. 소수 한 자리까지만 남긴다. */
export const scaleLabel = (scale: number): string =>
  `${Math.round(scale * 1000) / 10}%`;

/** 좌표 반올림 — 0.001mm는 인쇄에서 의미가 없고 파일만 커진다. */
export const round3 = (value: number): number => {
  const r = Math.round(value * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

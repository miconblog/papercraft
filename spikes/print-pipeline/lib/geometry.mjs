// 인쇄 파이프라인 스파이크 — 단위 변환과 용지 상수 (IDE-002)
//
// 모든 도안 좌표는 mm, 원점은 좌상단(SVG·CSS와 같은 방향)이다.
// PDF는 원점이 좌하단이라 렌더러에서 Y를 뒤집는다.

export const MM_PER_IN = 25.4;
export const PT_PER_IN = 72; // PDF 사용자 단위
export const CSS_PX_PER_IN = 96; // CSS 절대 길이 기준

export const mmToPt = (mm) => (mm / MM_PER_IN) * PT_PER_IN;
export const ptToMm = (pt) => (pt / PT_PER_IN) * MM_PER_IN;
export const mmToCssPx = (mm) => (mm / MM_PER_IN) * CSS_PX_PER_IN;
export const mmToPx = (mm, dpi) => (mm / MM_PER_IN) * dpi;
export const pxToMm = (px, dpi) => (px / dpi) * MM_PER_IN;

/** A4 = 210×297mm. 배율 100%에서 운동장이 정확히 이 크기다(IDE-002 배경). */
export const A4 = Object.freeze({ w: 210, h: 297 });
export const A3 = Object.freeze({ w: 297, h: 420 });

/**
 * 가정용 프린터의 인쇄 불가 여백. 기종마다 다르므로 파라미터로 둔다.
 * 6mm는 잉크젯·레이저 공통으로 안전한 쪽에 잡은 기본값이고,
 * `out/probe-printable-area.pdf`로 실제 기종 값을 재서 낮출 수 있다.
 */
export const DEFAULT_PRINTER_MARGIN = 6;

/** 타일 겹침 폭 — 손으로 오려 붙일 때 필요한 풀칠 여유. */
export const DEFAULT_OVERLAP = 10;

export const A4_PT = Object.freeze({ w: mmToPt(A4.w), h: mmToPt(A4.h) });

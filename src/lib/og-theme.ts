/**
 * 공유용 이미지(`opengraph-image.tsx`)가 쓰는 색. `next/og`는 CSS 변수를
 * 읽지 못해 globals.css의 레트로 토큰을 그대로 쓸 수 없다 — 컴파일된 값과
 * 같은 색을 여기 한 번만 적어 두고 두 이미지가 함께 참조한다.
 */
export const OG_COLORS = {
  /** globals.css `--background`(라이트) */
  paperCream: '#f7efe0',
  /** globals.css `--foreground`(라이트) */
  ink: '#39251b',
  paper: '#ffffff',
  brick: '#b04522',
  mustard: '#ac7c26',
  teal: '#277678',
  olive: '#56702f',
  plum: '#6d4370',
} as const;

/** 이미지 아래를 가로지르는 색 띠 — 옛 인쇄물의 색 맞춤 막대를 흉내 낸다. */
export const OG_BANDS = [
  OG_COLORS.brick,
  OG_COLORS.mustard,
  OG_COLORS.teal,
] as const;

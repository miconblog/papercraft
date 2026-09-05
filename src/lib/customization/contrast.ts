/**
 * 색 대비 계산 (IDE-009)
 *
 * 두 군데서 쓴다 — 사용자가 고른 팀 색이 서로 구분되는지(흑백 인쇄에서도),
 * 그리고 마커 위 글자가 배경과 구분되는지(`render.ts`의 `readableTextColor`는
 * 이 파일이 생기기 전부터 있던 더 단순한 버전이라 그대로 둔다. 여기 있는 건
 * WCAG 공식 그대로라 값이 살짝 다르다 — 용도가 다르면 같은 수식을 억지로
 * 공유하지 않는다).
 *
 * WCAG 2.x의 상대 휘도·명암비 공식을 그대로 옮겼다.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** hex(`#rrggbb`)의 WCAG 상대 휘도. 0(검정)~1(흰색). */
export function relativeLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const [rl, gl, bl] = [r, g, b].map(srgbToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** 두 색의 WCAG 명암비. 1(구분 안 됨)~21(검정 vs 흰색). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 흑백(그레이스케일) 인쇄에서 두 팀 색이 구분될지의 기준 명암비.
 *
 * 흑백 변환은 상대 휘도를 그대로 회색조로 옮기는 것과 같다 — 명암비가
 * 1에 가까우면 색상(색조)이 달라도 흑백에서는 같은 회색으로 찍힌다(예:
 * 채도 높은 빨강과 파랑). WCAG의 텍스트 기준(4.5:1)만큼 엄격할 필요는
 * 없다 — 팀은 이름표·마커 모양으로도 구분되므로 색은 보조 신호다. 1.6은
 * 실제로 눈에 띄는 밝기 차(대략 회색조 값 15% 안팎)가 나는 최소선이다.
 */
export const MIN_GRAYSCALE_DISTINCT_RATIO = 1.6;

/** 팀 색 목록에 흑백에서 구분되지 않을 만큼 가까운 짝이 있으면 그 둘을 돌려준다. */
export function findIndistinguishablePair(
  colors: readonly { id: string; label: string; hex: string }[],
): { a: { id: string; label: string }; b: { id: string; label: string } } | null {
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      if (
        contrastRatio(colors[i].hex, colors[j].hex) < MIN_GRAYSCALE_DISTINCT_RATIO
      ) {
        return { a: colors[i], b: colors[j] };
      }
    }
  }
  return null;
}

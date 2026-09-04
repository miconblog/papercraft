/**
 * 배경 SVG 문자열을 미리보기에 맞게 손보는 순수 함수들 (IDE-006)
 *
 * 아트워크 SVG(`public/games/<id>/*.svg`)는 실측 mm 크기(`width="297mm"`)를
 * 갖고 있어 그대로 넣으면 화면 배율을 무시하고 실제 크기로 박힌다. 컨테이너
 * 폭에 맞게 늘어나도록 바깥 `<svg>` 태그의 width·height만 지우고 viewBox는
 * 남긴다 — 안쪽 도형의 width·height 속성(예: `<rect width="…">`)은 건드리지
 * 않는다.
 */
export function stripOuterSvgSize(svgMarkup: string): string {
  return svgMarkup.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
    const stripped = attrs
      .replace(/\swidth="[^"]*"/, '')
      .replace(/\sheight="[^"]*"/, '');
    return `<svg${stripped}>`;
  });
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 색을 받는 레이어(`<g id="pc-team-home" fill="…">`)의 fill 값을 바꾼다.
 * 레이어가 없으면 아무 일도 하지 않는다 — 도안이 아직 그 파트에 레이어를
 * 두지 않았을 수 있다.
 */
export function paintLayer(
  svgMarkup: string,
  layerId: string,
  color: string,
): string {
  const pattern = new RegExp(
    `(<g id="${escapeRegExp(layerId)}"[^>]*\\bfill=")[^"]*(")`,
  );
  return svgMarkup.replace(pattern, `$1${color}$2`);
}

/**
 * 바깥 `<svg>` 태그를 벗기고 안쪽 내용만 돌려준다. 마커 아트워크를 미리보기의
 * 오버레이 `<g>` 안에 끼워 넣을 때 쓴다 — SVG는 `<svg>` 안에 `<svg>`를 다시
 * 둘 수 없으니, 자리(`<g transform="translate(...)">`)만 만들고 내용물만
 * 옮겨 담는다.
 */
export function extractSvgInner(svgMarkup: string): string {
  const match = svgMarkup.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return match ? match[1] : svgMarkup;
}

/** 어두운 배경엔 흰 글자, 밝은 배경엔 검은 글자 — 마커 위 등번호가 늘 읽히게. */
export function readableTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

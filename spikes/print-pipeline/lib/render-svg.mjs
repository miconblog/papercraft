// 후보 ② 앞단 — 화면·PDF 공용 SVG. 1 user unit = 1mm (width/height를 mm로 준다).
const KO_STACK =
  "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

function prim(it) {
  const sw = it.strokeMm ?? 0.2;
  const stroke = it.strokeMm === 0 ? 'none' : (it.stroke ?? '#000');
  const dash = it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : '';
  const common = `fill="${it.fill ?? 'none'}" stroke="${stroke}" stroke-width="${sw}"${dash}`;
  switch (it.kind) {
    case 'rect':
      return `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" ${common}/>`;
    case 'line':
      return `<line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" ${common}/>`;
    case 'circle':
      return `<circle cx="${it.cx}" cy="${it.cy}" r="${it.r}" ${common}/>`;
    case 'poly':
      return `<polygon points="${it.pts.map((p) => p.join(',')).join(' ')}" ${common}/>`;
    case 'text': {
      const anchor =
        it.anchor === 'middle'
          ? 'middle'
          : it.anchor === 'end'
            ? 'end'
            : 'start';
      // font-size는 mm 단위 user unit이라 그대로 쓴다
      return `<text x="${it.x}" y="${it.y}" font-size="${it.sizeMm}" text-anchor="${anchor}" font-family="${KO_STACK}" font-weight="${it.bold ? 700 : 400}" fill="#000" stroke="none">${esc(it.text)}</text>`;
    }
    default:
      return '';
  }
}

export function pageToSvg(page, { id = 'p0' } = {}) {
  const { pageW, pageH, clip, transform, content, marks } = page;
  const clipDef = clip
    ? `<clipPath id="clip-${id}"><rect x="${clip.x}" y="${clip.y}" width="${clip.w}" height="${clip.h}"/></clipPath>`
    : '';
  // 클립과 변환을 같은 <g>에 걸면 안 된다 — SVG는 요소의 transform이 적용된
  // 좌표계에서 clip-path를 해석해서, 잘리는 자리가 도안과 함께 밀려난다.
  // 클립은 변환 없는 바깥 <g>에, 변환은 안쪽 <g>에 건다.
  const inner = `<g transform="translate(${transform.tx} ${transform.ty}) scale(${transform.scale})">${content.map(prim).join('')}</g>`;
  const g = clip ? `<g clip-path="url(#clip-${id})">${inner}</g>` : inner;
  const mk = marks.length ? `<g>${marks.map(prim).join('')}</g>` : '';
  return { pageW, pageH, inner: `<defs>${clipDef}</defs>${g}${mk}` };
}

export function pageSvgDocument(page, opts) {
  const { pageW, pageH, inner } = pageToSvg(page, opts);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}" shape-rendering="geometricPrecision">${inner}</svg>`;
}

// 해칭 같은 합성 프리미티브를 선으로 펼친다 — 세 렌더러가 같은 결과를 내게.
export function expand(items) {
  const out = [];
  for (const it of items) {
    if (it.kind !== 'hatch') {
      out.push(it);
      continue;
    }
    const { x, y, w, h, gapMm = 1.5, strokeMm = 0.12, stroke = '#000000' } = it;
    // 45° 사선: x + y = c
    for (let c = 0; c <= w + h; c += gapMm) {
      const pts = [];
      // 사각형 네 변과의 교점
      if (c >= 0 && c <= h) pts.push([x, y + c]);
      if (c >= 0 && c <= w) pts.push([x + c, y]);
      if (c - w >= 0 && c - w <= h) pts.push([x + w, y + c - w]);
      if (c - h >= 0 && c - h <= w) pts.push([x + c - h, y + h]);
      if (pts.length >= 2) {
        const [p1, p2] = pts;
        out.push({
          kind: 'line',
          x1: p1[0],
          y1: p1[1],
          x2: p2[0],
          y2: p2[1],
          stroke,
          strokeMm,
        });
      }
    }
  }
  return out;
}

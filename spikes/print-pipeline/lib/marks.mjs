// 타일 표식 — 재단선 · 겹침 · 조립 표식 · 장 번호 (IDE-002 타일 분할 규격)
const INK = '#000000';
const line = (x1, y1, x2, y2, o = {}) => ({
  kind: 'line',
  x1,
  y1,
  x2,
  y2,
  stroke: INK,
  strokeMm: 0.15,
  ...o,
});
const text = (x, y, s, o = {}) => ({
  kind: 'text',
  x,
  y,
  text: s,
  sizeMm: 2.6,
  anchor: 'start',
  ...o,
});
const tri = (pts) => ({ kind: 'poly', pts, fill: INK, strokeMm: 0 });

/**
 * 한 타일의 용지 위 표식을 만든다. 좌표는 용지(mm) 절대 좌표다.
 * 클립 바깥, 즉 여백에 그린다.
 */
export function tileMarks({ plan, tile, pageH, scaleLabel, partLabel }) {
  const { srcW, srcH } = tile;
  const x0 = tile.dstX,
    y0 = tile.dstY,
    x1 = x0 + srcW,
    y1 = y0 + srcH;
  const items = [];
  const L = 4; // 재단선 길이

  // 재단선 — 라이브 영역 네 귀퉁이. 마주보는 두 장의 재단선을 맞춰 자른다.
  for (const [cx, cy, sx, sy] of [
    [x0, y0, -1, -1],
    [x1, y0, 1, -1],
    [x0, y1, -1, 1],
    [x1, y1, 1, 1],
  ]) {
    items.push(
      line(cx + sx * 1, cy, cx + sx * (1 + L), cy, { strokeMm: 0.15 }),
    );
    items.push(
      line(cx, cy + sy * 1, cx, cy + sy * (1 + L), { strokeMm: 0.15 }),
    );
  }

  // 겹침 띠 — 다음 장과 포개지는 자리. 파선으로만 표시하고 도안은 계속 그린다.
  const ovX = plan.overlapX;
  const ovY = plan.overlapY;
  if (tile.col < plan.cols) {
    items.push(
      line(x1 - ovX, y0, x1 - ovX, y1, { strokeMm: 0.12, dash: [1.5, 1.5] }),
    );
    items.push(text(x1 - ovX + 1, y0 + 4, `겹침 ${ovX}mm →`, { sizeMm: 2.2 }));
  }
  if (tile.row < plan.rows) {
    items.push(
      line(x0, y1 - ovY, x1, y1 - ovY, { strokeMm: 0.12, dash: [1.5, 1.5] }),
    );
    items.push(
      text(x0 + 1, y1 - ovY + 3.4, `↓ 겹침 ${ovY}mm`, { sizeMm: 2.2 }),
    );
  }

  // 조립 표식 — 이웃 장 번호와 방향. 겹쳐 붙일 때 무엇을 어디에 대는지.
  const idxAt = (r, c) => (r - 1) * plan.cols + c;
  const nb = [];
  if (tile.col > 1)
    nb.push([
      '◀',
      `${idxAt(tile.row, tile.col - 1)}번 왼쪽`,
      x0 - 1,
      (y0 + y1) / 2,
      'end',
    ]);
  if (tile.col < plan.cols)
    nb.push([
      '▶',
      `${idxAt(tile.row, tile.col + 1)}번 오른쪽`,
      x1 + 1,
      (y0 + y1) / 2,
      'start',
    ]);
  if (tile.row > 1)
    nb.push([
      '▲',
      `${idxAt(tile.row - 1, tile.col)}번 위`,
      (x0 + x1) / 2,
      y0 - 1.6,
      'middle',
    ]);
  if (tile.row < plan.rows)
    nb.push([
      '▼',
      `${idxAt(tile.row + 1, tile.col)}번 아래`,
      (x0 + x1) / 2,
      y1 + 4,
      'middle',
    ]);
  for (const [arrow, label, tx, ty, anchor] of nb) {
    items.push(text(tx, ty, `${arrow} ${label}`, { sizeMm: 2.4, anchor }));
  }

  // 정렬 삼각형 — 두 장을 겹칠 때 이 삼각형 두 개가 정확히 포개져야 한다
  const t = 2.2;
  if (tile.col < plan.cols) {
    for (const ty of [y0 + srcH * 0.25, y0 + srcH * 0.75]) {
      items.push(
        tri([
          [x1 - ovX, ty - t],
          [x1 - ovX, ty + t],
          [x1 - ovX + t * 1.6, ty],
        ]),
      );
    }
  }
  if (tile.col > 1) {
    for (const ty of [y0 + srcH * 0.25, y0 + srcH * 0.75]) {
      items.push(
        tri([
          [x0, ty - t],
          [x0, ty + t],
          [x0 + t * 1.6, ty],
        ]),
      );
    }
  }
  if (tile.row < plan.rows) {
    for (const tx of [x0 + srcW * 0.25, x0 + srcW * 0.75]) {
      items.push(
        tri([
          [tx - t, y1 - ovY],
          [tx + t, y1 - ovY],
          [tx, y1 - ovY + t * 1.6],
        ]),
      );
    }
  }
  if (tile.row > 1) {
    for (const tx of [x0 + srcW * 0.25, x0 + srcW * 0.75]) {
      items.push(
        tri([
          [tx - t, y0],
          [tx + t, y0],
          [tx, y0 + t * 1.6],
        ]),
      );
    }
  }

  // 장 번호 — 여백 하단
  const stamp = `${partLabel} · ${scaleLabel} · ${tile.index}/${plan.total}장 (${tile.row}행 ${tile.col}열)`;
  items.push(text(x0, pageH - 1.6, stamp, { sizeMm: 2.6, bold: true }));
  items.push(
    text(x1, pageH - 1.6, '배율 100%(맞춤 없음)으로 인쇄', {
      sizeMm: 2.4,
      anchor: 'end',
    }),
  );
  return items;
}

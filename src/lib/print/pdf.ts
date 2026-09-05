/**
 * 벡터 PDF 렌더러 (IDE-007)
 *
 * `docs/print-spec.md` §3의 채택안이다 — 도안을 **코드가 만든 벡터 PDF**로 낸다.
 * PDF의 MediaBox는 pt 단위 절대 크기라, 브라우저 인쇄 대화상자의 "용지에 맞춤"이
 * 끼어들 자리가 없다. 같은 코드가 어느 브라우저에서든 같은 바이트를 만든다.
 *
 * Node에서만 돈다(`./font`이 `node:fs`를 쓴다).
 */
import {
  clip,
  endPath,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFPage,
} from 'pdf-lib';
import type { Draw, PathDraw, TextDraw } from './draw';
import { fontFor } from './font';
import { layoutText } from './font';
import { MIN_STROKE_MM, mmToPt } from './geometry';
import { toPathData, type Transform } from './path';
import type { ExportDocument, ExportPage } from './compose';

const hexToRgb = (hex: string) => {
  const v = hex.replace('#', '');
  return rgb(
    Number.parseInt(v.slice(0, 2), 16) / 255,
    Number.parseInt(v.slice(2, 4), 16) / 255,
    Number.parseInt(v.slice(4, 6), 16) / 255,
  );
};

/**
 * `drawSvgPath`는 경로를 SVG 좌표(y 아래)로 받고 `(x, y)`에 그 원점을 놓는다.
 * 원점을 페이지 **좌상단**에 두면 우리 좌표계와 그대로 맞는다.
 *
 * `scale`을 쓰지 않는 이유: pdf-lib은 선 굵기·파선을 배율 안쪽에서 설정해
 * 굵기까지 같이 늘린다. 좌표를 미리 pt로 바꿔 넘기면 굵기를 pt로 곧장 줄 수 있다.
 */
const drawOptionsOrigin = (page: PDFPage) => ({
  x: 0,
  y: page.getSize().height,
});

const identity: Transform = { scale: 1, rotationDeg: 0, txMm: 0, tyMm: 0 };

const toTransform = (t: ExportPage['transform']): Transform => ({
  scale: t.scale,
  rotationDeg: 0,
  txMm: t.txMm,
  tyMm: t.tyMm,
});

function drawPath(page: PDFPage, item: PathDraw, t: Transform): void {
  const d = toPathData(item.commands, t, mmToPt);
  if (d === '') return;
  // 배율을 먹지 않는 표시선은 굵기를 그대로 두고, 도안 선은 배율을 같이 먹는다.
  // 굵기만 고정하면 축소했을 때 도안이 시커멓게 뭉친다(print-spec §1).
  const strokeMm = item.fixedStroke ? item.strokeMm : item.strokeMm * t.scale;
  const stroked = item.stroke !== null && strokeMm > 0;
  // 칠도 선도 없으면 그리지 않는다. pdf-lib은 둘 다 없으면 검은 테두리를
  // 임의로 넣어 버려서, 보이지 않아야 할 도형이 인쇄물에 나타난다.
  if (item.fill === null && !stroked) return;
  page.drawSvgPath(d, {
    ...drawOptionsOrigin(page),
    ...(item.fill !== null ? { color: hexToRgb(item.fill) } : {}),
    ...(stroked
      ? {
          borderColor: hexToRgb(item.stroke!),
          // 가정용 프린터에서 끊기지 않는 하한을 지킨다(print-spec §6).
          borderWidth: mmToPt(Math.max(strokeMm, MIN_STROKE_MM)),
          ...(item.dashMm
            ? {
                borderDashArray: item.dashMm.map((v) =>
                  mmToPt(item.fixedStroke ? v : v * t.scale),
                ),
              }
            : {}),
        }
      : {}),
  });
}

function drawText(page: PDFPage, item: TextDraw, t: Transform): void {
  if (item.text === '') return;
  const sizeMm = item.sizeMm * t.scale;
  const laid = layoutText(
    {
      text: item.text,
      sizeMm,
      anchor: item.anchor,
      baseline: item.baseline,
      bold: item.bold,
      maxWidthMm: item.maxWidthMm === null ? null : item.maxWidthMm * t.scale,
    },
    fontFor(item.bold),
  );
  const [xMm, yMm] = [t.txMm + t.scale * item.xMm, t.tyMm + t.scale * item.yMm];
  // 글자는 이미 배율이 반영된 로컬 좌표라 여기서는 자리와 회전만 얹는다.
  const d = toPathData(
    laid.commands,
    { scale: 1, rotationDeg: item.rotationDeg, txMm: xMm, tyMm: yMm },
    mmToPt,
  );
  if (d === '') return;
  page.drawSvgPath(d, {
    ...drawOptionsOrigin(page),
    color: hexToRgb(item.fill),
  });
}

const draw = (page: PDFPage, item: Draw, t: Transform): void =>
  item.kind === 'path' ? drawPath(page, item, t) : drawText(page, item, t);

/**
 * 클립을 건다. 변환이 걸린 그룹 안에서 클립을 잡으면 잘리는 자리가 도안과 함께
 * 밀려난다(IDE-002 결정 기록) — 여기서는 좌표를 미리 pt로 계산해 넘기므로
 * 그 함정이 생기지 않는다.
 */
function pushClip(
  page: PDFPage,
  rect: NonNullable<ExportPage['clip']>,
  pageHeightMm: number,
): void {
  // PDF는 원점이 좌하단이라 y를 뒤집는다. `drawSvgPath`로는 클립을 걸 수 없다 —
  // 그 함수는 경로를 자기 그래픽 상태 안에서 칠하고 닫아 버려, 뒤이어 부르는
  // `clip()`이 빈 경로를 받는다.
  page.pushOperators(
    pushGraphicsState(),
    rectangle(
      mmToPt(rect.xMm),
      mmToPt(pageHeightMm - rect.yMm - rect.heightMm),
      mmToPt(rect.widthMm),
      mmToPt(rect.heightMm),
    ),
    clip(),
    endPath(),
  );
}

export async function renderPdf(doc: ExportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  pdf.setProducer('papercraft (IDE-007)');
  pdf.setCreator('papercraft');

  for (const page of doc.pages) {
    const pdfPage = pdf.addPage([mmToPt(page.widthMm), mmToPt(page.heightMm)]);
    const t = toTransform(page.transform);

    if (page.clip) pushClip(pdfPage, page.clip, page.heightMm);
    for (const item of page.items) draw(pdfPage, item, t);
    if (page.clip) pdfPage.pushOperators(popGraphicsState());

    // 표식은 용지 좌표라 변환을 걸지 않는다. 클립 밖에 그려야 여백의
    // 재단선·장 번호가 살아남는다.
    for (const item of page.marks) draw(pdfPage, item, identity);
  }

  return pdf.save({ useObjectStreams: true });
}

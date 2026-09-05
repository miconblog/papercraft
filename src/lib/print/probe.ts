/**
 * 인쇄 가능 영역 탐침 시트 (IDE-007)
 *
 * `docs/print-spec.md` §4가 넘긴 기능이다. 가정용 프린터는 용지 가장자리에
 * 인쇄하지 못하고 그 폭이 기종마다 다르다. 기본값 6mm는 안전한 쪽에 잡은
 * 값이라, 실제로 4mm인 프린터를 쓰는 사람은 쓸데없이 한 장을 더 뽑는다.
 *
 * 읽는 법은 단순하다 — 네 변마다 **가장자리에서 0·1·2…mm 떨어진 짧은 선**을
 * 늘어놓고, 번호는 안쪽 한 줄에 모아 둔다. 뽑아 보고 **처음으로 보이는 선의
 * 번호**가 그 변의 인쇄 불가 여백이다. 번호를 선 옆이 아니라 안쪽에 모은 이유는
 * 번호까지 잘려 버리면 읽을 수 없기 때문이다.
 */
import { A4, MIN_STROKE_MM } from './geometry';
import { BLACK, INK, path, text, type Draw } from './draw';
import { linePath } from './path';
import type { ExportDocument } from './compose';

/** 재는 범위. 이보다 큰 여백을 가진 가정용 프린터는 드물다. */
const MAX_PROBE_MM = 14;
/** 눈금 하나가 차지하는 폭. 번호가 겹치지 않을 만큼이다. */
const PITCH_MM = 11;
const TICK_LEN_MM = 9;
/** 번호를 모아 두는 줄이 가장자리에서 얼마나 안쪽인가. */
const LABEL_INSET_MM = 20;

const TICK_STROKE_MM = 0.3;

export interface ProbeInput {
  /** 지금 앱이 쓰고 있는 값. 시트에 함께 적어 비교하게 한다. */
  readonly currentMarginMm: number;
}

function edgeTicks(
  edge: 'top' | 'bottom' | 'left' | 'right',
  pageWidthMm: number,
  pageHeightMm: number,
): Draw[] {
  const items: Draw[] = [];
  const horizontal = edge === 'top' || edge === 'bottom';
  const along = horizontal ? pageWidthMm : pageHeightMm;
  const span = (MAX_PROBE_MM + 1) * PITCH_MM;
  const start = (along - span) / 2;

  for (let d = 0; d <= MAX_PROBE_MM; d++) {
    const at = start + d * PITCH_MM;
    // 가장자리에서 d mm 떨어진 짧은 선.
    const depth =
      edge === 'top'
        ? d
        : edge === 'bottom'
          ? pageHeightMm - d
          : edge === 'left'
            ? d
            : pageWidthMm - d;
    const commands = horizontal
      ? linePath(at, depth, at + TICK_LEN_MM, depth)
      : linePath(depth, at, depth, at + TICK_LEN_MM);
    items.push(
      path(commands, {
        stroke: BLACK,
        fill: null,
        // 짝수 눈금을 굵게 해 세면서 읽기 쉽게 한다.
        strokeMm: d % 2 === 0 ? TICK_STROKE_MM * 1.6 : TICK_STROKE_MM,
        fixedStroke: true,
      }),
    );

    // 번호 — 네 변 모두 안쪽 한 줄에 모은다.
    const labelDepth =
      edge === 'top'
        ? LABEL_INSET_MM
        : edge === 'bottom'
          ? pageHeightMm - LABEL_INSET_MM
          : edge === 'left'
            ? LABEL_INSET_MM
            : pageWidthMm - LABEL_INSET_MM;
    items.push(
      horizontal
        ? text(String(d), at + TICK_LEN_MM / 2, labelDepth, 3, {
            anchor: 'middle',
            fill: INK,
          })
        : text(String(d), labelDepth, at + TICK_LEN_MM / 2, 3, {
            anchor: 'middle',
            fill: INK,
          }),
    );
  }
  return items;
}

/** 탐침 시트 한 장. 언제나 A4 세로다 — 재는 대상이 용지 자체이기 때문이다. */
export function probeDocument({ currentMarginMm }: ProbeInput): ExportDocument {
  const pageWidthMm = A4.widthMm;
  const pageHeightMm = A4.heightMm;
  const marks: Draw[] = [];

  for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
    marks.push(...edgeTicks(edge, pageWidthMm, pageHeightMm));
  }

  // 지금 설정값이 어디인지 보여 주는 네모. 이 안쪽은 앱이 도안을 넣는 자리다.
  marks.push(
    path(
      [
        { c: 'M', x: currentMarginMm, y: currentMarginMm },
        { c: 'L', x: pageWidthMm - currentMarginMm, y: currentMarginMm },
        {
          c: 'L',
          x: pageWidthMm - currentMarginMm,
          y: pageHeightMm - currentMarginMm,
        },
        { c: 'L', x: currentMarginMm, y: pageHeightMm - currentMarginMm },
        { c: 'Z' },
      ],
      {
        stroke: BLACK,
        fill: null,
        strokeMm: MIN_STROKE_MM,
        dashMm: [2, 2],
        fixedStroke: true,
      },
    ),
  );

  const centreX = pageWidthMm / 2;
  let y = 110;
  const line = (value: string, sizeMm: number, bold = false) => {
    marks.push(
      text(value, centreX, y, sizeMm, {
        anchor: 'middle',
        bold,
        fill: INK,
        maxWidthMm: pageWidthMm - 2 * LABEL_INSET_MM - 8,
      }),
    );
    y += sizeMm * 1.7;
  };

  line('내 프린터 여백 재기', 7, true);
  y += 3;
  line('이 장을 배율 100%(맞춤 없음)로 뽑는다.', 3.4);
  line('네 변마다 짧은 선이 0mm부터 1mm 간격으로 놓여 있다.', 3.4);
  line('처음으로 보이는 선의 번호가 그 변의 인쇄 불가 여백이다.', 3.4);
  y += 4;
  line('네 값 중 가장 큰 것을 인쇄 화면의 “인쇄 불가 여백”에 넣는다.', 3.4);
  line('값을 줄이면 같은 배율에서 장수가 줄어든다.', 3.4);
  y += 6;
  line(
    `지금 설정: ${Math.round(currentMarginMm * 10) / 10}mm — 파선이 그 자리다`,
    3.4,
    true,
  );

  return {
    title: '내 프린터 여백 재기',
    parts: [],
    pages: [
      {
        widthMm: pageWidthMm,
        heightMm: pageHeightMm,
        clip: null,
        transform: { scale: 1, txMm: 0, tyMm: 0 },
        items: [],
        marks,
      },
    ],
  };
}

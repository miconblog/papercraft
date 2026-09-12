/**
 * 선수 보관함 전개도 (2026-09-12 사용자 요청)
 *
 * 오려 놓은 선수 스무 명을 **접은 채로 세워 일렬로** 담는 상자다. 뚜껑은 없다.
 * 치수와 이유는 `../dimensions.ts`의 `STAND_BOX`에 있다.
 *
 * 전개도 한 벌은 **바닥 + 벽 넷 + 귀 넷**이고 시트에서는 세워 쓴다 — 바닥의 긴
 * 쪽(안쪽 길이)이 세로다. 귀는 **짧은 벽**에 붙어 있다가 안으로 접혀 긴 벽에 풀로
 * 붙는다. 긴 벽은 선수를 꽂고 빼는 쪽이라 그쪽에 겹이 생기면 종이가 두꺼워져
 * 카드가 걸린다.
 *
 * 바깥 모서리 넷은 비스듬히 자른다(`tabInsetMm`). 직각으로 두면 귀를 접어 넣을 때
 * 모서리가 옆 벽에 걸린다.
 *
 * 접는선은 모두 **골접기**다 — 인쇄면이 안으로 들어가 상자의 **안쪽**이 인쇄면이
 * 된다. 바닥에 적힌 이름이 상자를 열면 보인다.
 */
import { STAND_BOX, trayNetMm, type StandTray } from '../dimensions.ts';
import {
  INK_COLOR,
  glueHatch,
  line,
  num,
  path,
  text,
} from '../../../shared/svg.ts';

export interface TrayNet {
  /** 바깥 오림선 하나. */
  readonly cut: string;
  /** 골접기 선 넷 — 세로 둘은 귀까지 그대로 이어진다. */
  readonly folds: readonly string[];
  /** 귀 넷의 풀칠 빗금. */
  readonly glue: readonly string[];
  readonly labels: readonly string[];
}

/** 전개도 한 벌. (xMm, yMm)은 전개도 사각형의 좌상단이다. */
export const renderTrayNet = (
  tray: StandTray,
  xMm: number,
  yMm: number,
): TrayNet => {
  const d = tray.depthMm;
  const inset = STAND_BOX.tabInsetMm;
  const net = trayNetMm(tray);

  // 바닥 사각형 — 벽과 귀는 이 밖이다.
  const left = xMm + d;
  const top = yMm + d;
  const right = xMm + net.widthMm - d;
  const bottom = yMm + net.heightMm - d;
  const outerRight = xMm + net.widthMm;
  const outerBottom = yMm + net.heightMm;

  const outline: ReadonlyArray<readonly [number, number]> = [
    [xMm, top],
    [xMm + inset, yMm],
    [outerRight - inset, yMm],
    [outerRight, top],
    [outerRight, bottom],
    [outerRight - inset, outerBottom],
    [xMm + inset, outerBottom],
    [xMm, bottom],
  ];

  return {
    cut: path(
      outline
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
        .join('') + 'Z',
    ),
    // 세로 둘은 귀까지 한 줄로 이어진다 — 귀도 같은 자리에서 같은 방향으로 접힌다.
    folds: [
      line(left, yMm, left, outerBottom),
      line(right, yMm, right, outerBottom),
      line(left, top, right, top),
      line(left, bottom, right, bottom),
    ],
    glue: [
      ...glueHatch(xMm + 1.5, yMm + 2, d - 3, d - 3.5),
      ...glueHatch(right + 1.5, yMm + 2, d - 3, d - 3.5),
      ...glueHatch(xMm + 1.5, bottom + 1.5, d - 3, d - 3.5),
      ...glueHatch(right + 1.5, bottom + 1.5, d - 3, d - 3.5),
    ],
    labels: [
      text(
        tray.label,
        (left + right) / 2,
        (top + bottom) / 2,
        STAND_BOX.noteFontMm + 0.8,
        { 'text-anchor': 'middle', fill: INK_COLOR, stroke: 'none' },
      ),
      text(
        '선수를 세워 일렬로',
        (left + right) / 2,
        (top + bottom) / 2 + 6,
        STAND_BOX.noteFontMm,
        { 'text-anchor': 'middle', fill: INK_COLOR, stroke: 'none' },
      ),
    ],
  };
};

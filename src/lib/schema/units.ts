/**
 * 도안 좌표계와 치수 단위 (IDE-003)
 *
 * - 단위는 **mm**다. 배율 100%에서 mm 값이 그대로 종이 위 실측 치수가 된다.
 * - 파트 좌표계의 원점은 **좌상단**, x는 오른쪽, y는 아래 방향이다(SVG·CSS와 같다).
 *   PDF는 원점이 좌하단이라 렌더러에서 y를 뒤집는다 — 도안 데이터는 뒤집지 않는다.
 * - 슬롯의 좌표는 그 슬롯이 놓인 **파트 로컬 좌표**다. 용지 좌표가 아니다.
 *   용지 배치(타일 분할·여백)는 IDE-002가 정한 인쇄 규격의 몫이다.
 */
import { z } from 'zod';

/** 길이·치수 — 0보다 커야 한다. */
export const mmLength = z.number().positive();

/** 좌표 — 파트 로컬 기준. 파트 안쪽인지는 별도 규칙에서 검사한다. */
export const mmCoord = z.number();

/** A4. 배율 100%에서 축구 게임판의 운동장이 이 크기다(IDE-002). */
export const A4 = Object.freeze({ widthMm: 210, heightMm: 297 });

/** 도안 id·레이어 id에 쓰는 슬러그. 파일명·SVG id로 그대로 나가므로 좁게 잡는다. */
export const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    '소문자·숫자·하이픈만 쓴다 (예: home-player-1)',
  );

/** 6자리 HEX 색. 인쇄 파이프라인이 알파를 다루지 않으므로 8자리는 받지 않는다. */
export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 형식이어야 한다');

/** 파트 로컬 좌표계의 축 정렬 사각형. */
export const rectMm = z.strictObject({
  xMm: mmCoord,
  yMm: mmCoord,
  widthMm: mmLength,
  heightMm: mmLength,
});

export type RectMm = z.infer<typeof rectMm>;

export const containsPoint = (
  rect: RectMm,
  xMm: number,
  yMm: number,
): boolean =>
  xMm >= rect.xMm &&
  xMm <= rect.xMm + rect.widthMm &&
  yMm >= rect.yMm &&
  yMm <= rect.yMm + rect.heightMm;

export const rectContainsRect = (outer: RectMm, inner: RectMm): boolean =>
  containsPoint(outer, inner.xMm, inner.yMm) &&
  containsPoint(outer, inner.xMm + inner.widthMm, inner.yMm + inner.heightMm);

/** 두 사각형이 겹치는지. 변이 맞닿기만 한 경우는 겹침으로 보지 않는다. */
export const rectsOverlap = (a: RectMm, b: RectMm): boolean =>
  a.xMm < b.xMm + b.widthMm &&
  b.xMm < a.xMm + a.widthMm &&
  a.yMm < b.yMm + b.heightMm &&
  b.yMm < a.yMm + a.heightMm;

/** 중심점과 크기로 사각형을 만든다. 마커는 중심을 기준점으로 쓴다. */
export const rectAround = (
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): RectMm => ({
  xMm: xMm - widthMm / 2,
  yMm: yMm - heightMm / 2,
  widthMm,
  heightMm,
});

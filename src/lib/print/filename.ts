/**
 * 내보내기 파일명 규칙 (IDE-007)
 *
 * 사용자는 배율을 바꿔 가며 여러 번 뽑는다. 내려받기 폴더에서 **무엇을 뽑은
 * 것인지 파일명만 보고 알아야** 다시 뽑는 수고를 던다. 그래서 게임 · 파트 ·
 * 배율 · 벌 수를 이름에 넣는다.
 *
 *     soccer-field-200pct.pdf              운동장만, 200%
 *     soccer-accessories-100pct.pdf        부속 전부, 100%
 *     soccer-ball-markers-100pct-x3.pdf    공 마커 3벌
 *     soccer-all-mixed.pdf                 파트마다 배율이 다를 때
 *
 * 게임 id와 파트 id가 이미 소문자·숫자·하이픈 슬러그라(IDE-003) 한글을 섞지
 * 않는다. 한글 파일명은 브라우저·OS·압축 프로그램을 지날 때마다 깨질 자리가
 * 생기는데, 얻는 것은 파일 목록의 읽기 쉬움 하나뿐이다. 한글 제목은 PDF 메타데이터와
 * 조립 안내 시트에 남는다.
 */
import type { GameDefinition } from '@/lib/schema';
import type { PartSelection } from './options';

/** 고른 파트를 줄여 부르는 이름. */
export type GroupLabel = 'board' | 'accessories' | 'all' | 'parts';

/** 파트 묶음의 이름. 하나면 그 파트 id, 여럿이면 묶음 이름이다. */
export interface FilenameInput {
  readonly gameId: string;
  readonly selections: readonly PartSelection[];
  /** 보드·부속을 나눠 부를 수 있게 부르는 쪽이 알려 준다. */
  readonly groupLabel?: GroupLabel;
}

const pctToken = (scale: number): string =>
  `${String(Math.round(scale * 1000) / 10).replace('.', '_')}pct`;

export function exportFilename({
  gameId,
  selections,
  groupLabel,
}: FilenameInput): string {
  const scales = new Set(selections.map((s) => s.scale));
  const scaleToken = scales.size === 1 ? pctToken([...scales][0]) : 'mixed';

  const subject =
    selections.length === 1 ? selections[0].partId : (groupLabel ?? 'parts');

  const copies = new Set(selections.map((s) => s.copies));
  const copyToken =
    copies.size === 1 && [...copies][0] > 1 ? `-x${[...copies][0]}` : '';

  return `${gameId}-${subject}-${scaleToken}${copyToken}.pdf`;
}

/**
 * `Content-Disposition` 헤더 값. 파일명이 ASCII라 따옴표만 붙이면 되지만,
 * 규칙이 바뀌어 한글이 섞여도 깨지지 않게 RFC 5987 형식을 함께 낸다.
 */
export const contentDisposition = (filename: string): string =>
  `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

/**
 * 고른 파트가 어떤 묶음인지. 파일명과 화면 안내가 같은 말을 쓰게 한다.
 *
 * `board`는 핵심 게임판 하나, `accessories`는 오림용 부속 전부, `all`은 둘 다다.
 * 그 밖의 조합은 `parts`로 부른다 — 이름으로 줄여 부를 수 있는 조합이 아니다.
 */
export function groupLabelFor(
  game: GameDefinition,
  selections: readonly PartSelection[],
): GroupLabel {
  const chosen = new Set(selections.map((s) => s.partId));
  const boards = game.parts.filter((p) => p.kind === 'board').map((p) => p.id);
  const accessories = game.parts
    .filter((p) => p.kind !== 'board')
    .map((p) => p.id);
  const has = (ids: string[]) =>
    ids.length > 0 && ids.every((id) => chosen.has(id));

  if (chosen.size === boards.length + accessories.length) return 'all';
  if (has(boards) && chosen.size === boards.length) return 'board';
  if (has(accessories) && chosen.size === accessories.length)
    return 'accessories';
  return 'parts';
}

/**
 * 게임 메타데이터를 화면 문구로 바꾸는 순수 함수들 (IDE-005)
 *
 * 카탈로그(목록·상세)가 쓴다. 게임을 몰라도 되게 — `GameDefinition`의 필드만
 * 보고 문구를 만든다.
 */
import type { GameDefinition, Part } from '@/lib/schema';

/** "2인용" · "2~4인용". 최소·최대가 같으면 한 번만 적는다. */
export function formatPlayers(players: GameDefinition['players']): string {
  if (players.min === players.max) return `${players.min}인용`;
  return `${players.min}~${players.max}인용`;
}

export const PART_KIND_LABEL: Record<Part['kind'], string> = {
  board: '게임판',
  cutout: '오려 쓰는 부속',
  buildable: '접어 세우는 조립물',
};

export const ORIENTATION_LABEL: Record<Part['orientation'], string> = {
  portrait: '세로',
  landscape: '가로',
};

/**
 * 지원 용지. 게임마다 다르지 않다 — 인쇄 규격(`docs/print-spec.md`, `IDE-002`)이
 * 배율·타일 분할의 기준 용지를 A4로 고정했다. 파트 치수(mm)에서 유추하지 않고
 * 여기 상수 하나로 둔다 — 스키마에 파트별 용지 필드가 없다.
 */
export const SUPPORTED_PAPER_SIZE = 'A4';

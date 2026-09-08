import Image from 'next/image';
import Link from 'next/link';
import type { GameDefinition } from '@/lib/schema';
import {
  boardOf,
  formatPlayers,
  SUPPORTED_PAPER_SIZE,
} from '@/lib/games/format';

/** 게임 목록 카드. 게임 메타데이터만 읽는다 — 게임이 늘어도 이 컴포넌트는
 * 손대지 않는다(IDE-005 수용 기준). */
export function GameCard({ game }: { game: GameDefinition }) {
  const board = boardOf(game);
  return (
    <li>
      <Link
        href={`/games/${game.id}`}
        className="group block h-full rounded-lg border border-border-strong bg-popover p-4 shadow-[5px_5px_0_var(--border-strong)] transition-all hover:border-primary hover:shadow-[5px_5px_0_var(--retro-brick)]"
      >
        {/* 도안 비율이 아니라 **A4 가로 한 장** 크기의 자리를 늘 같게 잡고, 그
            안에 도안을 통째로 담는다(`object-contain`). 게임마다 판 방향이
            다른데(축구는 가로, 야구는 세로) 그림 비율을 그대로 따르면 세로판
            하나가 줄 전체를 늘려 카드가 다 같이 길어졌다(2026-09-08).
            남는 자리는 흰 종이면이라 세로판은 종이 위에 놓인 것처럼 보인다. */}
        <div className="aspect-[297/210] overflow-hidden rounded-md border border-border bg-paper">
          <Image
            src={game.thumbnail}
            alt={`${game.title} 미리보기`}
            width={board.widthMm}
            height={board.heightMm}
            className="h-full w-full object-contain"
          />
        </div>
        <h2 className="mt-3 text-lg font-semibold group-hover:underline">
          {game.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{game.tagline}</p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt className="font-medium">인원</dt>
            <dd>{formatPlayers(game.players)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium">용지</dt>
            <dd>{SUPPORTED_PAPER_SIZE}</dd>
          </div>
        </dl>
      </Link>
    </li>
  );
}

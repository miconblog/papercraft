import Image from 'next/image';
import Link from 'next/link';
import type { GameDefinition } from '@/lib/schema';
import { formatPlayers, SUPPORTED_PAPER_SIZE } from '@/lib/games/format';

/** 게임 목록 카드. 게임 메타데이터만 읽는다 — 게임이 늘어도 이 컴포넌트는
 * 손대지 않는다(IDE-005 수용 기준). */
export function GameCard({ game }: { game: GameDefinition }) {
  return (
    <li>
      <Link
        href={`/games/${game.id}`}
        className="group block h-full rounded-lg border border-black/10 p-4 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
      >
        <div className="overflow-hidden rounded-md border border-black/5 bg-white dark:border-white/10">
          <Image
            src={game.thumbnail}
            alt={`${game.title} 미리보기`}
            width={297}
            height={210}
            className="h-auto w-full"
          />
        </div>
        <h2 className="mt-3 text-lg font-semibold group-hover:underline">
          {game.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {game.tagline}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
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

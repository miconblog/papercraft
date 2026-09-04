import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { gameIds, getGame } from '@/lib/games';
import {
  formatPlayers,
  ORIENTATION_LABEL,
  PART_KIND_LABEL,
  SUPPORTED_PAPER_SIZE,
} from '@/lib/games/format';

type Params = { id: string };
type Props = { params: Promise<Params> };

/** 게임마다 하나씩 빌드 시점에 정적 생성한다 — 등록소에 게임을 더하면 이
 * 목록도 같이 늘어난다(IDE-005 수용 기준: 페이지가 자동으로 생긴다). */
export function generateStaticParams(): Params[] {
  return gameIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return {};

  return {
    title: game.title,
    description: game.tagline,
    openGraph: {
      title: game.title,
      description: game.tagline,
    },
  };
}

export default async function GamePage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const board = game.parts.find((p) => p.kind === 'board')!;
  const accessories = game.parts.filter((p) => p.kind !== 'board');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← 목록으로
      </Link>

      <div className="mt-4 overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/15">
        <Image
          src={game.thumbnail}
          alt={`${game.title} 도안 미리보기`}
          width={board.widthMm}
          height={board.heightMm}
          className="h-auto w-full"
        />
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{game.title}</h1>
      <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
        {game.tagline}
      </p>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-1">
          <dt className="font-medium">인원</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {formatPlayers(game.players)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">지원 용지</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {SUPPORTED_PAPER_SIZE}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">준비물</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {game.supplies.join(' · ')}
          </dd>
        </div>
      </dl>

      <p className="mt-6 leading-7 text-zinc-700 dark:text-zinc-300">
        {game.description}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">구성</h2>
        <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
          {[board, ...accessories].map((part) => (
            <li key={part.id} className="p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{part.title}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {PART_KIND_LABEL[part.kind]}
                </span>
              </div>
              <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                배율 100%에서 {part.widthMm}×{part.heightMm}mm ·{' '}
                {ORIENTATION_LABEL[part.orientation]}
              </div>
              {part.description && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {part.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Link
        href={`/games/${game.id}/edit`}
        className="mt-8 inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        만들기 시작
      </Link>
    </div>
  );
}

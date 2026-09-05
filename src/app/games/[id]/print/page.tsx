import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { gameIds, getGame } from '@/lib/games';
import { ExportClient } from '@/components/print/ExportClient';

type Params = { id: string };
type Props = { params: Promise<Params> };

export function generateStaticParams(): Params[] {
  return gameIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  return game ? { title: `${game.title} 인쇄하기` } : {};
}

/**
 * 인쇄·PDF 내보내기 화면 (IDE-007)
 *
 * 에디터와 페이지를 나눈 이유는 두 화면이 묻는 것이 다르기 때문이다. 에디터는
 * "무엇을 바꿀까", 여기는 "어떤 크기로 몇 장을 뽑을까"다. 커스터마이즈 값은
 * 브라우저 저장소를 통해 넘어온다(IDE-006).
 */
export default async function PrintGamePage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const board = game.parts.find((p) => p.kind === 'board');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href={`/games/${game.id}/edit`}
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← 만들기로 돌아가기
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        {game.title} 인쇄하기
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        배율 100%가 원본 크기다
        {board && ` — ${board.title}이 ${board.widthMm}×${board.heightMm}mm`}.
        크게 뽑으면 A4 여러 장에 나눠 나오고, 안내 시트대로 붙이면 이어진다.
      </p>
      <ExportClient game={game} />
    </div>
  );
}

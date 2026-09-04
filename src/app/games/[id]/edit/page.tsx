import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { gameIds, getGame } from '@/lib/games';
import { roParticle } from '@/lib/korean';
import { EditorClient } from '@/components/editor/EditorClient';

type Params = { id: string };
type Props = { params: Promise<Params> };

export function generateStaticParams(): Params[] {
  return gameIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  return game ? { title: `${game.title} 만들기` } : {};
}

/**
 * 커스터마이즈 에디터 진입점 (IDE-006)
 *
 * 스키마(`GameDefinition`)를 클라이언트 컴포넌트에 그대로 넘긴다 — 폼도
 * 미리보기도 이 안에서 게임을 몰라도 되게 스키마만 읽는다.
 */
export default async function EditGamePage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href={`/games/${game.id}`}
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← {game.title}
        {roParticle(game.title)} 돌아가기
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        {game.title} 만들기
      </h1>
      <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-400">
        등번호·팀 이름·팀 색을 바꾸면 오른쪽 미리보기에 바로 반영된다. 입력은
        이 브라우저에 남아 새로고침해도 그대로다.
      </p>
      <EditorClient game={game} />
    </div>
  );
}

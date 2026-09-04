import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { gameIds, getGame } from '@/lib/games';
import { roParticle } from '@/lib/korean';

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
 * 커스터마이즈 에디터 진입점 (IDE-005 수용 기준: "상세 페이지에서 에디터로
 * 이동하는 경로가 동작한다").
 *
 * 실제 편집 UI는 `IDE-006`의 몫이다. 이 페이지는 그 전까지 경로가 404가
 * 아니라는 것만 보장하는 자리표시자다 — `IDE-006`이 이 파일을 채운다.
 */
export default async function EditGamePage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
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
      <p className="mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
        등번호·팀 이름·팀 색을 바꾸고 배율을 골라 인쇄하는 에디터는 아직 준비
        중이다. 여기까지 오는 경로는 이미 연결돼 있으니, 조금만 기다려 달라.
      </p>
    </div>
  );
}

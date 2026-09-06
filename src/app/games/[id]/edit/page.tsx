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
 *
 * 폭을 넓게 잡고 위아래 여백은 좁힌다. 미리보기를 폭 전체로 놓는 배치라
 * (`EditorClient`) 페이지가 좁으면 미리보기가 그만큼 작아지고, 세로 여백은
 * 곧장 미리보기 높이에서 빠진다(2026-09-06 레이아웃 정리).
 */
export default async function EditGamePage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <Link
        href={`/games/${game.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {game.title}
        {roParticle(game.title)} 돌아가기
      </Link>
      {/* 설명 문단은 두지 않는다(2026-09-06 사용자 요청 — "최대한 간결하고
          직관적으로"). 미리보기가 곧 설명이다: 바꾸면 바로 보이고, 마커는 끌면
          움직인다. */}
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {game.title} 만들기
      </h1>
      <EditorClient game={game} />
    </div>
  );
}

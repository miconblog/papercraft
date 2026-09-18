import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { gameIds, getGame } from '@/lib/games';
import { movableSlots } from '@/lib/schema';
import { CommentSection } from '@/components/comments/CommentSection';
import { CommentSectionFallback } from '@/components/comments/CommentSectionFallback';
import { EditorClient } from '@/components/editor/EditorClient';
import { JsonLd } from '@/components/JsonLd';
import { ShareSection } from '@/components/share/ShareSection';
import { OPEN_GRAPH_BASE } from '@/lib/site';
import { breadcrumbLd, gameLd } from '@/lib/structured-data';

type Params = { id: string };
type Props = { params: Promise<Params> };

export function generateStaticParams(): Params[] {
  return gameIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return {};

  return {
    title: `${game.title} 만들기`,
    description: game.tagline,
    // 밖에서 이 주소를 나눌 때 보이는 것은 "만들기 화면"이 아니라 게임이다 —
    // 카탈로그·공유 링크(`/admin/share`)가 가리키는 주소가 여기다.
    // 자기 주소를 대표로 적는다. 공유 링크에는 utm 이 붙어 오므로, 적지 않으면
    // `?utm_source=…` 가 붙은 주소가 저마다 다른 페이지로 실린다.
    alternates: { canonical: `/games/${id}` },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      type: 'website',
      title: game.title,
      description: game.tagline,
      url: `/games/${id}`,
    },
  };
}

/**
 * 게임 화면 = 커스터마이즈 에디터 (IDE-006)
 *
 * 스키마(`GameDefinition`)를 클라이언트 컴포넌트에 그대로 넘긴다 — 폼도
 * 미리보기도 이 안에서 게임을 몰라도 되게 스키마만 읽는다.
 *
 * **카탈로그에서 누르면 곧장 여기로 온다**(2026-09-12 사용자 요청). 전에는
 * 소개 페이지를 거쳐 "만들기"를 한 번 더 눌러야 했는데, 고르고 나서 하고 싶은
 * 일이 늘 만들기였다. 소개와 게임 방법은 `./rules`로 옮기고 여기서 링크한다.
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
      <JsonLd
        data={[
          gameLd(game, `/games/${game.id}`),
          breadcrumbLd([{ name: game.title, path: `/games/${game.id}` }]),
        ]}
      />
      {/* 왼쪽은 목록으로, 오른쪽은 게임 방법이다. 규칙은 이제 이 화면에 없고
          (`./rules`), 놀다가 되짚을 것이라 늘 한 번에 닿아야 한다. */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 목록으로
        </Link>
        <Link
          href={`/games/${game.id}/rules`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {game.title} 게임 방법
        </Link>
      </div>
      {/* 설명 문단은 여전히 두지 않는다(2026-09-06 사용자 요청 — "최대한
          간결하고 직관적으로"). 다만 끌어서 옮길 수 있다는 것만은 보지 않으면
          모르므로, 제목 옆에 한 줄로 붙인다(2026-09-08 사용자 요청).

          끌 수 있는 슬롯이 없는 게임에서는 거짓말이 되므로 그때는 감춘다 —
          이 페이지는 게임을 모르는 채로 서야 한다. */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {game.title} 만들기
        </h1>
        {movableSlots(game).length > 0 && (
          <p className="text-sm text-muted-foreground">
            선수를 드래그해서 위치를 직접 바꿔보세요.
          </p>
        )}
      </div>
      <EditorClient game={game} />

      {/* 만들기가 끝난 자리에 나누기와 이야기를 놓는다 (IDE-029).
          미리보기 위로 올리면 만들러 온 사람의 길을 막고, 미리보기는 이 화면에서
          폭을 전부 쓰는 물건이라 옆에 세울 자리도 없다. */}
      <div className="mt-10 space-y-10 border-t border-border pt-8">
        <ShareSection
          path={`/games/${game.id}`}
          title={game.title}
          description={game.tagline}
          // 공유 카드의 그림은 `opengraph-image.tsx` 가 그리는 그것이다 —
          // 카카오톡 카드와 다른 그림을 쓰면 같은 링크가 앱마다 달라 보인다.
          imagePath={`/games/${game.id}/opengraph-image`}
        />
        {/* 댓글만 경계 뒤에 둔다 — 미리보기와 폼은 저장소를 기다리지 않는다. */}
        <Suspense fallback={<CommentSectionFallback />}>
          <CommentSection kind="game" targetId={game.id} />
        </Suspense>
      </div>
    </div>
  );
}

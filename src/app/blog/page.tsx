import type { Metadata } from 'next';
import Link from 'next/link';
import { PenLineIcon } from 'lucide-react';
import { PostCard } from '@/components/blog/PostCard';
import { publishedPosts } from '@/lib/blog/posts';

/**
 * 공방 일지 목록 (IDE-023)
 *
 * 경로는 `/blog` 다(2026-09-09 사용자 결정). `/log` · `/diary` · `/making` 을
 * 놓고 보다가 사용자가 "개인 블로그와 성격이 같다"며 고른 이름이다 — 설명이
 * 필요 없고, 주소만 보고 무엇이 있는 곳인지 안다.
 *
 * 안 낸 글은 `publishedPosts` 가 뺀다. **60초마다 다시 그려지므로** 게시
 * 시각이 지나면 사람이 아무것도 하지 않아도 카드가 붙는다 — 홈의 게임 목록과
 * 같은 방식이다(IDE-022).
 */
/**
 * 60초마다 다시 그린다 — `RENDER_REVALIDATE_S` 와 같은 값이다(리터럴이어야
 * 해서 상수를 못 쓴다. 홈이 같은 이유로 숫자를 적어 두고 있다).
 */
export const revalidate = 60;

const TITLE = '공방 일지';
const DESCRIPTION =
  '옛 인쇄본을 다시 그리며 겪은 것들 — 종이로 뽑고 접고 아이와 놀아 본 기록.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: '/blog',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function BlogIndexPage() {
  const posts = await publishedPosts();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← 게임 목록으로
      </Link>

      <h1 className="mt-4 flex items-center gap-2 text-3xl font-bold tracking-tight">
        <PenLineIcon className="size-7 text-retro-teal" aria-hidden />
        {TITLE}
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        {DESCRIPTION}
      </p>

      {posts.length === 0 ? (
        // Supabase 에 닿지 못해도 여기까지는 뜬다 — 글 자리만 빈다.
        <p className="mt-10 text-muted-foreground">아직 쓴 글이 없다.</p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </ul>
      )}
    </div>
  );
}

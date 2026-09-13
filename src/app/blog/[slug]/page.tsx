import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostArticle } from '@/components/blog/PostArticle';
import { CommentSection } from '@/components/comments/CommentSection';
import { CommentSectionFallback } from '@/components/comments/CommentSectionFallback';
import { ShareSection } from '@/components/share/ShareSection';
import { isPublished, postBySlug, type Post } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';

type Props = { params: Promise<{ slug: string }> };

/**
 * 공방 일지 글 하나 (IDE-023)
 *
 * **안 낸 글은 여기서 절대 안 나온다.** 두 겹으로 막는다.
 *
 * 1. 문지기(`proxy.ts`)가 낸 글의 슬러그만 통과시킨다. 판정을 페이지가 아니라
 *    거기 둔 이유는 `IDE-022` 와 같다 — 여기서 쿠키를 읽으면 글 화면이 통째로
 *    정적 렌더링에서 빠진다.
 * 2. 그래도 **이 페이지가 스스로 한 번 더 본다.** matcher 한 줄이 바뀌면 문지기는
 *    조용히 사라지는데, 그때 새어 나가는 것이 아직 세상에 안 낸 글이다.
 *
 * 2번을 붙일 수 있게 된 것은 **미리보기를 `/admin` 아래로 옮긴 덕**이다
 * (2026-09-09 사용자 제안). 그전에는 관리자가 이 주소로 초안을 봐야 해서
 * 페이지가 초안을 거절할 수 없었다 — 관리자인지 알려면 쿠키를 읽어야 하니까.
 * 이제 이 화면은 **아무의 것도 아닌 공개 화면**이고, 그래서 더 단단하다.
 *
 * 본문은 마크다운 원문에서 그때 그린다. HTML 문자열을 거치지 않아 `<script>` 든
 * `onerror` 든 글자로 나온다(`lib/blog/markdown.tsx`).
 */

/**
 * 60초마다 다시 그린다 — `RENDER_REVALIDATE_S` 와 같은 값이다(리터럴이어야
 * 해서 상수를 못 쓴다. 홈이 같은 이유로 숫자를 적어 두고 있다).
 */
export const revalidate = 60;

/** 낸 글만. 아니면 `null` — 부르는 쪽이 없는 글로 다룬다. */
async function openPost(slug: string): Promise<Post | null> {
  const post = await postBySlug(slug);
  return post && isPublished(post) ? post : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await openPost(slug);
  if (!post) return {};

  const description = postSummary(post);
  const url = `/blog/${post.slug}`;

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description,
      publishedTime:
        post.publishAt === null
          ? undefined
          : new Date(post.publishAt).toISOString(),
      modifiedTime: new Date(post.updatedAt).toISOString(),
      // 대표 사진이 없으면 사이트 기본 이미지가 그대로 쓰인다.
      ...(post.coverUrl ? { images: [{ url: post.coverUrl }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      ...(post.coverUrl ? { images: [post.coverUrl] } : {}),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await openPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/blog"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← 공방 일지 목록으로
      </Link>

      <div className="mt-6">
        <PostArticle post={post} />
      </div>

      {/* 글을 다 읽은 자리에 나누기와 이야기를 놓는다 (IDE-029).
          게임 화면과 **같은 컴포넌트**다 — 두 화면에서 댓글 모양이 달라지면
          같은 사이트로 안 읽힌다. */}
      <div className="mt-12 space-y-10 border-t border-border pt-8">
        <ShareSection
          path={`/blog/${post.slug}`}
          title={post.title}
          description={postSummary(post)}
          // 대표 사진이 있으면 그것, 없으면 사이트 공유 이미지다 —
          // `generateMetadata` 가 OG 에 세우는 것과 같은 순서다.
          imagePath={post.coverUrl ?? '/opengraph-image'}
        />
        {/* 댓글만 경계 뒤에 둔다 — 글은 저장소를 한 번 더 기다리지 않는다. */}
        <Suspense fallback={<CommentSectionFallback />}>
          <CommentSection kind="post" targetId={post.id} />
        </Suspense>
      </div>
    </article>
  );
}

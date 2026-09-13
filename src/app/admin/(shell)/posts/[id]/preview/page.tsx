import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { PencilIcon } from 'lucide-react';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { PostArticle } from '@/components/blog/PostArticle';
import { isPublished, postById } from '@/lib/blog/posts';
import { formatKst } from '@/lib/kst';

export const metadata: Metadata = {
  title: '미리보기',
  robots: { index: false, follow: false },
};

/** 방금 저장한 글이 보여야 하는 화면이다. 캐시할 것이 없다. */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/**
 * 글 미리보기 (IDE-023)
 *
 * **2026-09-09 사용자 제안으로 `/admin` 아래로 옮겼다.** 그전에는 관리자가
 * 공개 주소(`/blog/<슬러그>`)로 초안을 봤는데, 두 가지가 걸렸다.
 *
 * 1. **쿠키가 닿아야만 보였다.** `IDE-022` 전에 로그인한 브라우저는 인증 쿠키가
 *    `/admin` 에 갇혀 있어서, 관리자 화면은 열리는데 미리보기만 404 가 났다.
 *    미리보기가 여기 있으면 그 문제가 아예 생기지 않는다 — 쿠키가 반드시 닿는
 *    경로다.
 * 2. **초안이 공개 주소에 존재해야 했다.** 그 탓에 공개 화면이 초안을 스스로
 *    거절할 수 없었다(관리자인지 알려면 쿠키를 읽어야 하고, 읽으면 정적 렌더링이
 *    깨진다). 옮기고 나서 그 화면에 검사를 한 겹 더 넣었다.
 *
 * 그리는 것은 공개 화면과 **같은 컴포넌트**(`PostArticle`)다. 두 벌로 두면
 * 미리 본 것과 나가는 것이 어긋나 미리 본 뜻이 없다. 다른 것은 관리자 껍데기
 * (왼쪽 메뉴)가 함께 보인다는 점뿐이다.
 */
export default async function AdminPostPreviewPage({ params }: Props) {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const { id } = await params;
  // 새 글은 아직 줄이 없다 — 저장하기 전에는 미리 볼 것도 없다.
  const post = id === 'new' ? null : await postById(id);
  if (!post) notFound();

  const open = isPublished(post);

  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/posts/${post.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
        >
          <PencilIcon className="size-3.5" aria-hidden />
          고치기로 돌아가기
        </Link>
        {open && (
          // 이미 낸 글이면 진짜 주소도 열린다 — 거기서 봐야 보이는 것들이 있다
          // (헤더·바닥글·글자 폭).
          <Link
            href={`/blog/${post.slug}`}
            className="text-sm underline underline-offset-4"
          >
            공개된 주소로 보기 →
          </Link>
        )}
      </div>

      <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
        {open ? (
          <>
            <strong>공개 중인 글</strong>입니다 —{' '}
            {post.publishAt !== null &&
              `${formatKst(post.publishAt)}에 냈습니다.`}
          </>
        ) : post.hidden ? (
          <>
            <strong>내려 둔 글</strong>입니다. 지금은 아무에게도 안 보입니다.
          </>
        ) : post.publishAt === null ? (
          <>
            아직 <strong>내지 않은 글</strong>입니다. 이 화면에서만 보입니다.
          </>
        ) : (
          <>
            <strong>{formatKst(post.publishAt)}</strong> 에 나갈 글입니다.
            그때까지는 이 화면에서만 보입니다.
          </>
        )}
      </p>

      {/* 편집 화면의 「미리보기」는 새 창으로 연다(2026-09-10). 새 창에는 **저장한
          글**만 보여서, 이것을 안 적으면 방금 쓴 문장이 없는 걸 보고 미리보기가
          고장 났다고 여긴다. */}
      <p className="mt-1 text-xs text-muted-foreground">
        <strong>마지막으로 저장한 내용</strong>입니다. 쓰던 글은 저장해야 여기에
        반영됩니다.
      </p>

      <p className="mt-1 font-mono text-xs text-muted-foreground">
        /blog/{post.slug}
      </p>

      {/* 공개 화면과 같은 폭·같은 컴포넌트다. */}
      <article className="mt-8">
        <PostArticle post={post} />
      </article>
    </div>
  );
}

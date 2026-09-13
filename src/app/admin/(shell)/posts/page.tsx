import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  EyeIcon,
  EyeOffIcon,
  CalendarClockIcon,
  PencilIcon,
  PlusIcon,
} from 'lucide-react';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { allPosts, isPublished, type Post } from '@/lib/blog/posts';
import { formatKst } from '@/lib/kst';
import { removePost, togglePostHidden } from './actions';

export const metadata: Metadata = {
  title: '공방 일지',
  robots: { index: false, follow: false },
};

/** 방금 저장한 값이 보여야 하는 화면이다. 캐시할 것이 없다. */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; confirm?: string }>;
};

const BUTTON =
  'rounded-full border border-border px-4 py-2 text-xs transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

/** 지금 이 글이 어떤 상태인가 — 한 줄로 읽히게 한다. */
function StatusLabel({ post }: { post: Post }) {
  if (post.hidden) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-retro-brick">
        <EyeOffIcon className="size-3.5" aria-hidden />
        내려 둠
        {post.publishAt !== null &&
          ` · ${formatKst(post.publishAt)} 예약은 남아 있음`}
      </span>
    );
  }
  if (post.publishAt === null) {
    return <span className="text-xs text-muted-foreground">초안 — 안 냄</span>;
  }
  if (!isPublished(post)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-retro-brick">
        <CalendarClockIcon className="size-3.5" aria-hidden />
        {formatKst(post.publishAt)} 게시 예정
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      공개 중 · {formatKst(post.publishAt)}에 냄
    </span>
  );
}

/**
 * 공방 일지 목록 (IDE-023)
 *
 * 글을 만들고 고르는 자리다. 쓰는 것은 `[id]` 화면이 맡는다 — 좁은 화면에서
 * 목록과 편집기가 한 페이지에 있으면 둘 다 쓰기 어렵다.
 *
 * `/admin` 아래라 **방문 통계에 잡히지 않는다**(`analytics/excluded.ts`).
 * 공개 쪽 `/blog` 는 그대로 잡힌다.
 */
export default async function AdminPostsPage({ searchParams }: Props) {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const { saved, error, confirm } = await searchParams;
  const posts = await allPosts();

  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">공방 일지</h1>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <PlusIcon className="size-4" aria-hidden />새 글
        </Link>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        게시 시각을 지정한 글은 그때까지{' '}
        <strong>목록에도 없고 주소로 들어가도 404</strong>입니다. 시각을 비우면
        초안입니다. 로그인한 이 브라우저에서는 내기 전에도 열어 볼 수 있습니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        시각은 <strong>한국 시간(KST)</strong> 입니다. 게시 시각이 지나면 사람이
        아무것도 하지 않아도 열립니다 — 주소로 들어오는 길은 30초 안에, 목록은
        방문이 있고 나서 1분 안에 반영됩니다.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          {saved}
        </p>
      )}

      {posts.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          아직 쓴 글이 없다. 저장소에 닿지 못했을 때도 이렇게 보인다.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {posts.map((post) => (
            <li key={post.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{post.title}</h2>
                <StatusLabel post={post} />
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                /blog/{post.slug}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/posts/${post.id}`}
                  className={`inline-flex items-center gap-1.5 ${BUTTON}`}
                >
                  <PencilIcon className="size-3.5" aria-hidden />
                  고치기
                </Link>

                {/* 공개 주소가 아니라 `/admin` 아래다 — 안 낸 글은 공개
                    주소에 아예 존재하지 않는다(2026-09-09 사용자 제안). */}
                <Link
                  href={`/admin/posts/${post.id}/preview`}
                  className={`inline-flex items-center gap-1.5 ${BUTTON}`}
                >
                  <EyeIcon className="size-3.5" aria-hidden />
                  미리보기
                </Link>

                {/* 낸 글에만 뜬다. 초안에는 내릴 것이 없다. */}
                {post.publishAt !== null && (
                  <form action={togglePostHidden}>
                    <input type="hidden" name="id" value={post.id} />
                    <input
                      type="hidden"
                      name="hide"
                      value={post.hidden ? '0' : '1'}
                    />
                    <button
                      type="submit"
                      className={
                        post.hidden
                          ? 'rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
                          : 'rounded-full border border-retro-brick/50 px-4 py-2 text-xs font-medium text-retro-brick transition-colors outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
                      }
                    >
                      {post.hidden ? '다시 올리기' : '지금 내리기'}
                    </button>
                  </form>
                )}

                {/* 되돌릴 수 없어서 두 번 눌러야 한다 — 좁은 화면에서 옆
                    버튼을 잘못 누른 것이 글을 지우는 일이 되면 안 된다. */}
                {confirm === post.id ? (
                  <form action={removePost} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={post.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-destructive px-4 py-2 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-destructive/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    >
                      정말 지운다
                    </button>
                    <Link href="/admin/posts" className={BUTTON}>
                      그만두기
                    </Link>
                  </form>
                ) : (
                  <Link
                    href={`/admin/posts?confirm=${post.id}`}
                    className="rounded-full border border-destructive/40 px-4 py-2 text-xs text-destructive transition-colors outline-none hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    지우기
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        저장소에 닿지 못하면 <strong>글이 하나도 없는 것</strong>으로 읽힙니다.
        게임 쪽과 반대인데, 글은 이 저장소가 유일한 원본이라 안 낸 글이 사고로
        세상에 나가지 않는 쪽을 골랐습니다.
      </p>
    </div>
  );
}

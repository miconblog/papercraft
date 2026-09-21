import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  EyeIcon,
  EyeOffIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from 'lucide-react';
import { PageSizeSelect } from '@/components/admin/PageSizeSelect';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import {
  PAGE_SIZES,
  listHref,
  listViewParams,
  paginate,
  readListView,
  type ListView,
} from '@/lib/blog/adminListView';
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
  searchParams: Promise<{
    saved?: string;
    error?: string;
    confirm?: string;
    draftPage?: string;
    draftSize?: string;
    pubPage?: string;
    pubSize?: string;
  }>;
};

const BUTTON =
  'rounded-full border border-border px-3 py-1 text-xs transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

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
    // 초안 섹션에만 있으니 "초안"은 섹션 제목이 말한다. 정렬 기준인 만든
    // 시각을 보인다(2026-09-22 사용자 요청). 모르면(0) 1970년을 찍지 않는다.
    if (post.createdAt === 0) return null;
    return (
      <span className="text-xs text-muted-foreground">
        {formatKst(post.createdAt)}
      </span>
    );
  }
  if (!isPublished(post)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-retro-brick">
        <CalendarClockIcon className="size-3.5" aria-hidden />
        {formatKst(post.publishAt)} 게시 예정
      </span>
    );
  }
  // 발행 섹션에 있으니 "공개 중"은 섹션 제목이 말한다. 정렬 기준인 게시
  // 시각만 남긴다(2026-09-22 사용자 요청).
  return (
    <span className="text-xs text-muted-foreground">
      {formatKst(post.publishAt)}
    </span>
  );
}

/** 액션이 끝나고 보던 쪽으로 돌아오게 폼에 실어 보낸다. */
function ViewInputs({ view }: { view: ListView }) {
  return Object.entries(listViewParams(view)).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

/** 글 한 줄 — 제목(누르면 고치기)·상태와 손댈 단추들. */
function PostItem({
  post,
  view,
  confirm,
}: {
  post: Post;
  view: ListView;
  confirm?: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      {/* 한 줄에 다 싣는다(2026-09-22 사용자 요청). 제목이 길면 말줄임하고,
          주소는 제목에 올려 보면 뜬다. 좁은 화면에서는 단추가 아래로 접힌다. */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        {/* 제목이 곧 고치기 링크다 — 따로 단추를 두지 않는다(2026-09-22
            사용자 요청). */}
        <h3 className="min-w-0 truncate font-medium">
          <Link
            href={`/admin/posts/${post.id}`}
            title={`고치기 · /blog/${post.slug}`}
            className="underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {post.title}
          </Link>
        </h3>
        <span className="shrink-0">
          <StatusLabel post={post} />
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
            <input type="hidden" name="hide" value={post.hidden ? '0' : '1'} />
            <ViewInputs view={view} />
            <button
              type="submit"
              className={
                post.hidden
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
                  : 'rounded-full border border-retro-brick/50 px-3 py-1 text-xs font-medium text-retro-brick transition-colors outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
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
            <ViewInputs view={view} />
            <button
              type="submit"
              className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-destructive/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              정말 지운다
            </button>
            <Link href={listHref(view)} scroll={false} className={BUTTON}>
              그만두기
            </Link>
          </form>
        ) : (
          <Link
            href={listHref(view, { confirm: post.id })}
            scroll={false}
            className="rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive transition-colors outline-none hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            지우기
          </Link>
        )}
      </div>
    </li>
  );
}

/** 게시 시각이 없는 글. 예약·내려 둔 글은 시각이 있으니 발행 쪽이다. */
const isDraft = (post: Post): boolean => post.publishAt === null;

const PAGER_LINK =
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

/**
 * 초안·발행 한 묶음. 비어 있어도 제목은 남겨 둔다 — 어디에 뭐가 없는지 보이게.
 *
 * 쪽은 섹션마다 따로 넘긴다(2026-09-22 사용자 요청). 한 쪽이면 넘길 단추는
 * 숨기고 몇 개씩 볼지만 남긴다.
 */
function PostSection({
  kind,
  title,
  posts,
  view,
  confirm,
}: {
  kind: 'draft' | 'pub';
  title: string;
  posts: Post[];
  view: ListView;
  confirm?: string;
}) {
  const pageKey = `${kind}Page` as const;
  const sizeKey = `${kind}Size` as const;
  const shown = paginate(posts, view[pageKey], view[sizeKey]);
  const toPage = (page: number) => listHref({ ...view, [pageKey]: page });
  // 크기를 바꾸면 1쪽부터 — 5쪽을 보다 50개씩으로 바꾸면 5쪽이 없다.
  const sizeHrefs = Object.fromEntries(
    PAGE_SIZES.map((size) => [
      String(size),
      listHref({ ...view, [sizeKey]: size, [pageKey]: 1 }),
    ]),
  );

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {title}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {posts.length}
          </span>
        </h2>
        {posts.length > 0 && (
          <PageSizeSelect
            label={`${title} 한 쪽에 보일 개수`}
            value={view[sizeKey]}
            hrefs={sizeHrefs}
          />
        )}
      </div>
      {posts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">없음</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {shown.items.map((post) => (
            <PostItem key={post.id} post={post} view={view} confirm={confirm} />
          ))}
        </ul>
      )}
      {shown.pages > 1 && (
        <nav
          aria-label={`${title} 쪽 넘기기`}
          className="mt-3 flex items-center justify-center gap-2 text-xs"
        >
          {shown.page > 1 ? (
            <Link
              href={toPage(shown.page - 1)}
              scroll={false}
              className={PAGER_LINK}
            >
              <ChevronLeftIcon className="size-3.5" aria-hidden />
              이전
            </Link>
          ) : (
            <span className={`${PAGER_LINK} opacity-40`} aria-hidden>
              <ChevronLeftIcon className="size-3.5" />
              이전
            </span>
          )}
          <span className="tabular-nums text-muted-foreground">
            {shown.page} / {shown.pages}
          </span>
          {shown.page < shown.pages ? (
            <Link
              href={toPage(shown.page + 1)}
              scroll={false}
              className={PAGER_LINK}
            >
              다음
              <ChevronRightIcon className="size-3.5" aria-hidden />
            </Link>
          ) : (
            <span className={`${PAGER_LINK} opacity-40`} aria-hidden>
              다음
              <ChevronRightIcon className="size-3.5" />
            </span>
          )}
        </nav>
      )}
    </section>
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

  const query = await searchParams;
  const { saved, error, confirm } = query;
  const view = readListView((key) => query[key]);
  const posts = await allPosts();
  // 둘 다 최신이 위다. 초안은 만든 순, 발행은 게시 시각 순
  // (2026-09-22 사용자 요청).
  const drafts = posts
    .filter(isDraft)
    .sort((a, b) => b.createdAt - a.createdAt);
  const published = posts
    .filter((post) => !isDraft(post))
    .sort(
      (a, b) =>
        (b.publishAt ?? 0) - (a.publishAt ?? 0) || b.createdAt - a.createdAt,
    );

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
        <>
          <PostSection
            kind="draft"
            title="초안"
            posts={drafts}
            view={view}
            confirm={confirm}
          />
          <PostSection
            kind="pub"
            title="발행"
            posts={published}
            view={view}
            confirm={confirm}
          />
        </>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        저장소에 닿지 못하면 <strong>글이 하나도 없는 것</strong>으로 읽힙니다.
        게임 쪽과 반대인데, 글은 이 저장소가 유일한 원본이라 안 낸 글이 사고로
        세상에 나가지 않는 쪽을 골랐습니다.
      </p>
    </div>
  );
}

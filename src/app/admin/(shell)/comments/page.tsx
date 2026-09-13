import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ClockIcon, Trash2Icon } from 'lucide-react';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { allPosts } from '@/lib/blog/posts';
import {
  ADMIN_PAGE_SIZE,
  allComments,
  isApproved,
  type Comment,
} from '@/lib/comments/comments';
import { getGame } from '@/lib/games';
import { formatKst } from '@/lib/kst';
import { Button } from '@/components/ui/button';
import { approveComment, removeComment, unapproveComment } from './actions';

export const metadata: Metadata = {
  title: '댓글',
  robots: { index: false, follow: false },
};

/** 방금 승인한 값이 보여야 하는 화면이다. 캐시할 것이 없다. */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ done?: string; error?: string; confirm?: string }>;
};

/** 댓글이 달린 곳의 이름과 주소. 대상이 사라졌으면 이름 대신 그 사실을 적는다. */
type Where = { label: string; href: string | null };

/**
 * 관리자 댓글 화면 — 승인이 여기서만 일어난다 (IDE-029)
 *
 * **대기 중인 것이 위다.** 이 화면을 여는 이유가 그것뿐이라, 승인된 목록은 아래에
 * 접어 두지 않고 그냥 뒤에 놓는다 — 잘못 승인한 것을 되돌리는 것도 여기서 한다.
 *
 * 대상 이름을 붙이려면 게임 등록소와 글 표를 봐야 한다. 게임은 코드에 있고(공짜),
 * 글은 한 번 읽는다. 댓글 줄마다 글을 따로 물으면 같은 표를 수십 번 두드린다.
 */
export default async function AdminCommentsPage({ searchParams }: Props) {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const { done, error, confirm } = await searchParams;
  const [comments, posts] = await Promise.all([allComments(), allPosts()]);
  const postById = new Map(posts.map((post) => [post.id, post]));

  const whereOf = (comment: Comment): Where => {
    if (comment.kind === 'game') {
      const game = getGame(comment.targetId);
      return game
        ? { label: game.title, href: `/games/${game.id}` }
        : { label: `없는 게임(${comment.targetId})`, href: null };
    }
    const post = postById.get(comment.targetId);
    return post
      ? { label: post.title, href: `/blog/${post.slug}` }
      : { label: '지워진 글', href: null };
  };

  const pending = comments.filter((comment) => !isApproved(comment));
  const approved = comments.filter(isApproved);

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">댓글</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        댓글은 <strong>승인할 때까지 아무에게도 보이지 않습니다</strong> — 쓴
        사람에게도 그렇습니다. 승인을 되돌리면 다시 대기로 내려갑니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        승인하면 그 게임·글 페이지가 <strong>곧바로</strong> 다시 그려집니다.
        최근 {ADMIN_PAGE_SIZE}개까지 보여 줍니다.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {done && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          {done}
        </p>
      )}

      <Group
        title="승인 대기"
        count={pending.length}
        empty="대기 중인 댓글이 없습니다."
        comments={pending}
        whereOf={whereOf}
        confirm={confirm}
      />
      <Group
        title="공개 중"
        count={approved.length}
        empty="공개된 댓글이 없습니다."
        comments={approved}
        whereOf={whereOf}
        confirm={confirm}
      />
    </div>
  );
}

function Group({
  title,
  count,
  empty,
  comments,
  whereOf,
  confirm,
}: {
  title: string;
  count: number;
  empty: string;
  comments: Comment[];
  whereOf: (comment: Comment) => Where;
  /** 지우기를 한 번 누른 댓글의 id. 그 줄만 두 번째 버튼을 보여 준다. */
  confirm: string | undefined;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight">
        {title}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
          {count}
        </span>
      </h2>

      {comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {comments.map((comment) => (
            <li key={comment.id} className="p-4">
              <Row
                comment={comment}
                where={whereOf(comment)}
                confirming={confirm === comment.id}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  comment,
  where,
  confirming,
}: {
  comment: Comment;
  where: Where;
  confirming: boolean;
}) {
  const approved = isApproved(comment);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{comment.nickname}</span>
          {where.href ? (
            <Link
              href={where.href}
              className="text-xs text-muted-foreground hover:underline"
            >
              {where.label}
            </Link>
          ) : (
            <span className="text-xs text-retro-brick">{where.label}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {approved ? (
            `${formatKst(comment.createdAt)} 작성`
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-retro-brick">
              <ClockIcon className="size-3.5" aria-hidden />
              {formatKst(comment.createdAt)} 작성 · 대기
            </span>
          )}
        </span>
      </div>

      {/* 화면에서와 똑같이 글자로만 그린다 — 관리자 화면이라고 서식을 해석해
          주면, 스팸이 노리는 곳이 정확히 여기가 된다. */}
      <p className="mt-2 text-sm break-words whitespace-pre-wrap">
        {comment.body}
      </p>

      {/* 조작을 폼 셋으로 갈라 둔다 — 하나를 누르다 다른 하나가 조용히 바뀌지
          않게 한다(`admin/games` 가 정한 규칙이다). */}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={approved ? unapproveComment : approveComment}>
          <input type="hidden" name="id" value={comment.id} />
          <input type="hidden" name="kind" value={comment.kind} />
          <input type="hidden" name="targetId" value={comment.targetId} />
          <Button type="submit" variant={approved ? 'outline' : 'default'}>
            {approved ? '대기로 돌리기' : '승인'}
          </Button>
        </form>

        {/* 되돌릴 수 없어서 두 번 눌러야 한다 — `admin/posts` 가 글 지우기에
            정한 방식 그대로다. 좁은 화면에서 「승인」 옆을 잘못 누른 것이 남의
            댓글을 지우는 일이 되면 안 된다. */}
        {confirming ? (
          <form action={removeComment} className="flex items-center gap-2">
            <input type="hidden" name="id" value={comment.id} />
            <input type="hidden" name="kind" value={comment.kind} />
            <input type="hidden" name="targetId" value={comment.targetId} />
            <Button type="submit" variant="destructive">
              <Trash2Icon className="size-4" aria-hidden />
              정말 지운다
            </Button>
            <Link
              href="/admin/comments"
              className="text-xs text-muted-foreground hover:underline"
            >
              그만두기
            </Link>
          </form>
        ) : (
          <Link
            href={`/admin/comments?confirm=${comment.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 text-sm text-destructive transition-colors outline-none hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <Trash2Icon className="size-4" aria-hidden />
            지우기
          </Link>
        )}
      </div>
    </>
  );
}

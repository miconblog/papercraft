import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ClockIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { allPosts, type Post } from '@/lib/blog/posts';
import { getGame } from '@/lib/games';
import { formatKst } from '@/lib/kst';
import { mentionsSendEnabled } from '@/lib/mentions/config';
import {
  ADMIN_PAGE_SIZE,
  allMentions,
  isApproved,
  type Mention,
} from '@/lib/mentions/mentions';
import { recentSent, type SentMention } from '@/lib/mentions/sent';
import { Button } from '@/components/ui/button';
import {
  approveMention,
  removeMention,
  resendMentions,
  unapproveMention,
} from './actions';

export const metadata: Metadata = {
  title: '멘션',
  robots: { index: false, follow: false },
};

/** 방금 승인한 값이 보여야 하는 화면이다. 캐시할 것이 없다. */
export const dynamic = 'force-dynamic';

/**
 * 「다시 보내기」는 남의 서버들을 기다린다 (IDE-046).
 *
 * 서버 액션의 한도는 그것을 부른 화면에서 정한다. 링크 스무 곳을 네 곳씩 나눠
 * 두드리면 느린 곳이 섞였을 때 기본 한도를 넘는다.
 */
export const maxDuration = 60;

type Props = {
  searchParams: Promise<{ done?: string; error?: string; confirm?: string }>;
};

/** 멘션이 붙은 곳의 이름과 주소. 대상이 사라졌으면 이름 대신 그 사실을 적는다. */
type Where = { label: string; href: string | null };

const VIA_LABEL = { webmention: '웹멘션', pingback: '핑백' } as const;

/**
 * 관리자 멘션 화면 — 받은 것을 승인하고, 보낸 것을 확인한다 (IDE-046)
 *
 * 댓글 화면(`admin/comments`)과 같은 뼈대다. **대기 중인 것이 위**이고, 지우기는
 * 두 번 눌러야 한다.
 *
 * 아래쪽의 「보낸 멘션」은 이 화면에만 있다. 보내기는 저장할 때 응답 뒤에서
 * 조용히 돌아서(`lib/mentions/send.ts`), 여기가 아니면 **갔는지 안 갔는지를 볼
 * 곳이 없다.**
 */
export default async function AdminMentionsPage({ searchParams }: Props) {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const { done, error, confirm } = await searchParams;
  const [mentions, sent, posts] = await Promise.all([
    allMentions(),
    recentSent(),
    allPosts(),
  ]);
  const postById = new Map(posts.map((post) => [post.id, post]));

  const whereOf = (mention: Mention): Where => {
    if (mention.kind === 'game') {
      const game = getGame(mention.targetId);
      return game
        ? { label: game.title, href: `/games/${game.id}` }
        : { label: `없는 게임(${mention.targetId})`, href: null };
    }
    const post = postById.get(mention.targetId);
    return post
      ? { label: post.title, href: `/blog/${post.slug}` }
      : { label: '지워진 글', href: null };
  };

  const pending = mentions.filter((mention) => !isApproved(mention));
  const approved = mentions.filter(isApproved);

  // 보낸 것은 글마다 묶는다 — 「다시 보내기」가 글 단위라서다. 최근에 보낸 글이
  // 위에 온다(`recentSent` 가 이미 최근 순이다).
  const sentByPost = new Map<string, SentMention[]>();
  for (const row of sent) {
    sentByPost.set(row.postId, [...(sentByPost.get(row.postId) ?? []), row]);
  }

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">멘션</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        다른 블로그가 이 사이트의 글 · 게임을 가리키면 웹멘션 · 핑백으로 알려
        옵니다. 받은 멘션은{' '}
        <strong>승인할 때까지 아무에게도 보이지 않습니다.</strong> 보낸 쪽이
        글을 고쳐 내용이 바뀌면 다시 대기로 내려옵니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
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
        empty="대기 중인 멘션이 없습니다."
        mentions={pending}
        whereOf={whereOf}
        confirm={confirm}
      />
      <Group
        title="공개 중"
        empty="공개된 멘션이 없습니다."
        mentions={approved}
        whereOf={whereOf}
        confirm={confirm}
      />

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="text-lg font-bold tracking-tight">보낸 멘션</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          글에 다른 블로그 링크를 걸고 저장하면, 글이 공개 중일 때 그 블로그에
          웹멘션(없으면 핑백)을 보냅니다. 예약해 둔 글은 열린 뒤 처음 읽힐 때
          나갑니다. 한 번 보낸 링크는 다시 보내지 않습니다.
        </p>
        {!mentionsSendEnabled() && (
          <p className="mt-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            이 환경에서는 멘션을 보내지 않습니다 — 운영 배포에서만 나갑니다.
          </p>
        )}

        {sentByPost.size === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            아직 보낸 멘션이 없습니다.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {[...sentByPost].map(([postId, rows]) => (
              <li key={postId} className="rounded-lg border border-border">
                <SentGroup post={postById.get(postId)} rows={rows} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Group({
  title,
  empty,
  mentions,
  whereOf,
  confirm,
}: {
  title: string;
  empty: string;
  mentions: Mention[];
  whereOf: (mention: Mention) => Where;
  /** 지우기를 한 번 누른 멘션의 id. 그 줄만 두 번째 버튼을 보여 준다. */
  confirm: string | undefined;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold tracking-tight">
        {title}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
          {mentions.length}
        </span>
      </h2>

      {mentions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {mentions.map((mention) => (
            <li key={mention.id} className="p-4">
              <Row
                mention={mention}
                where={whereOf(mention)}
                confirming={confirm === mention.id}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  mention,
  where,
  confirming,
}: {
  mention: Mention;
  where: Where;
  confirming: boolean;
}) {
  const approved = isApproved(mention);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="font-medium break-all">{mention.sourceHost}</span>
          <span className="text-xs text-muted-foreground">
            {VIA_LABEL[mention.via]} →
          </span>
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
            `${formatKst(mention.createdAt)} 받음`
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-retro-brick">
              <ClockIcon className="size-3.5" aria-hidden />
              {formatKst(mention.createdAt)} 받음 · 대기
            </span>
          )}
        </span>
      </div>

      {/* 공개 화면과 똑같이 글자로만 그린다 — 남의 서버가 준 값이다. 승인하기
          전에 **가서 읽어 보라고** 주소를 그대로 보여 준다. */}
      <p className="mt-2 text-sm font-medium break-words">
        {mention.title || '(제목 없음)'}
      </p>
      {mention.excerpt && (
        <p className="mt-1 text-sm break-words text-muted-foreground">
          {mention.excerpt}
        </p>
      )}
      <a
        href={mention.sourceUrl}
        target="_blank"
        rel="nofollow ugc noopener noreferrer"
        className="mt-1 block text-xs break-all text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {mention.sourceUrl}
      </a>

      {/* 조작을 폼 셋으로 갈라 둔다 — `admin/comments` 와 같은 규칙이다. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={approved ? unapproveMention : approveMention}>
          <input type="hidden" name="id" value={mention.id} />
          <input type="hidden" name="kind" value={mention.kind} />
          <input type="hidden" name="targetId" value={mention.targetId} />
          <Button type="submit" variant={approved ? 'outline' : 'default'}>
            {approved ? '대기로 돌리기' : '승인'}
          </Button>
        </form>

        {confirming ? (
          <form action={removeMention} className="flex items-center gap-2">
            <input type="hidden" name="id" value={mention.id} />
            <input type="hidden" name="kind" value={mention.kind} />
            <input type="hidden" name="targetId" value={mention.targetId} />
            <Button type="submit" variant="destructive">
              <Trash2Icon className="size-4" aria-hidden />
              정말 지운다
            </Button>
            <Link
              href="/admin/mentions"
              className="text-xs text-muted-foreground hover:underline"
            >
              그만두기
            </Link>
          </form>
        ) : (
          <Link
            href={`/admin/mentions?confirm=${mention.id}`}
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

const STATUS_LABEL = {
  sent: '보냄',
  failed: '실패',
  none: '받는 곳 없음',
} as const;

function SentGroup({
  post,
  rows,
}: {
  /** 글을 지우면 기록도 함께 가므로(017) 없을 일이 드물지만, 못 읽었을 수 있다. */
  post: Post | undefined;
  rows: SentMention[];
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        {post ? (
          <Link
            href={`/admin/posts/${post.id}`}
            className="text-sm font-medium hover:underline"
          >
            {post.title}
          </Link>
        ) : (
          <span className="text-sm text-retro-brick">찾을 수 없는 글</span>
        )}
        {post && (
          <form action={resendMentions}>
            <input type="hidden" name="postId" value={post.id} />
            <Button type="submit" variant="outline">
              <SendIcon className="size-4" aria-hidden />
              다시 보내기
            </Button>
          </form>
        )}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.targetUrl} className="p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 break-all">{row.targetUrl}</span>
              <span
                className={
                  row.status === 'failed'
                    ? 'text-xs font-medium text-retro-brick'
                    : 'text-xs text-muted-foreground'
                }
              >
                {STATUS_LABEL[row.status]}
                {row.via ? ` · ${VIA_LABEL[row.via]}` : ''} ·{' '}
                {formatKst(row.sentAt)}
              </span>
            </div>
            {row.status === 'failed' && row.detail && (
              <p className="mt-1 text-xs text-muted-foreground">
                {row.detail} 글을 다시 저장하면 한 번 더 보냅니다.
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

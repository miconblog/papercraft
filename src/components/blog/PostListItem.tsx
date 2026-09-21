import Link from 'next/link';
import type { Post } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';
import { formatKstDate } from '@/lib/kst';
import { TagList } from './TagList';

/**
 * 공방 일지 목록의 한 줄 (IDE-023)
 *
 * 카드가 아니라 **가로줄로 나뉜 목록**이다(2026-09-13 사용자 요청, 스크린샷으로
 * 지정). 왼쪽에 날짜, 오른쪽에 제목·발췌·더 읽기가 선다.
 * 날짜 칸은 넷 중 하나다. 날짜만 있을 때는 휑해서 다섯 중 하나로 줄였다가,
 * 사진이 날짜 밑으로 들어오면서 원래 폭으로 돌렸다 — 사진이 그만큼 커진다
 * (2026-09-22 사용자 요청).
 *
 * 카드 그리드를 버린 이유는 발췌 길이다. 한 줄에 카드 셋을 세우면 폭이 좁아
 * 본문을 서너 줄밖에 못 보여 주는데, 글은 제목만으로 고르기 어렵다 — 한 편에
 * 폭을 다 주면 여덟 줄쯤이 들어가서 **목록에서 읽고 고를 수 있다.**
 *
 * 대표 사진이 있으면 **날짜 밑**에 둔다(2026-09-22 사용자 요청). 날짜만 있던
 * 왼쪽 칸이 휑했고, 발췌 옆에 두면 사진이 발췌 폭을 먹는다 — 여기 두면 둘 다
 * 풀린다. 좁은 화면에서는 날짜 → 사진 → 제목 순으로 쌓인다.
 *
 * 날짜 칸이 `dl` 인 것은 "게시일: 2026년 9월 13일"이 뜻 그대로 이름과 값이라서다
 * — 화면에는 이름을 안 띄우지만(`sr-only`) 읽어 주는 쪽에는 남는다.
 */

/**
 * 목록 발췌 길이.
 *
 * OG 설명(160자)보다 길다 — 검색 결과 한 줄과 달리 여기는 읽고 고르는 자리다.
 */
const SUMMARY_LIMIT = 320;

export function PostListItem({
  post,
  activeTag = null,
}: {
  post: Post;
  /** 지금 이 태그로 걸러 놓은 목록이면 그 태그. 눌린 모양으로 선다. */
  activeTag?: string | null;
}) {
  const href = `/blog/${post.slug}`;

  return (
    <li className="py-10 first:pt-0">
      <article className="gap-6 sm:grid sm:grid-cols-4 sm:items-baseline">
        <div>
          <dl>
            <dt className="sr-only">게시일</dt>
            <dd className="text-base text-muted-foreground">
              {post.publishAt !== null && (
                <time dateTime={new Date(post.publishAt).toISOString()}>
                  {formatKstDate(post.publishAt)}
                </time>
              )}
            </dd>
          </dl>

          {post.coverUrl && (
            // 제목 링크와 같은 곳으로 간다. 링크가 하나 더 늘면 읽어 주는
            // 쪽에는 같은 말이 세 번 되풀이되므로 거기서는 빼 둔다.
            // 넓은 화면에서 `mt-6` 은 사진 윗변을 발췌 첫 줄에 맞추는 값이다
            // (제목 한 줄 + 발췌의 `mt-4` 가 날짜 한 줄 + 이만큼과 같다).
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden
              className="mt-3 block sm:mt-6"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-video w-full rounded-lg border border-border-strong object-cover sm:aspect-[4/3]"
              />
            </Link>
          )}
        </div>

        <div className="mt-4 sm:col-span-3 sm:mt-0">
          <h2 className="text-2xl font-bold tracking-tight">
            <Link
              href={href}
              className="rounded-sm outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {post.title}
            </Link>
          </h2>

          {/* 제목 바로 아래. 누르면 그 태그를 단 글만 모아 본다
              (2026-09-22 사용자 요청). */}
          <TagList tags={post.tags} active={activeTag} className="mt-3" />

          <p className="mt-4 leading-7 text-muted-foreground">
            {postSummary(post, SUMMARY_LIMIT)}
          </p>

          {/* 줄마다 같은 글자가 반복되므로 읽어 주는 쪽에는 제목을 붙여 준다 —
              "더 읽기"만 늘어선 목록은 어디로 가는 링크인지 알 수가 없다. */}
          <Link
            href={href}
            aria-label={`${post.title} 더 읽기`}
            className="mt-4 inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            더 읽기 <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    </li>
  );
}

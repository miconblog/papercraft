import Link from 'next/link';
import type { Post } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';
import { formatKstDate } from '@/lib/kst';

/**
 * 공방 일지 목록의 한 줄 (IDE-023)
 *
 * 카드가 아니라 **가로줄로 나뉜 목록**이다(2026-09-13 사용자 요청, 스크린샷으로
 * 지정). 왼쪽에 날짜, 오른쪽에 제목·발췌·더 읽기가 선다.
 *
 * 카드 그리드를 버린 이유는 발췌 길이다. 한 줄에 카드 셋을 세우면 폭이 좁아
 * 본문을 서너 줄밖에 못 보여 주는데, 글은 제목만으로 고르기 어렵다 — 한 편에
 * 폭을 다 주면 여덟 줄쯤이 들어가서 **목록에서 읽고 고를 수 있다.**
 *
 * 대표 사진은 여기에 없다 — 글 화면에는 그대로 있다.
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

export function PostListItem({ post }: { post: Post }) {
  const href = `/blog/${post.slug}`;

  return (
    <li className="py-10 first:pt-0">
      <article className="gap-6 sm:grid sm:grid-cols-4 sm:items-baseline">
        <dl>
          <dt className="sr-only">게시일</dt>
          <dd className="text-sm text-muted-foreground">
            {post.publishAt !== null && (
              <time dateTime={new Date(post.publishAt).toISOString()}>
                {formatKstDate(post.publishAt)}
              </time>
            )}
          </dd>
        </dl>

        <div className="mt-2 sm:col-span-3 sm:mt-0">
          <h2 className="text-2xl font-bold tracking-tight">
            <Link
              href={href}
              className="rounded-sm outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {post.title}
            </Link>
          </h2>

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

import Link from 'next/link';
import type { Post } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';
import { formatKstDate } from '@/lib/kst';

/**
 * 공방 일지 목록 카드 (IDE-023)
 *
 * `GameCard` 와 같은 종이 카드 모양이다 — 홈에서 게임 카드 바로 아래에 서므로
 * 다른 생김새를 쓰면 사이트가 두 벌로 보인다.
 *
 * 대표 사진은 `next/image` 가 아니라 `<img>` 다. 사진이 이미지 보관소에 있고
 * 그 호스트가 환경변수로 오는 값이라 `remotePatterns` 에 미리 적을 수가 없다
 * (`lib/blog/markdown.tsx` 의 본문 사진과 같은 사정이다).
 */
export function PostCard({ post }: { post: Post }) {
  return (
    <li>
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col rounded-lg border border-border-strong bg-popover p-4 shadow-[5px_5px_0_var(--border-strong)] transition-all outline-none hover:border-primary hover:shadow-[5px_5px_0_var(--retro-brick)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {post.coverUrl && (
          <div className="mb-3 aspect-[297/210] overflow-hidden rounded-md border border-border bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element -- 위 주석 참고 */}
            <img
              src={post.coverUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {post.publishAt !== null && (
          <time
            dateTime={new Date(post.publishAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formatKstDate(post.publishAt)}
          </time>
        )}
        <h2 className="mt-1 text-lg font-semibold group-hover:underline">
          {post.title}
        </h2>
        <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {postSummary(post)}
        </p>
      </Link>
    </li>
  );
}

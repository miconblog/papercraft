import type { Post } from '@/lib/blog/posts';
import { renderDoc } from '@/lib/blog/DocView';
import { formatKstDate } from '@/lib/kst';
import { TagList } from './TagList';

/**
 * 글 한 편의 생김새 (IDE-023)
 *
 * 공개 화면(`/blog/<슬러그>`)과 관리자 미리보기(`/admin/posts/<id>/preview`)가
 * **같은 것을 그린다.** 두 벌로 두면 미리보기가 실물과 조금씩 어긋나고, 그러면
 * 미리 본 뜻이 없다.
 *
 * 대표 사진은 `next/image` 가 아니라 `<img>` 다 — 사진이 이미지 보관소에 있고
 * 그 호스트가 환경변수로 오는 값이라 `remotePatterns` 에 미리 적을 수 없다.
 */
export function PostArticle({ post }: { post: Post }) {
  return (
    <>
      <header>
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance">
          {post.title}
        </h1>
        {post.publishAt !== null && (
          <time
            dateTime={new Date(post.publishAt).toISOString()}
            className="mt-3 block text-sm text-muted-foreground"
          >
            {formatKstDate(post.publishAt)}
          </time>
        )}
        {/* 누르면 그 태그를 단 글만 모아 본다(2026-09-22 사용자 요청). */}
        <TagList tags={post.tags} className="mt-3" />
      </header>

      {post.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverUrl}
          alt=""
          className="mt-8 h-auto w-full rounded-lg border border-border-strong"
        />
      )}

      <div className="mt-8">{renderDoc(post.doc)}</div>
    </>
  );
}

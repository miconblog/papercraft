import Link from 'next/link';
import { tagHref } from '@/lib/blog/tags';

/**
 * 글의 태그 줄 (2026-09-22 사용자 요청)
 *
 * 목록의 한 줄과 글 화면 머리가 **같은 것을 그린다.** 누르면 그 태그를 단 글만
 * 모아 보는 목록(`/blog?tag=…`)으로 간다.
 *
 * `active` 는 지금 모아 보고 있는 태그다 — 목록에서 그 태그만 눌린 모양으로
 * 서서, 무엇으로 걸러 놓은 목록인지가 줄마다 보인다.
 */
export function TagList({
  tags,
  active,
  className = '',
}: {
  tags: string[];
  active?: string | null;
  className?: string;
}) {
  if (tags.length === 0) return null;

  return (
    <ul aria-label="태그" className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => {
        const current = active?.toLowerCase() === tag.toLowerCase();
        return (
          <li key={tag}>
            <Link
              href={tagHref(tag)}
              aria-current={current ? 'page' : undefined}
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                current
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              #{tag}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

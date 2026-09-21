import type { Metadata } from 'next';
import Link from 'next/link';
import { PostListItem } from '@/components/blog/PostListItem';
import { JsonLd } from '@/components/JsonLd';
import { publishedPosts } from '@/lib/blog/posts';
import { hasTag, readTagParam } from '@/lib/blog/tags';
import {
  BLOG_DESCRIPTION,
  BLOG_TITLE,
  OPEN_GRAPH_BASE,
  RSS_ALTERNATE,
} from '@/lib/site';
import { breadcrumbLd } from '@/lib/structured-data';

/**
 * 공방 일지 목록 (IDE-023)
 *
 * 경로는 `/blog` 다(2026-09-09 사용자 결정). `/log` · `/diary` · `/making` 을
 * 놓고 보다가 사용자가 "개인 블로그와 성격이 같다"며 고른 이름이다 — 설명이
 * 필요 없고, 주소만 보고 무엇이 있는 곳인지 안다.
 *
 * 안 낸 글은 `publishedPosts` 가 뺀다. **60초마다 다시 그려지므로** 게시
 * 시각이 지나면 사람이 아무것도 하지 않아도 글이 붙는다 — 홈의 게임 목록과
 * 같은 방식이다(IDE-022).
 *
 * 생김새는 카드 그리드가 아니라 **한 줄에 한 편씩 쌓는 목록**이다(2026-09-13
 * 사용자 요청). 홈의 최근 글은 카드 그대로다 — 거기서는 게임 카드 옆에 서므로
 * 같은 모양이어야 하지만, 여기서는 글만 있어서 한 편에 폭을 다 줄 수 있다.
 *
 * 화면 맨 위에 머리말이 없다 — 돌아가는 링크도, 제목도, 소개 문구도 빼고 글
 * 목록으로 바로 시작한다(2026-09-13 사용자 요청). `TITLE` 과 `DESCRIPTION` 은
 * 지우지 않는다. 탭 제목과 공유 카드·검색 결과가 그대로 쓰는 값이라, 화면에서
 * 안 보인다고 해서 없어도 되는 문구가 아니다.
 */
/**
 * 60초마다 다시 그린다 — `RENDER_REVALIDATE_S` 와 같은 값이다(리터럴이어야
 * 해서 상수를 못 쓴다. 홈이 같은 이유로 숫자를 적어 두고 있다).
 *
 * **태그로 걸러 보기(`?tag=`)가 생기면서 이 화면은 요청마다 그려진다**
 * (2026-09-22 사용자 요청). 검색 인자를 읽으면 정적으로 둘 수 없다. 글
 * 데이터는 여전히 60초 캐시(`postsForRender`)에서 오므로 저장소를 매번
 * 두드리지는 않는다.
 */
export const revalidate = 60;

type Props = {
  searchParams: Promise<{ tag?: string | string[] }>;
};

const TITLE = BLOG_TITLE;
const DESCRIPTION = BLOG_DESCRIPTION;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog', types: RSS_ALTERNATE },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    type: 'website',
    url: '/blog',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function BlogIndexPage({ searchParams }: Props) {
  const tag = readTagParam((await searchParams).tag);
  const all = await publishedPosts();
  const posts = tag ? all.filter((post) => hasTag(post.tags, tag)) : all;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* 화면에는 제목이 없지만 검색 결과에는 내가 어디 있는지가 뜬다. */}
      <JsonLd data={breadcrumbLd([{ name: TITLE, path: '/blog' }])} />

      {/* 태그로 걸러 볼 때만 머리말이 선다 — 무엇으로 걸렀는지와 돌아가는 길.
          평소 목록은 머리말 없이 글로 바로 시작한다(2026-09-13 사용자 요청). */}
      {tag && (
        <div className="mb-10 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            #{tag}{' '}
            <span className="text-base font-normal text-muted-foreground">
              글 {posts.length}편
            </span>
          </h1>
          <Link
            href="/blog"
            className="rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            전체 글 보기
          </Link>
        </div>
      )}

      {tag && posts.length === 0 ? (
        <p className="text-muted-foreground">이 태그를 단 글이 없다.</p>
      ) : posts.length === 0 ? (
        // Supabase 에 닿지 못해도 여기까지는 뜬다 — 글 자리만 빈다.
        <p className="text-muted-foreground">아직 쓴 글이 없다.</p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <PostListItem key={post.id} post={post} activeTag={tag} />
          ))}
        </ul>
      )}
    </div>
  );
}

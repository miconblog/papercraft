import type { Metadata } from 'next';
import { PostListItem } from '@/components/blog/PostListItem';
import { publishedPosts } from '@/lib/blog/posts';

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
 */
export const revalidate = 60;

const TITLE = '공방 일지';
const DESCRIPTION =
  '옛 인쇄본을 다시 그리며 겪은 것들 — 종이로 뽑고 접고 아이와 놀아 본 기록.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: '/blog',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function BlogIndexPage() {
  const posts = await publishedPosts();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {posts.length === 0 ? (
        // Supabase 에 닿지 못해도 여기까지는 뜬다 — 글 자리만 빈다.
        <p className="text-muted-foreground">아직 쓴 글이 없다.</p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </ul>
      )}
    </div>
  );
}

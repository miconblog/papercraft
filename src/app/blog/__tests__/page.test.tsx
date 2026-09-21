/**
 * 공개 쪽 공방 일지 (IDE-023)
 *
 * 지키는 것이 셋이다. **Supabase 를 꺼도 화면이 뜬다**(글 자리만 빈다) ·
 * **낸 글만 목록에 있다** · **글 페이지에 OG 메타데이터가 있다**(글은 검색으로
 * 들어오라고 쓰는 것이라 이게 빠지면 쓴 보람이 없다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlogIndexPage from '../page';
import PostPage, { generateMetadata } from '../[slug]/page';
import { forgetPosts } from '@/lib/blog/posts';

const AT = '2020-01-01T00:00:00+09:00';

const withPosts = (rows: unknown[]) => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })),
  );
};

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

const list = (query: { tag?: string } = {}) =>
  BlogIndexPage({ searchParams: Promise.resolve(query) });

/**
 * 서버 컴포넌트가 돌려준 트리를 실제로 그린다.
 *
 * `JSON.stringify` 로 훑지 않는다 — `next/link` 가 순환 참조라 거기서 던진다.
 */
const draw = async (node: Promise<React.ReactElement>) => {
  render(await node);
  return document.body.textContent ?? '';
};

beforeEach(() => {
  forgetPosts();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  forgetPosts();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/blog', () => {
  it('대표 사진이 있는 글만 목록에 사진이 선다 (2026-09-22 사용자 요청)', async () => {
    withPosts([
      {
        id: '1',
        slug: 'with-cover',
        title: '사진 있는 글',
        publish_at: AT,
        cover_url: 'https://example.com/cover.webp',
      },
      { id: '2', slug: 'no-cover', title: '사진 없는 글', publish_at: AT },
    ]);

    await draw(list());
    const images = [...document.querySelectorAll('img')];
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'https://example.com/cover.webp',
    ]);
    // 사진도 글로 가는 길이지만, 읽어 주는 쪽에는 링크를 늘리지 않는다.
    const link = images[0].closest('a');
    expect(link).toHaveAttribute('href', '/blog/with-cover');
    expect(link).toHaveAttribute('aria-hidden', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
  });

  it('Supabase 를 꺼도 화면이 뜬다 — 글 자리만 빈다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    expect(await draw(list())).toContain('아직 쓴 글이 없다');
  });

  it('낸 글만 목록에 있다', async () => {
    withPosts([
      { id: '1', slug: 'shipped', title: '낸 글', publish_at: AT },
      { id: '2', slug: 'draft', title: '안 낸 글', publish_at: null },
      {
        id: '3',
        slug: 'later',
        title: '예정된 글',
        publish_at: '2099-01-01T00:00:00+09:00',
      },
    ]);

    const text = await draw(list());
    expect(text).toContain('낸 글');
    expect(text).not.toContain('안 낸 글');
    expect(text).not.toContain('예정된 글');
    // 줄마다 링크가 둘이다 — 제목과 "더 읽기". 이름을 정확히 대서 제목 쪽을
    // 집는다(더 읽기 쪽은 `낸 글 더 읽기` 라 걸리지 않는다).
    expect(screen.getByRole('link', { name: '낸 글' })).toHaveAttribute(
      'href',
      '/blog/shipped',
    );
    expect(screen.getByRole('link', { name: '낸 글 더 읽기' })).toHaveAttribute(
      'href',
      '/blog/shipped',
    );
  });
});

describe('/blog 태그 (2026-09-22 사용자 요청)', () => {
  const TAGGED = [
    {
      id: '1',
      slug: 'yut',
      title: '윷 만들기',
      publish_at: AT,
      tags: ['윷놀이', '나무'],
    },
    {
      id: '2',
      slug: 'board',
      title: '보드판 그리기',
      publish_at: AT,
      tags: ['보드게임'],
    },
    { id: '3', slug: 'plain', title: '태그 없는 글', publish_at: AT },
  ];
  const titles = () =>
    [...document.querySelectorAll('h2')].map((h) => h.textContent);

  it('제목 아래에 태그가 서고, 누르면 그 태그로 모아 본다', async () => {
    withPosts(TAGGED);
    await draw(list());
    expect(titles()).toEqual(['윷 만들기', '보드판 그리기', '태그 없는 글']);
    expect(screen.getByRole('link', { name: '#윷놀이' })).toHaveAttribute(
      'href',
      `/blog?tag=${encodeURIComponent('윷놀이')}`,
    );
    // 태그 없는 글에는 태그 줄이 없다.
    expect(screen.getAllByRole('list', { name: '태그' })).toHaveLength(2);
  });

  it('?tag= 로 들어오면 그 태그를 단 글만 보이고, 무엇으로 걸렀는지 적는다', async () => {
    withPosts(TAGGED);
    await draw(list({ tag: '윷놀이' }));
    expect(titles()).toEqual(['윷 만들기']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '#윷놀이 글 1편',
    );
    expect(screen.getByRole('link', { name: '전체 글 보기' })).toHaveAttribute(
      'href',
      '/blog',
    );
    // 걸러 놓은 태그는 눌린 모양이다.
    expect(screen.getByRole('link', { name: '#윷놀이' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('# 을 붙여 쳐도, 영문 대소문자가 달라도 같은 태그다', async () => {
    withPosts([
      { id: '1', slug: 'diy', title: 'DIY 글', publish_at: AT, tags: ['DIY'] },
    ]);
    await draw(list({ tag: '#diy' }));
    expect(titles()).toEqual(['DIY 글']);
  });

  it('단 글이 없는 태그면 그렇다고 말한다', async () => {
    withPosts(TAGGED);
    const text = await draw(list({ tag: '없는태그' }));
    expect(text).toContain('이 태그를 단 글이 없다');
    expect(titles()).toEqual([]);
  });
});

describe('/blog/[slug]', () => {
  it('태그가 있으면 제목 아래에 # 을 붙여 적는다 (2026-09-22 사용자 요청)', async () => {
    withPosts([
      {
        id: '1',
        slug: 'tagged',
        title: '태그 단 글',
        publish_at: AT,
        tags: ['윷놀이', '나무'],
      },
    ]);
    await draw(PostPage(params('tagged')));
    const tags = screen.getByRole('list', { name: '태그' });
    expect(tags.textContent).toBe('#윷놀이#나무');
    // 누르면 그 태그를 단 글만 모아 본다.
    expect(screen.getByRole('link', { name: '#나무' })).toHaveAttribute(
      'href',
      `/blog?tag=${encodeURIComponent('나무')}`,
    );
  });

  it('태그가 없으면 태그 줄도 없다', async () => {
    withPosts([{ id: '1', slug: 'plain', title: '그냥 글', publish_at: AT }]);
    await draw(PostPage(params('plain')));
    expect(screen.queryByRole('list', { name: '태그' })).toBeNull();
  });

  it('없는 글은 404 다', async () => {
    withPosts([]);
    await expect(PostPage(params('없는-글'))).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });

  it('본문을 마크다운으로 그린다', async () => {
    withPosts([
      {
        id: '1',
        slug: 'shipped',
        title: '윷가락 무게중심',
        body: '## 배경\n\n**겹**을 등에 넣었다.',
        publish_at: AT,
      },
    ]);

    const text = await draw(PostPage(params('shipped')));
    expect(text).toContain('윷가락 무게중심');
    // 본문의 `##` 은 h3 이다 — h1 은 글 제목, h2 는 본문의 `#` 몫이다.
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('배경');
    // 마크다운 표시 문자가 글자로 남아 있으면 안 그려진 것이다.
    expect(text).not.toContain('**겹**');
  });

  it('OG 메타데이터가 붙는다 — 요약을 안 적었으면 본문 앞머리를 쓴다', async () => {
    withPosts([
      {
        id: '1',
        slug: 'shipped',
        title: '윷가락 무게중심',
        body: '통나무를 반으로 쪼갠 단면을 정육각형의 아래 절반으로 근사했다.',
        publish_at: AT,
        cover_url: 'https://example.supabase.co/storage/v1/x.jpg',
      },
    ]);

    const meta = await generateMetadata(params('shipped'));
    expect(meta.title).toBe('윷가락 무게중심');
    expect(meta.description).toContain('통나무를 반으로 쪼갠');
    expect(meta.alternates?.canonical).toBe('/blog/shipped');
    expect(meta.openGraph).toMatchObject({
      type: 'article',
      url: '/blog/shipped',
      publishedTime: '2019-12-31T15:00:00.000Z',
    });
    expect(JSON.stringify(meta.openGraph)).toContain('/storage/v1/x.jpg');
  });

  it('안 낸 글은 화면도 메타데이터도 없다 — 문지기가 죽어도 새지 않는다', async () => {
    // 문지기가 이미 막지만 여기서도 막는다. matcher 한 줄이 바뀌면 문지기는
    // 조용히 사라지고, 그때 새어 나가는 것이 아직 세상에 안 낸 글이다.
    // 미리보기를 `/admin` 아래로 옮긴 덕에 붙일 수 있게 된 검사다(2026-09-09).
    withPosts([
      { id: '1', slug: 'draft', title: '초안', body: '비밀', publish_at: null },
    ]);

    await expect(PostPage(params('draft'))).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
    expect(await generateMetadata(params('draft'))).toEqual({});
  });

  it('내려 둔 글도 마찬가지다', async () => {
    withPosts([
      {
        id: '1',
        slug: 'pulled',
        title: '내려 둠',
        publish_at: AT,
        hidden: true,
      },
    ]);
    await expect(PostPage(params('pulled'))).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });
});

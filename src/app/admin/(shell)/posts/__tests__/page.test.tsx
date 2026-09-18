/**
 * `/admin/posts` · `/admin/posts/[id]` (IDE-023)
 *
 * 문지기(`proxy.ts`) 뒤에 있지만 화면도 스스로 한 번 더 확인한다 — matcher 한
 * 줄이 바뀌면 문지기는 조용히 사라진다(`admin/share` 와 같은 이유).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name)
        ? { name, value: cookieStore.get(name) }
        : undefined,
  }),
}));

const { default: PostsPage } = await import('../page');
const { default: EditorPage } = await import('../[id]/page');
const { default: PreviewPage } = await import('../[id]/preview/page');
const { issueSession } = await import('@/lib/analytics/session');
const { forgetPosts } = await import('@/lib/blog/posts');

const PASSWORD = 'admin-password-for-tests';

const loggedIn = () => {
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  cookieStore.set('dc_admin', issueSession(PASSWORD));
};

/**
 * 서버 컴포넌트가 돌려준 트리를 실제로 그린다 — `JSON.stringify` 는 `next/link`
 * 의 순환 참조에서 던진다.
 */
const draw = async (node: Promise<React.ReactElement>) => {
  render(await node);
  return document.body;
};

const list = () => PostsPage({ searchParams: Promise.resolve({}) });
const editor = (id: string) =>
  EditorPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  });
const preview = (id: string) =>
  PreviewPage({ params: Promise.resolve({ id }) });

/** 글 한 줄을 돌려주는 저장소. */
const withPost = (row: Record<string, unknown>) => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([row]), { status: 200 })),
  );
};

beforeEach(() => {
  cookieStore.clear();
  forgetPosts();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.unstubAllEnvs();
  // 저장소에 닿지 않는 상태 — 그래도 화면은 떠야 한다.
  vi.stubEnv('SUPABASE_URL', '');
});

afterEach(() => {
  forgetPosts();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AdminPostsPage', () => {
  it('비밀번호가 설정돼 있지 않으면 404 다 — 경로의 존재 자체를 숨긴다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    await expect(list()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('쿠키 없이 열리지 않는다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    await expect(list()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('다른 비밀번호로 만든 쿠키도 열지 못한다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    cookieStore.set('dc_admin', issueSession('예전-비밀번호'));
    await expect(list()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('저장소에 닿지 못해도 화면은 뜬다 — 새 글은 쓸 수 있어야 한다', async () => {
    loggedIn();
    const body = await draw(list());
    expect(body.querySelector('a[href="/admin/posts/new"]')).not.toBeNull();
  });

  it('상태를 한 줄로 적는다', async () => {
    loggedIn();
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { id: '1', slug: 'draft', title: '초안', publish_at: null },
              {
                id: '2',
                slug: 'later',
                title: '예정',
                publish_at: '2099-01-01T00:00:00+09:00',
              },
            ]),
            { status: 200 },
          ),
      ),
    );

    const text = (await draw(list())).textContent ?? '';
    expect(text).toContain('초안 — 안 냄');
    expect(text).toContain('게시 예정');
  });
});

describe('AdminPostEditorPage', () => {
  it('쿠키 없이 열리지 않는다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    await expect(editor('new')).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('새 글은 빈 폼으로 뜬다 — 저장소에 닿지 못해도 쓸 수는 있다', async () => {
    loggedIn();
    const body = await draw(editor('new'));
    expect(body.textContent).toContain('새 글');
    // 본문은 편집기가 맡고(IDE-028), 나머지 칸은 그대로 평범한 폼이다 —
    // 편집기가 안 떠도 제목·주소·게시 시각은 고칠 수 있어야 한다.
    expect(body.querySelector('input[name="title"]')).not.toBeNull();
    expect(body.querySelector('input[name="publishAt"]')).not.toBeNull();
  });

  it('지운 글의 주소를 다시 열면 404 다 — 빈 폼을 주면 새 글인 줄 안다', async () => {
    loggedIn();
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );
    await expect(editor('없는-id')).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });
});

/**
 * 미리보기가 `/admin` 아래인 이유는 화면 주석에 적었다 — 요약하면 **쿠키가 반드시
 * 닿는 경로**여야 하고, 초안이 공개 주소에 존재하지 않아야 한다(2026-09-09
 * 사용자 제안).
 */
describe('AdminPostPreviewPage', () => {
  it('쿠키 없이 열리지 않는다 — 안 낸 글이 여기 있다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    await expect(preview('아무-id')).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });

  it('비밀번호가 설정돼 있지 않으면 404 다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    await expect(preview('아무-id')).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });

  it('안 낸 글을 본문까지 보여 준다 — 이게 이 화면의 쓸모다', async () => {
    loggedIn();
    withPost({
      id: 'id-1',
      slug: 'yut-stick',
      title: '윷가락 무게중심',
      body: '**겹**을 등에 넣었다.',
      publish_at: null,
    });

    const text = (await draw(preview('id-1'))).textContent ?? '';
    expect(text).toContain('윷가락 무게중심');
    expect(text).toContain('겹을 등에 넣었다.');
    expect(text).toContain('내지 않은 글');
    expect(text).toContain('/blog/yut-stick');
  });

  it('안 낸 글에는 공개 주소로 가는 길을 안 준다 — 눌러 봐야 404 다', async () => {
    loggedIn();
    withPost({
      id: 'id-1',
      slug: 'yut-stick',
      title: '초안',
      publish_at: null,
    });

    const body = await draw(preview('id-1'));
    expect(body.querySelector('a[href="/blog/yut-stick"]')).toBeNull();
  });

  it('낸 글에는 공개 주소로 가는 길이 있다', async () => {
    loggedIn();
    withPost({
      id: 'id-1',
      slug: 'yut-stick',
      title: '낸 글',
      publish_at: '2020-01-01T00:00:00+09:00',
    });

    const body = await draw(preview('id-1'));
    expect(body.querySelector('a[href="/blog/yut-stick"]')).not.toBeNull();
    expect(body.textContent).toContain('공개 중인 글');
  });

  it('새 글은 미리 볼 것이 없다', async () => {
    loggedIn();
    await expect(preview('new')).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });
});

/**
 * 미리보기는 새 창으로 (2026-09-10 사용자 신고)
 *
 * "글을 쓰다가 미리보기를 눌렀는데, 저장을 하지 않아서 이전에 저장된 글이
 * 보이거든! 결국 내가 쓰던 글을 모두 날려버렸어." 편집 화면의 미리보기가 같은
 * 창에서 페이지를 바꾸는 링크였다.
 */
describe('미리보기가 쓰던 글을 날리지 않는다', () => {
  const row = {
    id: 'id-1',
    slug: 'yut-stick',
    title: '윷가락 무게중심',
    body: '본문',
    publish_at: null,
  };

  it('편집 화면의 미리보기는 새 창으로 연다', async () => {
    loggedIn();
    withPost(row);

    const body = await draw(editor('id-1'));
    const link = body.querySelector('a[href="/admin/posts/id-1/preview"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    // 새 창이 이 창을 되짚어 조작하지 못하게 한다.
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('미리보기 화면은 저장한 내용이라고 적는다 — 방금 쓴 문장이 없다고 놀라지 않게', async () => {
    loggedIn();
    withPost(row);

    const body = await draw(preview('id-1'));
    expect(body.textContent).toContain('마지막으로 저장한 내용');
  });
});

/**
 * SNS 로 내보내기 (IDE-034)
 *
 * **열린 글에서만** 칸이 열린다. 안 낸 글의 링크는 404 라, 올려 두면 누른
 * 사람이 전부 빈 화면을 본다.
 */
describe('SNS 로 내보내기', () => {
  const base = { id: 'id-1', slug: 'yut-stick', title: '윷가락 무게중심' };
  const exportCards = (body: HTMLElement) =>
    body.querySelectorAll('section[aria-labelledby="sns-export"] textarea');

  it('낸 글에는 플랫폼 넷의 문구 칸이 선다', async () => {
    loggedIn();
    withPost({ ...base, publish_at: '2020-01-01T00:00:00+09:00' });

    const body = await draw(editor('id-1'));
    expect(exportCards(body)).toHaveLength(4);
    const text = body.textContent ?? '';
    for (const label of [
      '페이스북',
      '링크드인',
      '인스타그램',
      '네이버 블로그',
    ]) {
      expect(text).toContain(label);
    }
    // 링크에 출처와 캠페인이 붙는다.
    const link = [
      ...body.querySelectorAll(
        'section[aria-labelledby="sns-export"] input[readonly]',
      ),
    ].map((input) => (input as HTMLInputElement).value);
    expect(link.some((value) => value.includes('utm_source=linkedin'))).toBe(
      true,
    );
    expect(
      link.every((value) => value.includes('utm_campaign=devlog-yut-stick')),
    ).toBe(true);
  });

  it('대표 사진이 없으면 인스타그램 칸이 막힌다', async () => {
    loggedIn();
    withPost({ ...base, publish_at: '2020-01-01T00:00:00+09:00' });

    const body = await draw(editor('id-1'));
    expect(body.textContent).toContain('사진 없이 올릴 수 없습니다');
  });

  it('안 낸 글에는 칸이 없고 이유를 말한다', async () => {
    loggedIn();
    withPost({ ...base, publish_at: null });

    const body = await draw(editor('id-1'));
    expect(exportCards(body)).toHaveLength(0);
    expect(body.textContent).toContain('아직 안 낸 글입니다');
  });

  it('예약된 글은 공개 시각을 알려 준다', async () => {
    loggedIn();
    withPost({ ...base, publish_at: '2999-01-01T09:00:00+09:00' });

    const body = await draw(editor('id-1'));
    expect(exportCards(body)).toHaveLength(0);
    expect(body.textContent).toContain('2999-01-01 09:00(KST)에 공개된 뒤에');
  });

  it('내려 둔 글은 열지 않는다', async () => {
    loggedIn();
    withPost({
      ...base,
      publish_at: '2020-01-01T00:00:00+09:00',
      hidden: true,
    });

    const body = await draw(editor('id-1'));
    expect(exportCards(body)).toHaveLength(0);
    expect(body.textContent).toContain('내려 둔 글입니다');
  });

  it('새 글에는 칸 자체가 없다', async () => {
    loggedIn();
    const body = await draw(editor('new'));
    expect(body.textContent).not.toContain('SNS 로 내보내기');
  });
});

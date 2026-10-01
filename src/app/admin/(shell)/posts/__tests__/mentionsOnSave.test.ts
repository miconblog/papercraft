/**
 * 글을 저장하면 멘션을 보낸다 (IDE-046 · 사용자 요청 2026-10-01)
 *
 * "글을 쓸 때 외부 블로그 링크를 걸면 웹멘션이나 핑백을 보내 주면 좋겠다."
 * 보내는 방법은 `lib/mentions/send.ts` 의 시험이 보고, 여기는 **저장 액션이 그
 * 일을 제때 거는지**만 본다 — 저장이 끝난 뒤에, 응답을 붙잡지 않고.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
const dispatchMentions = vi.fn(async () => null);
/** 응답 뒤로 미룬 일들. 시험이 직접 돌려 본다. */
const deferred: Array<() => Promise<unknown>> = [];

vi.mock('next/headers', () => ({ cookies: async () => ({ get }) }));
vi.mock('next/navigation', () => ({
  redirect,
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('@/lib/mentions/send', () => ({ dispatchMentions }));
vi.mock('@/lib/analytics/after', () => ({
  afterResponse: (task: () => Promise<unknown>) => {
    deferred.push(task);
  },
}));

const { publishNow, savePost } = await import('../actions');
const { issueSession } = await import('@/lib/analytics/session');
const { forgetPosts } = await import('@/lib/blog/posts');

const PASSWORD = 'admin-password-for-tests';
const ID = '11111111-1111-4111-8111-111111111111';

const DOC = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '참고한 글',
          marks: [
            { type: 'link', attrs: { href: 'https://blog.example/post' } },
          ],
        },
      ],
    },
  ],
});

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

/** 저장소 대역. 읽기에는 `stored` 를, 쓰기에는 `writeStatus` 를 돌려준다. */
const withStore = (stored: Record<string, unknown>[], writeStatus = 204) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method
        ? new Response(writeStatus < 300 ? null : '실패', {
            status: writeStatus,
          })
        : new Response(JSON.stringify(stored), { status: 200 }),
    ),
  );

const settle = (run: Promise<unknown>) => run.catch(() => {});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  forgetPosts();
  deferred.length = 0;
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  get.mockReturnValue({ value: issueSession(PASSWORD) });
});

afterEach(() => {
  forgetPosts();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('저장하면 멘션을 보낸다', () => {
  it('저장한 글을 응답 뒤로 미뤄 보낸다 — 남의 서버가 느려도 저장은 느려지지 않는다', async () => {
    withStore([]);

    await settle(
      publishNow(form({ title: '윷가락 접기', slug: 'yut', doc: DOC })),
    );

    // 액션이 돌아갈 때까지는 아무것도 나가지 않았다.
    expect(dispatchMentions).not.toHaveBeenCalled();
    expect(deferred).toHaveLength(1);

    await deferred[0]();

    expect(dispatchMentions).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'yut',
        hidden: false,
        doc: expect.objectContaining({ type: 'doc' }),
      }),
      'save',
      { justOpened: true },
    );
    // 새 글의 id 는 저장하면서 정해진 그 값이다.
    const [post] = dispatchMentions.mock.calls[0] as unknown as [
      { id: string; publishAt: number | null },
    ];
    expect(post.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.publishAt).not.toBeNull();
  });

  it('이미 열려 있던 글을 고칠 때는 방금 열린 글이 아니다', async () => {
    withStore([
      {
        id: ID,
        slug: 'yut',
        title: '윷가락 접기',
        publish_at: '2026-09-01T00:00:00.000Z',
        hidden: false,
      },
    ]);

    await settle(
      savePost(
        form({
          id: ID,
          title: '윷가락 접기',
          slug: 'yut',
          doc: DOC,
          publishAt: '2026-09-01T09:00',
        }),
      ),
    );
    await deferred[0]();

    expect(dispatchMentions).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID }),
      'save',
      { justOpened: false },
    );
  });

  it('저장이 실패하면 보내지 않는다 — 세상에 없는 글을 알리게 된다', async () => {
    withStore([], 500);

    await settle(
      publishNow(form({ title: '윷가락 접기', slug: 'yut', doc: DOC })),
    );

    expect(deferred).toHaveLength(0);
    expect(dispatchMentions).not.toHaveBeenCalled();
  });
});

/**
 * 공방 일지 — 게시 판정과 읽기·쓰기 (IDE-023)
 *
 * 지키는 것이 넷이다. **경계 시각**(게시 시각 그 순간부터 열린다),
 * **없으면 안 낸 글**(예약 공개와 반대다), **닿지 못하면 글이 없다**(사이트는
 * 그대로 뜬다), **슬러그가 겹치면 사람 말로 알려 준다**.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DOC } from '../doc';
import {
  allPosts,
  createPost,
  forgetPosts,
  isPublished,
  openSlugsForRequest,
  postBySlug,
  publishedPosts,
  toPost,
  toPosts,
  updatePost,
  type Post,
  type PostDraft,
} from '../posts';

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const enableSupabase = () => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
};

const rows = (value: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(value), { status: 200 }));

const AT = Date.UTC(2026, 8, 10, 0, 0, 0);

const post = (over: Partial<Post> = {}): Post => ({
  id: 'id-1',
  slug: 'yut-stick-balance',
  title: '윷가락 무게중심',
  summary: '',
  doc: EMPTY_DOC,
  body: '본문',
  coverUrl: null,
  publishAt: AT,
  hidden: false,
  createdAt: AT,
  updatedAt: AT,
  ...over,
});

const DRAFT: PostDraft = {
  slug: 'yut-stick-balance',
  title: '윷가락 무게중심',
  summary: '',
  doc: EMPTY_DOC,
  coverUrl: null,
  publishAt: AT,
  hidden: false,
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

describe('isPublished', () => {
  it('게시 시각 그 순간부터 열린다 — 1밀리초 전은 닫혀 있다', () => {
    expect(isPublished(post(), AT - 1)).toBe(false);
    expect(isPublished(post(), AT)).toBe(true);
  });

  it('게시 시각이 없으면 안 낸 글이다 — 예약 공개와 반대다', () => {
    // 게임은 오픈일을 안 잡으면 공개였다(IDE-022). 글은 그 반대여야 한다.
    expect(isPublished(post({ publishAt: null }), AT + 1)).toBe(false);
  });

  it('내림 스위치가 지난 게시 시각을 이긴다', () => {
    expect(isPublished(post({ hidden: true }), AT + 1)).toBe(false);
  });
});

describe('toPost', () => {
  it('id 나 slug 가 없는 줄은 버린다 — 열 주소가 없다', () => {
    expect(toPost({ id: 'x' })).toBeNull();
    expect(toPost({ slug: 'x' })).toBeNull();
    expect(toPost(null)).toBeNull();
  });

  it('읽을 수 없는 시각은 없는 것으로 친다 — 줄을 통째로 버리지 않는다', () => {
    const parsed = toPost({
      id: 'a',
      slug: 'b',
      publish_at: '어제쯤',
      hidden: true,
    });
    expect(parsed?.publishAt).toBeNull();
    // 날짜 한 칸 때문에 내려 둔 글이 도로 열리면 안 된다.
    expect(parsed?.hidden).toBe(true);
  });

  it('문서 칸이 비어 있으면 마크다운을 옮겨서 읽는다 — IDE-023 때 쓴 글 (IDE-028)', () => {
    const parsed = toPost({
      id: 'a',
      slug: 'b',
      body: '물어본다.\n"아빠 일해!"',
      doc: null,
    });
    // 한 문단 · 그 안에 줄바꿈 하나.
    expect(parsed?.doc.content).toHaveLength(1);
    expect(JSON.stringify(parsed?.doc)).toContain('hardBreak');
  });

  it('문서 칸이 있으면 그것을 쓴다 — 옮기기를 다시 지나지 않는다', () => {
    const parsed = toPost({
      id: 'a',
      slug: 'b',
      body: '옛 마크다운',
      doc: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    });
    expect(JSON.stringify(parsed?.doc)).not.toContain('옛 마크다운');
  });

  it('저장한 문서가 모르는 마디를 담고 있어도 걸러 낸다', () => {
    const parsed = toPost({
      id: 'a',
      slug: 'b',
      doc: { type: 'doc', content: [{ type: 'script', content: [] }] },
    });
    expect(parsed?.doc.content).toEqual([]);
  });

  it('망가진 줄만 건너뛰고 나머지는 살린다', () => {
    expect(toPosts([{ id: 'a', slug: 'a' }, 3, null])).toHaveLength(1);
    expect(toPosts('배열이 아니다')).toEqual([]);
  });
});

describe('닿지 못할 때', () => {
  it('키가 없으면 글이 하나도 없다 — 던지지 않는다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    await expect(publishedPosts()).resolves.toEqual([]);
    await expect(postBySlug('무엇')).resolves.toBeNull();
    await expect(allPosts()).resolves.toEqual([]);
  });

  it('저장소가 오류를 내도 빈 목록이다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    await expect(publishedPosts()).resolves.toEqual([]);
  });

  it('연결이 끊겨도 빈 목록이다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(publishedPosts()).resolves.toEqual([]);
  });
});

describe('publishedPosts', () => {
  it('안 낸 글과 내려 둔 글을 빼고 최근 순으로 준다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      rows([
        { id: '1', slug: 'old', publish_at: new Date(AT - 1000).toISOString() },
        { id: '2', slug: 'new', publish_at: new Date(AT).toISOString() },
        { id: '3', slug: 'draft', publish_at: null },
        {
          id: '4',
          slug: 'hidden',
          publish_at: new Date(AT).toISOString(),
          hidden: true,
        },
        {
          id: '5',
          slug: 'later',
          publish_at: new Date(AT + 10_000).toISOString(),
        },
      ]),
    );

    const list = await publishedPosts(AT + 1);
    expect(list.map((p) => p.slug)).toEqual(['new', 'old']);
  });
});

describe('문지기가 보는 값', () => {
  /**
   * **진짜 질의가 돌려주는 모양 그대로다 — `id` 가 없다.**
   *
   * 처음에는 여기에 `id` 를 넣어 뒀는데, fetch 대역이 질의 문자열을 무시하는
   * 바람에 "실제로는 오지 않는 칸"을 테스트가 계속 먹여 주고 있었다. 그래서
   * `toPost` 가 `id` 없는 줄을 전부 버리던 것을 못 잡았고, 낸 글까지 404 가
   * 됐다(2026-09-09). 대역은 진짜가 주는 것만 줘야 한다.
   */
  const gateRows = (
    list: Array<{ slug: string; publish_at: string | null; hidden?: boolean }>,
  ) => rows(list);

  it('낸 글의 슬러그만 담긴다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      gateRows([
        { slug: 'open', publish_at: new Date(AT).toISOString() },
        { slug: 'draft', publish_at: null },
        {
          slug: 'pulled',
          publish_at: new Date(AT).toISOString(),
          hidden: true,
        },
      ]),
    );

    const slugs = await openSlugsForRequest(AT + 1);
    expect(slugs.has('open')).toBe(true);
    expect(slugs.has('draft')).toBe(false);
    expect(slugs.has('pulled')).toBe(false);
  });

  it('`id` 를 안 받아 와도 줄을 버리지 않는다 — 버리면 낸 글이 전부 404 가 된다', async () => {
    enableSupabase();
    // 이 한 줄이 위 사고의 재발 방지다. 경고도 남으면 안 된다.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      gateRows([{ slug: 'open', publish_at: new Date(AT).toISOString() }]),
    );

    expect([...(await openSlugsForRequest(AT + 1))]).toEqual(['open']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('같은 순간에 여러 요청이 들어와도 왕복은 하나다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      openSlugsForRequest(AT),
      openSlugsForRequest(AT),
      openSlugsForRequest(AT),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('본문까지 받아 오지 않는다 — 30초마다 글 전체가 프록시로 흐르면 안 된다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await openSlugsForRequest(AT);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('select=slug,publish_at,hidden');
  });
});

describe('쓰기', () => {
  it('슬러그가 겹치면 무엇을 고쳐야 하는지 알려 준다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: '23505' }), { status: 409 }),
      ),
    );

    const result = await createPost(DRAFT, 'id-1');
    expect(result).toEqual({
      ok: false,
      message: '같은 주소를 쓰는 글이 이미 있습니다. 주소를 바꾸세요.',
    });
  });

  it('키가 없으면 저장이 조용히 성공하지 않는다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    const result = await createPost(DRAFT, 'id-1');
    expect(result.ok).toBe(false);
  });

  it('고칠 때는 그 글만 짚는다', async () => {
    enableSupabase();
    const fetchMock = vi.fn(async () => new Response('', { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await updatePost('id-1', DRAFT);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain('id=eq.id-1');
    expect(init.method).toBe('PATCH');
  });
});

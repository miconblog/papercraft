/**
 * 링크드인에 바로 올리기 (IDE-037)
 *
 * 가짜 저장소와 가짜 링크드인을 세우고 실제로 오가는 요청을 본다. 지키는 것:
 * **관리자만** · **공개 중인 글만** · **보낸 모양이 규격대로** · **썸네일이
 * 실패해도 글은 올라간다** · **실패를 감추지 않는다**.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ get }) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const { postToLinkedIn } = await import('../linkedinActions');
const { issueSession } = await import('@/lib/analytics/session');
const { forgetPosts } = await import('@/lib/blog/posts');

const PASSWORD = 'admin-password-for-tests';
const COVER = 'https://example.supabase.co/storage/v1/object/public/blog/c.jpg';

const POST = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'yut-stick',
  title: '윷가락 무게중심',
  summary: '등이 더 자주 나온다',
  body: '',
  cover_url: COVER,
  publish_at: '2020-01-01T00:00:00+09:00',
  hidden: false,
};

const ACCOUNT = {
  provider: 'linkedin',
  access_token: 'tok',
  expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  member_urn: 'urn:li:person:me',
  member_name: '손병대',
};

type Call = { url: string; init: RequestInit };

/** 주소로 갈라 답하는 가짜 네트워크. 오간 요청을 모두 남긴다. */
function network({
  post = POST as Record<string, unknown>,
  account = ACCOUNT as Record<string, unknown> | null,
  coverType = 'image/jpeg',
  postStatus = 201,
}: {
  post?: Record<string, unknown>;
  account?: Record<string, unknown> | null;
  coverType?: string;
  postStatus?: number;
} = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes('/rest/v1/social_accounts')) {
        return Response.json(account ? [account] : []);
      }
      if (url.includes('/rest/v1/social_posts')) {
        return new Response(null, { status: 201 });
      }
      if (url.includes('/rest/v1/posts')) return Response.json([post]);
      if (url === COVER || url.endsWith('.webp')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': coverType },
        });
      }
      if (url.includes('/rest/images?action=initializeUpload')) {
        return Response.json({
          value: {
            uploadUrl: 'https://www.linkedin.com/dms-uploads/x',
            image: 'urn:li:image:thumb',
          },
        });
      }
      if (url.startsWith('https://www.linkedin.com/dms-uploads/')) {
        return new Response(null, { status: 201 });
      }
      if (url === 'https://api.linkedin.com/rest/posts') {
        return postStatus === 201
          ? new Response(null, {
              status: 201,
              headers: { 'x-restli-id': 'urn:li:share:42' },
            })
          : new Response('{"message":"nope"}', { status: postStatus });
      }
      return new Response('[]');
    }),
  );
  return calls;
}

const created = (calls: Call[]) => {
  const call = calls.find(
    (c) => c.url === 'https://api.linkedin.com/rest/posts',
  );
  return call
    ? { init: call.init, body: JSON.parse(String(call.init.body)) }
    : null;
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  forgetPosts();
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('LINKEDIN_CLIENT_ID', 'cid');
  vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'secret');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.daddyscraft.com');
  get.mockReturnValue({ value: issueSession(PASSWORD) });
});

afterEach(() => {
  forgetPosts();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('postToLinkedIn', () => {
  it('세션이 없으면 404 다 — 서버 액션은 밖에서도 불린다', async () => {
    get.mockReturnValue(undefined);
    network();
    await expect(postToLinkedIn(POST.id, '문구')).rejects.toThrow('NOT_FOUND');
  });

  it('올리고, 글 주소를 돌려주고, 기록을 남긴다', async () => {
    const calls = network();
    const result = await postToLinkedIn(POST.id, '윷가락 이야기 #아빠공방');

    expect(result).toEqual({
      ok: true,
      url: 'https://www.linkedin.com/feed/update/urn:li:share:42/',
      thumbnail: true,
      recorded: true,
    });

    const sent = created(calls)!;
    const headers = sent.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers['Linkedin-Version']).toMatch(/^\d{6}$/);
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');

    expect(sent.body.author).toBe('urn:li:person:me');
    expect(sent.body.commentary).toBe('윷가락 이야기 {hashtag|\\#|아빠공방}');
    const article = sent.body.content.article;
    expect(article.title).toBe('윷가락 무게중심');
    expect(article.description).toBe('등이 더 자주 나온다');
    expect(article.thumbnail).toBe('urn:li:image:thumb');
    const source = new URL(article.source);
    expect(source.pathname).toBe('/blog/yut-stick');
    expect(source.searchParams.get('utm_source')).toBe('linkedin');
    expect(source.searchParams.get('utm_campaign')).toBe('devlog-yut-stick');

    const record = calls.find((c) => c.url.includes('/rest/v1/social_posts'));
    expect(JSON.parse(String(record?.init.body))).toMatchObject({
      provider: 'linkedin',
      external_id: 'urn:li:share:42',
      post_id: POST.id,
    });
  });

  it('WebP 대표 사진은 썸네일 없이 올린다 — 링크드인이 JPG·PNG·GIF 만 받는다', async () => {
    const calls = network({
      post: { ...POST, cover_url: 'https://example.supabase.co/c.webp' },
      coverType: 'image/webp',
    });
    const result = await postToLinkedIn(POST.id, '문구');

    expect(result).toMatchObject({ ok: true, thumbnail: false });
    expect(calls.some((c) => c.url.includes('initializeUpload'))).toBe(false);
    expect('thumbnail' in created(calls)!.body.content.article).toBe(false);
  });

  it('안 낸 글은 올리지 않는다 — 링크가 404 다', async () => {
    const calls = network({ post: { ...POST, publish_at: null } });
    expect(await postToLinkedIn(POST.id, '문구')).toEqual({
      ok: false,
      message: '공개 중인 글만 올릴 수 있습니다.',
    });
    expect(created(calls)).toBeNull();
  });

  it('한도를 넘는 문구는 보내기 전에 막는다', async () => {
    const calls = network();
    const result = await postToLinkedIn(POST.id, '가'.repeat(3001));
    expect(result.ok).toBe(false);
    expect(created(calls)).toBeNull();
  });

  it('연결이 없거나 만료됐으면 무엇을 할지 말한다', async () => {
    network({ account: null });
    expect(await postToLinkedIn(POST.id, '문구')).toMatchObject({
      ok: false,
      message: '링크드인이 연결돼 있지 않습니다.',
    });

    network({
      account: {
        ...ACCOUNT,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    expect(await postToLinkedIn(POST.id, '문구')).toMatchObject({
      ok: false,
      message: expect.stringContaining('만료'),
    });
  });

  it('링크드인이 거절하면 이유를 사람 말로 돌려준다', async () => {
    network({ postStatus: 401 });
    expect(await postToLinkedIn(POST.id, '문구')).toEqual({
      ok: false,
      message: '링크드인 연결이 끊겼습니다. 다시 연결해 주세요.',
    });
  });

  it('앱 키가 없으면 링크드인에 닿지 않는다', async () => {
    vi.stubEnv('LINKEDIN_CLIENT_ID', '');
    const calls = network();
    expect((await postToLinkedIn(POST.id, '문구')).ok).toBe(false);
    expect(calls.some((c) => c.url.includes('linkedin.com'))).toBe(false);
  });
});

/**
 * 받은 멘션과 보낸 기록 — 읽기와 쓰기 (IDE-046)
 *
 * 댓글(`comments.test.ts`)과 같은 것을 지킨다 — **승인 안 된 것은 서버까지도 안
 * 온다** · **담을 때 승인 칸을 보내지 않는다**. 멘션에만 있는 것이 둘이다:
 * **다시 온 멘션으로 고치면 승인이 풀린다** · **못 읽은 것을 "없다"로 읽지
 * 않는다**(겹쳐 담거나 다시 보내게 된다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOST_PENDING_LIMIT,
  PENDING_LIMIT,
  approvedMentions,
  createMention,
  hasPendingRoom,
  mentionFrom,
  mentionsTag,
  pendingMentionCount,
  reviseMention,
  setMentionApproved,
  toMention,
} from '../mentions';
import { recordSent, sentForPost, toSent } from '../sent';

const enableSupabase = () => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
};

const rows = (value: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(value), { status }));

const AT = Date.UTC(2026, 9, 1, 3);

/** DB 가 돌려주는 모양 그대로. */
const row = (over: Record<string, unknown> = {}) => ({
  id: 'm-1',
  target_kind: 'post',
  target_id: 'p-1',
  source_url: 'https://blog.example/post',
  source_host: 'blog.example',
  title: '종이 장난감',
  excerpt: '윷가락이 잘 굴렀다',
  via: 'webmention',
  approved_at: new Date(AT).toISOString(),
  created_at: new Date(AT).toISOString(),
  ...over,
});

const urlOf = (mock: ReturnType<typeof rows>, call = 0): string =>
  String((mock.mock.calls[call] as unknown[])[0]);

const initOf = (mock: ReturnType<typeof rows>, call = 0): RequestInit =>
  (mock.mock.calls[call] as unknown[])[1] as RequestInit;

const bodyOf = (mock: ReturnType<typeof rows>, call = 0) =>
  JSON.parse(String(initOf(mock, call).body)) as Record<string, unknown>;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('toMention', () => {
  it('출처가 웹 주소가 아닌 줄은 버린다 — 화면이 이 값을 href 에 쓴다', () => {
    expect(toMention(row({ source_url: 'javascript:alert(1)' }))).toBeNull();
    expect(toMention(row({ source_url: '' }))).toBeNull();
  });

  it('모르는 종류 · 모르는 규약은 버린다', () => {
    expect(toMention(row({ target_kind: 'photo' }))).toBeNull();
    expect(toMention(row({ via: 'trackback' }))).toBeNull();
  });

  it('제목과 발췌는 비어도 된다 — 제목을 안 단 글이 있다', () => {
    expect(toMention(row({ title: '', excerpt: null }))).toMatchObject({
      title: '',
      excerpt: '',
    });
  });

  it('읽을 수 없는 승인 시각은 대기로 읽는다', () => {
    expect(toMention(row({ approved_at: '어제쯤' }))?.approvedAt).toBeNull();
  });
});

describe('approvedMentions', () => {
  it('승인된 것만 묻고, 대상마다 따로 태그를 붙인다', async () => {
    enableSupabase();
    const fetchMock = rows([row()]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await approvedMentions('post', 'p-1')).toHaveLength(1);

    const url = urlOf(fetchMock);
    expect(url).toContain('approved_at=not.is.null');
    expect(url).toContain('target_kind=eq.post');
    expect(url).toContain('target_id=eq.p-1');
    expect(initOf(fetchMock).next).toMatchObject({
      tags: [mentionsTag('post', 'p-1')],
    });
  });

  it('못 읽으면 멘션이 없다 — 글은 그대로 선다', async () => {
    enableSupabase();
    vi.stubGlobal('fetch', rows({ message: '표가 없다' }, 404));

    expect(await approvedMentions('post', 'p-1')).toEqual([]);
  });
});

describe('mentionFrom', () => {
  it('있으면 줄, 없으면 null', async () => {
    enableSupabase();
    const fetchMock = rows([row()]);
    vi.stubGlobal('fetch', fetchMock);

    expect(
      await mentionFrom('https://blog.example/post?a=1&b=2', {
        kind: 'post',
        targetId: 'p-1',
      }),
    ).toMatchObject({ id: 'm-1' });
    // 주소의 `&` 가 남의 질의 조건이 되지 않는다.
    expect(urlOf(fetchMock)).toContain(
      `source_url=eq.${encodeURIComponent('https://blog.example/post?a=1&b=2')}`,
    );

    vi.stubGlobal('fetch', rows([]));
    expect(
      await mentionFrom('https://blog.example/x', {
        kind: 'post',
        targetId: 'p-1',
      }),
    ).toBeNull();
  });

  it('못 읽은 것은 "없다"가 아니다 — 겹쳐 담지 않게 가른다', async () => {
    enableSupabase();
    vi.stubGlobal('fetch', rows({ message: '꺼짐' }, 503));

    expect(
      await mentionFrom('https://blog.example/x', {
        kind: 'post',
        targetId: 'p-1',
      }),
    ).toBeUndefined();
  });
});

describe('hasPendingRoom', () => {
  const pendingRows = (host: number, total: number) =>
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            Array.from(
              { length: String(url).includes('source_host=') ? host : total },
              (_, i) => ({ id: `m-${i}` }),
            ),
          ),
          { status: 200 },
        ),
    );

  it('호스트 몫과 전체 몫이 다 남아 있어야 한다', async () => {
    enableSupabase();

    vi.stubGlobal('fetch', pendingRows(0, 0));
    expect(await hasPendingRoom('blog.example')).toBe(true);

    vi.stubGlobal('fetch', pendingRows(HOST_PENDING_LIMIT, HOST_PENDING_LIMIT));
    expect(await hasPendingRoom('blog.example')).toBe(false);

    vi.stubGlobal('fetch', pendingRows(0, PENDING_LIMIT));
    expect(await hasPendingRoom('blog.example')).toBe(false);
  });

  it('못 읽으면 자리가 없는 것이다 — 한도가 없는 쪽으로 틀리지 않는다', async () => {
    enableSupabase();
    vi.stubGlobal('fetch', rows({ message: '꺼짐' }, 503));

    expect(await hasPendingRoom('blog.example')).toBe(false);
  });
});

describe('쓰기', () => {
  it('새 멘션은 승인 칸 없이 담긴다 — 비어 있는 것이 대기다', async () => {
    enableSupabase();
    const fetchMock = rows(null, 201);
    vi.stubGlobal('fetch', fetchMock);

    await createMention(
      {
        kind: 'post',
        targetId: 'p-1',
        sourceUrl: 'https://blog.example/post',
        sourceHost: 'blog.example',
        title: '종이 장난감',
        excerpt: '',
        via: 'pingback',
      },
      'm-9',
    );

    const body = bodyOf(fetchMock);
    expect(body).toMatchObject({
      id: 'm-9',
      via: 'pingback',
      target_id: 'p-1',
    });
    expect(body).not.toHaveProperty('approved_at');
  });

  it('다시 온 멘션으로 고치면 승인이 풀린다', async () => {
    // 멀쩡한 글로 승인받은 뒤 광고로 바꿔 다시 보내는 길을 막는다.
    enableSupabase();
    const fetchMock = rows(null, 204);
    vi.stubGlobal('fetch', fetchMock);

    await reviseMention(
      'm-1',
      { title: '새 제목', excerpt: '새 발췌', via: 'webmention' },
      AT,
    );

    expect(urlOf(fetchMock)).toContain('id=eq.m-1');
    expect(bodyOf(fetchMock)).toMatchObject({
      title: '새 제목',
      approved_at: null,
      updated_at: new Date(AT).toISOString(),
    });
  });

  it('승인 취소는 대기로 돌아간다', async () => {
    enableSupabase();
    const fetchMock = rows(null, 204);
    vi.stubGlobal('fetch', fetchMock);

    await setMentionApproved('m-1', true, AT);
    await setMentionApproved('m-1', false, AT);

    expect(bodyOf(fetchMock, 0)).toEqual({
      approved_at: new Date(AT).toISOString(),
    });
    expect(bodyOf(fetchMock, 1)).toEqual({ approved_at: null });
  });

  it('메뉴 숫자는 본문을 받지 않고 센다', async () => {
    enableSupabase();
    const fetchMock = rows([{ id: 'a' }, { id: 'b' }]);
    vi.stubGlobal('fetch', fetchMock);

    expect(await pendingMentionCount()).toBe(2);
    expect(urlOf(fetchMock)).toContain('select=id');
    expect(urlOf(fetchMock)).toContain('approved_at=is.null');
  });
});

describe('보낸 기록', () => {
  it('못 읽으면 null 이다 — "보낸 적 없다"로 읽으면 전부 다시 나간다', async () => {
    enableSupabase();
    vi.stubGlobal('fetch', rows({ message: '꺼짐' }, 503));
    expect(await sentForPost('p-1')).toBeNull();

    vi.stubGlobal('fetch', rows([]));
    expect(await sentForPost('p-1')).toEqual([]);
  });

  it('키가 없는 환경에서도 null 이다 — 로컬에서 멘션이 나가지 않는다', async () => {
    expect(await sentForPost('p-1')).toBeNull();
  });

  it('같은 글 · 같은 주소면 덮어쓴다', async () => {
    enableSupabase();
    const fetchMock = rows(null, 201);
    vi.stubGlobal('fetch', fetchMock);

    await recordSent(
      {
        postId: 'p-1',
        targetUrl: 'https://blog.example/post',
        sourceUrl: 'https://www.daddyscraft.com/blog/yut-sticks',
        via: 'webmention',
        endpoint: 'https://blog.example/wm',
        status: 'failed',
        detail: '가'.repeat(500),
      },
      AT,
    );

    expect(urlOf(fetchMock)).toContain('on_conflict=post_id,target_url');
    expect(
      (initOf(fetchMock).headers as Record<string, string>).Prefer,
    ).toContain('resolution=merge-duplicates');
    // 남의 서버가 돌려준 글자가 섞이는 칸이라 길이에 끝을 둔다.
    expect(String(bodyOf(fetchMock).detail)).toHaveLength(200);
  });

  it('모르는 상태의 줄은 버린다', () => {
    expect(
      toSent({
        post_id: 'p-1',
        target_url: 'https://x.example/',
        status: 'maybe',
      }),
    ).toBeNull();
  });
});

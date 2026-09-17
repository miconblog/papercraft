/**
 * 댓글 — 읽기와 쓰기 (IDE-029)
 *
 * 지키는 것이 다섯이다. **승인 안 된 댓글은 서버까지도 안 온다**(거르기를 SQL 에
 * 맡긴다) · **못 읽으면 댓글이 없다**(화면은 그대로 선다) · **담을 때 승인 칸을
 * 보내지 않는다** · **승인 취소는 대기로 돌아간다** · **캐시 태그는 대상마다
 * 따로**다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMIT,
  RATE_WINDOW_MS,
  allComments,
  approvedComments,
  commentsTag,
  createComment,
  deleteComment,
  isApproved,
  PENDING_COUNT_CAP,
  pendingCommentCount,
  recentCommentCount,
  setCommentApproved,
  toComment,
  toComments,
} from '../comments';

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const enableSupabase = () => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
};

const rows = (value: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(value), { status: 200 }));

const AT = Date.UTC(2026, 8, 13, 3, 0, 0);

/** DB 가 돌려주는 모양 그대로. 앱의 `Comment` 가 아니다. */
const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  target_kind: 'game',
  target_id: 'soccer',
  nickname: '아빠',
  body: '잘 만들었어요',
  approved_at: new Date(AT).toISOString(),
  created_at: new Date(AT).toISOString(),
  ...over,
});

const urlOf = (mock: ReturnType<typeof rows>, call = 0): string =>
  String((mock.mock.calls[call] as unknown[])[0]);

const initOf = (mock: ReturnType<typeof rows>, call = 0): RequestInit =>
  (mock.mock.calls[call] as unknown[])[1] as RequestInit;

const bodyOf = (mock: ReturnType<typeof rows>, call = 0): unknown =>
  JSON.parse(String(initOf(mock, call).body));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('toComment', () => {
  it('어디 달렸는지 모르는 줄은 버린다', () => {
    expect(toComment(row({ id: '' }))).toBeNull();
    expect(toComment(row({ target_id: '' }))).toBeNull();
    expect(toComment(null)).toBeNull();
  });

  it('모르는 종류는 버린다 — DB 의 check 가 뚫렸어도 화면에 세우지 않는다', () => {
    expect(toComment(row({ target_kind: 'photo' }))).toBeNull();
  });

  it('본문이 비면 버린다 — 세울 것이 없다', () => {
    expect(toComment(row({ body: '' }))).toBeNull();
  });

  it('이름은 없어도 된다 — 이름 없이 쓸 수 있는 자리다', () => {
    expect(toComment(row({ nickname: '' }))?.nickname).toBe('');
  });

  it('읽을 수 없는 승인 시각은 대기로 읽는다', () => {
    // 날짜 한 칸 때문에 승인 안 된 댓글이 공개되면 안 된다.
    const parsed = toComment(row({ approved_at: '어제쯤' }));
    expect(parsed?.approvedAt).toBeNull();
    expect(isApproved(parsed!)).toBe(false);
  });

  it('읽을 수 없는 줄은 건너뛰고 나머지를 살린다', () => {
    expect(toComments([row(), { id: '' }, row({ id: 'c-2' })])).toHaveLength(2);
  });
});

describe('commentsTag', () => {
  it('대상마다 다르다 — 하나를 승인해도 남의 페이지를 깨우지 않는다', () => {
    expect(commentsTag('game', 'soccer')).not.toBe(commentsTag('game', 'yut'));
    expect(commentsTag('game', 'x')).not.toBe(commentsTag('post', 'x'));
  });
});

describe('approvedComments', () => {
  it('승인된 것만 묻는다 — 대기 중인 본문은 서버까지도 오지 않는다', async () => {
    enableSupabase();
    const fetchMock = rows([row()]);
    vi.stubGlobal('fetch', fetchMock);

    await approvedComments('game', 'soccer');

    const url = urlOf(fetchMock);
    expect(url).toContain('approved_at=not.is.null');
    expect(url).toContain('target_kind=eq.game');
    expect(url).toContain('target_id=eq.soccer');
    // 댓글은 대화라 위에서 아래로 읽는 순서여야 한다.
    expect(url).toContain('order=created_at.asc');
  });

  it('대상 이름에 든 특수 문자를 질의에 그대로 흘리지 않는다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await approvedComments('post', 'a&b=c');

    // 인코딩하지 않으면 `&` 뒤가 남의 질의 조건이 된다.
    expect(urlOf(fetchMock)).toContain('target_id=eq.a%26b%3Dc');
  });

  it('페이지가 정적인 채로 다시 그려지게 태그를 붙인다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await approvedComments('game', 'soccer');

    expect(initOf(fetchMock).next).toEqual({
      revalidate: 60,
      tags: [commentsTag('game', 'soccer')],
    });
  });

  it('못 읽으면 빈 목록이다 — 게임 화면은 그대로 선다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    await expect(approvedComments('game', 'soccer')).resolves.toEqual([]);
  });

  it('저장소 키가 없으면 묻지도 않는다', async () => {
    const fetchMock = rows([row()]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(approvedComments('game', 'soccer')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('allComments (관리자)', () => {
  it('캐시를 타지 않는다 — 방금 승인한 것이 보여야 한다', async () => {
    enableSupabase();
    const fetchMock = rows([row({ approved_at: null }), row({ id: 'c-2' })]);
    vi.stubGlobal('fetch', fetchMock);

    const comments = await allComments();

    expect(initOf(fetchMock).cache).toBe('no-store');
    // 대기·공개를 가르는 것은 화면의 일이다. 여기서는 둘 다 온다.
    expect(comments.filter(isApproved)).toHaveLength(1);
    expect(urlOf(fetchMock)).toContain('order=created_at.desc');
  });
});

describe('pendingCommentCount (메뉴의 대기 숫자)', () => {
  it('승인 안 된 것만, 본문 없이, 한도 하나 위까지만 묻는다', async () => {
    enableSupabase();
    const fetchMock = rows([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(pendingCommentCount()).resolves.toBe(3);
    const url = urlOf(fetchMock);
    expect(url).toContain('select=id');
    expect(url).toContain('approved_at=is.null');
    expect(url).toContain(`limit=${PENDING_COUNT_CAP + 1}`);
    // 방금 승인한 것이 숫자에서 바로 빠져야 한다.
    expect(initOf(fetchMock).cache).toBe('no-store');
  });

  it('못 읽으면 0 이다 — 숫자 하나 때문에 관리자 화면이 서지 않으면 안 된다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    await expect(pendingCommentCount()).resolves.toBe(0);

    vi.unstubAllEnvs();
    await expect(pendingCommentCount()).resolves.toBe(0);
  });
});

describe('recentCommentCount (도배 제한)', () => {
  it('해시가 없으면 묻지 않고 0 이다 — 비밀값 없는 환경에서 제한이 없다', async () => {
    enableSupabase();
    const fetchMock = rows([row()]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(recentCommentCount(null)).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('창 안에 쓴 것만 센다', async () => {
    enableSupabase();
    const fetchMock = rows([{ id: 'a' }, { id: 'b' }]);
    vi.stubGlobal('fetch', fetchMock);

    await expect(recentCommentCount('hash-1', AT)).resolves.toBe(2);

    const url = urlOf(fetchMock);
    expect(url).toContain('visitor_hash=eq.hash-1');
    expect(url).toContain(
      `created_at=gte.${encodeURIComponent(new Date(AT - RATE_WINDOW_MS).toISOString())}`,
    );
    // 세는 데 본문이 필요 없다 — 남이 쓴 글을 끌어오지 않는다.
    expect(url).toContain('select=id');
    // 한도를 넘었는지만 알면 되므로 그만큼만 받는다.
    expect(url).toContain(`limit=${RATE_LIMIT + 1}`);
  });

  it('못 읽으면 0 이다 — 읽기 실패가 댓글 쓰기를 막지 않는다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    await expect(recentCommentCount('hash-1')).resolves.toBe(0);
  });
});

describe('쓰기', () => {
  it('담을 때 승인 칸을 보내지 않는다 — 비어 있는 것이 대기다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await createComment(
      {
        kind: 'post',
        targetId: 'post-id-1',
        nickname: '아빠',
        body: '고마워요',
        visitorHash: 'hash-1',
      },
      'c-new',
    );

    const sent = bodyOf(fetchMock) as Record<string, unknown>;
    expect(sent).not.toHaveProperty('approved_at');
    expect(sent).toMatchObject({
      id: 'c-new',
      target_kind: 'post',
      target_id: 'post-id-1',
      visitor_hash: 'hash-1',
    });
  });

  it('쓰기 실패는 사람에게 보인다 — 조용히 사라지면 승인을 기다리게 된다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    const result = await createComment({
      kind: 'game',
      targetId: 'soccer',
      nickname: '아빠',
      body: '고마워요',
      visitorHash: null,
    });
    expect(result.ok).toBe(false);
  });

  it('저장소 키가 없으면 무엇을 고쳐야 하는지 알려 준다', async () => {
    vi.stubGlobal('fetch', rows([]));

    const result = await createComment({
      kind: 'game',
      targetId: 'soccer',
      nickname: '아빠',
      body: '고마워요',
      visitorHash: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('SUPABASE_URL');
  });

  it('승인 취소는 대기로 돌아간다 — 따로 내리는 스위치가 없다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await setCommentApproved('c-1', true, AT);
    await setCommentApproved('c-1', false, AT);

    expect(bodyOf(fetchMock, 0)).toEqual({
      approved_at: new Date(AT).toISOString(),
    });
    expect(bodyOf(fetchMock, 1)).toEqual({ approved_at: null });
  });

  it('지우기는 그 한 줄만 지운다', async () => {
    enableSupabase();
    const fetchMock = rows([]);
    vi.stubGlobal('fetch', fetchMock);

    await deleteComment('c-1');

    expect(initOf(fetchMock).method).toBe('DELETE');
    expect(urlOf(fetchMock)).toContain('id=eq.c-1');
  });
});

/**
 * 멘션 보내기 (IDE-046)
 *
 * 남의 서버를 두드리는 일이라 **보내지 않아야 할 때 보내지 않는 것**이 먼저다 —
 * 꺼진 환경 · 안 낸 글 · 이미 보낸 링크 · 기록을 못 읽었을 때. 그다음이 보내는
 * 방법이다(웹멘션 먼저, 없으면 핑백).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toDoc } from '@/lib/blog/doc';
import type {
  PublicFetch,
  PublicFetchOptions,
  PublicResult,
} from '../fetchPublic';
import type { SentMention } from '../sent';
import { pingbackFaultXml, pingbackOkXml } from '../xmlrpc';

const sentForPost = vi.fn();
const recordSent = vi.fn();
const forgetSent = vi.fn();

vi.mock('../sent', () => ({ sentForPost, recordSent, forgetSent }));

const { deliver, dispatchMentions, forgetDispatches } = await import('../send');

/** 시험 환경의 사이트 주소다(`lib/site.ts` — 로컬 개발 서버). */
const SOURCE = 'http://localhost:3000/blog/yut-sticks';
const TARGET = 'https://blog.example/post';

const html = (
  body: string,
  headers: Record<string, string> = {},
): PublicResult => ({
  reached: true,
  status: 200,
  url: TARGET,
  headers: new Headers({ 'content-type': 'text/html', ...headers }),
  text: body,
});

const reply = (status: number, text = ''): PublicResult => ({
  reached: true,
  status,
  url: 'https://blog.example/wm',
  headers: new Headers(),
  text,
});

/** 주소마다 정해 둔 답을 돌려주는 가짜. 무엇을 불렀는지는 `calls` 로 본다. */
function fakeFetcher(answers: Record<string, PublicResult>) {
  const calls: Array<{ url: string; options?: PublicFetchOptions }> = [];
  const fetcher: PublicFetch = async (url, options) => {
    calls.push({ url, options });
    return answers[url] ?? { reached: false, reason: 'unreachable' };
  };
  return { fetcher, calls };
}

const WEBMENTION_PAGE = html('<link rel="webmention" href="/wm">');

describe('deliver — 웹멘션', () => {
  it('받는 주소를 찾아 source 와 target 을 폼으로 보낸다', async () => {
    const { fetcher, calls } = fakeFetcher({
      [TARGET]: WEBMENTION_PAGE,
      'https://blog.example/wm': reply(202),
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toEqual({
      status: 'sent',
      via: 'webmention',
      endpoint: 'https://blog.example/wm',
      detail: '',
    });

    const post = calls[1];
    expect(post.options?.method).toBe('POST');
    expect(post.options?.headers?.['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(Object.fromEntries(new URLSearchParams(post.options?.body))).toEqual(
      { source: SOURCE, target: TARGET },
    );
  });

  it('받는 쪽이 거절하면 실패로 적고 이유를 남긴다', async () => {
    const { fetcher } = fakeFetcher({
      [TARGET]: WEBMENTION_PAGE,
      'https://blog.example/wm': reply(400),
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'failed',
      via: 'webmention',
      detail: expect.stringContaining('400'),
    });
  });

  it('받는 주소가 안쪽이라 막히면 실패다 — 남의 글이 알려 준 주소를 믿지 않는다', async () => {
    const { fetcher } = fakeFetcher({
      [TARGET]: html('<link rel="webmention" href="http://localhost/wm">'),
      'http://localhost/wm': { reached: false, reason: 'blocked' },
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'failed',
      detail: expect.stringContaining('blocked'),
    });
  });
});

describe('deliver — 핑백', () => {
  const PINGBACK_PAGE = html('', {
    'x-pingback': 'https://blog.example/xmlrpc.php',
  });

  it('웹멘션을 안 받는 곳에는 핑백으로 보낸다', async () => {
    const { fetcher, calls } = fakeFetcher({
      [TARGET]: PINGBACK_PAGE,
      'https://blog.example/xmlrpc.php': reply(200, pingbackOkXml('ok')),
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'sent',
      via: 'pingback',
      endpoint: 'https://blog.example/xmlrpc.php',
    });
    expect(calls[1].options?.body).toContain('<methodName>pingback.ping');
    expect(calls[1].options?.body).toContain(SOURCE);
  });

  it('200 이어도 몸통이 거절이면 실패다', async () => {
    const { fetcher } = fakeFetcher({
      [TARGET]: PINGBACK_PAGE,
      'https://blog.example/xmlrpc.php': reply(
        200,
        pingbackFaultXml(17, 'no link'),
      ),
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'failed',
      detail: expect.stringContaining('no link'),
    });
  });

  it('"이미 받은 핑백"은 보낸 것으로 친다', async () => {
    const { fetcher } = fakeFetcher({
      [TARGET]: PINGBACK_PAGE,
      'https://blog.example/xmlrpc.php': reply(
        200,
        pingbackFaultXml(48, 'already registered'),
      ),
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'sent',
    });
  });
});

describe('deliver — 보내지 않는다', () => {
  it('받는 주소가 없는 곳에는 아무것도 보내지 않는다', async () => {
    const { fetcher, calls } = fakeFetcher({
      [TARGET]: html('<p>그냥 글</p>'),
    });

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'none',
      via: null,
      endpoint: null,
    });
    expect(calls).toHaveLength(1);
  });

  it('링크한 글에 닿지 못하면 실패다 — 다음 저장 때 다시 해 본다', async () => {
    const { fetcher } = fakeFetcher({});

    expect(await deliver(SOURCE, TARGET, fetcher)).toMatchObject({
      status: 'failed',
      via: null,
    });
  });
});

// ── 글 단위 ─────────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 9, 1, 3);
const ON = { WEBMENTION_SEND: 'on' };

const link = (href: string) => ({
  type: 'paragraph',
  content: [
    { type: 'text', text: '링크', marks: [{ type: 'link', attrs: { href } }] },
  ],
});

const post = (hrefs: string[], over: Record<string, unknown> = {}) => ({
  id: 'p-1',
  slug: 'yut-sticks',
  doc: toDoc(hrefs.map(link)),
  // 한참 전에 낸 글이다 — 기다리지 않고 보낸다.
  publishAt: NOW - 86_400_000,
  hidden: false,
  ...over,
});

const row = (over: Partial<SentMention> = {}): SentMention => ({
  postId: 'p-1',
  targetUrl: TARGET,
  sourceUrl: SOURCE,
  via: 'webmention',
  endpoint: 'https://blog.example/wm',
  status: 'sent',
  detail: '',
  sentAt: NOW - 1_000,
  ...over,
});

const accepting = () =>
  fakeFetcher({
    [TARGET]: WEBMENTION_PAGE,
    'https://blog.example/wm': reply(202),
  });

const sleep = vi.fn(async () => {});

const options = (fetcher: PublicFetch, over: Record<string, unknown> = {}) => ({
  fetcher,
  now: () => NOW,
  sleep,
  env: ON,
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  forgetDispatches();
  sentForPost.mockResolvedValue([]);
  recordSent.mockResolvedValue({ ok: true });
  forgetSent.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('dispatchMentions — 보내지 않아야 할 때', () => {
  it('꺼진 환경에서는 남의 서버도 저장소도 건드리지 않는다', async () => {
    const { fetcher, calls } = accepting();

    expect(
      await dispatchMentions(
        post([TARGET]),
        'save',
        options(fetcher, { env: {} }),
      ),
    ).toBeNull();
    expect(calls).toHaveLength(0);
    expect(sentForPost).not.toHaveBeenCalled();
  });

  it.each([
    ['초안', { publishAt: null }],
    ['예약해 둔 글', { publishAt: NOW + 60_000 }],
    ['내려 둔 글', { hidden: true }],
  ])('%s 의 멘션은 나가지 않는다', async (_, over) => {
    // 안 낸 글의 주소를 남의 서버에 알려 주게 된다.
    const { fetcher, calls } = accepting();

    expect(
      await dispatchMentions(post([TARGET], over), 'save', options(fetcher)),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('기록을 못 읽었으면 아무것도 보내지 않는다', async () => {
    // 못 읽은 것을 "보낸 적 없다"로 읽으면 화면이 그려질 때마다 다시 나간다.
    sentForPost.mockResolvedValue(null);
    const { fetcher, calls } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('이미 보낸 링크는 다시 보내지 않는다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher, calls } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toEqual({ sent: 0, failed: 0, none: 0, withdrawn: 0 });
    expect(calls).toHaveLength(0);
  });

  it('받는 곳이 없던 링크도 다시 두드리지 않는다', async () => {
    sentForPost.mockResolvedValue([row({ status: 'none', via: null })]);
    const { fetcher, calls } = accepting();

    await dispatchMentions(post([TARGET]), 'save', options(fetcher));
    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(calls).toHaveLength(0);
  });

  it('바깥 링크가 없는 글은 화면이 그려질 때 저장소도 묻지 않는다', async () => {
    const { fetcher } = accepting();

    expect(
      await dispatchMentions(
        post(['/blog/other']),
        'catch-up',
        options(fetcher),
      ),
    ).toBeNull();
    expect(sentForPost).not.toHaveBeenCalled();
  });

  it('던지지 않는다 — 응답 뒤에 도는 일이라 받아 줄 곳이 없다', async () => {
    sentForPost.mockRejectedValue(new Error('저장소가 터졌다'));
    const { fetcher } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toBeNull();
  });
});

describe('dispatchMentions — 보낸다', () => {
  it('처음 보는 링크에 보내고 결과를 적는다', async () => {
    const { fetcher } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toEqual({ sent: 1, failed: 0, none: 0, withdrawn: 0 });
    expect(recordSent).toHaveBeenCalledWith({
      postId: 'p-1',
      targetUrl: TARGET,
      sourceUrl: SOURCE,
      status: 'sent',
      via: 'webmention',
      endpoint: 'https://blog.example/wm',
      detail: '',
    });
  });

  it('받는 곳이 없던 것도 적어 둔다 — 안 적으면 그려질 때마다 다시 두드린다', async () => {
    const { fetcher } = fakeFetcher({ [TARGET]: html('<p>그냥 글</p>') });

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(recordSent).toHaveBeenCalledWith(
      expect.objectContaining({ targetUrl: TARGET, status: 'none' }),
    );
  });

  it('저장할 때는 실패했던 것을 다시 해 본다', async () => {
    sentForPost.mockResolvedValue([row({ status: 'failed' })]);
    const { fetcher } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toMatchObject({ sent: 1 });
  });

  it('화면이 그려질 때는 실패했던 것을 다시 하지 않는다 — 방문마다 두드리게 된다', async () => {
    sentForPost.mockResolvedValue([row({ status: 'failed' })]);
    const { fetcher, calls } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(calls).toHaveLength(0);
  });

  it('슬러그를 고쳐 우리 주소가 달라졌으면 다시 보낸다', async () => {
    sentForPost.mockResolvedValue([
      row({ sourceUrl: 'http://localhost:3000/blog/old-slug' }),
    ]);
    const { fetcher } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher)),
    ).toMatchObject({ sent: 1 });
  });

  it('주인이 누르면 보낸 것도 다시 보낸다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher } = accepting();

    expect(
      await dispatchMentions(post([TARGET]), 'force', options(fetcher)),
    ).toMatchObject({ sent: 1 });
  });
});

describe('dispatchMentions — 겹쳐 보내지 않는다', () => {
  it('보내는 중인 글은 화면이 다시 그려져도 한 번 더 보내지 않는다', async () => {
    // 받는 쪽은 받자마자 우리 글에 와서 링크를 확인한다. 그 요청이 화면을 다시
    // 그리는데, 첫 번째 보내기는 아직 답을 기다리는 중이라 기록이 없다.
    const posts: string[] = [];
    let again: Promise<unknown> | null = null;
    const fetcher: PublicFetch = async (url, options) => {
      if (url === TARGET) return WEBMENTION_PAGE;
      posts.push(String(options?.body));
      again ??= dispatchMentions(post([TARGET]), 'catch-up', {
        fetcher,
        now: () => NOW,
        sleep,
        env: ON,
      });
      await again;
      return reply(202);
    };

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(posts).toHaveLength(1);
    expect(await again).toBeNull();
  });

  it('끝난 뒤에는 다시 보낼 수 있다 — 막아 둔 것이 남지 않는다', async () => {
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toMatchObject({ sent: 1 });
  });
});

describe('dispatchMentions — 화면이 그려질 때마다 저장소를 묻지 않는다', () => {
  // 글 화면은 방문마다 그려진다. 그때마다 보낸 기록을 읽으면 글 한 번 읽힐
  // 때마다 저장소를 한 번 두드린다.
  it('한 번 확인한 글은 다시 묻지 않는다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));
    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));
    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(sentForPost).toHaveBeenCalledTimes(1);
  });

  it('보내고 난 글도 기억한다', async () => {
    const { fetcher, calls } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));
    const after = calls.length;
    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(sentForPost).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(after);
  });

  it('링크가 달라지면 다시 본다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));
    await dispatchMentions(
      post([TARGET, 'https://other.example/x']),
      'catch-up',
      options(fetcher),
    );

    expect(sentForPost).toHaveBeenCalledTimes(2);
  });

  it('슬러그가 달라져도 다시 본다 — 우리 주소가 바뀌었다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));
    await dispatchMentions(
      post([TARGET], { slug: 'new-slug' }),
      'catch-up',
      options(fetcher),
    );

    expect(sentForPost).toHaveBeenCalledTimes(2);
  });

  it('기록을 못 읽은 것은 기억하지 않는다 — 다음에 다시 읽는다', async () => {
    sentForPost.mockResolvedValueOnce(null).mockResolvedValue([]);
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(
      await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher)),
    ).toMatchObject({ sent: 1 });
  });

  it('저장할 때는 기억을 믿지 않는다 — 실패했던 것을 다시 해 봐야 한다', async () => {
    sentForPost.mockResolvedValue([row({ status: 'failed' })]);
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'catch-up', options(fetcher));

    expect(
      await dispatchMentions(post([TARGET]), 'save', options(fetcher)),
    ).toMatchObject({ sent: 1 });
  });
});

describe('dispatchMentions — 본문에서 뺀 링크', () => {
  it('저장할 때, 받았던 곳에 한 번 더 알리고 기록을 지운다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher, calls } = accepting();

    expect(await dispatchMentions(post([]), 'save', options(fetcher))).toEqual({
      sent: 0,
      failed: 0,
      none: 0,
      withdrawn: 1,
    });
    // 받는 쪽이 다시 와서 링크가 사라진 것을 보고 멘션을 내린다.
    expect(calls.map((call) => call.url)).toEqual([
      TARGET,
      'https://blog.example/wm',
    ]);
    expect(forgetSent).toHaveBeenCalledWith('p-1', TARGET);
  });

  it('받는 곳이 없던 링크는 알리지 않고 기록만 지운다', async () => {
    sentForPost.mockResolvedValue([row({ status: 'none', via: null })]);
    const { fetcher, calls } = accepting();

    await dispatchMentions(post([]), 'save', options(fetcher));

    expect(calls).toHaveLength(0);
    expect(forgetSent).toHaveBeenCalledWith('p-1', TARGET);
  });

  it('화면이 그려질 때는 치우지 않는다 — 사람이 글을 고쳤을 때의 일이다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher } = fakeFetcher({});

    await dispatchMentions(
      post(['https://other.example/x']),
      'catch-up',
      options(fetcher),
    );

    expect(forgetSent).not.toHaveBeenCalled();
  });
});

describe('dispatchMentions — 문지기를 기다린다', () => {
  it('오래전에 낸 글은 기다리지 않는다', async () => {
    const { fetcher } = accepting();

    await dispatchMentions(post([TARGET]), 'save', options(fetcher));

    expect(sleep).not.toHaveBeenCalled();
  });

  it('방금 낸 글은 문지기의 메모(30초)가 비워질 때까지 기다린다', async () => {
    // 받는 쪽은 받자마자 우리 글에 와 본다. 그때 아직 404 면 멘션을 버린다.
    const { fetcher } = accepting();

    await dispatchMentions(
      post([TARGET], { publishAt: NOW - 10_000 }),
      'save',
      options(fetcher),
    );

    expect(sleep).toHaveBeenCalledWith(22_000);
  });

  it('내려 뒀다 올린 글도 방금 열린 글이다 — 저장한 쪽이 알려 준다', async () => {
    const { fetcher } = accepting();

    await dispatchMentions(
      post([TARGET]),
      'save',
      options(fetcher, { justOpened: true }),
    );

    expect(sleep).toHaveBeenCalledWith(32_000);
  });

  it('보낼 것이 없으면 기다리지도 않는다', async () => {
    sentForPost.mockResolvedValue([row()]);
    const { fetcher } = accepting();

    await dispatchMentions(
      post([TARGET], { publishAt: NOW - 1_000 }),
      'save',
      options(fetcher),
    );

    expect(sleep).not.toHaveBeenCalled();
  });
});

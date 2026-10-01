/**
 * 멘션 받기 (IDE-046)
 *
 * 누구나 부를 수 있는 문이다. 지키는 것은 순서와 문지기다 — **싼 검사가 먼저,
 * 남의 서버를 두드리는 일이 맨 뒤** · **출처에 가서 링크를 직접 확인한 것만
 * 담는다** · **담긴 것은 대기다** · **보낸 쪽이 링크를 거두면 내린다.**
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicFetch, PublicResponse, PublicResult } from '../fetchPublic';
import type { Mention } from '../mentions';

const revalidateTag = vi.fn();
const mentionFrom = vi.fn();
const hasPendingRoom = vi.fn();
const createMention = vi.fn();
const reviseMention = vi.fn();
const deleteMention = vi.fn();
const resolveTarget = vi.fn();

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('../mentions', async (original) => ({
  ...(await original<typeof import('../mentions')>()),
  mentionFrom,
  hasPendingRoom,
  createMention,
  reviseMention,
  deleteMention,
}));
vi.mock('../target', async (original) => ({
  ...(await original<typeof import('../target')>()),
  resolveTarget,
}));

const { receiveMention } = await import('../receive');

/** 시험 환경의 사이트 주소다(`lib/site.ts` — 로컬 개발 서버). */
const SITE = 'http://localhost:3000';
const TARGET = `${SITE}/blog/yut-sticks`;
const SOURCE = 'https://blog.example/2026/paper-toys';

const page = (
  html: string,
  over: Partial<PublicResponse> = {},
): PublicResponse => ({
  reached: true,
  status: 200,
  url: SOURCE,
  headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  text: html,
  ...over,
});

const LINKING = `<html><head><title>종이 장난감 모음</title></head><body>
<p>윷놀이는 <a href="${TARGET}">아빠 공방의 윷가락</a>이 제일 잘 굴렀다.</p></body></html>`;

const fetcherOf = (result: PublicResult) =>
  vi.fn<PublicFetch>(async () => result);

const existing = (over: Partial<Mention> = {}): Mention => ({
  id: 'm-1',
  kind: 'post',
  targetId: 'p-1',
  sourceUrl: SOURCE,
  sourceHost: 'blog.example',
  title: '종이 장난감 모음',
  excerpt: '윷놀이는 아빠 공방의 윷가락이 제일 잘 굴렀다.',
  via: 'webmention',
  approvedAt: Date.UTC(2026, 8, 30),
  createdAt: Date.UTC(2026, 8, 29),
  ...over,
});

const receive = (
  fetcher: PublicFetch,
  over: Partial<Parameters<typeof receiveMention>[0]> = {},
) =>
  receiveMention(
    { source: SOURCE, target: TARGET, via: 'webmention', ...over },
    fetcher,
  );

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  resolveTarget.mockResolvedValue({ kind: 'post', targetId: 'p-1' });
  mentionFrom.mockResolvedValue(null);
  hasPendingRoom.mockResolvedValue(true);
  createMention.mockResolvedValue({ ok: true });
  reviseMention.mockResolvedValue({ ok: true });
  deleteMention.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('받는다', () => {
  it('출처에 우리로 오는 링크가 있으면 대기로 담는다', async () => {
    const fetcher = fetcherOf(page(LINKING));

    expect(await receive(fetcher)).toEqual({ status: 'accepted' });
    expect(createMention).toHaveBeenCalledWith({
      kind: 'post',
      targetId: 'p-1',
      sourceUrl: SOURCE,
      sourceHost: 'blog.example',
      title: '종이 장난감 모음',
      excerpt: '윷놀이는 아빠 공방의 윷가락이 제일 잘 굴렀다.',
      via: 'webmention',
    });
    // 담는 값에 승인 칸이 없다 — 비어 있는 것이 대기다.
    expect(createMention.mock.calls[0][0]).not.toHaveProperty('approvedAt');
  });

  it('링크가 www · utm 을 달고 있어도 같은 글로 본다', async () => {
    const html = `<a href="http://www.localhost:3000/blog/yut-sticks/?utm_source=naver#c">윷</a>`;

    expect(await receive(fetcherOf(page(html)))).toEqual({
      status: 'accepted',
    });
  });

  it('출처 주소의 # 뒤는 떼고 담는다 — 같은 글이 두 멘션이 되지 않게', async () => {
    await receive(fetcherOf(page(LINKING)), { source: `${SOURCE}#section-2` });

    expect(mentionFrom).toHaveBeenCalledWith(SOURCE, expect.anything());
    expect(createMention.mock.calls[0][0].sourceUrl).toBe(SOURCE);
  });

  it('핑백으로 온 것은 핑백으로 적는다', async () => {
    await receive(fetcherOf(page(LINKING)), { via: 'pingback' });

    expect(createMention.mock.calls[0][0].via).toBe('pingback');
  });

  it('제목 속의 마크업은 글자로 담긴다', async () => {
    const html = `<title>&lt;img src=x onerror=alert(1)&gt;</title><a href="${TARGET}">x</a>`;
    await receive(fetcherOf(page(html)));

    expect(createMention.mock.calls[0][0].title).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });
});

describe('받지 않는다 — 출처를 두드리기 전에', () => {
  it.each([
    ['웹 주소가 아닌 출처', { source: 'javascript:alert(1)' }],
    ['주소가 아닌 출처', { source: '안녕하세요' }],
    ['너무 긴 출처', { source: `https://blog.example/${'a'.repeat(2_100)}` }],
    ['너무 긴 대상', { target: `${SITE}/blog/${'a'.repeat(2_100)}` }],
  ])('%s', async (_, over) => {
    const fetcher = fetcherOf(page(LINKING));

    expect(await receive(fetcher, over)).toEqual({
      status: 'rejected',
      reason: 'bad-request',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('우리 사이트끼리의 링크는 멘션이 아니다', async () => {
    const fetcher = fetcherOf(page(LINKING));

    expect(
      await receive(fetcher, { source: `${SITE}/blog/another-post` }),
    ).toEqual({ status: 'rejected', reason: 'own-source' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('우리 글 · 게임이 아닌 대상', async () => {
    const fetcher = fetcherOf(page(LINKING));

    expect(
      await receive(fetcher, { target: 'https://elsewhere.example/blog/x' }),
    ).toEqual({ status: 'rejected', reason: 'target-not-found' });
    expect(resolveTarget).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('열려 있지 않은 대상 — 안 낸 글에는 멘션이 붙지 않는다', async () => {
    resolveTarget.mockResolvedValue(null);
    const fetcher = fetcherOf(page(LINKING));

    expect(await receive(fetcher)).toEqual({
      status: 'rejected',
      reason: 'target-not-found',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('저장소에 닿지 못하면 남의 서버도 두드리지 않는다', async () => {
    // 담을 수 없는 멘션을 위해 요청을 걸면, 저장소가 꺼진 동안 이 주소는
    // "아무 데나 요청을 대신 걸어 주는 곳"이 된다.
    mentionFrom.mockResolvedValue(undefined);
    const fetcher = fetcherOf(page(LINKING));

    expect(await receive(fetcher)).toEqual({
      status: 'rejected',
      reason: 'store-failed',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('대기 줄이 찼으면 받지 않는다', async () => {
    hasPendingRoom.mockResolvedValue(false);
    const fetcher = fetcherOf(page(LINKING));

    expect(await receive(fetcher)).toEqual({
      status: 'rejected',
      reason: 'too-many',
    });
    expect(hasPendingRoom).toHaveBeenCalledWith('blog.example');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('받지 않는다 — 출처에 가 보고', () => {
  it('닿지 못했다', async () => {
    const fetcher = fetcherOf({ reached: false, reason: 'blocked' });

    expect(await receive(fetcher)).toEqual({
      status: 'rejected',
      reason: 'source-unreachable',
    });
    expect(createMention).not.toHaveBeenCalled();
  });

  it('출처가 오류로 답했다', async () => {
    expect(await receive(fetcherOf(page('', { status: 500 })))).toEqual({
      status: 'rejected',
      reason: 'source-unreachable',
    });
  });

  it('링크가 없다 — 주소를 적어 보내기만 해서는 세울 수 없다', async () => {
    expect(
      await receive(fetcherOf(page('<p>아빠 공방 이야기는 없다.</p>'))),
    ).toEqual({ status: 'rejected', reason: 'no-link' });
    expect(createMention).not.toHaveBeenCalled();
  });

  it('주소를 글자로만 적은 것은 링크가 아니다', async () => {
    expect(
      await receive(fetcherOf(page(`<p>주소는 ${TARGET} 이다.</p>`))),
    ).toMatchObject({ reason: 'no-link' });
  });

  it('주석 속에 숨긴 링크는 링크가 아니다', async () => {
    expect(
      await receive(fetcherOf(page(`<!-- <a href="${TARGET}">x</a> -->`))),
    ).toMatchObject({ reason: 'no-link' });
  });

  it('우리의 다른 글로 가는 링크로는 이 글의 멘션이 되지 않는다', async () => {
    expect(
      await receive(
        fetcherOf(page(`<a href="${SITE}/blog/another-post">다른 글</a>`)),
      ),
    ).toMatchObject({ reason: 'no-link' });
  });

  it('HTML 이 아닌 응답에서는 링크를 찾지 않는다', async () => {
    expect(
      await receive(
        fetcherOf(
          page(LINKING, {
            headers: new Headers({ 'content-type': 'application/pdf' }),
          }),
        ),
      ),
    ).toMatchObject({ reason: 'no-link' });
  });

  it('담지 못하면 감추지 않는다', async () => {
    createMention.mockResolvedValue({ ok: false, message: '실패' });

    expect(await receive(fetcherOf(page(LINKING)))).toEqual({
      status: 'rejected',
      reason: 'store-failed',
    });
  });
});

describe('다시 온 멘션', () => {
  it('바뀐 것이 없으면 그대로 둔다 — 승인도 그대로다', async () => {
    mentionFrom.mockResolvedValue(existing());

    expect(await receive(fetcherOf(page(LINKING)))).toEqual({
      status: 'unchanged',
    });
    expect(reviseMention).not.toHaveBeenCalled();
    expect(createMention).not.toHaveBeenCalled();
  });

  it('이미 있는 멘션은 대기 줄 한도를 다시 묻지 않는다', async () => {
    mentionFrom.mockResolvedValue(existing());
    hasPendingRoom.mockResolvedValue(false);

    expect(await receive(fetcherOf(page(LINKING)))).toEqual({
      status: 'unchanged',
    });
  });

  it('내용이 바뀌면 고치고, 서 있던 화면을 다시 그리게 한다', async () => {
    mentionFrom.mockResolvedValue(existing({ title: '옛 제목' }));

    expect(await receive(fetcherOf(page(LINKING)))).toEqual({
      status: 'updated',
    });
    // 승인을 푸는 것은 `reviseMention` 의 일이다(`mentions.test.ts`).
    expect(reviseMention).toHaveBeenCalledWith('m-1', {
      title: '종이 장난감 모음',
      excerpt: '윷놀이는 아빠 공방의 윷가락이 제일 잘 굴렀다.',
      via: 'webmention',
    });
    expect(revalidateTag).toHaveBeenCalledWith('mentions:post:p-1', 'max');
  });

  it('보낸 쪽이 링크를 뺐으면 내린다', async () => {
    mentionFrom.mockResolvedValue(existing());

    expect(await receive(fetcherOf(page('<p>링크를 지웠다.</p>')))).toEqual({
      status: 'removed',
    });
    expect(deleteMention).toHaveBeenCalledWith('m-1');
    expect(revalidateTag).toHaveBeenCalledWith('mentions:post:p-1', 'max');
  });

  it.each([404, 410])('출처 글이 사라졌으면(%i) 내린다', async (status) => {
    mentionFrom.mockResolvedValue(existing());

    expect(await receive(fetcherOf(page('', { status })))).toEqual({
      status: 'removed',
    });
    expect(deleteMention).toHaveBeenCalledWith('m-1');
  });

  it('잠깐 안 닿는 것으로는 내리지 않는다', async () => {
    mentionFrom.mockResolvedValue(existing());

    expect(
      await receive(fetcherOf({ reached: false, reason: 'timeout' })),
    ).toMatchObject({ reason: 'source-unreachable' });
    expect(await receive(fetcherOf(page('', { status: 503 })))).toMatchObject({
      reason: 'source-unreachable',
    });
    expect(deleteMention).not.toHaveBeenCalled();
  });

  it('대기 중이던 것이 바뀔 때는 화면을 깨우지 않는다 — 서 있던 적이 없다', async () => {
    mentionFrom.mockResolvedValue(existing({ approvedAt: null, title: '옛' }));

    await receive(fetcherOf(page(LINKING)));

    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

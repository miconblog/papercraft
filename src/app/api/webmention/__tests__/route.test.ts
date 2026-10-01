/**
 * 웹멘션 · 핑백을 받는 주소 (IDE-046)
 *
 * 라우트는 **봉투만 뜯는다.** 검사와 확인은 `receiveMention` 의 일이라 여기서
 * 보는 것은 둘이다 — 봉투에서 주소 둘을 제대로 꺼내 넘기나, 받은 결과를 그
 * 규약의 말로 돌려주나(웹멘션은 상태 코드, 핑백은 오류 번호).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pingbackCallXml, parsePingbackReply } from '@/lib/mentions/xmlrpc';

const receiveMention = vi.fn();
vi.mock('@/lib/mentions/receive', () => ({ receiveMention }));

const webmention = await import('../route');
const pingback = await import('../../pingback/route');

const SOURCE = 'https://blog.example/post?a=1&b=2';
const TARGET = 'https://www.daddyscraft.com/blog/yut-sticks';

const form = (
  entries: Record<string, string>,
  headers: Record<string, string> = {},
) =>
  webmention.POST(
    new Request('http://localhost/api/webmention', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body: new URLSearchParams(entries).toString(),
    }),
  );

const call = (body: string) =>
  pingback.POST(
    new Request('http://localhost/api/pingback', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body,
    }),
  );

beforeEach(() => {
  receiveMention.mockReset().mockResolvedValue({ status: 'accepted' });
});

describe('POST /api/webmention', () => {
  it('폼에서 주소 둘을 꺼내 넘긴다 — 주소의 & 까지 그대로', async () => {
    const response = await form({ source: SOURCE, target: TARGET });

    expect(receiveMention).toHaveBeenCalledWith({
      source: SOURCE,
      target: TARGET,
      via: 'webmention',
    });
    // 확인은 끝났지만 세우는 것은 승인 뒤다 — 그래서 202 다.
    expect(response.status).toBe(202);
  });

  it.each([
    [{ status: 'updated' }, 202],
    [{ status: 'unchanged' }, 200],
    [{ status: 'removed' }, 200],
    [{ status: 'rejected', reason: 'no-link' }, 400],
    [{ status: 'rejected', reason: 'target-not-found' }, 400],
    [{ status: 'rejected', reason: 'source-unreachable' }, 400],
    // 아래 둘은 보낸 쪽 잘못이 아니다 — 나중에 다시 보내라는 답이다.
    [{ status: 'rejected', reason: 'too-many' }, 429],
    [{ status: 'rejected', reason: 'store-failed' }, 503],
  ])('%o → %i', async (outcome, status) => {
    receiveMention.mockResolvedValue(outcome);

    expect((await form({ source: SOURCE, target: TARGET })).status).toBe(
      status,
    );
  });

  it('주소가 하나라도 빠지면 받는 길에 들어서지 않는다', async () => {
    expect((await form({ source: SOURCE })).status).toBe(400);
    expect((await form({ target: TARGET })).status).toBe(400);
    expect(receiveMention).not.toHaveBeenCalled();
  });

  it('폼이 아닌 몸통은 받지 않는다', async () => {
    const response = await webmention.POST(
      new Request('http://localhost/api/webmention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: SOURCE, target: TARGET }),
      }),
    );

    expect(response.status).toBe(415);
    expect(receiveMention).not.toHaveBeenCalled();
  });

  it('너무 큰 몸통은 읽지 않는다', async () => {
    const response = await form({
      source: `https://blog.example/${'a'.repeat(10_000)}`,
      target: TARGET,
    });

    expect(response.status).toBe(413);
    expect(receiveMention).not.toHaveBeenCalled();
  });

  it('브라우저로 열면 여기가 무엇인지 말해 주고, 검색에는 싣지 않는다', async () => {
    const response = webmention.GET();

    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await response.text()).toContain('Webmention');
    expect(pingback.GET().headers.get('x-robots-tag')).toBe('noindex');
  });
});

describe('POST /api/pingback', () => {
  it('XML-RPC 에서 주소 둘을 꺼내 같은 길로 넘긴다', async () => {
    const response = await call(pingbackCallXml(SOURCE, TARGET));

    expect(receiveMention).toHaveBeenCalledWith({
      source: SOURCE,
      target: TARGET,
      via: 'pingback',
    });
    expect(response.headers.get('content-type')).toContain('text/xml');
    expect(parsePingbackReply(await response.text())).toEqual({ ok: true });
  });

  it.each([
    ['no-link', 17],
    ['source-unreachable', 16],
    ['target-not-found', 33],
    ['too-many', 49],
  ])('%s 는 규약의 번호 %i 로 답한다', async (reason, code) => {
    receiveMention.mockResolvedValue({ status: 'rejected', reason });

    const response = await call(pingbackCallXml(SOURCE, TARGET));

    // XML-RPC 는 실패도 200 에 실어 보낸다. 몸통이 실패를 말한다.
    expect(response.status).toBe(200);
    expect(parsePingbackReply(await response.text())).toMatchObject({
      ok: false,
      code,
    });
  });

  it('다른 메서드를 찔러 보는 요청은 받는 길에 들어서지 않는다', async () => {
    const response = await call(
      '<methodCall><methodName>wp.getUsersBlogs</methodName><params/></methodCall>',
    );

    expect(parsePingbackReply(await response.text())).toMatchObject({
      ok: false,
      code: -32601,
    });
    expect(receiveMention).not.toHaveBeenCalled();
  });

  it('읽을 수 없는 몸통에도 XML 로 답한다', async () => {
    const response = await call('XML 이 아니다');

    expect(response.status).toBe(200);
    expect(parsePingbackReply(await response.text())).toMatchObject({
      ok: false,
      code: -32700,
    });
    expect(receiveMention).not.toHaveBeenCalled();
  });
});

/**
 * 수집 엔드포인트 (IDE-013)
 *
 * 브라우저가 보내는 것은 경로와 referrer 뿐이다. 방문자 해시·채널·국가를
 * 클라이언트가 정할 수 있으면 누구나 원하는 숫자를 만들어 넣을 수 있다 —
 * 그것들이 **몸통이 아니라 헤더에서** 나오는지 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordEvent = vi.fn();
vi.mock('@/lib/analytics/record', () => ({ recordEvent }));

const { POST } = await import('../route');

const post = (body: unknown, extra: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/analytics/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/141 Safari/537.36',
        'x-forwarded-for': '203.0.113.7',
        ...extra,
      },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  recordEvent.mockReset().mockResolvedValue({ recorded: true });
});

describe('POST /api/analytics/event', () => {
  it('페이지뷰 한 줄을 넘긴다', async () => {
    const res = await post({ url: '/games/soccer', referrer: null });

    expect(res.status).toBe(204);
    expect(recordEvent).toHaveBeenCalledOnce();
    expect(recordEvent.mock.calls[0][0]).toMatchObject({
      type: 'pageview',
      url: '/games/soccer',
    });
  });

  it('방문자·채널을 정하는 재료는 헤더에서만 온다', async () => {
    await post({
      url: '/',
      referrer: null,
      // 아래는 스키마에 없는 칸이다 — 있어도 그대로 흘러가면 안 된다.
      visitorId: '내가정한값',
      channel: 'organic',
      country: 'US',
    });

    const passed = recordEvent.mock.calls[0][0];
    expect(passed).not.toHaveProperty('visitorId');
    expect(passed).not.toHaveProperty('channel');
    expect(passed).not.toHaveProperty('country');
    expect(passed.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('바깥으로 나가는 경로는 받지 않는다', async () => {
    for (const url of ['//evil.example/x', 'https://evil.example', 'games/x']) {
      recordEvent.mockClear();
      expect((await post({ url })).status, url).toBe(204);
      expect(recordEvent, url).not.toHaveBeenCalled();
    }
  });

  it('몸통이 망가져도 204 다 — 브라우저는 결과로 할 일이 없다', async () => {
    const res = await POST(
      new Request('http://localhost/api/analytics/event', {
        method: 'POST',
        body: 'JSON이 아니다',
      }),
    );
    expect(res.status).toBe(204);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

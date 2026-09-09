/**
 * 기록 경로 통합 (IDE-013)
 *
 * `record_event` RPC 에 **무엇이 실려 나가는지**를 본다. Supabase 는 가짜로
 * 세우고, 방문자 해시·채널·게임 id 를 서버가 헤더에서 만들어 넣는지 확인한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('../client', () => ({ analyticsClient: () => stubClient }));

let stubClient: { rpc: typeof rpc } | null = { rpc };

const { recordEvent } = await import('../record');
const { analyticsConfig } = await import('../config');

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANALYTICS_HASH_SALT: 'test-salt',
};

const headers = (extra: Record<string, string> = {}) =>
  new Headers({
    host: 'daddyscraft.example',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'x-forwarded-for': '203.0.113.7',
    ...extra,
  });

const lastArgs = () => rpc.mock.calls.at(-1)?.[1];

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  stubClient = { rpc };
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  vi.stubEnv('ANALYTICS_ENABLED', '1');
});

describe('recordEvent', () => {
  it('언어와 봇 점수를 함께 실어 보낸다', async () => {
    await recordEvent({
      type: 'pageview',
      url: '/',
      headers: headers({
        'accept-language': 'de-AT,de;q=0.9',
        'sec-ch-ua': '"Chromium";v="141"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
      }),
    });

    expect(lastArgs()).toMatchObject({
      p_lang: 'de',
      p_bot_score: 0,
      p_bot_reason: null,
    });
  });

  it('봇으로 매겨도 줄은 나간다 — 집계에서만 빠진다', async () => {
    const result = await recordEvent({
      type: 'pageview',
      url: '/',
      headers: headers(),
    });

    // 헤더 묶음에 accept-language 가 없다.
    expect(result).toEqual({ recorded: true, channel: 'direct' });
    expect(lastArgs().p_bot_score).toBeGreaterThanOrEqual(2);
    expect(lastArgs().p_bot_reason).toContain('no-accept-language');
  });

  it('제외 쿠키가 있으면 사이트 어디를 열어도 세지 않는다 (IDE-026)', async () => {
    for (const url of ['/', '/games/soccer']) {
      const result = await recordEvent({
        type: 'pageview',
        url,
        headers: headers({ cookie: 'theme=dark; dc_nocount=1' }),
      });

      expect(result).toEqual({ recorded: false, reason: 'opted-out' });
    }

    // 다운로드도 마찬가지다 — 서버가 직접 세는 쪽이라 더 중요하다.
    await recordEvent({
      type: 'download',
      url: '/games/soccer/print',
      headers: headers({ cookie: 'dc_nocount=1' }),
      gameId: 'soccer',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('관리자 화면은 세지 않는다 — 숫자를 보러 갈 때마다 숫자가 늘면 안 된다', async () => {
    for (const url of [
      '/admin',
      '/admin/analytics',
      '/admin/analytics?days=30',
    ]) {
      const result = await recordEvent({
        type: 'pageview',
        url,
        headers: headers(),
      });

      expect(result).toEqual({ recorded: false, reason: 'excluded' });
    }

    expect(rpc).not.toHaveBeenCalled();
  });

  it('페이지를 열면 이벤트 한 줄이 나간다', async () => {
    const result = await recordEvent({
      type: 'pageview',
      url: '/games/soccer',
      headers: headers(),
    });

    expect(result).toEqual({ recorded: true, channel: 'direct' });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe('record_event');
    expect(lastArgs()).toMatchObject({
      p_type: 'pageview',
      p_path: '/games/soccer',
      p_game_id: 'soccer',
      p_channel: 'direct',
    });
  });

  it('게임 상세·에디터·인쇄 세 경로가 모두 그 게임으로 잡힌다', async () => {
    for (const path of [
      '/games/soccer',
      '/games/soccer/edit',
      '/games/soccer/print',
    ]) {
      await recordEvent({ type: 'pageview', url: path, headers: headers() });
      expect(lastArgs().p_game_id, path).toBe('soccer');
    }
  });

  it('같은 방문자는 하루 안에서 같은 해시다 (UV 1)', async () => {
    const now = new Date('2026-09-07T03:00:00Z');
    await recordEvent({ type: 'pageview', url: '/', headers: headers(), now });
    const first = lastArgs().p_visitor_id;

    await recordEvent({
      type: 'pageview',
      url: '/games/soccer',
      headers: headers(),
      now: new Date('2026-09-07T09:00:00Z'),
    });
    expect(lastArgs().p_visitor_id).toBe(first);
    expect(lastArgs().p_day).toBe('2026-09-07');
  });

  it('날이 바뀌면 같은 방문자라도 새 해시다', async () => {
    await recordEvent({
      type: 'pageview',
      url: '/',
      headers: headers(),
      now: new Date('2026-09-07T03:00:00Z'),
    });
    const first = lastArgs().p_visitor_id;

    await recordEvent({
      type: 'pageview',
      url: '/',
      headers: headers(),
      now: new Date('2026-09-08T03:00:00Z'),
    });
    expect(lastArgs().p_visitor_id).not.toBe(first);
    expect(lastArgs().p_day).toBe('2026-09-08');
  });

  it('utm 이 붙은 방문과 안 붙은 방문이 다른 채널로 나간다', async () => {
    await recordEvent({ type: 'pageview', url: '/', headers: headers() });
    expect(lastArgs().p_channel).toBe('direct');

    await recordEvent({
      type: 'pageview',
      url: '/?utm_source=newsletter&utm_medium=email&utm_campaign=fall',
      headers: headers(),
    });
    expect(lastArgs()).toMatchObject({
      p_channel: 'campaign',
      p_utm_source: 'newsletter',
      p_utm_medium: 'email',
      p_utm_campaign: 'fall',
      // 쿼리는 경로에 남기지 않는다.
      p_path: '/',
    });
  });

  it('개인을 특정할 값이 실려 나가지 않는다', async () => {
    await recordEvent({
      type: 'pageview',
      url: '/games/soccer?token=secret',
      referrer: 'https://www.google.com/search?q=아이와+보드게임',
      headers: headers(),
    });

    const payload = JSON.stringify(lastArgs());
    expect(payload).not.toContain('203.0.113.7'); // IP 원본
    expect(payload).not.toContain('AppleWebKit'); // 전체 UA
    expect(payload).not.toContain('secret'); // 쿼리 문자열
    expect(payload).not.toContain('아이와'); // 남의 사이트 검색어
    expect(lastArgs().p_referrer_host).toBe('www.google.com');
    expect(lastArgs().p_channel).toBe('organic');
  });

  it('사이트 안에서 넘어온 것은 유입으로 세지 않는다', async () => {
    await recordEvent({
      type: 'pageview',
      url: '/games/soccer',
      referrer: 'https://daddyscraft.example/',
      headers: headers(),
    });
    expect(lastArgs().p_referrer_host).toBeNull();
    expect(lastArgs().p_channel).toBe('direct');
  });

  it('호스트에 포트가 붙어 있어도 사이트 안 이동을 유입으로 세지 않는다', async () => {
    // referrer URL 의 hostname 에는 포트가 없다. 그대로 견주면 로컬·비표준
    // 포트 배포에서 **내부 이동이 전부 외부 유입**으로 잡힌다.
    await recordEvent({
      type: 'download',
      url: '/games/soccer/print',
      referrer: 'http://daddyscraft.example/games/soccer/print',
      headers: headers({ host: 'daddyscraft.example:3000' }),
      gameId: 'soccer',
    });
    expect(lastArgs().p_referrer_host).toBeNull();
    expect(lastArgs().p_channel).toBe('direct');
  });

  it('봇은 한 줄도 넣지 않는다', async () => {
    const result = await recordEvent({
      type: 'pageview',
      url: '/',
      headers: headers({ 'user-agent': 'Googlebot/2.1' }),
    });
    expect(result).toEqual({ recorded: false, reason: 'bot' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('환경변수가 없으면 조용히 꺼진다', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(analyticsConfig()).toBeNull();

    const result = await recordEvent({
      type: 'pageview',
      url: '/',
      headers: headers(),
    });
    expect(result).toEqual({ recorded: false, reason: 'disabled' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('Supabase 가 죽어 있어도 던지지 않는다', async () => {
    rpc.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      recordEvent({ type: 'pageview', url: '/', headers: headers() }),
    ).resolves.toEqual({ recorded: false, reason: 'error' });

    rpc.mockResolvedValue({ error: { message: '스키마가 노출돼 있지 않다' } });
    await expect(
      recordEvent({ type: 'pageview', url: '/', headers: headers() }),
    ).resolves.toEqual({ recorded: false, reason: 'error' });
  });

  it('경로로 알 수 없는 게임은 넘겨받은 값을 쓴다 (내보내기 API)', async () => {
    await recordEvent({
      type: 'download',
      url: '/api/games/soccer/export',
      headers: headers(),
      gameId: 'soccer',
    });
    expect(lastArgs()).toMatchObject({
      p_type: 'download',
      p_game_id: 'soccer',
    });
  });
});

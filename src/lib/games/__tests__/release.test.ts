/**
 * 게임 예약 공개 — 판정과 읽기 (IDE-022)
 *
 * 여기서 지키는 것은 셋이다. **경계 시각**(오픈 시각 그 순간부터 열린다),
 * **닿지 못하면 전부 공개**(키가 없어도 값이 망가져도 게임이 사라지지 않는다),
 * **KST 벽시계**(관리자가 넣은 날짜가 한국 시간으로 읽힌다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueSession } from '@/lib/analytics/session';
import {
  NO_RELEASES,
  clearRelease,
  formatKst,
  forgetReleases,
  instantToKstLocal,
  isGameVisible,
  isOpen,
  kstLocalToInstant,
  releasesForRequest,
  saveRelease,
  setReleaseHidden,
  toReleaseMap,
} from '../release';

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const enableSupabase = () => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
};

const respondWith = (rows: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 }));

beforeEach(() => {
  forgetReleases();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  forgetReleases();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isOpen', () => {
  const at = Date.UTC(2026, 8, 10, 0, 0, 0);
  const releases = new Map([['soccer', { publishAt: at, hidden: false }]]);

  it('오픈일을 지정하지 않은 게임은 지금까지처럼 열려 있다', () => {
    expect(isOpen(releases, 'baseball', at - 1)).toBe(true);
    expect(isOpen(NO_RELEASES, 'soccer', 0)).toBe(true);
  });

  it('오픈 시각 그 순간부터 열린다 — 1밀리초 전은 닫혀 있다', () => {
    expect(isOpen(releases, 'soccer', at - 1)).toBe(false);
    expect(isOpen(releases, 'soccer', at)).toBe(true);
    expect(isOpen(releases, 'soccer', at + 1)).toBe(true);
  });

  it('내려 두면 오픈 시각이 지났어도 닫혀 있다 — 스위치가 날짜를 이긴다', () => {
    const down = new Map([['soccer', { publishAt: at, hidden: true }]]);
    expect(isOpen(down, 'soccer', at + 86_400_000)).toBe(false);
  });

  it('예약 없이 내려 둔 것도 닫혀 있다', () => {
    const down = new Map([['soccer', { publishAt: null, hidden: true }]]);
    expect(isOpen(down, 'soccer', at)).toBe(false);
  });

  it('날짜가 비어 있고 안 내렸으면 열려 있다', () => {
    const idle = new Map([['soccer', { publishAt: null, hidden: false }]]);
    expect(isOpen(idle, 'soccer', at)).toBe(true);
  });
});

describe('toReleaseMap', () => {
  it('게임 id 가 없는 줄만 버린다', () => {
    const map = toReleaseMap([
      { game_id: 'soccer', publish_at: '2026-09-10T00:00:00+09:00' },
      { game_id: '', publish_at: '2026-09-10T00:00:00Z' },
      { publish_at: '2026-09-10T00:00:00Z' },
      null,
      'nope',
    ]);
    expect([...map.keys()]).toEqual(['soccer']);
  });

  it('망가진 날짜는 "예약 없음"으로 읽되 줄은 살린다 — 그 줄의 내림까지 버리면 안 된다', () => {
    const map = toReleaseMap([
      { game_id: 'soccer', publish_at: '언젠가', hidden: true },
      { game_id: 'baseball', publish_at: '언젠가', hidden: false },
    ]);

    expect(map.get('soccer')).toEqual({ publishAt: null, hidden: true });
    // 내려 둔 것은 날짜가 망가져도 닫혀 있다.
    expect(isOpen(map, 'soccer', 0)).toBe(false);
    // 안 내린 쪽은 열린다 — 감추다 실패하는 쪽보다 낫다.
    expect(isOpen(map, 'baseball', 0)).toBe(true);
  });

  it('hidden 칸이 아직 없는 DB(006 적용 전)는 안 내린 것으로 읽는다', () => {
    const map = toReleaseMap([
      { game_id: 'soccer', publish_at: '2099-01-01T00:00:00+09:00' },
    ]);
    expect(map.get('soccer')?.hidden).toBe(false);
    // 예약은 그대로 돈다 — 칸 하나가 없다고 잡아 둔 날이 풀리면 안 된다.
    expect(isOpen(map, 'soccer', 0)).toBe(false);
  });

  it('배열이 아니면 빈 표다', () => {
    expect(toReleaseMap({ message: 'nope' }).size).toBe(0);
    expect(toReleaseMap(null).size).toBe(0);
  });
});

describe('KST 벽시계', () => {
  it('오픈일 당일 0시(KST)는 전날 15시(UTC)다', () => {
    expect(kstLocalToInstant('2026-09-10T00:00')).toBe(
      Date.parse('2026-09-09T15:00:00Z'),
    );
  });

  it('초가 붙어 있어도 읽는다', () => {
    expect(kstLocalToInstant('2026-09-10T00:00:00')).toBe(
      Date.parse('2026-09-09T15:00:00Z'),
    );
  });

  it('읽을 수 없는 값은 null 이다 — 저장하지 않고 되돌려보낸다', () => {
    for (const bad of ['', '2026-09-10', 'tomorrow', '2026-9-10T00:00']) {
      expect(kstLocalToInstant(bad), bad).toBeNull();
    }
  });

  it('넣은 값이 그대로 다시 나온다', () => {
    const ms = kstLocalToInstant('2026-09-10T09:30');
    expect(instantToKstLocal(ms!)).toBe('2026-09-10T09:30');
    expect(formatKst(ms!)).toBe('2026-09-10 09:30 KST');
  });
});

describe('releasesForRequest', () => {
  it('키가 없으면 DB 를 두드리지 않고 전부 공개다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await releasesForRequest()).size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('수집을 꺼도 예약은 살아 있다 — 방문을 안 세는 것과 게임을 여는 것은 다른 일이다', async () => {
    enableSupabase();
    // `ANALYTICS_ENABLED=0` 은 방문을 세지 말라는 뜻이다. 이것에 예약을 묶어
    // 두면 스위치 하나로 잡아 둔 오픈일이 전부 풀려 게임이 세상에 열린다.
    vi.stubEnv('ANALYTICS_ENABLED', '0');
    vi.stubGlobal(
      'fetch',
      respondWith([
        { game_id: 'soccer', publish_at: '2099-01-01T00:00:00+09:00' },
      ]),
    );
    expect(isOpen(await releasesForRequest(), 'soccer')).toBe(false);
  });

  it('저장소가 답하지 않으면 전부 공개다 — 사이트가 텅 비지 않는다', async () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    expect((await releasesForRequest()).size).toBe(0);

    forgetReleases();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('네트워크가 끊겼다');
      }),
    );
    expect((await releasesForRequest()).size).toBe(0);
  });

  it('읽은 값을 들고 있는다 — 방문마다 DB 를 두드리지 않는다', async () => {
    enableSupabase();
    const fetchMock = respondWith([
      { game_id: 'soccer', publish_at: '2099-01-01T00:00:00+09:00' },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const first = await releasesForRequest();
    const second = await releasesForRequest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(isOpen(first, 'soccer')).toBe(false);
    expect(isOpen(first, 'baseball')).toBe(true);
  });

  it('스키마와 서비스 롤 키를 실어 보낸다', async () => {
    enableSupabase();
    const fetchMock = respondWith([]);
    vi.stubGlobal('fetch', fetchMock);
    await releasesForRequest();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/rest/v1/game_release');
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept-Profile']).toBe('daddys_craft');
    expect(headers.Authorization).toBe(
      `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
    );
  });
});

describe('isGameVisible', () => {
  const PASSWORD = 'admin-password-for-tests';
  const closed = () => {
    enableSupabase();
    vi.stubGlobal(
      'fetch',
      respondWith([
        { game_id: 'soccer', publish_at: '2099-01-01T00:00:00+09:00' },
      ]),
    );
  };

  it('오픈 전 게임은 아무에게도 안 보인다', async () => {
    closed();
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    expect(await isGameVisible('soccer', new Headers())).toBe(false);
  });

  it('관리자 세션이면 오픈 전에도 보인다', async () => {
    closed();
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    const headers = new Headers({
      cookie: `dc_owner=1; dc_admin=${issueSession(PASSWORD)}`,
    });
    expect(await isGameVisible('soccer', headers)).toBe(true);
  });

  it('비밀번호가 설정돼 있지 않으면 아무도 관리자가 아니다', async () => {
    closed();
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    const headers = new Headers({
      cookie: `dc_admin=${issueSession(PASSWORD)}`,
    });
    expect(await isGameVisible('soccer', headers)).toBe(false);
  });

  it('오픈일이 없는 게임은 쿠키가 없어도 보인다', async () => {
    closed();
    expect(await isGameVisible('baseball', new Headers())).toBe(true);
  });
});

/**
 * 쓰기 — **두 칸이 서로를 지우지 않는다** (사용자 요청 2026-09-09)
 *
 * 급히 내리는 일과 날을 잡는 일은 다른 일이다. 한쪽을 만지다 다른 쪽이 조용히
 * 바뀌면, 급할 때 이 화면을 믿을 수 없게 된다.
 */
describe('쓰기', () => {
  /** 지금 DB 에 있는 줄. 쓰기 직전 읽기가 이걸 받는다. */
  const standing = (rows: unknown[]) => {
    enableSupabase();
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push([url, init]);
        return new Response(JSON.stringify(rows), { status: 200 });
      }),
    );
    return calls;
  };

  /** 실제로 보낸 쓰기 요청 하나. */
  const written = (calls: Array<[string, RequestInit]>) => {
    const call = calls.find(([, init]) => init.method !== undefined);
    if (!call) throw new Error('쓰기 요청이 없다');
    return {
      url: call[0],
      method: call[1].method,
      body: call[1].body ? JSON.parse(String(call[1].body)) : null,
    };
  };

  it('오픈 시각을 저장해도 내림은 그대로다', async () => {
    const calls = standing([
      { game_id: 'soccer', publish_at: null, hidden: true },
    ]);
    expect(await saveRelease('soccer', Date.UTC(2030, 4, 5))).toEqual({
      ok: true,
    });

    expect(written(calls).body).toMatchObject({
      game_id: 'soccer',
      publish_at: new Date(Date.UTC(2030, 4, 5)).toISOString(),
      hidden: true,
    });
  });

  it('내려도 잡아 둔 오픈 시각은 그대로다 — 다시 올리면 예약이 이어진다', async () => {
    const at = '2030-05-05T00:00:00.000Z';
    const calls = standing([
      { game_id: 'soccer', publish_at: at, hidden: false },
    ]);
    expect(await setReleaseHidden('soccer', true)).toEqual({ ok: true });

    expect(written(calls).body).toMatchObject({
      game_id: 'soccer',
      publish_at: at,
      hidden: true,
    });
  });

  it('줄이 없던 게임을 내리면 예약 없이 내림만 적힌다', async () => {
    const calls = standing([]);
    expect(await setReleaseHidden('soccer', true)).toEqual({ ok: true });

    expect(written(calls).body).toMatchObject({
      game_id: 'soccer',
      publish_at: null,
      hidden: true,
    });
  });

  it('예약 해제는 내려 둔 게임을 도로 열지 않는다', async () => {
    const calls = standing([
      { game_id: 'soccer', publish_at: '2030-05-05T00:00:00Z', hidden: true },
    ]);
    expect(await clearRelease('soccer')).toEqual({ ok: true });

    const sent = written(calls);
    // 줄을 지우면 내림까지 함께 풀린다. 날짜만 비운다.
    expect(sent.method).toBe('POST');
    expect(sent.body).toMatchObject({ publish_at: null, hidden: true });
  });

  it('남길 이유가 없는 줄은 지운다', async () => {
    const calls = standing([
      { game_id: 'soccer', publish_at: '2030-05-05T00:00:00Z', hidden: false },
    ]);
    expect(await clearRelease('soccer')).toEqual({ ok: true });

    const sent = written(calls);
    expect(sent.method).toBe('DELETE');
    expect(sent.url).toContain('game_id=eq.soccer');
  });

  it('저장소에 닿지 못하면 성공했다고 하지 않는다', async () => {
    // 키가 없다.
    expect(await setReleaseHidden('soccer', true)).toMatchObject({ ok: false });
  });
});

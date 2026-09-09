/**
 * 게임 예약 공개 — 저장·해제 서버 액션 (IDE-022)
 *
 * 여기서 지키는 것은 넷이다. **관리자만 쓴다** · **KST 벽시계로 읽는다** ·
 * **저장 실패를 감추지 않는다**(실패를 삼키면 관리자는 날을 잡아 뒀다고 믿는다) ·
 * **바뀐 값이 목록에 곧바로 보인다**(`updateTag`).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
const updateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock('next/headers', () => ({ cookies: async () => ({ get }) }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/cache', () => ({ updateTag, revalidatePath }));

const { scheduleGame, clearSchedule, setGameHidden } =
  await import('../actions');
const { issueSession } = await import('@/lib/analytics/session');
const { RELEASE_TAG, forgetReleases } = await import('@/lib/games/release');

const PASSWORD = 'admin-password-for-tests';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

/** 로그인한 관리자로 만든다. */
const asAdmin = () => get.mockReturnValue({ value: issueSession(PASSWORD) });

/**
 * 실제로 보낸 **쓰기** 요청.
 *
 * 쓰기 직전에 지금 값을 한 번 읽는다(두 칸이 서로를 지우지 않게). 그래서
 * 첫 호출은 읽기이고, `method` 가 붙은 쪽이 쓰기다.
 */
const writeCall = () => {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
    .calls as unknown as Array<[string, RequestInit]>;
  const call = calls.find(([, init]) => init?.method !== undefined);
  if (!call) throw new Error('쓰기 요청이 없다');
  return {
    url: call[0],
    init: call[1],
    body: call[1].body ? JSON.parse(String(call[1].body)) : null,
  };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  forgetReleases();
  get.mockReset();
  redirect.mockClear();
  notFound.mockClear();
  updateTag.mockClear();
  revalidatePath.mockClear();
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200 })),
  );
});

afterEach(() => {
  forgetReleases();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('scheduleGame', () => {
  it('KST 벽시계를 절대 시각으로 바꿔 저장한다', async () => {
    asAdmin();
    await expect(
      scheduleGame(form({ gameId: 'soccer', publishAt: '2030-05-05T09:00' })),
    ).rejects.toThrow('REDIRECT:/admin/games?saved=soccer');

    const sent = writeCall();
    expect(sent.url).toContain('/rest/v1/game_release');
    expect(sent.init.method).toBe('POST');
    // 같은 게임을 두 번 지정하면 덮어써야 한다 — 줄이 둘이면 어느 쪽이 진짜인지
    // 알 수 없다.
    expect((sent.init.headers as Record<string, string>).Prefer).toBe(
      'resolution=merge-duplicates',
    );
    expect(sent.body).toMatchObject({
      game_id: 'soccer',
      publish_at: new Date('2030-05-05T00:00:00Z').toISOString(),
    });
  });

  it('저장하면 목록이 60초를 기다리지 않는다', async () => {
    asAdmin();
    await expect(
      scheduleGame(form({ gameId: 'soccer', publishAt: '2030-05-05T09:00' })),
    ).rejects.toThrow('REDIRECT:');

    expect(updateTag).toHaveBeenCalledWith(RELEASE_TAG);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('읽을 수 없는 날짜는 저장하지 않고 되돌려보낸다', async () => {
    asAdmin();
    await expect(
      scheduleGame(form({ gameId: 'soccer', publishAt: '언젠가' })),
    ).rejects.toThrow('REDIRECT:/admin/games?error=');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('등록되지 않은 게임은 저장하지 않는다', async () => {
    asAdmin();
    await expect(
      scheduleGame(form({ gameId: '없는게임', publishAt: '2030-05-05T09:00' })),
    ).rejects.toThrow('REDIRECT:/admin/games?error=');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('저장이 실패하면 성공했다고 하지 않는다', async () => {
    asAdmin();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 403 })),
    );
    await expect(
      scheduleGame(form({ gameId: 'soccer', publishAt: '2030-05-05T09:00' })),
    ).rejects.toThrow(/REDIRECT:\/admin\/games\?error=.*403/);
  });

  it('관리자가 아니면 404 다 — 문지기를 지나왔더라도 다시 본다', async () => {
    get.mockReturnValue(undefined);
    await expect(
      scheduleGame(form({ gameId: 'soccer', publishAt: '2030-05-05T09:00' })),
    ).rejects.toThrow('NOT_FOUND');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('clearSchedule', () => {
  it('그 게임의 줄만 지운다', async () => {
    asAdmin();
    await expect(clearSchedule(form({ gameId: 'soccer' }))).rejects.toThrow(
      'REDIRECT:/admin/games?saved=soccer',
    );

    const sent = writeCall();
    expect(sent.url).toContain('game_id=eq.soccer');
    expect(sent.init.method).toBe('DELETE');
    expect(updateTag).toHaveBeenCalledWith(RELEASE_TAG);
  });

  it('관리자가 아니면 404 다', async () => {
    get.mockReturnValue(undefined);
    await expect(clearSchedule(form({ gameId: 'soccer' }))).rejects.toThrow(
      'NOT_FOUND',
    );
  });
});

/**
 * 지금 내리기 · 다시 올리기 (사용자 요청 2026-09-09)
 *
 * 날짜를 잘못 넣어 게임이 열린 것을 뒤늦게 알았을 때 누르는 버튼이다. 빨라야
 * 하고, **다른 것을 건드리지 않아야** 한다.
 */
describe('setGameHidden', () => {
  it('내리면 목록이 60초를 기다리지 않는다', async () => {
    asAdmin();
    await expect(
      setGameHidden(form({ gameId: 'soccer', hide: '1' })),
    ).rejects.toThrow('REDIRECT:/admin/games?saved=soccer');

    expect(writeCall().body).toMatchObject({
      game_id: 'soccer',
      hidden: true,
    });
    expect(updateTag).toHaveBeenCalledWith(RELEASE_TAG);
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('다시 올린다', async () => {
    asAdmin();
    await expect(
      setGameHidden(form({ gameId: 'soccer', hide: '0' })),
    ).rejects.toThrow('REDIRECT:');
    expect(writeCall().body).toMatchObject({ hidden: false });
  });

  it('등록되지 않은 게임은 건드리지 않는다', async () => {
    asAdmin();
    await expect(
      setGameHidden(form({ gameId: '없는게임', hide: '1' })),
    ).rejects.toThrow('REDIRECT:/admin/games?error=');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('관리자가 아니면 404 다', async () => {
    get.mockReturnValue(undefined);
    await expect(
      setGameHidden(form({ gameId: 'soccer', hide: '1' })),
    ).rejects.toThrow('NOT_FOUND');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

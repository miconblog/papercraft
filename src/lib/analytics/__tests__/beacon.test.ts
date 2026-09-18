/**
 * 퍼널 비콘 (IDE-035)
 *
 * 드래그 한 번에 값이 수십 번 바뀐다. 비콘은 **탭 하나에서 경로마다 한 번만**
 * 나가야 한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
  async () => new Response(null, { status: 204 }),
);

const sentBodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)));

const load = async () => {
  vi.resetModules();
  return import('../beacon');
};

const sentTypes = () => sentBodies().map((body) => body.type);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/games/soccer');
});

describe('sendFunnelStep', () => {
  it('같은 단계는 한 번만 보낸다', async () => {
    const { sendFunnelStep } = await load();
    for (let i = 0; i < 10; i++) sendFunnelStep('edit_start');
    sendFunnelStep('print_open');
    expect(sentTypes()).toEqual(['edit_start', 'print_open']);
  });

  it('새로고침해도 같은 탭이면 다시 보내지 않는다', async () => {
    (await load()).sendFunnelStep('edit_start');
    (await load()).sendFunnelStep('edit_start');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('다른 게임에서는 다시 보낸다', async () => {
    const { sendFunnelStep } = await load();
    sendFunnelStep('edit_start');
    window.history.replaceState(null, '', '/games/baseball');
    sendFunnelStep('edit_start');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('경로만 싣고 referrer 는 싣지 않는다', async () => {
    (await load()).sendFunnelStep('print_open');
    expect(sentBodies()[0]).toEqual({
      type: 'print_open',
      url: '/games/soccer',
    });
  });

  it('저장소가 막혀 있어도 한 번만 보낸다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('막힘');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('막힘');
    });
    const { sendFunnelStep } = await load();
    sendFunnelStep('edit_start');
    sendFunnelStep('edit_start');
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('관리자 화면에서는 보내지 않는다', async () => {
    window.history.replaceState(null, '', '/admin/analytics');
    (await load()).sendFunnelStep('print_open');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

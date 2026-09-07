/**
 * 내보내기 라우트의 다운로드 집계 (IDE-013)
 *
 * 다운로드는 **서버가 직접** 센다 — 브라우저 이벤트에 맡기면 차단기에 막히거나
 * 저장 직후 탭을 닫는 사람만큼이 통째로 빠진다. 그리고 그 집계가 무슨 일을
 * 겪든 PDF 응답은 멀쩡해야 한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordEvent = vi.fn();
/** `after` 는 응답 뒤에 도는 것이라, 테스트에서는 모아 뒀다가 직접 돌린다. */
const scheduled: (() => unknown)[] = [];

vi.mock('@/lib/analytics/record', () => ({ recordEvent }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    scheduled.push(task);
  },
}));

const { getGame } = await import('@/lib/games');
const { defaultCustomization } = await import('@/lib/schema');
const { POST } = await import('../route');

const game = getGame('soccer')!;

const call = () =>
  POST(
    new Request('http://localhost/api/games/soccer/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/141 Safari/537.36',
        referer: 'http://localhost/games/soccer/print',
      },
      body: JSON.stringify({
        customization: defaultCustomization(game),
        options: {
          parts: [{ partId: 'field', scale: 1, copies: 1 }],
          marginMm: 6,
          overlapMm: 10,
        },
      }),
    }),
    { params: Promise.resolve({ id: 'soccer' }) } as never,
  );

const runScheduled = () => Promise.all(scheduled.splice(0).map((t) => t()));

beforeEach(() => {
  scheduled.length = 0;
  recordEvent.mockReset().mockResolvedValue({ recorded: true });
});

describe('PDF 다운로드 집계', () => {
  it('브라우저가 이벤트를 안 보내도 서버가 기록한다', async () => {
    const res = await call();
    expect(res.status).toBe(200);

    await runScheduled();
    expect(recordEvent).toHaveBeenCalledOnce();
    expect(recordEvent.mock.calls[0][0]).toMatchObject({
      type: 'download',
      gameId: 'soccer',
    });
  });

  it('PDF 바이트가 다 나간 뒤에 돈다 — 내보내기를 붙잡지 않는다', async () => {
    const res = await call();
    // 응답이 끝난 시점에는 아직 한 번도 불리지 않았다.
    expect(recordEvent).not.toHaveBeenCalled();
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it('집계가 통째로 터져도 PDF 는 그대로 나온다', async () => {
    recordEvent.mockRejectedValue(new Error('Supabase 가 죽었다'));

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
    // 던지지 않는다 — 여기서 새어 나가면 서버 로그가 아니라 사용자가 본다.
    await expect(runScheduled()).resolves.toBeDefined();
  });
});

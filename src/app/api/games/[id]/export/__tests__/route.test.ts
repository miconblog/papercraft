/**
 * 내보내기 라우트.
 *
 * PDF를 **서버에서** 만드는 것이 "지원 브라우저 전부에서 내보내기가 성공한다"를
 * 지키는 방법이다(`docs/print-spec.md` §3). 브라우저별로 확인할 것이 없으려면
 * 이 라우트가 브라우저를 전혀 쓰지 않아야 하고, 그것을 여기서 확인한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { issueSession } from '@/lib/analytics/session';
import { getGame } from '@/lib/games';
import { forgetReleases } from '@/lib/games/release';
import { defaultCustomization, type GameDefinition } from '@/lib/schema';
import { POST } from '../route';

const game = getGame('soccer') as GameDefinition;

type Body = {
  customization: unknown;
  options: unknown;
};

const call = (id: string, body: Body, cookie?: string) =>
  POST(
    new Request(`http://localhost/api/games/${id}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never,
  );

const options = (
  parts: Array<{ partId: string; scale: number; copies: number }>,
) => ({ parts, marginMm: 6, overlapMm: 10 });

describe('POST /api/games/[id]/export', () => {
  it('PDF를 내려준다 — 파일명 규칙과 함께', async () => {
    const res = await call('soccer', {
      customization: defaultCustomization(game),
      options: options([{ partId: 'field', scale: 2, copies: 1 }]),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain(
      'soccer-field-200pct.pdf',
    );

    const pdf = await PDFDocument.load(await res.arrayBuffer());
    // 200% 보드 8장
    expect(pdf.getPageCount()).toBe(8);
  });

  it('커스터마이즈한 값이 담긴 PDF가 나온다', async () => {
    const customization = defaultCustomization(game);
    const res = await call('soccer', {
      customization: {
        ...customization,
        values: { ...customization.values, 'home-player-9': '77' },
      },
      options: options([{ partId: 'field', scale: 1, copies: 1 }]),
    });
    expect(res.status).toBe(200);
    expect(Number(res.headers.get('Content-Length'))).toBeGreaterThan(0);
  });

  it('없는 게임은 404다', async () => {
    const res = await call('없는-게임', {
      customization: defaultCustomization(game),
      options: options([{ partId: 'field', scale: 1, copies: 1 }]),
    });
    expect(res.status).toBe(404);
  });

  it('도안 하한보다 작은 배율은 400으로 막는다 — 값 검증을 클라이언트에만 맡기지 않는다', async () => {
    const res = await call('soccer', {
      customization: defaultCustomization(game),
      options: options([{ partId: 'goals', scale: 0.2, copies: 1 }]),
    });
    expect(res.status).toBe(400);
    expect(
      ((await res.json()) as { messages: string[] }).messages[0],
    ).toContain('읽히지 않는다');
  });

  it('도안과 맞지 않는 커스터마이즈는 400이다', async () => {
    const res = await call('soccer', {
      customization: { gameId: 'soccer', values: {}, positions: {} },
      options: options([{ partId: 'field', scale: 1, copies: 1 }]),
    });
    expect(res.status).toBe(400);
  });

  it('요청 모양이 틀리면 400이다', async () => {
    const res = await call('soccer', {
      customization: defaultCustomization(game),
      options: { parts: [] },
    });
    expect(res.status).toBe(400);
  });
});

/**
 * 오픈 전 게임의 도안은 API 로도 안 나간다 (IDE-022)
 *
 * 화면은 `proxy.ts` 가 막지만 **여기가 도안 바이트가 실제로 나가는 자리**다.
 * 문지기 한 겹만 믿으면 matcher 한 줄이 바뀌는 날 PDF 가 통째로 새어 나간다.
 */
describe('POST /api/games/[id]/export · 오픈 전 게임', () => {
  const PASSWORD = 'admin-password-for-tests';

  const body = () => ({
    customization: defaultCustomization(game),
    options: options([{ partId: 'field', scale: 1, copies: 1 }]),
  });

  beforeEach(() => {
    forgetReleases();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubEnv('ANALYTICS_HASH_SALT', 'salt');
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { game_id: 'soccer', publish_at: '2099-01-01T00:00:00+09:00' },
            ]),
            { status: 200 },
          ),
      ),
    );
  });

  afterEach(() => {
    forgetReleases();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('없는 게임과 똑같이 404 다 — 응답이 다르면 그 차이가 신호가 된다', async () => {
    const res = await call('soccer', body());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ messages: ['없는 게임이다'] });
  });

  it('관리자 세션이면 오픈 전에도 PDF 가 나온다', async () => {
    const res = await call(
      'soccer',
      body(),
      `dc_admin=${issueSession(PASSWORD)}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('오픈일을 지정하지 않은 게임은 그대로 나온다', async () => {
    const baseball = getGame('baseball') as GameDefinition;
    const res = await call('baseball', {
      customization: defaultCustomization(baseball),
      options: options([{ partId: 'field', scale: 1, copies: 1 }]),
    });
    expect(res.status).toBe(200);
  });
});

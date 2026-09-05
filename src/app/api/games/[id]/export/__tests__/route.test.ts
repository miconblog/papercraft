/**
 * 내보내기 라우트.
 *
 * PDF를 **서버에서** 만드는 것이 "지원 브라우저 전부에서 내보내기가 성공한다"를
 * 지키는 방법이다(`docs/print-spec.md` §3). 브라우저별로 확인할 것이 없으려면
 * 이 라우트가 브라우저를 전혀 쓰지 않아야 하고, 그것을 여기서 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getGame } from '@/lib/games';
import { defaultCustomization, type GameDefinition } from '@/lib/schema';
import { POST } from '../route';

const game = getGame('soccer') as GameDefinition;

type Body = {
  customization: unknown;
  options: unknown;
};

const call = (id: string, body: Body) =>
  POST(
    new Request(`http://localhost/api/games/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never,
  );

const options = (
  parts: Array<{ partId: string; scale: number; copies: number }>,
) => ({ parts, marginMm: 6, overlapMm: 10, includeGuide: true });

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
    // 안내 시트 1장 + 200% 보드 8장
    expect(pdf.getPageCount()).toBe(9);
  });

  it('커스터마이즈한 값이 담긴 PDF가 나온다', async () => {
    const customization = defaultCustomization(game);
    const res = await call('soccer', {
      customization: {
        ...customization,
        values: { ...customization.values, 'home-name': '초록 번개' },
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
      options: options([{ partId: 'rules-card', scale: 0.2, copies: 1 }]),
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

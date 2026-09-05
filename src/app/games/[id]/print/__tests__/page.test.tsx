import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => '' })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('인쇄 화면 진입 경로 (IDE-007)', () => {
  it('등록된 게임 id는 렌더링되고 에디터로 돌아가는 링크를 갖는다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '축구 게임판 인쇄하기',
    );
    expect(screen.getByRole('link', { name: /돌아가기/ })).toHaveAttribute(
      'href',
      '/games/soccer/edit',
    );
  });

  it('기준 크기를 화면에 밝힌다 — 배율 100%가 무엇인지 알아야 한다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByText(/운동장이 297×210mm/)).toBeInTheDocument();
  });

  it('실제 내보내기 화면이 함께 렌더링된다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(
      screen.getByRole('button', { name: 'PDF 내려받기' }),
    ).toBeInTheDocument();
  });

  it('없는 게임 id는 notFound를 던진다', async () => {
    await expect(
      Page({ params: Promise.resolve({ id: '없는-게임' }) }),
    ).rejects.toThrow();
  });
});

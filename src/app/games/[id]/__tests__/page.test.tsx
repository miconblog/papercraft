import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page, { generateStaticParams } from '../page';
import { getGame } from '@/lib/games';

describe('게임 상세 페이지', () => {
  it('등록된 게임마다 정적 경로 params를 만든다', () => {
    expect(generateStaticParams()).toEqual(
      expect.arrayContaining([{ id: 'soccer' }]),
    );
  });

  it('축구 게임판 상세를 렌더링한다 — 제목·인원·구성·에디터 링크', async () => {
    const soccer = getGame('soccer')!;
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);

    expect(
      screen.getByRole('heading', { level: 1, name: soccer.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('2인용')).toBeInTheDocument();
    for (const part of soccer.parts) {
      expect(screen.getByText(part.title)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: '만들기 시작' })).toHaveAttribute(
      'href',
      '/games/soccer/edit',
    );
  });

  it('없는 게임 id는 notFound를 던진다', async () => {
    await expect(
      Page({ params: Promise.resolve({ id: '없는-게임' }) }),
    ).rejects.toThrow();
  });
});

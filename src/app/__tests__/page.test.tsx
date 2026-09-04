import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';
import { GAMES } from '@/lib/games';

test('목록 페이지가 h1 헤딩을 렌더링한다', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
});

test('등록소의 게임마다 카드와 상세 페이지 링크가 나온다 — 게임을 추가해도 이 페이지는 손대지 않는다', () => {
  render(<Page />);
  expect(GAMES.length).toBeGreaterThan(0);
  for (const game of GAMES) {
    expect(screen.getByText(game.title)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: new RegExp(game.title) }),
    ).toHaveAttribute('href', `/games/${game.id}`);
  }
});

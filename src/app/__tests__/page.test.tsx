import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';
import { GAMES } from '@/lib/games';
import { boardOf } from '@/lib/games/format';

/**
 * 목록이 오픈 시각을 읽게 되면서(IDE-022) 페이지가 async 가 됐다. 키가 없는
 * 테스트 환경에서는 **전부 공개**로 읽히므로 등록소 그대로가 나온다 — 그것이
 * "Supabase 를 꺼도 게임 다섯이 전부 보인다"이기도 하다.
 */
const renderPage = async () => render(await Page());

test('목록 페이지가 h1 헤딩을 렌더링한다', async () => {
  await renderPage();
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
});

test('등록소의 게임마다 카드와 상세 페이지 링크가 나온다 — 게임을 추가해도 이 페이지는 손대지 않는다', async () => {
  await renderPage();
  expect(GAMES.length).toBeGreaterThan(0);
  for (const game of GAMES) {
    expect(screen.getByText(game.title)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: new RegExp(game.title) }),
    ).toHaveAttribute('href', `/games/${game.id}`);
  }
});

/**
 * 판 방향이 게임마다 다르다 — 축구는 가로, 야구는 세로, 윷놀이는 정사각이다
 * (`IDE-017`). 카드는 늘 A4 가로 크기의 자리를 잡고 그 안에 도안을 통째로
 * 담으므로(`object-contain`) 어떤 비율이 와도 줄이 늘어나거나 그림이 찌그러지지
 * 않는다. 그 규약이 지켜지는지 **그림의 실제 치수로** 확인한다.
 */
test('판 방향이 달라도 썸네일이 찌그러지지 않는다 — 도안 비율 그대로 담긴다', async () => {
  await renderPage();
  for (const game of GAMES) {
    const board = boardOf(game);
    const image = screen.getByAltText(`${game.title} 미리보기`);
    expect(image, game.id).toHaveClass('object-contain');
    // next/image가 비율 계산에 쓰는 값이 곧 파트의 실측 치수다.
    expect(
      Number(image.getAttribute('width')) /
        Number(image.getAttribute('height')),
    ).toBeCloseTo(board.widthMm / board.heightMm, 6);
  }
  // 정사각 판이 실제로 하나는 있어야 이 검사가 뜻을 갖는다.
  expect(GAMES.some((g) => boardOf(g).widthMm === boardOf(g).heightMm)).toBe(
    true,
  );
});

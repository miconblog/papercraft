import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

describe('에디터 진입 경로 (IDE-006이 실제 구현을 채운다)', () => {
  it('등록된 게임 id는 404 없이 렌더링되고 상세 페이지로 돌아가는 링크를 갖는다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /돌아가기/ })).toHaveAttribute(
      'href',
      '/games/soccer',
    );
  });

  it('없는 게임 id는 notFound를 던진다', async () => {
    await expect(
      Page({ params: Promise.resolve({ id: '없는-게임' }) }),
    ).rejects.toThrow();
  });
});

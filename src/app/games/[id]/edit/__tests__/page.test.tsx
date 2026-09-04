import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

afterEach(() => {
  window.localStorage.clear();
});

describe('에디터 진입 경로 (IDE-006)', () => {
  it('등록된 게임 id는 404 없이 렌더링되고 상세 페이지로 돌아가는 링크를 갖는다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /돌아가기/ })).toHaveAttribute(
      'href',
      '/games/soccer',
    );
  });

  it('실제 커스터마이즈 폼이 함께 렌더링된다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByLabelText('홈 팀 이름')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '기본값으로 되돌리기' }),
    ).toBeInTheDocument();
  });

  it('없는 게임 id는 notFound를 던진다', async () => {
    await expect(
      Page({ params: Promise.resolve({ id: '없는-게임' }) }),
    ).rejects.toThrow();
  });
});

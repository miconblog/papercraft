import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

afterEach(() => {
  window.localStorage.clear();
});

describe('게임 화면 = 만들기 (IDE-006)', () => {
  // 2026-09-12 사용자 요청 — 카탈로그에서 누르면 곧장 만들기다. 소개·규칙은
  // `/games/<id>/rules` 로 옮겼고 여기서 한 번에 닿는다.
  it('등록된 게임 id는 404 없이 렌더링되고 목록·게임 방법 링크를 갖는다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /목록으로/ })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: /게임 방법/ })).toHaveAttribute(
      'href',
      '/games/soccer/rules',
    );
  });

  it('실제 커스터마이즈 폼이 함께 렌더링된다', async () => {
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);
    expect(screen.getByLabelText('홈 팀 색')).toBeInTheDocument();
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

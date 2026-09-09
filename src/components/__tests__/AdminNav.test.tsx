/**
 * 관리자 사이드바 메뉴 (IDE-022)
 *
 * 지금 어느 화면인지가 **색으로만** 보이면 스크린리더에게는 아무 말도 안 한 것이
 * 된다. `aria-current` 가 붙는지를 본다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminNav } from '../admin/AdminNav';

const pathname = vi.fn(() => '/admin/analytics');
vi.mock('next/navigation', () => ({ usePathname: () => pathname() }));

afterEach(cleanup);

describe('AdminNav', () => {
  it('관리자 화면마다 가는 길이 있다', () => {
    render(<AdminNav />);
    for (const [label, href] of [
      ['방문 통계', '/admin/analytics'],
      ['게임 공개', '/admin/games'],
      ['공유 링크', '/admin/share'],
    ]) {
      expect(
        screen.getByRole('link', { name: new RegExp(label) }),
        label,
      ).toHaveAttribute('href', href);
    }
  });

  it('지금 보고 있는 화면만 aria-current 다', () => {
    render(<AdminNav />);
    expect(screen.getByRole('link', { name: /방문 통계/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /게임 공개/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('하위 경로에서도 메뉴가 켜져 있다 — `/admin/games/무엇` 이 생겨도 꺼지지 않는다', () => {
    pathname.mockReturnValue('/admin/games/soccer');
    render(<AdminNav />);
    expect(screen.getByRole('link', { name: /게임 공개/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('이름이 겹치는 남의 경로에는 안 걸린다', () => {
    // `startsWith('/admin/games')` 로만 보면 여기에도 걸린다.
    pathname.mockReturnValue('/admin/games-archive');
    render(<AdminNav />);
    expect(screen.getByRole('link', { name: /게임 공개/ })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

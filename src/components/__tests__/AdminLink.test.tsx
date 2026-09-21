/**
 * 헤더의 관리자 메뉴 (IDE-027)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { OWNER_COOKIE } from '@/lib/analytics/cookieNames';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathname.current,
}));

const { AdminLink } = await import('../AdminLink');

const setCookie = (raw: string) => {
  Object.defineProperty(document, 'cookie', {
    value: raw,
    configurable: true,
    writable: true,
  });
};

afterEach(() => {
  setCookie('');
  pathname.current = '/';
});

describe('AdminLink', () => {
  it('주인 쿠키가 있으면 통계로 가는 링크가 나온다', () => {
    setCookie(`${OWNER_COOKIE}=1`);
    render(<AdminLink />);

    expect(screen.getByRole('link', { name: '관리자' })).toHaveAttribute(
      'href',
      '/admin/analytics',
    );
  });

  it('다른 쿠키에 섞여 있어도 찾는다', () => {
    setCookie(`theme=dark; ${OWNER_COOKIE}=1; other=2`);
    render(<AdminLink />);

    expect(screen.getByRole('link', { name: '관리자' })).toBeInTheDocument();
  });

  it('쿠키가 없으면 아무것도 그리지 않는다', () => {
    setCookie('theme=dark');
    const { container } = render(<AdminLink />);

    expect(container).toBeEmptyDOMElement();
  });

  it('이름이 겹치는 남의 쿠키에 걸리지 않는다', () => {
    // 서버 쪽 `isOwnerBrowser` 와 같은 잣대여야 한다.
    setCookie(`x${OWNER_COOKIE}=1`);
    const { container } = render(<AdminLink />);

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * 로그인해도 새로고침 전까지 안 보였다 (2026-09-22 사용자 신고).
   *
   * 헤더는 화면을 옮겨도 그대로 붙어 있다. 로그인은 페이지를 새로 불러오지 않고
   * 끝나므로, 쿠키가 생긴 뒤 **주소만 바뀐다.**
   */
  it('로그인하고 화면을 옮기면 새로고침 없이 나온다', () => {
    setCookie('');
    const { rerender } = render(<AdminLink />);
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull();

    setCookie(`${OWNER_COOKIE}=1`);
    pathname.current = '/admin/analytics';
    rerender(<AdminLink />);
    expect(screen.getByRole('link', { name: '관리자' })).toBeInTheDocument();
  });

  it('다른 탭에서 로그아웃하고 돌아오면 사라진다', () => {
    setCookie(`${OWNER_COOKIE}=1`);
    render(<AdminLink />);
    expect(screen.getByRole('link', { name: '관리자' })).toBeInTheDocument();

    setCookie('');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull();
  });
});

/**
 * 헤더의 관리자 메뉴 (IDE-027)
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminLink } from '../AdminLink';
import { OWNER_COOKIE } from '@/lib/analytics/cookieNames';

const setCookie = (raw: string) => {
  Object.defineProperty(document, 'cookie', {
    value: raw,
    configurable: true,
    writable: true,
  });
};

afterEach(() => setCookie(''));

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
});

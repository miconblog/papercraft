/**
 * 관리자 메뉴의 "처리할 것" 숫자
 *
 * 검토할 댓글이 있으면 메뉴에서 바로 보여야 한다 — 댓글 화면을 열어 봐야 아는
 * 숫자는 아무도 제때 안 본다.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/analytics' }));

const { AdminNav } = await import('../AdminNav');

const commentsLink = () => screen.getByRole('link', { name: /댓글/ });

describe('AdminNav', () => {
  it('대기 댓글이 있으면 댓글 메뉴에 숫자가 붙는다', () => {
    render(<AdminNav counts={{ '/admin/comments': 3 }} />);

    expect(commentsLink()).toHaveTextContent('3');
    // 스크린리더에게는 무엇의 숫자인지까지 들린다.
    expect(commentsLink()).toHaveAccessibleName(/검토 대기 3개/);
  });

  it('0 이면 아무것도 안 붙는다 — 늘 붙은 0 은 눈이 안 간다', () => {
    render(<AdminNav counts={{ '/admin/comments': 0 }} />);

    expect(commentsLink()).toHaveAccessibleName('댓글');
    expect(commentsLink()).not.toHaveTextContent('0');
  });

  it('숫자가 없어도 메뉴는 그대로 선다', () => {
    render(<AdminNav />);

    expect(commentsLink()).toHaveAccessibleName('댓글');
  });

  it('한도를 넘으면 한도+ 로 적는다', () => {
    render(<AdminNav counts={{ '/admin/comments': 100 }} countCap={99} />);

    expect(commentsLink()).toHaveTextContent('99+');
  });

  it('다른 메뉴에는 숫자가 새지 않는다', () => {
    render(<AdminNav counts={{ '/admin/comments': 5 }} />);

    expect(
      screen.getByRole('link', { name: '방문 통계' }),
    ).toHaveAccessibleName('방문 통계');
  });
});

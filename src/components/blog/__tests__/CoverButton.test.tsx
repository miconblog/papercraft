/**
 * 사진 위의 대표 사진 단추 (2026-09-19 사용자 요청)
 *
 * 편집기가 문맥을 내려 줄 때만 선다. 지금 대표 사진이면 눌린 채로 멈춰 있다.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CoverButton, CoverContext } from '../imageControls';

const A = 'https://example.com/a.jpg';
const B = 'https://example.com/b.jpg';

const withCover = (current: string | null, pick = vi.fn()) => (
  <CoverContext.Provider value={{ current, pick }}>
    <CoverButton src={A} />
  </CoverContext.Provider>
);

describe('CoverButton', () => {
  it('편집기 밖(문맥 없음)에서는 그리지 않는다', () => {
    const { container } = render(<CoverButton src={A} />);
    expect(container.innerHTML).toBe('');
  });

  it('누르면 그 사진의 주소로 고른다', () => {
    const pick = vi.fn();
    render(withCover(B, pick));
    const button = screen.getByRole('button', { name: '대표 사진으로 지정' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(pick).toHaveBeenCalledWith(A);
  });

  it('이미 대표 사진이면 눌린 채로 멈춘다 — 눌러도 저장만 한 바퀴 돈다', () => {
    const pick = vi.fn();
    render(withCover(A, pick));
    const button = screen.getByRole('button', { name: '지금 대표 사진' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.textContent).toContain('대표 사진');
  });
});

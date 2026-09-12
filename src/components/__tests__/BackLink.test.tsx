import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackLink } from '../BackLink';

/**
 * 히스토리 길이를 갈아 끼우고, 클릭이 기본 동작(= `href` 따라가기)까지 갔는지
 * 문서에서 본다. jsdom은 실제로 옮겨 가지 않으므로 마지막에 우리가 막는다.
 */
const clickAndWatch = async (historyLength: number) => {
  vi.spyOn(window.history, 'length', 'get').mockReturnValue(historyLength);
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  let followedHref = false;
  const watch = (event: MouseEvent) => {
    followedHref = !event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', watch);
  await userEvent.click(screen.getByRole('link', { name: '← 뒤로' }));
  document.removeEventListener('click', watch);
  return { back, followedHref };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('뒤로가기 (2026-09-12)', () => {
  it('왔던 곳이 있으면 히스토리를 되민다', async () => {
    render(<BackLink fallbackHref="/" />);
    const { back, followedHref } = await clickAndWatch(3);
    expect(back).toHaveBeenCalledOnce();
    expect(followedHref).toBe(false);
  });

  it('주소로 바로 들어왔으면 링크를 따라간다 — 눌러도 아무 일이 없으면 안 된다', async () => {
    render(<BackLink fallbackHref="/" />);
    expect(screen.getByRole('link', { name: '← 뒤로' })).toHaveAttribute(
      'href',
      '/',
    );
    const { back, followedHref } = await clickAndWatch(1);
    expect(back).not.toHaveBeenCalled();
    expect(followedHref).toBe(true);
  });
});

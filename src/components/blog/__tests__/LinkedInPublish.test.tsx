/**
 * 링크드인 칸의 "바로 올리기" (IDE-037)
 *
 * 연결 상태 넷에 따라 다른 것이 선다. 올릴 때는 **카드에서 고친 문구**가 가고,
 * 이미 올린 글이면 한 번 더 묻는다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LinkedInPublish, type LinkedInPanelData } from '../LinkedInPublish';

const data = (over: Partial<LinkedInPanelData> = {}): LinkedInPanelData => ({
  postId: 'p1',
  backPath: '/admin/posts/p1',
  status: { kind: 'connected', name: '손병대', expiresAt: 0 },
  expiresLabel: '2026년 11월 18일',
  posted: [],
  publish: vi.fn(async () => ({
    ok: true as const,
    url: 'https://www.linkedin.com/feed/update/urn:li:share:42/',
    thumbnail: true,
    recorded: true,
  })),
  disconnect: vi.fn(async () => {}),
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('LinkedInPublish', () => {
  it('앱 키가 없으면 무엇을 넣어야 하는지만 말한다', () => {
    render(
      <LinkedInPublish
        data={data({ status: { kind: 'unconfigured' } })}
        text="문구"
        over={false}
      />,
    );
    expect(screen.getByText(/LINKEDIN_CLIENT_ID/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('연결 전이면 이 화면으로 돌아오는 연결 링크를 준다', () => {
    render(
      <LinkedInPublish
        data={data({ status: { kind: 'disconnected' } })}
        text="문구"
        over={false}
      />,
    );
    const link = screen.getByRole('link', { name: '링크드인 연결하기' });
    expect(link.getAttribute('href')).toBe(
      `/admin/linkedin/connect?back=${encodeURIComponent('/admin/posts/p1')}`,
    );
  });

  it('만료됐으면 그렇다고 말하고 다시 연결하게 한다', () => {
    render(
      <LinkedInPublish
        data={data({ status: { kind: 'expired', name: '손병대' } })}
        text="문구"
        over={false}
      />,
    );
    expect(screen.getByText(/만료/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: '링크드인 연결하기' }),
    ).toBeTruthy();
  });

  it('카드에서 고친 문구를 그대로 올리고, 올린 글로 가는 길을 준다', async () => {
    const panel = data();
    render(<LinkedInPublish data={panel} text="고친 문구" over={false} />);

    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: '링크드인에 바로 올리기' }),
      ),
    );

    expect(panel.publish).toHaveBeenCalledWith('p1', '고친 문구');
    expect(
      screen
        .getByRole('link', { name: /링크드인에서 보기/ })
        .getAttribute('href'),
    ).toBe('https://www.linkedin.com/feed/update/urn:li:share:42/');
  });

  it('실패하면 이유를 보여 준다', async () => {
    const panel = data({
      publish: vi.fn(async () => ({
        ok: false as const,
        message: '링크드인 연결이 끊겼습니다. 다시 연결해 주세요.',
      })),
    });
    render(<LinkedInPublish data={panel} text="문구" over={false} />);
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: '링크드인에 바로 올리기' }),
      ),
    );
    expect(screen.getByText(/연결이 끊겼습니다/)).toBeTruthy();
  });

  it('이미 올린 글이면 한 번 더 묻고, 그만두면 보내지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const panel = data({
      posted: [{ url: 'https://www.linkedin.com/x', label: '2026년 9월 19일' }],
    });
    render(<LinkedInPublish data={panel} text="문구" over={false} />);

    expect(screen.getByText(/2026년 9월 19일에 올림/)).toBeTruthy();
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: '링크드인에 바로 올리기' }),
      ),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(panel.publish).not.toHaveBeenCalled();
  });

  it('한도를 넘거나 비었으면 누를 수 없다', () => {
    const { rerender } = render(
      <LinkedInPublish data={data()} text="문구" over />,
    );
    const button = () =>
      screen.getByRole('button', {
        name: '링크드인에 바로 올리기',
      }) as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    rerender(<LinkedInPublish data={data()} text="   " over={false} />);
    expect(button().disabled).toBe(true);
  });
});

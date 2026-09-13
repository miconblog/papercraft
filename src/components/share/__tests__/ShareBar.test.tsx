/**
 * 공유하기 줄 (IDE-029)
 *
 * 지키는 것이 넷이다. **못 쓰는 버튼은 없다**(시스템 공유·카카오톡은 조건부) ·
 * **주소를 브라우저에서 읽지 않는다**(서버가 준 값으로 조립한다) · **복사가
 * 막혀도 길이 있다** · **목차에 끼어들지 않는다**(제목이 아니라 묶음이다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareBar } from '../ShareBar';

// `next/script` 는 테스트 환경에서 실제 스크립트를 싣는다. 카카오 SDK 를 받아
// 오려 들지 않게 자리만 남긴다 — 이 줄의 관심사는 "버튼이 있나"다.
vi.mock('next/script', () => ({
  default: ({ src }: { src: string }) => <link rel="preload" href={src} />,
}));

const PROPS = {
  origin: 'https://example.com',
  path: '/games/soccer',
  title: '축구 게임판',
  description: '한 장으로 뽑는 운동장',
  imageUrl: 'https://example.com/games/soccer/opengraph-image',
  kakaoJsKey: null,
};

const button = (name: string) => screen.getByRole('button', { name });

/**
 * `vi.fn(async () => {})` 은 인자가 없는 것으로 잡혀 `calls[0][0]` 이 타입 오류가
 * 된다. 형태를 제네릭으로 준다 — 쓰지 않는 매개변수를 적어 두는 것보다 낫다.
 */
type ShareFn = (data: {
  title: string;
  text: string;
  url: string;
}) => Promise<void>;
type WriteTextFn = (text: string) => Promise<void>;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('언제나 있는 버튼', () => {
  it('X · 페이스북 · 링크 복사는 조건 없이 선다', () => {
    render(<ShareBar {...PROPS} />);
    expect(button('X')).toBeInTheDocument();
    expect(button('페이스북')).toBeInTheDocument();
    expect(button('링크 복사')).toBeInTheDocument();
  });

  it('제목이 아니라 이름 붙은 묶음이다 — 글의 목차에 끼어들지 않는다', () => {
    render(<ShareBar {...PROPS} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('group', { name: '공유하기' })).toBeInTheDocument();
  });
});

describe('시스템 공유', () => {
  it('`navigator.share` 가 없으면 버튼도 없다', () => {
    render(<ShareBar {...PROPS} />);
    expect(screen.queryByRole('button', { name: '공유' })).toBeNull();
  });

  it('있으면 서버가 준 주소로 부른다 — 주소창을 읽지 않는다', async () => {
    const share = vi.fn<ShareFn>(async () => {});
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<ShareBar {...PROPS} />);

    await userEvent.click(button('공유'));

    const passed = share.mock.calls[0][0];
    expect(passed.title).toBe('축구 게임판');
    // 이 페이지를 무엇을 통해 열었든, 나가는 주소는 이 수단의 것이어야 한다.
    expect(new URL(passed.url).searchParams.get('utm_source')).toBe(
      'web-share',
    );
    expect(new URL(passed.url).origin).toBe('https://example.com');
  });

  it('시트를 닫은 것을 오류로 알리지 않는다', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      share: vi.fn<ShareFn>(async () => {
        throw new Error('AbortError');
      }),
    });
    render(<ShareBar {...PROPS} />);

    await userEvent.click(button('공유'));

    expect(screen.queryByText(/못/)).toBeNull();
  });
});

describe('카카오톡', () => {
  it('키가 없으면 버튼도 SDK 도 없다', () => {
    render(<ShareBar {...PROPS} />);
    expect(screen.queryByRole('button', { name: '카카오톡' })).toBeNull();
  });

  it('키가 있어도 그림이 없으면 버튼이 없다 — 피드 카드가 그림을 요구한다', () => {
    render(<ShareBar {...PROPS} kakaoJsKey="key-1" imageUrl={null} />);
    expect(screen.queryByRole('button', { name: '카카오톡' })).toBeNull();
  });

  it('키와 그림이 다 있으면 선다 — SDK 가 실리기 전에는 못 누른다', () => {
    render(<ShareBar {...PROPS} kakaoJsKey="key-1" />);
    expect(button('카카오톡')).toBeDisabled();
  });
});

describe('링크 복사', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  it('복사하면 그 사실을 말한다', async () => {
    const writeText = vi.fn<WriteTextFn>(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ShareBar {...PROPS} />);

    await userEvent.click(button('링크 복사'));

    expect(
      new URL(writeText.mock.calls[0][0]).searchParams.get('utm_source'),
    ).toBe('copy');
    expect(screen.getByText('링크를 복사했습니다.')).toBeInTheDocument();
  });

  it('복사가 막혀 있으면 주소를 꺼내 놓는다 — 조용히 실패하지 않는다', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn<WriteTextFn>(async () => {
          throw new Error('막혔다');
        }),
      },
    });
    render(<ShareBar {...PROPS} />);

    await userEvent.click(button('링크 복사'));

    const field = screen.getByLabelText<HTMLInputElement>('공유 주소');
    expect(field.value).toContain('utm_source=copy');
    expect(screen.getByText(/아래 주소를 복사/)).toBeInTheDocument();
  });
});

/**
 * 공유 링크 만들기 화면 (IDE-013)
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareLinkBuilder } from '../ShareLinkBuilder';

const ORIGIN = 'https://daddyscraft.example';
const TARGETS = [
  { path: '/', label: '랜딩' },
  { path: '/games/soccer', label: '축구 게임판' },
];

const setup = () => {
  const user = userEvent.setup();
  render(<ShareLinkBuilder origin={ORIGIN} targets={TARGETS} />);
  return user;
};

const link = () =>
  screen.getByLabelText('만들어진 공유 링크').textContent ?? '';

/** 팝업은 비동기로 뜬다 — `findByRole` 이 아니면 열리기 전에 찾는다. */
const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  option: string,
) => {
  await user.click(screen.getByLabelText(field));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('ShareLinkBuilder', () => {
  it('열자마자 쓸 수 있는 링크가 나와 있다', () => {
    setup();
    expect(link()).toBe(
      'https://daddyscraft.example/?utm_source=facebook&utm_medium=social',
    );
  });

  it('기본 채널 셋이 다 있고 직접 입력도 고를 수 있다', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('채널'));

    for (const name of ['페이스북', '인스타그램', '링크드인', '직접 입력']) {
      expect(
        await screen.findByRole('option', { name }),
        name,
      ).toBeInTheDocument();
    }
  });

  it('채널을 바꾸면 utm_source 가 따라 바뀐다', async () => {
    const user = setup();
    await pick(user, '채널', '링크드인');

    expect(link()).toContain('utm_source=linkedin');
    expect(link()).toContain('utm_medium=social');
  });

  it('보낼 곳을 게임 상세로 바꿀 수 있다', async () => {
    const user = setup();
    await pick(user, '어디로 보낼까', '축구 게임판');

    expect(link()).toContain('/games/soccer?');
  });

  it('직접 입력을 고르면 source·medium 칸이 열린다', async () => {
    const user = setup();
    expect(screen.queryByLabelText('utm_source')).not.toBeInTheDocument();

    await pick(user, '채널', '직접 입력');

    await user.type(await screen.findByLabelText('utm_source'), 'Threads');
    expect(link()).toContain('utm_source=threads');
  });

  it('만든 링크가 어느 칸에 쌓일지 알려 준다', async () => {
    const user = setup();
    expect(screen.getByText('소셜')).toBeInTheDocument();

    await pick(user, '채널', '직접 입력');
    await user.clear(await screen.findByLabelText('utm_medium'));
    await user.type(screen.getByLabelText('utm_medium'), 'email');
    await user.type(screen.getByLabelText('utm_source'), 'newsletter');

    expect(await screen.findByText('캠페인(utm)')).toBeInTheDocument();
  });

  it('source 가 비면 채널이 갈리지 않는다고 말해 준다', async () => {
    const user = setup();
    await pick(user, '채널', '직접 입력');

    expect(link()).toBe('https://daddyscraft.example/');
    expect(await screen.findByText('직접 방문')).toBeInTheDocument();
  });

  it('한글 캠페인 이름이 사라지지 않는다', async () => {
    const user = setup();
    await user.type(screen.getByLabelText(/캠페인/), '여름방학');

    expect(new URL(link()).searchParams.get('utm_campaign')).toBe('여름방학');
  });
});

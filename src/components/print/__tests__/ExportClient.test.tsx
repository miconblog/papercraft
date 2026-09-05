import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { defaultCustomization, type GameDefinition } from '@/lib/schema';
import { saveCustomization } from '@/lib/customization/storage';
import { ExportClient } from '../ExportClient';

const game = getGame('soccer') as GameDefinition;

/** 파트 목록에서 제목이 든 줄. 미리보기 탭에도 같은 제목이 있어 범위를 좁힌다. */
const rowOf = (title: string) =>
  within(screen.getByRole('list', { name: '뽑을 파트' }))
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(title))!;

beforeEach(() => {
  window.localStorage.clear();
  // 미리보기가 도안 SVG를 fetch한다. jsdom에는 상대 경로 fetch가 없다.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => '' })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('내보내기 화면 (IDE-007)', () => {
  it('파트마다 무엇인지 알 수 있게 보여 주고 기본으로 전부 고른다', () => {
    render(<ExportClient game={game} />);
    const list = within(screen.getByRole('list', { name: '뽑을 파트' }));
    for (const part of game.parts) {
      expect(list.getByText(part.title)).toBeInTheDocument();
    }
    for (const checkbox of list.getAllByRole('checkbox')) {
      expect(checkbox).toBeChecked();
    }
  });

  it('배율을 바꾸면 A4 몇 장에 걸치는지 그 자리에서 바뀐다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    const board = rowOf('운동장');
    expect(within(board).getByText('A4 2장')).toBeInTheDocument();

    await user.click(within(board).getByRole('button', { name: '200%' }));
    expect(within(board).getByText('A4 8장')).toBeInTheDocument();

    await user.click(within(board).getByRole('button', { name: '50%' }));
    expect(within(board).getByText('A4 1장')).toBeInTheDocument();
  });

  it('임의 배율도 받는다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    const board = rowOf('운동장');
    const input = within(board).getByLabelText('운동장 배율(%)');
    await user.clear(input);
    await user.type(input, '150');
    expect(within(board).getByText('A4 4장')).toBeInTheDocument();
  });

  it('도안이 정한 하한보다 작은 배율은 막고 이유를 적는다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    const rules = rowOf('게임 방법');
    const input = within(rules).getByLabelText('게임 방법 배율(%)');
    await user.clear(input);
    await user.type(input, '40');
    expect(within(rules).getByText(/글자가 읽히지 않는다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF 내려받기' })).toBeDisabled();
  });

  it('배율이 100%가 아니면 원본 크기가 아니라고 적는다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    const board = rowOf('운동장');
    expect(within(board).queryByText(/원본 크기가 아니다/)).toBeNull();
    await user.click(within(board).getByRole('button', { name: '50%' }));
    expect(within(board).getByText(/원본 크기가 아니다/)).toBeInTheDocument();
  });

  it('보드만·부속만 고를 수 있다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    await user.click(screen.getByRole('button', { name: '게임판만' }));
    expect(screen.getByText('모두 A4 2장')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '부속만' }));
    // 점수 기록칸·게임 방법·골대 각 1장 + 공 마커 1장 × 2벌 = 5장
    expect(screen.getByText('모두 A4 5장')).toBeInTheDocument();
  });

  it('벌 수를 올리면 합계 장수가 그만큼 늘어난다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    await user.click(screen.getByRole('button', { name: '게임판만' }));
    const copies = within(rowOf('운동장')).getByLabelText('운동장 몇 벌');
    await user.clear(copies);
    await user.type(copies, '3');
    expect(screen.getByText('모두 A4 6장')).toBeInTheDocument();
  });

  it('프린터 여백을 줄이면 장수가 줄어든다 — 무여백에 가까우면 100%가 한 장이다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    await user.click(screen.getByRole('button', { name: '게임판만' }));
    expect(screen.getByText('모두 A4 2장')).toBeInTheDocument();
    const margin = screen.getByLabelText('인쇄 불가 여백');
    await user.clear(margin);
    await user.type(margin, '0');
    expect(screen.getByText('모두 A4 1장')).toBeInTheDocument();
  });

  it('배율 100%로 인쇄하라는 안내를 화면에 노출한다', () => {
    render(<ExportClient game={game} />);
    expect(screen.getByText('배율 100%로 인쇄한다')).toBeInTheDocument();
    expect(screen.getByText(/용지에 맞춤/)).toBeInTheDocument();
  });

  it('여백 재기 시트를 지금 설정값으로 내려받게 한다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    const margin = screen.getByLabelText('인쇄 불가 여백');
    await user.clear(margin);
    await user.type(margin, '4');
    expect(screen.getByRole('link', { name: /여백 재기/ })).toHaveAttribute(
      'href',
      '/api/print/probe?margin=4',
    );
  });

  it('저장된 커스터마이즈가 있으면 그 값으로 뽑는다고 알린다', () => {
    saveCustomization(defaultCustomization(game));
    render(<ExportClient game={game} />);
    expect(
      screen.getByText(/에디터에서 만든 값으로 뽑는다/),
    ).toBeInTheDocument();
  });

  it('저장된 값이 없으면 기본값으로 뽑는다고 알린다', () => {
    render(<ExportClient game={game} />);
    expect(screen.getByText(/도안 기본값으로 뽑는다/)).toBeInTheDocument();
  });

  it('모든 파트를 끄면 내려받을 수 없다', async () => {
    const user = userEvent.setup();
    render(<ExportClient game={game} />);
    const list = within(screen.getByRole('list', { name: '뽑을 파트' }));
    for (const checkbox of list.getAllByRole('checkbox')) {
      if ((checkbox as HTMLInputElement).checked) await user.click(checkbox);
    }
    expect(screen.getByRole('button', { name: 'PDF 내려받기' })).toBeDisabled();
    expect(screen.getByText(/파트를 하나 이상 고른다/)).toBeInTheDocument();
  });
});

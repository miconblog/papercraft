import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getGame } from '@/lib/games';
import { EditorClient } from '../EditorClient';

const game = getGame('soccer')!;

afterEach(() => {
  window.localStorage.clear();
});

describe('EditorClient (IDE-006 수용 기준)', () => {
  it('축구 게임판의 등번호 22개·팀명 2개·팀 색 2개를 모두 편집할 수 있다', () => {
    render(<EditorClient game={game} />);

    const numberInputs = screen
      .getAllByRole('spinbutton')
      .filter((el) => el.getAttribute('type') === 'number');
    expect(numberInputs).toHaveLength(22);

    expect(screen.getByLabelText('홈 팀 이름')).toBeInTheDocument();
    expect(screen.getByLabelText('원정 팀 이름')).toBeInTheDocument();
    expect(screen.getByLabelText('홈 팀 색')).toBeInTheDocument();
    expect(screen.getByLabelText('원정 팀 색')).toBeInTheDocument();
  });

  it('등번호를 바꾸면 미리보기에 반영된다', async () => {
    render(<EditorClient game={game} />);

    const input = screen.getByLabelText('홈 팀 1번');
    fireEvent.change(input, { target: { value: '77' } });

    await waitFor(() => {
      expect(screen.getByText('77')).toBeInTheDocument();
    });
  });

  it('팀 이름을 바꾸면 미리보기에 반영된다', async () => {
    render(<EditorClient game={game} />);

    const input = screen.getByLabelText('홈 팀 이름');
    fireEvent.change(input, { target: { value: '독수리 팀' } });

    await waitFor(() => {
      expect(screen.getByText('독수리 팀')).toBeInTheDocument();
    });
  });

  it('기본값으로 되돌리기를 누르면 바꾼 값이 되돌아간다', async () => {
    render(<EditorClient game={game} />);

    const input = screen.getByLabelText('홈 팀 1번');
    fireEvent.change(input, { target: { value: '77' } });
    await waitFor(() => expect(input).toHaveValue(77));

    fireEvent.click(screen.getByRole('button', { name: '기본값으로 되돌리기' }));
    await waitFor(() => expect(input).toHaveValue(1));
  });

  it('대형 버튼을 누르면 그 그룹 마커의 좌표가 바뀐다', async () => {
    render(<EditorClient game={game} />);

    const homeSection = screen.getByRole('heading', { name: '홈 팀' }).closest('section')!;
    // 4-4-2(기본)의 홈 2번은 y=48, 3-5-2는 y=62 — 등번호 값은 그대로다.
    const player2Before = screen
      .getAllByText('2')
      .find((el) => el.tagName === 'text' && el.getAttribute('y') === '48');
    expect(player2Before).toBeDefined();

    fireEvent.click(within(homeSection).getByRole('button', { name: '3-5-2' }));

    await waitFor(() => {
      const player2After = screen
        .getAllByText('2')
        .find((el) => el.tagName === 'text' && el.getAttribute('y') === '62');
      expect(player2After).toBeDefined();
    });
    // 버튼도 눌린 상태로 표시된다.
    expect(within(homeSection).getByRole('button', { name: '3-5-2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('기본값으로 되돌리면 대형 선택도 함께 풀린다', async () => {
    render(<EditorClient game={game} />);
    const homeSection = screen.getByRole('heading', { name: '홈 팀' }).closest('section')!;
    const formationButton = within(homeSection).getByRole('button', { name: '3-5-2' });

    fireEvent.click(formationButton);
    await waitFor(() => expect(formationButton).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(screen.getByRole('button', { name: '기본값으로 되돌리기' }));
    await waitFor(() => expect(formationButton).toHaveAttribute('aria-pressed', 'false'));
  });

  it('새로고침해도 입력값이 유지된다 — 저장 후 다시 마운트하면 복원된다', async () => {
    const { unmount } = render(<EditorClient game={game} />);
    const input = screen.getByLabelText('홈 팀 이름');
    fireEvent.change(input, { target: { value: '독수리 팀' } });

    await waitFor(() => {
      expect(window.localStorage.getItem('papercraft:customization:soccer')).toContain(
        '독수리 팀',
      );
    });
    unmount();

    render(<EditorClient game={game} />);
    await waitFor(() => {
      expect(screen.getByLabelText('홈 팀 이름')).toHaveValue('독수리 팀');
    });
  });
});

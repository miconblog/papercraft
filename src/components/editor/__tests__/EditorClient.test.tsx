import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { getGame } from '@/lib/games';
import { defaultCustomization } from '@/lib/schema';
import { loadCustomization } from '@/lib/customization/storage';
import { EditorClient } from '../EditorClient';

const game = getGame('soccer')!;

beforeEach(() => {
  // 마커를 눌렀을 때 입력으로 스크롤하는 경로가 jsdom에는 없다.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
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

  it('팀 이름을 바꾸면 그 이름이 놓인 파트의 미리보기에 반영된다', async () => {
    render(<EditorClient game={game} />);

    const input = screen.getByLabelText('홈 팀 이름');
    fireEvent.change(input, { target: { value: '독수리 팀' } });

    // 팀 이름은 점수 기록칸에 놓인다 — 운동장에서는 뺐다(IDE-010, 2026-09-05).
    fireEvent.click(screen.getByRole('button', { name: '점수 기록칸' }));

    await waitFor(() => {
      expect(screen.getByText('독수리 팀')).toBeInTheDocument();
    });
  });

  it('등번호를 바꾸면 운동장 미리보기에 바로 반영된다', async () => {
    render(<EditorClient game={game} />);

    fireEvent.change(screen.getByLabelText('홈 팀 9번'), {
      target: { value: '77' },
    });

    await waitFor(() => {
      const drawn = screen
        .getAllByText('77')
        .filter((el) => el.tagName === 'text');
      expect(drawn.length).toBeGreaterThan(0);
    });
  });

  it('기본값으로 되돌리기를 누르면 바꾼 값이 되돌아간다', async () => {
    render(<EditorClient game={game} />);

    const input = screen.getByLabelText('홈 팀 1번');
    fireEvent.change(input, { target: { value: '77' } });
    await waitFor(() => expect(input).toHaveValue(77));

    fireEvent.click(
      screen.getByRole('button', { name: '기본값으로 되돌리기' }),
    );
    await waitFor(() => expect(input).toHaveValue(1));
  });

  it('그룹은 좌우로 갈리고 공통 값은 가운데 한 번만 나온다', () => {
    render(<EditorClient game={game} />);
    // 폼을 세 조각으로 나눠 그리므로(좌·가운데·우) 중복 렌더링이 제일 쉬운
    // 실수다. 같은 입력이 두 벌이면 무엇을 고쳤는지 알 수 없다.
    for (const group of game.groups) {
      expect(
        screen.getAllByRole('heading', { name: group.label }),
      ).toHaveLength(1);
    }
    for (const slot of game.slots.filter((s) => !s.groupId)) {
      expect(screen.getAllByLabelText(slot.label)).toHaveLength(1);
    }
    for (const slot of game.slots.filter((s) => s.groupId)) {
      expect(screen.getAllByLabelText(slot.label)).toHaveLength(1);
    }
  });

  it('대형 버튼을 누르면 그 그룹 마커의 좌표가 바뀐다', async () => {
    render(<EditorClient game={game} />);

    const homeSection = screen
      .getByRole('heading', { name: '홈 팀' })
      .closest('section')!;
    // 좌표는 도안에서 읽는다 — 대형 값이 바뀌어도 "버튼이 좌표를 옮긴다"는
    // 이 테스트의 뜻은 그대로여야 한다.
    const homeY = (formationId: string) =>
      String(
        game.presets
          .find((p) => p.formationId === formationId && p.groupId === 'home')!
          .positions.find((pos) => pos.slotId === 'home-player-2')!.yMm,
      );
    const findPlayer2At = (y: string) =>
      screen
        .getAllByText('2')
        .find((el) => el.tagName === 'text' && el.getAttribute('y') === y);

    expect(findPlayer2At(homeY('4-4-2'))).toBeDefined();

    fireEvent.click(within(homeSection).getByRole('button', { name: '3-5-2' }));

    await waitFor(() => {
      expect(findPlayer2At(homeY('3-5-2'))).toBeDefined();
    });
    // 버튼도 눌린 상태로 표시된다.
    expect(
      within(homeSection).getByRole('button', { name: '3-5-2' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('마커를 옮기면 그 팀의 대형 선택 표시가 풀린다', async () => {
    render(<EditorClient game={game} />);
    const homeSection = screen
      .getByRole('heading', { name: '홈 팀' })
      .closest('section')!;

    fireEvent.click(within(homeSection).getByRole('button', { name: '3-5-2' }));
    await waitFor(() =>
      expect(
        within(homeSection).getByRole('button', { name: '3-5-2' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );

    // 손으로 옮긴 순간 그 팀은 더 이상 그 대형이 아니다.
    const marker = screen
      .getAllByRole('button')
      .find((el) => el.getAttribute('aria-label')?.startsWith('홈 팀 9번'))!;
    fireEvent.keyDown(marker, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(
        within(homeSection).getByRole('button', { name: '3-5-2' }),
      ).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  it('옮긴 좌표가 저장돼 새로고침해도 남는다', async () => {
    const { unmount } = render(<EditorClient game={game} />);
    const marker = screen
      .getAllByRole('button')
      .find((el) => el.getAttribute('aria-label')?.startsWith('홈 팀 9번'))!;
    fireEvent.keyDown(marker, { key: 'ArrowRight', shiftKey: true });

    const before = defaultCustomization(game).positions['home-player-9'];
    await waitFor(() => {
      expect(loadCustomization(game)?.positions['home-player-9']).toEqual({
        xMm: before.xMm + 5,
        yMm: before.yMm,
      });
    });

    unmount();
    render(<EditorClient game={game} />);
    const restored = screen
      .getAllByRole('button')
      .find((el) => el.getAttribute('aria-label')?.startsWith('홈 팀 9번'))!;
    await waitFor(() =>
      expect(restored.getAttribute('aria-label')).toContain(
        `가로 ${before.xMm + 5}mm`,
      ),
    );
  });

  it('기본값으로 되돌리면 대형 선택도 함께 풀린다', async () => {
    render(<EditorClient game={game} />);
    const homeSection = screen
      .getByRole('heading', { name: '홈 팀' })
      .closest('section')!;
    const formationButton = within(homeSection).getByRole('button', {
      name: '3-5-2',
    });

    fireEvent.click(formationButton);
    await waitFor(() =>
      expect(formationButton).toHaveAttribute('aria-pressed', 'true'),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '기본값으로 되돌리기' }),
    );
    await waitFor(() =>
      expect(formationButton).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  it('새로고침해도 입력값이 유지된다 — 저장 후 다시 마운트하면 복원된다', async () => {
    const { unmount } = render(<EditorClient game={game} />);
    const input = screen.getByLabelText('홈 팀 이름');
    fireEvent.change(input, { target: { value: '독수리 팀' } });

    await waitFor(() => {
      expect(
        window.localStorage.getItem('papercraft:customization:soccer'),
      ).toContain('독수리 팀');
    });
    unmount();

    render(<EditorClient game={game} />);
    await waitFor(() => {
      expect(screen.getByLabelText('홈 팀 이름')).toHaveValue('독수리 팀');
    });
  });
});

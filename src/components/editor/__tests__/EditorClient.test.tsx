import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { defaultCustomization, slotMarker } from '@/lib/schema';
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
  it('팀 색 2개를 편집하고, 팀 이름·등번호 입력은 두지 않는다', () => {
    render(<EditorClient game={game} />);

    // 색은 마커 **테두리**와 점수 기록칸 막대에 쓰인다 — 원 안은 비어 있다.
    expect(screen.getByLabelText('홈 팀 색')).toBeInTheDocument();
    expect(screen.getByLabelText('원정 팀 색')).toBeInTheDocument();

    // 팀 이름과 등번호는 아이가 종이에 직접 쓰는 자리라 입력을 내지 않는다
    // (2026-09-06 사용자 요청 — "최대한 간결하고 직관적으로"). 마커 자체는
    // 미리보기에 스물두 개가 그대로 있어 끌어 옮길 수 있다.
    expect(screen.queryByLabelText('홈 팀 이름')).toBeNull();
    expect(screen.queryByLabelText('원정 팀 이름')).toBeNull();
    for (const team of ['홈 팀', '원정 팀']) {
      for (let n = 1; n <= 11; n += 1) {
        expect(screen.queryByLabelText(`${team} ${n}번`)).toBeNull();
      }
    }
    const markers = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('aria-label')?.includes('번 마커'));
    expect(markers).toHaveLength(22);
  });

  it('팀 색을 바꾸면 운동장 미리보기의 마커에 반영된다', async () => {
    render(<EditorClient game={game} />);

    fireEvent.change(screen.getByLabelText('홈 팀 색'), {
      target: { value: '#00aa00' },
    });

    // 아트워크를 불러오기 전에는 대체 원이, 불러온 뒤에는 `pc-marker-team`
    // 레이어가 그 색을 받는다 — 어느 쪽이든 그 색으로 칠한 요소가 생긴다.
    await waitFor(() => {
      expect(document.querySelector('[fill="#00aa00"]')).not.toBeNull();
    });
  });

  it('기본값으로 되돌리기를 누르면 바꾼 값이 되돌아간다', async () => {
    render(<EditorClient game={game} />);

    const input = screen.getByLabelText('홈 팀 색');
    fireEvent.change(input, { target: { value: '#00aa00' } });
    await waitFor(() => expect(input).toHaveValue('#00aa00'));

    fireEvent.click(
      screen.getByRole('button', { name: '기본값으로 되돌리기' }),
    );
    await waitFor(() => expect(input).toHaveValue('#1d4ed8'));
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
    // 마커 슬롯은 폼에 입력이 없다 — 미리보기의 마커가 그 편집이다.
    for (const slot of game.slots.filter((s) => s.groupId && !slotMarker(s))) {
      expect(screen.getAllByLabelText(slot.label)).toHaveLength(1);
    }
  });

  /** 홈 팀 대형 셀렉트에서 한 대형을 고른다. */
  const chooseHomeFormation = async (formationId: string) => {
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('홈 팀 대형'));
    // 팝업이 열리는 애니메이션 상태가 걷힐 때까지 기다린다.
    await user.click(await screen.findByRole('option', { name: formationId }));
  };

  it('대형을 고르면 그 그룹 마커의 좌표가 바뀐다', async () => {
    render(<EditorClient game={game} />);

    // 좌표는 도안에서 읽는다 — 대형 값이 바뀌어도 "고르면 좌표를 옮긴다"는
    // 이 테스트의 뜻은 그대로여야 한다.
    const homeY = (formationId: string) =>
      String(
        game.presets
          .find((p) => p.formationId === formationId && p.groupId === 'home')!
          .positions.find((pos) => pos.slotId === 'home-player-2')!.yMm,
      );
    // 등번호가 기본으로 비어 있어(2026-09-05) 글자로는 마커를 찾을 수 없다.
    // 마커의 접근성 이름이 좌표를 그대로 읽어 준다.
    const findPlayer2At = (y: string) =>
      screen.queryByRole('button', {
        name: new RegExp(`홈 팀 2번 마커 — 가로 .+mm, 세로 ${y}mm`),
      });

    // 첫 화면은 기본 대형이고 셀렉트도 그렇게 보인다 — 좌표에서 알아낸다.
    expect(findPlayer2At(homeY('4-3-3'))).not.toBeNull();
    expect(screen.getByLabelText('홈 팀 대형')).toHaveTextContent('4-3-3');

    await chooseHomeFormation('3-5-2');

    await waitFor(() => {
      expect(findPlayer2At(homeY('3-5-2'))).not.toBeNull();
    });
    expect(screen.getByLabelText('홈 팀 대형')).toHaveTextContent('3-5-2');
    // 원정은 그대로다.
    expect(screen.getByLabelText('원정 팀 대형')).toHaveTextContent('4-3-3');
  });

  it('마커를 옮기면 그 팀의 대형 표시가 "직접 배치"로 바뀐다', async () => {
    render(<EditorClient game={game} />);
    expect(screen.getByLabelText('홈 팀 대형')).toHaveTextContent('4-3-3');

    // 손으로 옮긴 순간 그 팀은 더 이상 그 대형이 아니다.
    const marker = screen
      .getAllByRole('button')
      .find((el) => el.getAttribute('aria-label')?.startsWith('홈 팀 9번'))!;
    fireEvent.keyDown(marker, { key: 'ArrowRight' });

    await waitFor(() =>
      expect(screen.getByLabelText('홈 팀 대형')).toHaveTextContent(
        '직접 배치',
      ),
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

  it('기본값으로 되돌리면 대형 표시도 기본 대형으로 돌아간다', async () => {
    render(<EditorClient game={game} />);
    await chooseHomeFormation('3-5-2');
    await waitFor(() =>
      expect(screen.getByLabelText('홈 팀 대형')).toHaveTextContent('3-5-2'),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '기본값으로 되돌리기' }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('홈 팀 대형')).toHaveTextContent('4-3-3'),
    );
  });

  it('출력하기를 누르면 페이지를 옮기지 않고 인쇄 설정 모달이 뜬다', async () => {
    render(<EditorClient game={game} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '출력하기' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: '축구 게임판 출력하기' }),
    ).toBeInTheDocument();
    // 인쇄 페이지와 같은 설정 화면이다 — 파트 목록과 내려받기 버튼.
    expect(
      within(dialog).getByRole('list', { name: '뽑을 파트' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'PDF 내려받기' }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('새로고침해도 입력값이 유지된다 — 저장 후 다시 마운트하면 복원된다', async () => {
    const { unmount } = render(<EditorClient game={game} />);
    const input = screen.getByLabelText('홈 팀 색');
    fireEvent.change(input, { target: { value: '#00aa00' } });

    await waitFor(() => {
      expect(
        window.localStorage.getItem('papercraft:customization:soccer'),
      ).toContain('#00aa00');
    });
    unmount();

    render(<EditorClient game={game} />);
    await waitFor(() => {
      expect(screen.getByLabelText('홈 팀 색')).toHaveValue('#00aa00');
    });
  });
});

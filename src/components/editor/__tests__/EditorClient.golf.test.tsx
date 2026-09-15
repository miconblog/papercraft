/**
 * 골프 에디터 — 판이 열여덟 장인 게임 (IDE-030)
 *
 * 앞선 다섯 게임은 판이 한 장이라 파트 줄의 단추가 서넛이었다. 골프는 홀 판만
 * 열여덟이라 단추가 벽이 되었고, 사용자가 셀렉트로 바꿔 달라고 했다
 * (2026-09-15 — "1번홀부터 18번홀까지 홀 선택은 셀렉트 박스로 바꿔줘").
 *
 * 여기서 보는 것은 셋이다: 홀 열여덟이 셀렉트 하나로 접혔는가, 고르면 그 판이
 * 보이는가, **묶이지 않은 파트는 단추로 남는가**.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { EditorClient } from '../EditorClient';

const game = getGame('golf')!;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  window.localStorage.clear();
});

/** 미리보기 상자. 이름표가 파트 제목으로 시작한다(`BoardPreview`). */
const previewBox = (): HTMLElement =>
  screen.getByRole('group', { name: /미리보기 —/ }) as HTMLElement;

describe('골프 — 홀 열여덟 장을 셀렉트로 고른다', () => {
  it('홀 판은 셀렉트 하나로 접히고 나머지 파트는 단추로 남는다', () => {
    render(<EditorClient game={game} />);

    const holes = screen.getByLabelText('홀 판 고르기');
    expect(holes).toBeInTheDocument();
    // 열여덟 장이 단추로 늘어서지 않는다 — 그것이 이 셀렉트를 만든 이유다.
    expect(screen.queryByRole('button', { name: /^7번 홀/ })).toBeNull();

    // 묶이지 않은 파트는 기록표 하나뿐이다 — 오리고 접을 부속이 없다(IDE-032).
    expect(screen.getByRole('button', { name: '기록표' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '공' })).toBeNull();
  });

  it('첫 화면은 1번 홀이고, 고른 홀이 미리보기에 뜬다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    expect(previewBox().getAttribute('aria-label')).toContain('1번 홀');

    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: /^7번 홀/ }));

    expect(previewBox().getAttribute('aria-label')).toContain('7번 홀');
    // 판 크기는 홀이 바뀌어도 A4 세로 그대로다.
    expect(previewBox().style.aspectRatio).toBe('210 / 297');
  });

  it('홀 판에는 고칠 값이 없고, 기록표로 가면 이름 칸이 나온다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    // 코스 이름 칸을 뺐다(2026-09-16) — 미리 그린 판에서 고칠 것은 없다.
    expect(screen.queryByLabelText('코스 이름')).toBeNull();
    expect(screen.queryByLabelText('1번 선수')).toBeNull();

    await user.click(screen.getByRole('button', { name: '기록표' }));
    for (let n = 1; n <= 4; n += 1) {
      expect(screen.getByLabelText(`${n}번 선수`)).toBeInTheDocument();
    }
  });

  it('나만의 홀에서는 판 위에 끌 수 있는 손잡이가 선다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: '나만의 홀' }));

    // 길 셋 · 벙커 둘 · 카드 하나가 첫 화면이다.
    expect(
      screen.getByRole('button', { name: /^길목 1 —/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^길목 3 —/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^벙커 2 —/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^카드 1 —/ }),
    ).toBeInTheDocument();
    // 미리 그려 둔 홀에는 손잡이가 없다 — 고칠 자리가 아니다.
    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: /^7번 홀/ }));
    expect(screen.queryByRole('button', { name: /^길목 1 —/ })).toBeNull();
  });

  it('화살표 키로 손잡이를 옮기면 판이 따라 바뀐다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: '나만의 홀' }));

    const handle = screen.getByRole('button', { name: /^길목 2 —/ });
    const before = handle.getAttribute('aria-label');
    handle.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');

    const after = screen
      .getByRole('button', { name: /^길목 2 —/ })
      .getAttribute('aria-label');
    expect(after).not.toBe(before);
    // 1mm씩 세 번 — 오른쪽으로 3mm다.
    expect(after).toContain('가로 103mm');
  });

  it('벙커는 폼에서 늘리고 줄인다 — 자리는 판 위에서 끈다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: '나만의 홀' }));

    expect(screen.getAllByRole('button', { name: /^벙커 \d+ —/ })).toHaveLength(
      2,
    );
    await user.click(screen.getByLabelText('벙커 하나 더 놓기'));
    expect(screen.getAllByRole('button', { name: /^벙커 \d+ —/ })).toHaveLength(
      3,
    );
    await user.click(screen.getByLabelText('벙커 마지막 것 빼기'));
    expect(screen.getAllByRole('button', { name: /^벙커 \d+ —/ })).toHaveLength(
      2,
    );
  });

  it('다른 파트로 갔다 와도 셀렉트는 홀을 가리킨다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: /^12번 홀/ }));
    await user.click(screen.getByRole('button', { name: '기록표' }));

    expect(previewBox().getAttribute('aria-label')).toContain('기록표');
    // 묶음이 활성이 아니어도 무엇을 고를 수 있는 자리인지 보여 준다.
    expect(screen.getByLabelText('홀 판 고르기')).toBeInTheDocument();

    await user.click(screen.getByLabelText('홀 판 고르기'));
    await user.click(await screen.findByRole('option', { name: /^12번 홀/ }));
    expect(previewBox().getAttribute('aria-label')).toContain('12번 홀');
  });
});

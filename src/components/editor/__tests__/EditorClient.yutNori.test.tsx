/**
 * 윷놀이 에디터 — 마커도 프리셋도 없는 게임 (IDE-017)
 *
 * 앞선 세 게임에는 판 위에 마커가 있었다. 축구는 선수 스물둘, 야구는 열, 세계
 * 일주는 마커 대신 도시 목록 패널이 판 아래에 붙었다. 윷놀이는 **말이 판 밖에서
 * 시작해** 판에 걸리는 값이 하나도 없다 — 옵션 줄이 통째로 비는 첫 게임이다.
 *
 * 그때 에디터가 빈 화면이나 여백만 남은 상자를 내지 않는지 여기서 본다
 * (`IDE-017` 수용 기준). 고칠 값은 말 시트로 옮겨야 나온다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { loadCustomization } from '@/lib/customization/storage';
import { EditorClient } from '../EditorClient';

const game = getGame('yut-nori')!;

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

describe('윷놀이 — 판에 고칠 값이 없는 에디터', () => {
  it('말판이 첫 화면이고, 옵션이 하나도 없어도 미리보기와 파트 선택은 남는다', () => {
    render(<EditorClient game={game} />);

    // 정사각 판이라 미리보기 상자도 정사각이다 — 찌그러지지 않는다.
    expect(previewBox().style.aspectRatio).toBe('198 / 198');

    for (const title of ['말판', '말 · 네 편', '게임 방법']) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
    expect(
      screen.getByRole('button', { name: '기본값으로 되돌리기' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /출력/ })).toBeInTheDocument();

    // 판에 걸린 슬롯이 없으므로 편 입력은 아직 안 나온다.
    expect(screen.queryByLabelText('1편 이름')).toBeNull();
    expect(screen.queryByLabelText('1편 색')).toBeNull();
    // 마커도 대형 셀렉트도 없다.
    expect(screen.queryAllByLabelText(/대형$/)).toHaveLength(0);
    expect(
      screen
        .getAllByRole('button')
        .filter((el) => el.getAttribute('aria-label')?.includes('마커')),
    ).toHaveLength(0);
  });

  it('말 시트로 옮기면 편 넷의 이름과 색이 나온다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    await user.click(screen.getByRole('button', { name: '말 · 네 편' }));
    for (let n = 1; n <= 4; n += 1) {
      expect(screen.getByLabelText(`${n}편 이름`)).toBeInTheDocument();
      expect(screen.getByLabelText(`${n}편 색`)).toBeInTheDocument();
    }

    await user.type(screen.getByLabelText('1편 이름'), '형');
    expect(loadCustomization(game)?.values['side-1-name']).toBe('형');
  });

  it('게임 방법으로 옮기면 옵션이 다시 하나도 남지 않는다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);

    await user.click(screen.getByRole('button', { name: '말 · 네 편' }));
    expect(screen.getByLabelText('1편 색')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '게임 방법' }));
    expect(screen.queryByLabelText('1편 이름')).toBeNull();
    expect(screen.queryByLabelText('1편 색')).toBeNull();
    // 그래도 화면은 남는다 — 미리보기와 파트 선택, 출력 단추다.
    expect(previewBox()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /출력/ })).toBeInTheDocument();
  });
});

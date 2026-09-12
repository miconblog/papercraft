import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { EditorClient } from '../EditorClient';

/**
 * 미리보기 자리는 파트를 옮겨도 그대로다 (2026-09-12 사용자 요청)
 *
 * 야구 게임판은 야구장·스코어보드가 세로, 선수 스탠드가 가로다. 상자를 지금
 * 파트의 가로세로비로 잡던 시절에는 탭을 옮길 때마다 파트 단추 줄과 아래
 * 패널까지 넓어졌다 좁아졌다 했다 — 누르려던 단추가 그 자리에 없다.
 */
const game = getGame('baseball')!;
const widest = game.parts.reduce((a, b) =>
  a.widthMm / a.heightMm > b.widthMm / b.heightMm ? a : b,
);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  window.localStorage.clear();
});

/** 미리보기 상자 = 파트 미리보기(`role="group"`)를 담은 두 겹의 바깥쪽. */
const boxes = (partTitle: string) => {
  const preview = screen.getByRole('group', {
    name: new RegExp(`^${partTitle} 미리보기`),
  });
  const inner = preview.parentElement as HTMLElement;
  return { inner, outer: inner.parentElement as HTMLElement };
};

describe('미리보기 자리 (가장 넓은 파트에 고정)', () => {
  it('파트를 옮겨도 바깥 상자의 크기 기준이 가장 넓은 파트 그대로다', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorClient game={game} />);
    const root = container.firstElementChild as HTMLElement;

    // 가장 넓은 것은 가로 파트인 선수 스탠드다 — 세로 파트를 보고 있어도 이
    // 기준으로 폭이 잡힌다.
    expect(widest.id).toBe('stands');
    // jsdom 은 `calc()` 안의 나눗셈을 미리 접어 버려서 비율 값으로 본다.
    const fixedWidth = root.style.maxWidth;
    expect(fixedWidth).toContain(String(widest.widthMm / widest.heightMm));

    for (const part of game.parts) {
      await user.click(screen.getByRole('button', { name: part.title }));
      expect(root.style.maxWidth, part.title).toBe(fixedWidth);

      // 자리는 늘 같고, 그 안에서 미리보기만 지금 파트의 모양이다.
      const { inner } = boxes(part.title);
      expect(inner.style.aspectRatio, part.title).toBe(
        `${part.widthMm} / ${part.heightMm}`,
      );
      // 폭은 높이 예산이 허락하는 만큼까지 — 좁은 화면에서는 `100%`가 이긴다.
      expect(inner.style.width, part.title).toContain('min(100%');
    }
  });

  /**
   * 마커 모양 셀렉터는 파트에 따라 사라진다(야구장에는 있고 스코어보드에는
   * 없다). 줄에서 가장 큰 것이 그 셀렉터라, 사라질 때 줄이 낮아지면서 아래가
   * 통째로 흔들렸다 — 줄의 최소 높이를 셀렉터 높이로 박아 둔다.
   */
  it('마커 모양 셀렉터가 사라져도 도구 막대의 높이가 유지된다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    const toolbar = screen.getByRole('group', { name: '편집할 파트 선택' })
      .parentElement as HTMLElement;

    expect(screen.getByLabelText('선수 마커 모양')).toBeInTheDocument();
    expect(toolbar.className).toContain('min-h-8');

    await user.click(screen.getByRole('button', { name: '스코어보드' }));
    expect(screen.queryByLabelText('선수 마커 모양')).toBeNull();
    expect(toolbar.className).toContain('min-h-8');
  });
});

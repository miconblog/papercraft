/**
 * 세계일주 에디터 — 도시 목록으로 판을 바꾼다 (IDE-016)
 *
 * 동적 파트가 에디터에서 실제로 동작하는지 본다. 판 SVG는 서버 API가 그리므로
 * jsdom에서는 fetch를 흉내 내어 어떤 값으로 청했는지만 확인한다. 미리보기 상자의
 * 가로세로비와 파트 크기 안내는 스키마가 계산하므로 여기서 바로 읽힌다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { loadCustomization } from '@/lib/customization/storage';
import { EditorClient } from '../EditorClient';

const game = getGame('world-tour')!;

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (String(url).includes('/list-search')) {
    const q = new URL(String(url), 'http://localhost').searchParams.get('q');
    return {
      ok: true,
      json: async () => ({
        results:
          q === '류블랴나'
            ? [
                {
                  id: 'ne-1',
                  label: '류블랴나',
                  detail: '슬로베니아',
                  item: {
                    id: 'ne-1',
                    label: '류블랴나',
                    data: { lon: 14.5, lat: 46 },
                  },
                },
              ]
            : q === '파리'
              ? [{ id: 'paris', label: '파리', detail: '풀에 있는 도시' }]
              : [],
      }),
    };
  }
  return {
    ok: true,
    text: async () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" data-body="${encodeURIComponent(String(init?.body ?? ''))}"></svg>`,
  };
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const previewBox = (): HTMLElement =>
  screen.getByRole('group', { name: /게임판 미리보기/ }) as HTMLElement;

const lastArtworkRequest = () => {
  const calls = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith('/artwork'),
  );
  const [, init] = calls[calls.length - 1];
  return JSON.parse(String(init?.body)) as {
    partId: string;
    customization: { values: Record<string, unknown> };
  };
};

describe('세계일주 — 도시 목록', () => {
  it('기본은 50개 A4이고, 판 SVG를 서버에 청한다', async () => {
    render(<EditorClient game={game} />);
    expect(previewBox().style.aspectRatio).toBe('297 / 210');
    expect(
      screen.getByRole('group', { name: '도시 묶음' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(lastArtworkRequest().partId).toBe('board');
    });
    expect(lastArtworkRequest().customization.values.cities).toHaveLength(50);
  });

  it('100개 묶음을 고르면 미리보기가 A2 비율이 되고, 값이 저장되며, 판을 다시 청한다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await user.click(
      screen.getByRole('button', { name: '100개 · A2 (A4 4장)' }),
    );
    expect(previewBox().style.aspectRatio).toBe('594 / 420');
    expect(loadCustomization(game)?.values.cities).toHaveLength(100);
    await waitFor(() => {
      expect(lastArtworkRequest().customization.values.cities).toHaveLength(
        100,
      );
    });
  });

  it('도시를 끄고 켜고 차례를 바꾸면 목록 값이 그대로 따라간다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    const route = () =>
      within(screen.getByRole('list', { name: '도시 경로 차례' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent ?? '');

    // 도쿄(1번)를 끈다 — 목록에서 사라지고 나머지 번호가 당겨진다.
    await user.click(screen.getByRole('button', { name: '도쿄 끄기' }));
    expect(loadCustomization(game)?.values.cities).not.toContain('tokyo');
    expect(route()[1]).toContain('괌');

    // 전체 목록에서 부산을 켠다 — 바로 앞에 켜진 도시(베이징) 뒤에 끼어든다.
    await user.click(screen.getByRole('checkbox', { name: /^부산/ }));
    const cities = loadCustomization(game)?.values.cities as string[];
    expect(cities[cities.indexOf('beijing') + 1]).toBe('busan');

    // 호놀룰루를 한 칸 앞으로 — 괌보다 먼저 간다.
    await user.click(screen.getByRole('button', { name: '호놀룰루 앞으로' }));
    const moved = loadCustomization(game)?.values.cities as string[];
    expect(moved.indexOf('honolulu')).toBeLessThan(moved.indexOf('guam'));

    // 서울은 끌 수 없다 — 끄기 버튼도 체크박스도 잠겨 있다.
    expect(screen.queryByRole('button', { name: '서울 끄기' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /^서울/ })).toBeDisabled();
  });

  it('검색해서 풀 밖의 도시를 더하면 목록 끝에 붙고, 풀의 도시는 켜진다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    const box = screen.getByLabelText('검색해서 더하기');

    await user.type(box, '류블랴나');
    await user.click(await screen.findByRole('button', { name: '더하기' }));
    const cities = loadCustomization(game)?.values.cities as unknown[];
    expect(cities[cities.length - 1]).toMatchObject({
      id: 'ne-1',
      label: '류블랴나',
    });
    // 경로 차례에 "직접 추가"로 보이고 끌 수 있다.
    expect(
      screen.getByRole('button', { name: '류블랴나 끄기' }),
    ).toBeInTheDocument();
    // 다시 더할 수는 없다.
    expect(screen.getByRole('button', { name: '있음' })).toBeDisabled();

    // 풀에 있는 도시(파리)는 이미 켜져 있어 "있음"이다. 끄고 검색하면 켜진다.
    await user.click(screen.getByRole('button', { name: '파리 끄기' }));
    await user.clear(box);
    await user.type(box, '파리');
    await user.click(await screen.findByRole('button', { name: '더하기' }));
    expect(loadCustomization(game)?.values.cities).toContain('paris');
  });

  it('"지도만"을 고르면 미리보기가 지도 높이가 된다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await user.click(screen.getByLabelText('판 구성'));
    await user.click(await screen.findByRole('option', { name: '지도만' }));
    expect(previewBox().style.aspectRatio).toBe('297 / 150.62');
    await waitFor(() => {
      expect(lastArtworkRequest().customization.values['board-frame']).toBe(
        'map',
      );
    });
  });

  it('말과 주사위 시트로 옮기면 도시 목록 패널은 사라진다 — 게임판에만 걸린 값이다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await user.click(screen.getByRole('button', { name: '말과 주사위' }));
    expect(screen.queryByRole('group', { name: '도시 묶음' })).toBeNull();
    expect(screen.getByLabelText('말 1 이름')).toBeInTheDocument();
  });
});

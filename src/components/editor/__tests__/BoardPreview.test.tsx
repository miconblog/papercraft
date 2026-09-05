import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultCustomization } from '@/lib/schema';
import { getGame } from '@/lib/games';
import {
  BoardPreview,
  __resetMarkerArtworkCacheForTests,
} from '../BoardPreview';

const game = getGame('soccer')!;
const board = game.parts.find((p) => p.kind === 'board')!;

const publicDir = path.join(process.cwd(), 'public');
const readPublic = (assetPath: string) =>
  readFileSync(path.join(publicDir, assetPath), 'utf-8');

describe('BoardPreview — 마커 아트워크 (선수 마커 모양을 실제 그림으로 보여준다)', () => {
  beforeEach(() => {
    // 마커 아트워크는 모듈 레벨 캐시를 쓴다(BoardPreview.tsx) — 파트를 오가도
    // 다시 fetch하지 않기 위해서다. 테스트끼리는 매번 처음 불러오는 상태로
    // 시작해야 하므로 비운다.
    __resetMarkerArtworkCacheForTests();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        text: async () => readPublic(url),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('기본 스타일(원형)의 실제 아트워크를 불러와 팀 색으로 칠한다', async () => {
    const customization = defaultCustomization(game);
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );

    await waitFor(() => {
      // 원형 마커 SVG의 표식 — 원+등번호 대체 표시(circle만 있고 pc-art
      // 레이어가 없다)가 아니라 실제 아트워크가 꽂혔는지 이 id로 구분한다.
      expect(
        document.querySelector('[id="pc-marker-fill"]'),
      ).toBeInTheDocument();
    });
    const fillLayer = document.querySelector('[id="pc-marker-fill"]')!;
    // 홈 팀 기본색(#1d4ed8)으로 칠해졌다.
    expect(fillLayer.getAttribute('fill')).toBe('#1d4ed8');
  });

  it('마커 모양을 일러스트로 바꾸면 일러스트 아트워크가 반영된다', async () => {
    const customization = defaultCustomization(game);
    customization.values['marker-style'] = 'illustration';
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );

    await waitFor(() => {
      const titles = [...document.querySelectorAll('svg.absolute title')].map(
        (t) => t.textContent,
      );
      expect(titles.some((t) => t?.includes('일러스트'))).toBe(true);
    });
  });

  it('아트워크를 불러오기 전에는 원 + 값으로 대체해 보여준다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    ); // 영원히 응답 없음
    const customization = defaultCustomization(game);
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );
    // 등번호 값 자체는 즉시 보인다 — 대체 표시(circle)만 그림 대신 쓴다.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(
      document.querySelector('[id="pc-marker-fill"]'),
    ).not.toBeInTheDocument();
  });
});

describe('BoardPreview — 마커 옮기기 (프리셋은 출발점일 뿐이다)', () => {
  /**
   * jsdom은 레이아웃을 하지 않아 `getBoundingClientRect`가 전부 0이다.
   * 미리보기 상자를 파트와 같은 가로세로비로 흉내 내야 화면 픽셀 → 도안 mm
   * 변환이 실제와 같은 값을 낸다.
   */
  const PX_PER_MM = 2;
  const mockSurface = () => {
    Element.prototype.getBoundingClientRect = function () {
      if (this.tagName.toLowerCase() !== 'svg') return new DOMRect(0, 0, 0, 0);
      return new DOMRect(
        0,
        0,
        board.widthMm * PX_PER_MM,
        board.heightMm * PX_PER_MM,
      );
    };
  };
  const original = Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({ text: async () => readPublic(url) })),
    );
    mockSurface();
    // jsdom에는 없다. 없으면 포커스를 옮기기 전에 예외가 난다.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = original;
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    vi.unstubAllGlobals();
  });

  const markerOf = (label: string) =>
    screen
      .getAllByRole('button')
      .find((el) => el.getAttribute('aria-label')?.startsWith(label))!;

  const pointer = (type: string, x: number, y: number) =>
    Object.assign(new Event(type, { bubbles: true }), {
      pointerId: 1,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    });

  it('마커를 끌면 그 자리로 옮겨진다', () => {
    const moves: Array<[string, { xMm: number; yMm: number }]> = [];
    render(
      <BoardPreview
        game={game}
        part={board}
        customization={defaultCustomization(game)}
        onMoveSlot={(slotId, point) => moves.push([slotId, point])}
      />,
    );

    const marker = markerOf('홈 팀 9번');
    const from = defaultCustomization(game).positions['home-player-9'];
    marker.dispatchEvent(
      pointer('pointerdown', from.xMm * PX_PER_MM, from.yMm * PX_PER_MM),
    );
    marker.dispatchEvent(
      pointer(
        'pointermove',
        (from.xMm + 20) * PX_PER_MM,
        (from.yMm - 10) * PX_PER_MM,
      ),
    );
    marker.dispatchEvent(
      pointer(
        'pointerup',
        (from.xMm + 20) * PX_PER_MM,
        (from.yMm - 10) * PX_PER_MM,
      ),
    );

    expect(moves.length).toBeGreaterThan(0);
    const [slotId, point] = moves[moves.length - 1];
    expect(slotId).toBe('home-player-9');
    expect(point.xMm).toBeCloseTo(from.xMm + 20, 6);
    expect(point.yMm).toBeCloseTo(from.yMm - 10, 6);
  });

  it('잡은 자리와 중심의 차이를 지킨다 — 마커가 손끝으로 튀지 않는다', () => {
    const moves: Array<{ xMm: number; yMm: number }> = [];
    render(
      <BoardPreview
        game={game}
        part={board}
        customization={defaultCustomization(game)}
        onMoveSlot={(_slotId, point) => moves.push(point)}
      />,
    );

    const marker = markerOf('홈 팀 9번');
    const from = defaultCustomization(game).positions['home-player-9'];
    // 중심에서 4mm 벗어난 가장자리를 잡는다.
    const grabXMm = from.xMm + 4;
    marker.dispatchEvent(
      pointer('pointerdown', grabXMm * PX_PER_MM, from.yMm * PX_PER_MM),
    );
    marker.dispatchEvent(
      pointer('pointermove', (grabXMm + 30) * PX_PER_MM, from.yMm * PX_PER_MM),
    );

    // 포인터가 30mm 갔으면 중심도 30mm 간다 — 잡은 오프셋만큼 그대로 유지.
    expect(moves[moves.length - 1].xMm).toBeCloseTo(from.xMm + 30, 6);
  });

  it('끌지 않고 누르기만 하면 그 입력으로 포커스가 간다', () => {
    const moves: unknown[] = [];
    render(
      <>
        <input id="slot-field-home-player-9" />
        <BoardPreview
          game={game}
          part={board}
          customization={defaultCustomization(game)}
          onMoveSlot={(...args) => moves.push(args)}
        />
      </>,
    );

    const marker = markerOf('홈 팀 9번');
    const from = defaultCustomization(game).positions['home-player-9'];
    marker.dispatchEvent(
      pointer('pointerdown', from.xMm * PX_PER_MM, from.yMm * PX_PER_MM),
    );
    marker.dispatchEvent(
      pointer('pointerup', from.xMm * PX_PER_MM, from.yMm * PX_PER_MM),
    );

    expect(moves).toHaveLength(0);
    expect(document.getElementById('slot-field-home-player-9')).toHaveFocus();
  });

  it('화살표 키로도 옮긴다 — 드래그만 두면 키보드로는 배치를 못 바꾼다', () => {
    const moves: Array<{ xMm: number; yMm: number }> = [];
    render(
      <BoardPreview
        game={game}
        part={board}
        customization={defaultCustomization(game)}
        onMoveSlot={(_slotId, point) => moves.push(point)}
      />,
    );

    const marker = markerOf('홈 팀 9번');
    const from = defaultCustomization(game).positions['home-player-9'];
    fireEvent.keyDown(marker, { key: 'ArrowRight' });
    expect(moves[0]).toEqual({ xMm: from.xMm + 1, yMm: from.yMm });

    fireEvent.keyDown(marker, { key: 'ArrowUp', shiftKey: true });
    expect(moves[1]).toEqual({ xMm: from.xMm, yMm: from.yMm - 5 });

    fireEvent.keyDown(marker, { key: 'Enter' });
    expect(moves).toHaveLength(2);
  });

  it('보기 전용 미리보기에서는 마커가 움직이지 않는다', () => {
    render(
      <BoardPreview
        game={game}
        part={board}
        customization={defaultCustomization(game)}
        interactive={false}
      />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

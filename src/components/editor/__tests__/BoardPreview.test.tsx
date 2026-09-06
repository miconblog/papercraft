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

  it('기본 스타일(선수 그림 · 색칠용)의 실제 아트워크를 불러온다', async () => {
    const customization = defaultCustomization(game);
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );

    await waitFor(() => {
      // 실제 아트워크가 꽂혔는지는 `pc-art` 레이어로 구분한다 — 대체 표시는
      // 그 레이어 없이 circle만 그린다. 팀 색을 받던 `pc-marker-fill` 레이어는
      // 마커를 빈 원으로 바꾸면서 없앴다(2026-09-05).
      expect(document.querySelector('[id="pc-art"]')).toBeInTheDocument();
    });
    expect(document.querySelector('[id="pc-marker-fill"]')).toBeNull();
  });

  it('마커 모양을 선수 그림으로 바꾸면 자세가 여럿인 그림이 반영된다', async () => {
    const customization = defaultCustomization(game);
    customization.values['marker-style'] = 'illustration';
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );

    await waitFor(() => {
      const titles = [...document.querySelectorAll('svg.absolute title')].map(
        (t) => t.textContent,
      );
      expect(titles.some((t) => t?.includes('실루엣'))).toBe(true);
      // 선수마다 자세가 다르다(2026-09-06) — 제목에 자세 이름이 들어 있어
      // 같은 그림이 스물두 번 찍히지 않았음을 여기서 본다.
      expect(new Set(titles).size).toBeGreaterThan(2);
    });
  });

  it('아트워크를 불러오기 전에는 원으로 대체해 보여준다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    ); // 영원히 응답 없음
    const customization = defaultCustomization(game);
    // 등번호가 있으면 값도 즉시 보인다 — 대체 표시(circle)만 그림 대신 쓴다.
    customization.values['home-player-1'] = '7';
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
    expect(document.querySelector('[id="pc-art"]')).toBeNull();
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

  /**
   * 예전에는 누르면 그 슬롯의 입력창으로 커서가 갔다(IDE-006). 배치를 손보는
   * 동안 화면이 자꾸 입력 쪽으로 튀어 방해가 돼 회전으로 바꿨다(2026-09-05
   * 사용자 요청).
   */
  it('끌지 않고 누르기만 하면 마커가 45° 돌고, 포커스는 옮겨 가지 않는다', () => {
    const moves: Array<{ xMm: number; yMm: number; rotationDeg?: number }> = [];
    render(
      <>
        <input id="slot-field-home-player-9" />
        <BoardPreview
          game={game}
          part={board}
          customization={defaultCustomization(game)}
          onMoveSlot={(_slotId, point) => moves.push(point)}
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

    expect(moves).toEqual([{ ...from, rotationDeg: 45 }]);
    expect(
      document.getElementById('slot-field-home-player-9'),
    ).not.toHaveFocus();
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
    expect(moves[0]).toEqual({ ...from, xMm: from.xMm + 1 });

    fireEvent.keyDown(marker, { key: 'ArrowUp', shiftKey: true });
    expect(moves[1]).toEqual({ ...from, yMm: from.yMm - 5 });
  });

  /**
   * SVG `<g>`는 `role="button"`이어도 네이티브 버튼이 아니라 Enter·Space가
   * 저절로 클릭이 되지 않는다. 키보드만 쓰는 사람도 돌릴 수 있어야 해서
   * 직접 받는다.
   */
  it('r · Enter · Space로도 돌리고, Shift를 누르면 반대로 돈다', () => {
    const moves: Array<{ rotationDeg?: number }> = [];
    render(
      <BoardPreview
        game={game}
        part={board}
        customization={defaultCustomization(game)}
        onMoveSlot={(_slotId, point) => moves.push(point)}
      />,
    );

    const marker = markerOf('홈 팀 9번');
    for (const key of ['r', 'Enter', ' ']) {
      fireEvent.keyDown(marker, { key });
    }
    // 좌표는 부모가 들고 있어 각 호출이 0°에서 출발한다 — 셋 다 45°다.
    expect(moves.map((m) => m.rotationDeg)).toEqual([45, 45, 45]);

    fireEvent.keyDown(marker, { key: 'r', shiftKey: true });
    // 한 바퀴 아래로 내려가지 않고 315°로 접힌다.
    expect(moves[3].rotationDeg).toBe(315);
  });

  /**
   * 회전 축이 마커 **중심**이라야 돌려도 자리가 그대로다. SVG는 변환을 왼쪽부터
   * 적용하므로 `translate(중심) rotate() translate(-절반)` 차례여야 하고,
   * 회전이 뒤집기(`scale(-1,1)`)보다 **앞**에 와야 원정 마커가 반대로 돌지
   * 않는다. 인쇄 렌더러도 같은 차례다(`lib/print/compose.ts`).
   */
  it('회전은 마커 중심을 축으로 하고, 뒤집기보다 앞에 온다', async () => {
    const customization = defaultCustomization(game);
    customization.positions['away-player-9'] = {
      ...customization.positions['away-player-9'],
      rotationDeg: 90,
    };
    render(
      <BoardPreview
        game={game}
        part={board}
        customization={customization}
        onMoveSlot={() => {}}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[id="pc-art"]')).toBeInTheDocument();
    });
    const at = customization.positions['away-player-9'];
    const marker = markerOf('원정 팀 9번');
    const transform = marker
      .querySelector('g[transform]')!
      .getAttribute('transform')!;
    expect(transform).toContain(`translate(${at.xMm}, ${at.yMm})`);
    expect(transform.indexOf('rotate(90)')).toBeGreaterThan(
      transform.indexOf('translate('),
    );
    expect(transform.indexOf('rotate(90)')).toBeLessThan(
      transform.indexOf('scale(-1, 1)'),
    );
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

/**
 * 미리보기 확대·축소·이동 — 지도 앱과 같은 손맛 (IDE-016)
 *
 * jsdom은 레이아웃이 없어 상자 크기를 직접 심는다. 확대·이동은 무대(stage)의
 * CSS transform으로 나타나므로 그 값을 읽는다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultCustomization } from '@/lib/schema';
import { getGame } from '@/lib/games';
import { BoardPreview } from '../BoardPreview';

const game = getGame('soccer')!;
const board = game.parts.find((p) => p.kind === 'board')!;

const WIDTH = 594;
const HEIGHT = 420;

const setup = (interactive = true) => {
  const customization = defaultCustomization(game);
  const onMoveSlot = vi.fn();
  render(
    <BoardPreview
      game={game}
      part={board}
      customization={customization}
      interactive={interactive}
      onMoveSlot={interactive ? onMoveSlot : undefined}
    />,
  );
  const container = screen
    .getByText(/미리보기를 불러오는 중이다/)
    .closest('[style*="aspect-ratio"]') as HTMLElement;
  Object.defineProperty(container, 'clientWidth', { value: WIDTH });
  Object.defineProperty(container, 'clientHeight', { value: HEIGHT });
  container.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: WIDTH,
      bottom: HEIGHT,
      width: WIDTH,
      height: HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  const stage = container.firstElementChild as HTMLElement;
  return { container, stage, onMoveSlot };
};

const transformOf = (stage: HTMLElement) => {
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(
    stage.style.transform,
  );
  if (!m) throw new Error(`변환을 읽을 수 없다: ${stage.style.transform}`);
  return { tx: Number(m[1]), ty: Number(m[2]), scale: Number(m[3]) };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BoardPreview — 확대·축소·이동', () => {
  it('처음에는 원래 크기이고, 휠을 올리면 커서 자리를 중심으로 커진다', () => {
    const { container, stage } = setup();
    expect(transformOf(stage)).toEqual({ tx: 0, ty: 0, scale: 1 });

    // 왼쪽 위 모서리에서 휠 — 그 점은 제자리(0, 0)에 남는다.
    fireEvent.wheel(container, { deltaY: -100, clientX: 0, clientY: 0 });
    const after = transformOf(stage);
    expect(after.scale).toBeGreaterThan(1);
    expect(after.tx).toBe(0);
    expect(after.ty).toBe(0);

    // 오른쪽 아래 모서리에서 휠 — 그 점이 제자리에 남으려면 무대가 왼쪽 위로 밀린다.
    fireEvent.wheel(container, {
      deltaY: -100,
      clientX: WIDTH,
      clientY: HEIGHT,
    });
    const corner = transformOf(stage);
    expect(corner.scale).toBeGreaterThan(after.scale);
    expect(corner.tx).toBeLessThan(0);
    expect(corner.ty).toBeLessThan(0);
  });

  it('원래 크기 아래로는 안 줄고, 상한이 있다', () => {
    const { container, stage } = setup();
    fireEvent.wheel(container, { deltaY: 500, clientX: 10, clientY: 10 });
    expect(transformOf(stage).scale).toBe(1);
    for (let i = 0; i < 30; i += 1) {
      fireEvent.wheel(container, { deltaY: -500, clientX: 10, clientY: 10 });
    }
    expect(transformOf(stage).scale).toBe(8);
  });

  it('버튼과 키로도 된다 — 확대 · 축소 · 원래 크기', () => {
    const { container, stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(transformOf(stage).scale).toBeCloseTo(1.5, 6);
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(transformOf(stage).scale).toBeCloseTo(2.25, 6);
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(transformOf(stage).scale).toBeCloseTo(1.5, 6);
    fireEvent.click(screen.getByRole('button', { name: '원래 크기' }));
    expect(transformOf(stage)).toEqual({ tx: 0, ty: 0, scale: 1 });
    // 원래 크기에서는 "원래 크기" 버튼이 없고 축소도 막혀 있다.
    expect(screen.queryByRole('button', { name: '원래 크기' })).toBeNull();
    expect(screen.getByRole('button', { name: '축소' })).toBeDisabled();

    fireEvent.keyDown(container, { key: '+' });
    expect(transformOf(stage).scale).toBeCloseTo(1.5, 6);
    fireEvent.keyDown(container, { key: '0' });
    expect(transformOf(stage).scale).toBe(1);
  });

  it('확대한 뒤 빈 곳을 끌면 판이 따라오고, 판을 상자 밖으로 밀어낼 수는 없다', () => {
    const { container, stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    // 버튼은 상자 가운데를 중심으로 키우므로 무대는 왼쪽 위로 반쯤 밀려 있다.
    const before = transformOf(stage);
    expect(before.tx).toBeLessThan(0);

    // 오른쪽 아래로 끌면 그만큼 따라온다.
    fireEvent.pointerDown(container, {
      pointerId: 1,
      button: 0,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerMove(container, {
      pointerId: 1,
      clientX: 260,
      clientY: 240,
    });
    fireEvent.pointerUp(container, { pointerId: 1 });
    const after = transformOf(stage);
    expect(after.tx).toBeCloseTo(before.tx + 60, 6);
    expect(after.ty).toBeCloseTo(before.ty + 40, 6);

    // 아무리 세게 끌어도 판이 상자를 벗어나지 않는다 — 양쪽 한계에서 멈춘다.
    fireEvent.pointerDown(container, {
      pointerId: 2,
      button: 0,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerMove(container, {
      pointerId: 2,
      clientX: 2200,
      clientY: 2200,
    });
    fireEvent.pointerUp(container, { pointerId: 2 });
    expect(transformOf(stage)).toMatchObject({ tx: 0, ty: 0 });
    fireEvent.pointerDown(container, {
      pointerId: 3,
      button: 0,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerMove(container, {
      pointerId: 3,
      clientX: -3000,
      clientY: -3000,
    });
    fireEvent.pointerUp(container, { pointerId: 3 });
    const edge = transformOf(stage);
    expect(edge.tx).toBeCloseTo(WIDTH - WIDTH * edge.scale, 6);
    expect(edge.ty).toBeCloseTo(HEIGHT - HEIGHT * edge.scale, 6);
  });

  it('마커 위에서 시작한 끌기는 판을 옮기지 않는다 — 마커를 옮기는 것이다', () => {
    const { container, stage, onMoveSlot } = setup();
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    const marker = container.querySelector('[data-marker]') as SVGGElement;
    expect(marker).not.toBeNull();
    // 마커 끌기는 surface 사각형으로 좌표를 되돌린다 — 크기를 심어 준다.
    const surface = container.querySelector('svg.absolute') as SVGSVGElement;
    surface.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: WIDTH,
        bottom: HEIGHT,
        width: WIDTH,
        height: HEIGHT,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const before = transformOf(stage);
    fireEvent.pointerDown(marker, {
      pointerId: 3,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(marker, { pointerId: 3, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(marker, { pointerId: 3 });
    expect(transformOf(stage)).toEqual(before);
    expect(onMoveSlot).toHaveBeenCalled();
  });

  it('보기 전용 미리보기에는 확대 조작이 없다', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: '확대' })).toBeNull();
    expect(screen.queryByRole('group', { name: /확대·축소/ })).toBeNull();
  });
});

/**
 * 점 잇기 에디터 — 사진을 넣고, 고치고, 다시 연다 (IDE-020)
 *
 * 사진을 다루는 자리(`<canvas>`·`Image`)는 jsdom에 없으므로 브라우저 모듈만
 * 흉내 내고, **그 뒤 파이프라인은 진짜를 돌린다** — 윤곽 따기·점 배분·값 검증이
 * 실제로 걸리는지를 봐야 이 이슈가 확인하려던 것이 확인된다. 판 SVG는 서버가
 * 그리므로 어떤 값으로 청했는지만 확인한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGame } from '@/lib/games';
import { loadCustomization } from '@/lib/customization/storage';
import { __resetSaveFailuresForTests } from '@/lib/customization/storage';
import { loadPhoto } from '@/lib/customization/photo';
import { dotCapacity } from '@/lib/dot-to-dot';
import {
  blank,
  fillCircle,
  fillPolygon,
  starPoints,
} from '@/lib/dot-to-dot/__tests__/shapes';
import { EditorClient } from '../EditorClient';

const stub = vi.hoisted(() => ({
  /** `photoPixels`가 돌려줄 화소. 테스트마다 다른 "사진"을 물린다. */
  pixels: null as unknown,
  turns: [] as Array<{ quarterTurns?: number; flip?: boolean }>,
}));

vi.mock('@/lib/dot-to-dot/browser', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/dot-to-dot/browser')>();
  return {
    ...actual,
    readPhoto: async (file: File) => {
      if (!file.type.startsWith('image/'))
        throw new actual.PhotoError('그림 파일이 아니다.');
      return {
        dataUrl: 'data:image/jpeg;base64,PHOTO',
        widthPx: 120,
        heightPx: 160,
      };
    },
    turnPhoto: async (
      photo: { dataUrl: string; widthPx: number; heightPx: number },
      options: { quarterTurns?: number; flip?: boolean },
    ) => {
      stub.turns.push(options);
      const turned = (options.quarterTurns ?? 0) % 2 === 1;
      return {
        dataUrl: `${photo.dataUrl}-turned`,
        widthPx: turned ? photo.heightPx : photo.widthPx,
        heightPx: turned ? photo.widthPx : photo.heightPx,
      };
    },
    photoPixels: async () => stub.pixels,
  };
});

const game = getGame('dot-to-dot')!;

/** 별 하나가 찍힌 "사진". 뾰족한 끝 다섯이 모서리 판정을 그대로 태운다. */
const starPhoto = () =>
  fillPolygon(blank(120, 160), starPoints(60, 80, 45, 20, 5));
/**
 * 회색 머리에 검은 눈 둘과 입. 임계값이 하나뿐이면 셋이 통째로 실루엣에 묻힌다
 * — 세부 선이 필요한 이유가 이 사진이다(IDE-021).
 */
const facePhoto = () => {
  const canvas = fillCircle(blank(240, 300), 120, 140, 90, 160);
  fillCircle(canvas, 95, 115, 16, 30);
  fillCircle(canvas, 145, 115, 16, 30);
  fillCircle(canvas, 120, 175, 22, 30);
  return canvas;
};

/** 아무것도 없는 "사진". 윤곽 따기가 실패한다. */
const emptyPhoto = () => blank(120, 160);

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  void url;
  void init;
  return {
    ok: true,
    text: async () =>
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 277"></svg>',
  };
});

const jpeg = () => new File(['photo'], '아이.jpg', { type: 'image/jpeg' });

const artworkRequests = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/artwork'));

const lastArtworkBody = () => {
  const calls = artworkRequests();
  const [, init] = calls[calls.length - 1];
  return JSON.parse(String(init?.body)) as {
    partId: string;
    customization: { values: Record<string, unknown> };
  };
};

const outlineSlot = game.slots.find((s) => s.id === 'outline')!;
const defaultOutline = outlineSlot.default as number[];

const outlineOf = (): number[] =>
  loadCustomization(game)!.values.outline as number[];

const detailOf = (): number[][] =>
  loadCustomization(game)!.values.detail as number[][];

const countInput = () => screen.getByLabelText('점 개수') as HTMLInputElement;

const uploadPhoto = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.upload(screen.getByLabelText('사진 고르기'), jpeg());
  await waitFor(() => {
    expect(outlineOf()).not.toEqual(defaultOutline);
  });
};

beforeEach(() => {
  stub.pixels = starPhoto();
  stub.turns = [];
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  __resetSaveFailuresForTests();
});

describe('사진 넣기', () => {
  it('사진을 넣으면 윤곽이 바뀌고 판을 그 값으로 다시 청한다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    expect(outlineOf()).toEqual(defaultOutline);

    await uploadPhoto(user);
    const outline = outlineOf();
    // 별 다섯 꼭짓점이 살아 있어야 한다 — 점 배분이 모서리를 먼저 집는다.
    expect(outline.length).toBeGreaterThan(20);

    await waitFor(() => {
      expect(lastArtworkBody().customization.values.outline).toEqual(outline);
    });
  });

  it('사진은 서버로 가지 않는다 — 오가는 것은 좌표뿐이다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    await waitFor(() => expect(artworkRequests().length).toBeGreaterThan(0));

    for (const [, init] of artworkRequests()) {
      expect(String(init?.body)).not.toContain('data:image');
    }
    // 사진은 커스터마이즈가 아니라 제 키에 남는다.
    expect(loadPhoto(game.id, 'outline')?.dataUrl).toContain('data:image');
    expect(JSON.stringify(loadCustomization(game))).not.toContain('data:image');
  });

  it('끌어다 놓아도 같은 길로 들어간다', async () => {
    render(<EditorClient game={game} />);
    const zone = screen.getByLabelText('사진 고르기').parentElement!;
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [jpeg()] } });
    await waitFor(() => {
      expect(outlineOf()).not.toEqual(defaultOutline);
    });
  });

  it('끌어다 놓은 것이 그림이 아니면 사유를 낸다', async () => {
    // 파일 고르기는 브라우저가 `accept`로 걸러 주지만, 끌어다 놓기는 걸러 주지
    // 않는다 — 형식을 우리가 봐야 하는 자리가 여기다.
    render(<EditorClient game={game} />);
    const zone = screen.getByLabelText('사진 고르기').parentElement!;
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File(['x'], '메모.txt', { type: 'text/plain' })],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '그림 파일이 아니다',
    );
  });
});

describe('점 개수', () => {
  it('개수를 바꿔도 윤곽선은 그대로다 — 점만 다시 배분된다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    const outline = outlineOf();

    await user.click(screen.getByRole('button', { name: /^50개/ }));
    await waitFor(() => {
      expect(loadCustomization(game)!.values['dot-count']).toBe(50);
    });
    expect(outlineOf()).toEqual(outline);
  });

  it('상한을 넘기면 최대치로 잡아 주고 왜 그런지 말한다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    const capacity = dotCapacity(outlineOf());
    expect(capacity).toBeLessThan(100);

    await user.click(screen.getByRole('button', { name: /^100개/ }));
    await waitFor(() => expect(countInput().value).toBe(String(capacity)));
    expect(screen.getByText(/개로 맞췄다/)).toHaveTextContent(
      `${capacity}개까지 넣을 수 있다`,
    );
  });

  it('개수는 도구 막대가 아니라 사진 패널이 그린다 — 입력이 하나뿐이다', () => {
    render(<EditorClient game={game} />);
    expect(screen.getAllByLabelText('점 개수')).toHaveLength(1);
  });

  it('완성 그림 부속에서는 개수를 묻지 않는다 — 거기엔 점이 없다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await user.click(screen.getByRole('button', { name: '완성 그림' }));
    expect(screen.queryByLabelText('점 개수')).toBeNull();
    // 사진 패널 자체는 남는다 — 부속의 실루엣도 같은 사진에서 나온다.
    expect(screen.getByLabelText('사진 고르기')).toBeInTheDocument();
  });
});

describe('윤곽을 못 딴 사진', () => {
  it('빈 판이 아니라 무엇을 하면 되는지가 나온다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    const before = outlineOf();
    stub.pixels = emptyPhoto();

    await user.upload(screen.getByLabelText('사진 고르기'), jpeg());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/밝기|배경|피사체/);
    // 값은 건드리지 않는다 — 보기 그림이 그대로 남아 종이가 비지 않는다.
    expect(outlineOf()).toEqual(before);
  });

  it('실패한 사진도 남는다 — 밝기를 밀어 다시 따 볼 수 있다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    stub.pixels = emptyPhoto();
    await user.upload(screen.getByLabelText('사진 고르기'), jpeg());
    await screen.findByRole('alert');
    expect(loadPhoto(game.id, 'outline')).not.toBeNull();
    expect(screen.getByLabelText(/밝기/)).toBeInTheDocument();
  });
});

describe('사진 고치기', () => {
  it('돌리면 사진을 다시 굽고 윤곽을 다시 딴다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);

    await user.click(screen.getByRole('button', { name: '오른쪽으로 90°' }));
    await waitFor(() => {
      expect(loadPhoto(game.id, 'outline')?.dataUrl).toContain('-turned');
    });
    expect(stub.turns).toEqual([{ quarterTurns: 1 }]);
    // 돌린 결과가 저장까지 갔다 — 세로 사진이 가로가 된다.
    expect(loadPhoto(game.id, 'outline')?.widthPx).toBe(160);
  });

  it('사진을 지우면 보기 그림으로 돌아간다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    const sample = outlineOf();
    await uploadPhoto(user);

    await user.click(screen.getByRole('button', { name: '사진 지우기' }));
    await waitFor(() => expect(outlineOf()).toEqual(sample));
    expect(loadPhoto(game.id, 'outline')).toBeNull();
    expect(screen.getByLabelText('사진 고르기')).toBeInTheDocument();
  });

  it('원본 대조 보기는 사진이 있어야 켜진다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    const toggle = screen.getByRole('button', { name: '원본 대조 보기' });
    expect(toggle).toBeDisabled();

    await uploadPhoto(user);
    await waitFor(() => expect(toggle).not.toBeDisabled());
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('세부 선 (IDE-021)', () => {
  it('얼굴 사진을 넣으면 눈·입 선이 함께 나온다', async () => {
    const user = userEvent.setup();
    stub.pixels = facePhoto();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);

    await waitFor(() => expect(detailOf().length).toBeGreaterThan(0));
    // 선들이 판 요청에 함께 실린다 — 미리보기와 PDF가 같은 그림이다.
    await waitFor(() => {
      expect(lastArtworkBody().customization.values.detail).toEqual(detailOf());
    });
  });

  it('세부를 끄면 선이 사라지고 윤곽은 그대로다', async () => {
    const user = userEvent.setup();
    stub.pixels = facePhoto();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    await waitFor(() => expect(detailOf().length).toBeGreaterThan(0));
    const outline = outlineOf();

    await user.click(screen.getByRole('button', { name: '없음' }));
    await waitFor(() => expect(detailOf()).toEqual([]));
    expect(outlineOf()).toEqual(outline);
  });

  it('세부 슬롯은 제 패널을 갖지 않는다 — 사진 넣는 상자가 하나다', () => {
    render(<EditorClient game={game} />);
    expect(screen.getAllByLabelText('사진 고르기')).toHaveLength(1);
  });

  it('세부 정도는 사진을 바꿔도 고른 대로 남는다', async () => {
    const user = userEvent.setup();
    stub.pixels = facePhoto();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);

    await user.click(screen.getByRole('button', { name: '없음' }));
    await waitFor(() => expect(detailOf()).toEqual([]));
    await user.upload(screen.getByLabelText('다른 사진 고르기'), jpeg());
    await waitFor(() =>
      expect(loadPhoto(game.id, 'outline')?.detailLevel).toBe(0),
    );
    expect(detailOf()).toEqual([]);
  });

  it('사진을 지우면 보기 그림의 눈·코로 돌아간다', async () => {
    const user = userEvent.setup();
    stub.pixels = facePhoto();
    const sample = game.slots.find((s) => s.id === 'detail')!.default;
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    await waitFor(() => expect(detailOf().length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: '사진 지우기' }));
    await waitFor(() => expect(detailOf()).toEqual(sample));
  });
});

describe('다시 열기', () => {
  it('창을 닫았다 열어도 같은 도안이고, 개수를 다시 바꿀 수 있다', async () => {
    const user = userEvent.setup();
    const first = render(<EditorClient game={game} />);
    await uploadPhoto(user);
    const outline = outlineOf();
    first.unmount();

    render(<EditorClient game={game} />);
    // 윤곽은 저장된 좌표 그대로다 — 사진에서 다시 따지 않는다.
    expect(outlineOf()).toEqual(outline);
    // 사진도 남아 있어 밝기를 다시 밀 수 있다.
    expect(screen.getByLabelText(/밝기/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^30개/ }));
    await waitFor(() =>
      expect(loadCustomization(game)!.values['dot-count']).toBe(30),
    );
    expect(outlineOf()).toEqual(outline);
  });
});

describe('저장 한도', () => {
  it('사진을 남기지 못하면 사용자가 그 사실을 안다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });

    await user.upload(screen.getByLabelText('사진 고르기'), jpeg());
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((n) => n.textContent).join(' ')).toContain(
      '저장 공간이 가득 차',
    );
  });
});

describe('키보드와 스크린리더', () => {
  it('사진 넣기부터 개수 고르기까지 전부 이름을 가진 컨트롤이다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    // 파일 입력은 라벨을 가진 진짜 `<input>`이라 포커스를 받고 Enter로 열린다.
    const file = screen.getByLabelText('사진 고르기');
    expect(file).toHaveAttribute('type', 'file');
    file.focus();
    expect(file).toHaveFocus();

    await uploadPhoto(user);
    expect(screen.getByRole('slider', { name: /밝기/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '10개 — 만 3~4세 — 처음 잡는 연필' }),
    ).toBeInTheDocument();
  });

  it('사진 고치는 단추는 `disabled`가 되지 않는다 — 포커스를 잃지 않게', async () => {
    // 누른 단추가 그 순간 disabled가 되면 포커스가 문서 처음으로 튕긴다.
    // 따는 동안에는 `aria-disabled`로 알리고 포커스는 그대로 둔다.
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    for (const name of [
      '왼쪽으로 90°',
      '오른쪽으로 90°',
      '좌우 뒤집기',
      '다시 따기',
      '사진 지우기',
    ]) {
      expect(screen.getByRole('button', { name })).not.toBeDisabled();
    }
    expect(screen.getByRole('slider', { name: /밝기/ })).not.toBeDisabled();
  });

  it('점 개수와 상한이 소리로도 읽히는 자리에 있다', async () => {
    const user = userEvent.setup();
    render(<EditorClient game={game} />);
    await uploadPhoto(user);
    const live = screen
      .getAllByRole('status')
      .find((node) => node.textContent?.includes('넣을 수 있다'));
    expect(live).toBeDefined();
    expect(live).toHaveTextContent(/점 \d+개/);
  });
});

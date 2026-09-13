/**
 * 올리기 전에 사진 줄이기 (IDE-028)
 *
 * jsdom 에는 캔버스가 없어서 **실제로 굽는 부분은 여기서 못 본다.** 대신
 * 그때의 처분을 지킨다 — **줄이지 못하면 원본을 그대로 돌려준다.** 사진을 아예
 * 못 넣게 되는 것이 가장 나쁜 결과다.
 */
import { describe, expect, it } from 'vitest';
import { formatBytes, shouldShrink, shrinkPhoto, shrunkName } from '../photo';
import { PHOTO_MAX_BYTES, ACTION_BODY_LIMIT } from '../uploadLimit';

const file = (name: string, type: string, size: number): File =>
  Object.defineProperty(new File([], name, { type }), 'size', { value: size });

describe('shouldShrink', () => {
  it('큰 사진은 줄인다', () => {
    expect(shouldShrink(file('a.jpg', 'image/jpeg', 4_000_000))).toBe(true);
  });

  it('이미 작은 그림은 손대지 않는다 — 다시 구우면 되레 나빠진다', () => {
    expect(shouldShrink(file('a.png', 'image/png', 80_000))).toBe(false);
  });

  it('움직이는 GIF 는 그대로 둔다 — 다시 구우면 첫 장만 남는다', () => {
    expect(shouldShrink(file('a.gif', 'image/gif', 4_000_000))).toBe(false);
  });

  it('그림이 아닌 것은 건드리지 않는다', () => {
    expect(shouldShrink(file('a.pdf', 'application/pdf', 4_000_000))).toBe(
      false,
    );
  });
});

describe('shrinkPhoto', () => {
  it('캔버스를 못 쓰면 원본을 그대로 돌려준다 — 아예 못 넣는 것보다 낫다', async () => {
    // jsdom 에는 `createImageBitmap` 이 없다. 실제 브라우저에서 실패하는 경우와
    // 같은 길을 지난다.
    const original = file('아이.jpg', 'image/jpeg', 4_000_000);
    await expect(shrinkPhoto(original)).resolves.toBe(original);
  });

  it('줄일 필요가 없으면 손대지 않는다', async () => {
    const small = file('a.png', 'image/png', 1000);
    await expect(shrinkPhoto(small)).resolves.toBe(small);
  });

  it('던지지 않는다 — 사진 하나로 편집 화면이 멈추면 안 된다', async () => {
    await expect(
      shrinkPhoto(file('a.jpg', 'image/jpeg', 4_000_000)),
    ).resolves.toBeInstanceOf(File);
  });
});

describe('shrunkName', () => {
  it('알아볼 수 있게 이름을 남기고 확장자만 바꾼다', () => {
    expect(shrunkName('아이 사진.HEIC')).toBe('아이 사진.jpg');
    expect(shrunkName('a.png')).toBe('a.jpg');
  });

  it('이름이 확장자뿐이어도 파일을 만든다', () => {
    expect(shrunkName('.jpg')).toBe('photo.jpg');
  });
});

describe('한도', () => {
  it('서버 액션 본문 한도가 사진 한도보다 넉넉하다', () => {
    // 사진만 오는 것이 아니라 **쓰던 글 전체**가 같은 폼에 실린다. 여기가
    // 갈라져 있어서 `Body exceeded 1 MB limit` 를 봤다(2026-09-09).
    const limitMb = Number(ACTION_BODY_LIMIT.replace('mb', ''));
    expect(limitMb).toBeGreaterThan(PHOTO_MAX_BYTES / 1024 / 1024);
  });
});

describe('formatBytes', () => {
  it('사람이 읽을 크기로 적는다', () => {
    expect(formatBytes(4_000_000)).toBe('3.8MB');
    expect(formatBytes(300_000)).toBe('293KB');
    expect(formatBytes(10)).toBe('1KB');
  });
});

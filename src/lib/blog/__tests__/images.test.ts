/**
 * 공방 일지 사진 (IDE-023)
 *
 * **아이 얼굴이 나온 사진도 올린다**(2026-09-09 사용자 결정). 공개 버킷을 쓰되
 * 이름을 추측할 수 없게 하는 것이 여기서 지키는 선이라, 그 이름이 실제로
 * 임의 값인지와 받지 말아야 할 파일을 받지 않는지를 본다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteStoredImages,
  pathFromPublicUrl,
  publicUrl,
  rejectReason,
  storagePath,
} from '../images';

const file = (name: string, type: string, size: number): File =>
  Object.defineProperty(new File([], name, { type }), 'size', { value: size });

describe('storagePath', () => {
  it('같은 파일을 두 번 올려도 다른 경로다 — 이름을 맞혀 볼 수 없다', () => {
    const a = storagePath('아이.jpg', 'image/jpeg');
    const b = storagePath('아이.jpg', 'image/jpeg');
    expect(a).not.toBe(b);
    // 앞머리가 32자 임의 문자열이다.
    expect(a).toMatch(/^[0-9a-f]{32}/);
  });

  it('원래 이름에서 주소에 쓸 수 없는 글자를 지운다', () => {
    const path = storagePath('종이 윷가락 (완성).png', 'image/png');
    expect(path).toMatch(/^[0-9a-f]{32}(-[a-z0-9-]+)?\.png$/);
  });

  it('한글뿐인 이름이면 임의 문자열만 남는다', () => {
    expect(storagePath('아이.webp', 'image/webp')).toMatch(
      /^[0-9a-f]{32}\.webp$/,
    );
  });
});

describe('publicUrl', () => {
  it('브라우저가 열 수 있는 주소를 만든다', () => {
    expect(publicUrl('https://x.supabase.co/', 'abc.jpg')).toBe(
      'https://x.supabase.co/storage/v1/object/public/blog/abc.jpg',
    );
  });
});

describe('rejectReason', () => {
  it('그림이 아닌 것은 받지 않는다 — 스크립트가 될 수 있는 형식은 목록에 없다', () => {
    expect(rejectReason(file('a.svg', 'image/svg+xml', 10))).toContain('올릴');
    expect(rejectReason(file('a.html', 'text/html', 10))).toContain('올릴');
  });

  it('8MB 를 넘으면 받지 않는다', () => {
    expect(
      rejectReason(file('a.jpg', 'image/jpeg', 9 * 1024 * 1024)),
    ).toContain('너무 큽니다');
  });

  it('빈 파일은 받지 않는다', () => {
    expect(rejectReason(file('a.jpg', 'image/jpeg', 0))).toBe('빈 파일입니다.');
  });

  it('폰이 찍는 형식은 받는다', () => {
    expect(rejectReason(file('a.jpg', 'image/jpeg', 1024))).toBeNull();
    expect(rejectReason(file('a.heic.png', 'image/png', 1024))).toBeNull();
  });
});

describe('pathFromPublicUrl', () => {
  // 사진 파일을 지울 때 **우리 버킷에 우리가 붙인 이름**만 골라낸다(2026-09-10).
  // 지우는 일은 되돌릴 수 없어서, 밖에서 가져온 주소는 절대 후보가 되지 않아야 한다.
  const base = 'https://x.supabase.co';
  const name = '9e949571947c4620b380ec44bc661ff0-lagent.png';

  it('우리 공개 주소에서 파일 경로를 뽑는다', () => {
    expect(
      pathFromPublicUrl(`${base}/storage/v1/object/public/blog/${name}`, base),
    ).toBe(name);
  });

  it('올린 이름은 늘 되짚을 수 있다 — 올리는 쪽과 지우는 쪽의 규칙이 같다', () => {
    for (const [file, type] of [
      ['아이.jpg', 'image/jpeg'],
      ['종이 윷가락 (완성).png', 'image/png'],
      ['a.webp', 'image/webp'],
    ]) {
      const path = storagePath(file, type);
      expect(pathFromPublicUrl(publicUrl(`${base}/`, path), base), file).toBe(
        path,
      );
    }
  });

  it('다른 호스트·다른 버킷의 주소는 후보가 아니다', () => {
    expect(
      pathFromPublicUrl(
        `https://evil.example/storage/v1/object/public/blog/${name}`,
        base,
      ),
    ).toBeNull();
    expect(
      pathFromPublicUrl(`${base}/storage/v1/object/public/other/${name}`, base),
    ).toBeNull();
    expect(pathFromPublicUrl('https://x.co/a.jpg', base)).toBeNull();
  });

  it('우리가 붙인 꼴이 아닌 이름은 후보가 아니다', () => {
    const prefix = `${base}/storage/v1/object/public/blog/`;
    for (const bad of [
      'a.jpg',
      `../${name}`,
      `${name}?download`,
      `sub/${name}`,
      `${name.toUpperCase()}`,
      '',
    ]) {
      expect(pathFromPublicUrl(prefix + bad, base), bad).toBeNull();
    }
  });
});

describe('deleteStoredImages', () => {
  // 되돌릴 수 없는 일이라 **요청 모양**과 **실패해도 던지지 않는 것**을 본다.
  const name = `${'a'.repeat(32)}-a.jpg`;

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('스토리지의 여러 파일 지우기로 보낸다 — supabase-js 의 remove() 와 같은 요청', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ name }]), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteStoredImages([name])).resolves.toEqual([name]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://x.supabase.co/storage/v1/object/blog');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ prefixes: [name] });
    expect((init.headers as Record<string, string>).apikey).toBe(
      'service-role-key',
    );
  });

  it('우리 이름 꼴이 아닌 경로는 보내지도 않는다', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      deleteStoredImages(['a.jpg', '../x.png', 'other/thing.jpg']),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('스토리지가 실제로 지운 것만 돌려준다 — 이미 없던 파일은 빠진다', async () => {
    const other = `${'b'.repeat(32)}.png`;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify([{ name }]), { status: 200 }),
      ),
    );
    await expect(deleteStoredImages([name, other])).resolves.toEqual([name]);
  });

  it('실패해도 던지지 않는다 — 글은 이미 저장됐다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    await expect(deleteStoredImages([name])).resolves.toEqual([]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(deleteStoredImages([name])).resolves.toEqual([]);
  });

  it('키가 없으면 아무것도 하지 않는다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteStoredImages([name])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

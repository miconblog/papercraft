/**
 * 글에서 빠진 사진 파일 치우기 (IDE-028)
 *
 * 되돌릴 수 없는 일이라 **지우지 말아야 할 때**를 촘촘히 본다. 지워야 할 것을
 * 못 지우는 것은 저장 공간이 조금 남을 뿐이지만, 쓰고 있는 사진을 지우면 이미 낸
 * 글이 깨진다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeUnusedImages } from '../cleanup';

const BASE = 'https://x.supabase.co';
const nameOf = (c: string) => `${c.repeat(32)}-photo.jpg`;
const urlOf = (c: string) =>
  `${BASE}/storage/v1/object/public/blog/${nameOf(c)}`;

type Setup = {
  /** 글 목록 읽기가 돌려줄 줄들. `null` 이면 읽기가 실패한다. */
  rows: unknown[] | null;
};

/** 글 목록 읽기와 파일 지우기를 흉내 낸다. 보낸 요청을 들고 있는다. */
function storage({ rows }: Setup) {
  const calls: Array<[string, RequestInit]> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push([String(url), init]);
      if (init.method === 'DELETE') {
        const { prefixes } = JSON.parse(String(init.body)) as {
          prefixes: string[];
        };
        return new Response(
          JSON.stringify(prefixes.map((name) => ({ name }))),
          { status: 200 },
        );
      }
      return rows === null
        ? new Response('down', { status: 500 })
        : new Response(JSON.stringify(rows), { status: 200 });
    }),
  );
  const deleted = () => {
    const call = calls.find(([, init]) => init.method === 'DELETE');
    return call
      ? (JSON.parse(String(call[1].body)) as { prefixes: string[] }).prefixes
      : null;
  };
  return { calls, deleted };
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BASE);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('지운다', () => {
  it('어느 글도 쓰지 않는 우리 사진만 지운다', async () => {
    const { deleted } = storage({
      rows: [{ doc: { content: [{ type: 'image', src: urlOf('b') }] } }],
    });

    await expect(removeUnusedImages([urlOf('a'), urlOf('b')])).resolves.toEqual(
      [nameOf('a')],
    );
    expect(deleted()).toEqual([nameOf('a')]);
  });

  it('같은 후보가 여러 번 와도 한 번만 보낸다', async () => {
    const { deleted } = storage({ rows: [] });
    await removeUnusedImages([urlOf('a'), urlOf('a')]);
    expect(deleted()).toEqual([nameOf('a')]);
  });
});

describe('지우지 않는다', () => {
  it('다른 글이 쓰고 있으면 남긴다', async () => {
    const { deleted } = storage({
      rows: [
        { doc: null, body: '', cover_url: null },
        { doc: { content: [{ type: 'image', src: urlOf('a') }] } },
      ],
    });
    await expect(removeUnusedImages([urlOf('a')])).resolves.toEqual([]);
    expect(deleted()).toBeNull();
  });

  it('대표 사진으로 쓰고 있으면 남긴다', async () => {
    const { deleted } = storage({
      rows: [{ doc: null, cover_url: urlOf('a') }],
    });
    await removeUnusedImages([urlOf('a')]);
    expect(deleted()).toBeNull();
  });

  it('옛 마크다운 원문이 가리키고 있어도 남긴다 — 돌아갈 데를 깨지 않는다', async () => {
    const { deleted } = storage({
      rows: [{ doc: { content: [] }, body: `![](${urlOf('a')})` }],
    });
    await removeUnusedImages([urlOf('a')]);
    expect(deleted()).toBeNull();
  });

  it('글 목록을 못 읽으면 아무것도 지우지 않는다 — "아무도 안 쓴다"로 착각하지 않는다', async () => {
    const { deleted } = storage({ rows: null });
    await expect(removeUnusedImages([urlOf('a')])).resolves.toEqual([]);
    expect(deleted()).toBeNull();
  });

  it('밖에서 가져온 주소는 후보가 되지도 않는다 — 글 목록도 안 읽는다', async () => {
    const { calls } = storage({ rows: [] });
    await expect(
      removeUnusedImages([
        'https://example.com/photo.jpg',
        `${BASE}/storage/v1/object/public/other/${nameOf('a')}`,
      ]),
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('키가 없으면 아무것도 하지 않는다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    const { calls } = storage({ rows: [] });
    await expect(removeUnusedImages([urlOf('a')])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

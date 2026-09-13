/**
 * 공방 일지 — 저장·게시·사진 서버 액션 (IDE-023)
 *
 * 지키는 것이 넷이다. **관리자만 쓴다** · **주소는 늘 만들어진다**(폰에서 쓰다
 * 영문 주소를 짜내느라 막히지 않는다) · **어느 버튼을 눌러도 쓰던 글이 먼저
 * 저장된다** · **저장 실패를 감추지 않는다**.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
const updateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock('next/headers', () => ({ cookies: async () => ({ get }) }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/cache', () => ({ updateTag, revalidatePath }));

const { publishNow, savePost, setCoverImage, uploadPhoto } =
  await import('../actions');
const { issueSession } = await import('@/lib/analytics/session');
const { POSTS_TAG, forgetPosts } = await import('@/lib/blog/posts');

const PASSWORD = 'admin-password-for-tests';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const asAdmin = () => get.mockReturnValue({ value: issueSession(PASSWORD) });

/**
 * 액션은 늘 리다이렉트로 끝난다. 돌아간 주소를 **디코드해서** 돌려준다 —
 * 오류 문구가 한글이라 인코딩된 채로는 무엇이 떴는지 읽을 수 없다.
 */
const redirectedTo = async (run: Promise<void>): Promise<string> => {
  try {
    await run;
  } catch (cause) {
    // `URLSearchParams` 는 공백을 `+` 로 적는다 — 되돌려 놓아야 문장이 된다.
    return decodeURIComponent(
      String((cause as Error).message).replace(/\+/g, ' '),
    );
  }
  throw new Error('리다이렉트하지 않았다');
};

/** 실제로 보낸 **쓰기** 요청. PostgREST 로 간 것 가운데 `method` 가 붙은 쪽이다. */
const writeCall = () => {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
    .calls as unknown as Array<[string, RequestInit]>;
  const call = calls.find(
    ([url, init]) => String(url).includes('/rest/v1/') && init?.method,
  );
  if (!call) throw new Error('쓰기 요청이 없다');
  return {
    url: String(call[0]),
    init: call[1],
    body: call[1].body ? JSON.parse(String(call[1].body)) : null,
  };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  forgetPosts();
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200 })),
  );
});

afterEach(() => {
  forgetPosts();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('문지기', () => {
  it('세션이 없으면 404 다 — 서버 액션은 URL 만 알면 밖에서 부를 수 있다', async () => {
    get.mockReturnValue(undefined);
    await expect(savePost(form({ title: '글' }))).rejects.toThrow('NOT_FOUND');
  });

  it('비밀번호가 설정돼 있지 않으면 아무도 관리자가 아니다', async () => {
    vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', '');
    get.mockReturnValue({ value: 'whatever' });
    await expect(savePost(form({ title: '글' }))).rejects.toThrow('NOT_FOUND');
  });
});

describe('주소 정하기', () => {
  it('비워 두면 제목에서 만든다', async () => {
    asAdmin();
    await expect(
      savePost(form({ title: 'Yut Stick Balance', body: '' })),
    ).rejects.toThrow(/REDIRECT/);
    expect(writeCall().body.slug).toBe('yut-stick-balance');
  });

  it('제목이 한글뿐이면 날짜로 만든다 — 여기서 막으면 폰으로 못 쓴다', async () => {
    asAdmin();
    await expect(
      savePost(form({ title: '윷가락 무게중심', body: '' })),
    ).rejects.toThrow(/REDIRECT/);
    expect(writeCall().body.slug).toMatch(/^post-\d{8}-[0-9a-f]{4}$/);
  });

  it('사람이 적은 주소도 한 번 접는다 — 주소에 못 쓸 글자가 남지 않는다', async () => {
    asAdmin();
    await expect(
      savePost(form({ title: '아무', slug: 'Yut Stick!!' })),
    ).rejects.toThrow(/REDIRECT/);
    expect(writeCall().body.slug).toBe('yut-stick');
  });
});

describe('게시 시각', () => {
  it('비우면 초안이다 — 아무에게도 안 보인다', async () => {
    asAdmin();
    await expect(
      savePost(form({ title: '글', publishAt: '' })),
    ).rejects.toThrow(/REDIRECT/);
    expect(writeCall().body.publish_at).toBeNull();
  });

  it('KST 벽시계로 읽는다 — 브라우저 시각이 아니다', async () => {
    asAdmin();
    await expect(
      savePost(form({ title: '글', publishAt: '2026-09-10T00:00' })),
    ).rejects.toThrow(/REDIRECT/);
    // 한국 0시는 UTC 로 전날 15시다.
    expect(writeCall().body.publish_at).toBe('2026-09-09T15:00:00.000Z');
  });

  it('「지금 내기」는 날짜 칸을 안 만지고 낸다', async () => {
    asAdmin();
    const before = Date.now();
    await expect(
      publishNow(form({ title: '글', publishAt: '' })),
    ).rejects.toThrow(/REDIRECT/);

    const at = Date.parse(writeCall().body.publish_at);
    expect(at).toBeGreaterThanOrEqual(before);
  });
});

describe('사진', () => {
  const photo = () =>
    new File([new Uint8Array([1, 2, 3])], '아이.jpg', { type: 'image/jpeg' });

  /** 보관소로 간 업로드 요청만 성공시킨다. */
  const uploadOk = () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/rest/v1/')
          ? new Response('[]', { status: 200 })
          : new Response('{}', { status: 200 }),
      ),
    );
  };

  /** 편집기가 보내는 모양. 문단 하나짜리 글이다 (IDE-028). */
  const oneParagraph = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '첫 문단' }] },
    ],
  });

  describe('본문 사진 — 편집기가 직접 올린다', () => {
    // 폼을 한 바퀴 도는 방식은 넣은 사진이 글의 어디에 붙었는지 안 보여서
    // "올라간 건지 모르겠다"가 됐다(2026-09-09 사용자 신고).
    it('세션이 없으면 404 다', async () => {
      get.mockReturnValue(undefined);
      const data = new FormData();
      data.set('image', photo());
      await expect(uploadPhoto(data)).rejects.toThrow('NOT_FOUND');
    });

    it('주소만 돌려준다 — 저장도 리다이렉트도 하지 않는다', async () => {
      asAdmin();
      uploadOk();

      const data = new FormData();
      data.set('image', photo());

      const result = await uploadPhoto(data);
      expect(result.ok).toBe(true);
      expect(result.ok && result.url).toContain(
        '/storage/v1/object/public/blog/',
      );
      expect(redirect).not.toHaveBeenCalled();
    });

    it('고른 사진이 없으면 무엇을 하라는지 알려 준다', async () => {
      asAdmin();
      const result = await uploadPhoto(new FormData());
      expect(result).toEqual({ ok: false, message: '올릴 사진을 고르세요.' });
    });

    it('그림이 아닌 파일은 올리기 전에 막는다', async () => {
      asAdmin();
      const data = new FormData();
      data.set('image', new File(['x'], 'a.svg', { type: 'image/svg+xml' }));

      const result = await uploadPhoto(data);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).toContain(
        '올릴 수 있습니다',
      );
    });
  });

  describe('대표 사진 — 폼으로 간다', () => {
    it('세우면 본문은 그대로다', async () => {
      asAdmin();
      uploadOk();

      const data = form({ title: '글', doc: oneParagraph });
      data.set('image', photo());

      await expect(setCoverImage(data)).rejects.toThrow(/REDIRECT/);

      const written = writeCall().body;
      expect(written.doc.content).toHaveLength(1);
      expect(written.cover_url).toContain('/storage/v1/object/public/blog/');
    });

    it('고른 사진이 없으면 무엇을 하라는지 알려 준다', async () => {
      asAdmin();
      expect(
        await redirectedTo(setCoverImage(form({ title: '글' }))),
      ).toContain('올릴 사진을 고르세요');
    });
  });
});

describe('저장 결과', () => {
  it('실패를 감추지 않는다 — 슬러그가 겹치면 무엇을 고칠지 알려 준다', async () => {
    asAdmin();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: '23505' }), { status: 409 }),
      ),
    );

    expect(
      await redirectedTo(savePost(form({ title: '글', slug: 'a' }))),
    ).toContain('같은 주소를 쓰는 글이 이미 있습니다');
  });

  it('바뀐 글이 목록에 곧바로 보이게 캐시를 깨운다', async () => {
    asAdmin();
    await expect(savePost(form({ title: '글', slug: 'a' }))).rejects.toThrow(
      /REDIRECT/,
    );

    expect(updateTag).toHaveBeenCalledWith(POSTS_TAG);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/blog');
    expect(revalidatePath).toHaveBeenCalledWith('/blog/a');
  });

  it('새 글이 실패해도 쓰던 글이 화면에서 사라지지 않는다', async () => {
    asAdmin();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );

    // 없는 id 로 보내면 편집 화면이 404 를 낸다 — `new` 로 돌아와야 한다.
    await expect(savePost(form({ title: '글', slug: 'a' }))).rejects.toThrow(
      /REDIRECT:\/admin\/posts\/new\?/,
    );
  });
});

/**
 * 저장하면 글에서 빠진 사진 파일을 치운다 (2026-09-10 사용자 요청)
 *
 * "삭제된 채로 저장하면 실제 스토리지에서 삭제된 해당 이미지를 제거해 주면
 * 좋겠어." 저장 액션을 끝까지 돌려 **실제로 지우는 요청이 나가는지**, 그리고
 * **나가면 안 될 때 안 나가는지**를 본다.
 */
describe('저장할 때 안 쓰는 사진 파일을 치운다', () => {
  const BASE = 'https://example.supabase.co';
  const nameOf = (c: string) => `${c.repeat(32)}-photo.jpg`;
  const urlOf = (c: string) =>
    `${BASE}/storage/v1/object/public/blog/${nameOf(c)}`;
  const docWith = (...srcs: string[]) =>
    JSON.stringify({
      type: 'doc',
      content: srcs.map((src) => ({ type: 'image', attrs: { src } })),
    });

  type Plan = {
    /** 저장 전 글에 있던 사진들. */
    before: string[];
    /** 저장 뒤 모든 글이 쓰는 사진들(글 목록 읽기가 돌려줄 값). */
    usedAfter: string[];
    saveStatus?: number;
  };

  function storage({ before, usedAfter, saveStatus = 204 }: Plan) {
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const u = String(url);
        calls.push([u, init]);
        if (init.method === 'DELETE') {
          const { prefixes } = JSON.parse(String(init.body)) as {
            prefixes: string[];
          };
          return new Response(
            JSON.stringify(prefixes.map((name) => ({ name }))),
            { status: 200 },
          );
        }
        if (init.method === 'PATCH' || init.method === 'POST') {
          // 204 는 본문이 없어야 하는 상태다 — `''` 를 주면 `Response` 를 만드는
          // 순간 던져서, 저장이 실패로 읽히고 정리까지 가지 않는다.
          return new Response(null, { status: saveStatus });
        }
        if (u.includes('select=doc,body,cover_url')) {
          return new Response(
            JSON.stringify([
              {
                doc: {
                  type: 'doc',
                  content: usedAfter.map((src) => ({ type: 'image', src })),
                },
                body: '',
                cover_url: null,
              },
            ]),
            { status: 200 },
          );
        }
        if (u.includes('id=eq.id-1')) {
          return new Response(
            JSON.stringify([
              {
                id: 'id-1',
                slug: 'a',
                title: '글',
                doc: {
                  type: 'doc',
                  content: before.map((src) => ({ type: 'image', src })),
                },
                body: '',
                cover_url: null,
              },
            ]),
            { status: 200 },
          );
        }
        return new Response('[]', { status: 200 });
      }),
    );
    return {
      deleted: () => {
        const call = calls.find(([, init]) => init.method === 'DELETE');
        return call
          ? (JSON.parse(String(call[1].body)) as { prefixes: string[] })
              .prefixes
          : null;
      },
    };
  }

  /**
   * 돌아간 주소로 **저장이 정말 끝났는지**를 함께 본다. 이것 없이 "지운 요청이
   * 없다"만 보면, 가짜 응답이 틀려 저장이 실패해도 시험이 그냥 통과한다 — 실제로
   * 204 에 빈 본문을 줬다가 그렇게 될 뻔했다(2026-09-10).
   */
  it('글에서 뺀 사진은 저장하면 스토리지에서도 지운다', async () => {
    asAdmin();
    const { deleted } = storage({
      before: [urlOf('a'), urlOf('b')],
      usedAfter: [urlOf('b')],
    });

    await expect(
      savePost(
        form({ id: 'id-1', title: '글', slug: 'a', doc: docWith(urlOf('b')) }),
      ),
    ).rejects.toThrow(/saved=/);

    expect(deleted()).toEqual([nameOf('a')]);
  });

  it('저장이 실패하면 아무것도 지우지 않는다 — 글은 옛 모습인데 사진만 사라지면 안 된다', async () => {
    asAdmin();
    const { deleted } = storage({
      before: [urlOf('a')],
      usedAfter: [],
      saveStatus: 500,
    });

    await expect(
      savePost(form({ id: 'id-1', title: '글', slug: 'a', doc: docWith() })),
    ).rejects.toThrow(/error=/);

    expect(deleted()).toBeNull();
  });

  it('올렸다가 저장 전에 지운 사진도 치운다 — 글 어디에도 흔적이 없던 것', async () => {
    asAdmin();
    const { deleted } = storage({ before: [], usedAfter: [] });

    await expect(
      savePost(
        form({
          id: 'id-1',
          title: '글',
          slug: 'a',
          doc: docWith(),
          uploadedImages: JSON.stringify([urlOf('c')]),
        }),
      ),
    ).rejects.toThrow(/saved=/);

    expect(deleted()).toEqual([nameOf('c')]);
  });

  it('다른 글이 쓰는 사진은 이 글에서 빼도 남긴다', async () => {
    asAdmin();
    const { deleted } = storage({
      before: [urlOf('a')],
      // 이 글에서는 뺐지만 다른 글이 여전히 쓴다.
      usedAfter: [urlOf('a')],
    });

    await expect(
      savePost(form({ id: 'id-1', title: '글', slug: 'a', doc: docWith() })),
    ).rejects.toThrow(/saved=/);

    expect(deleted()).toBeNull();
  });

  it('숨은 칸에 밖의 주소를 적어 보내도 지우지 않는다', async () => {
    asAdmin();
    const { deleted } = storage({ before: [], usedAfter: [] });

    await expect(
      savePost(
        form({
          id: 'id-1',
          title: '글',
          slug: 'a',
          doc: docWith(),
          uploadedImages: JSON.stringify([
            'https://example.com/photo.jpg',
            `${BASE}/storage/v1/object/public/blog/../secret.jpg`,
          ]),
        }),
      ),
    ).rejects.toThrow(/saved=/);

    expect(deleted()).toBeNull();
  });
});

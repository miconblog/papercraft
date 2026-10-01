/**
 * 멘션이 가리키는 곳 (IDE-046)
 *
 * 지키는 것이 둘이다. **사람이 손으로 건 링크의 사소한 차이에 멘션이 떨어지지
 * 않는다**(`www` · 스킴 · 끝의 `/` · utm) · **열려 있지 않은 대상에는 붙지
 * 않고, 닫힌 것과 없는 것이 같은 답이다.**
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPosts } from '@/lib/blog/posts';
import { isOwnUrl, resolveTarget, sameRef, targetRef } from '../target';

const SITE = 'https://www.daddyscraft.com';

/** 한참 지난 시각 — 지금 시계와 무관하게 "이미 낸 글"이다. */
const AT = Date.UTC(2020, 0, 1);

const withPosts = (posts: Record<string, unknown>[]) => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      // 글 표만 채운다. 게임 공개 표는 비어 있고, 비어 있으면 전부 열려 있다.
      String(url).includes('/posts')
        ? new Response(JSON.stringify(posts), { status: 200 })
        : new Response('[]', { status: 200 }),
    ),
  );
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  forgetPosts();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isOwnUrl', () => {
  it('www 가 붙든 안 붙든, 스킴이 무엇이든 우리다', () => {
    for (const url of [
      'https://www.daddyscraft.com/blog/x',
      'https://daddyscraft.com/blog/x',
      'http://WWW.DaddysCraft.com/blog/x',
    ]) {
      expect(isOwnUrl(new URL(url), SITE), url).toBe(true);
    }
  });

  it('비슷하게 생긴 남의 호스트는 우리가 아니다', () => {
    for (const url of [
      'https://daddyscraft.com.evil.example/blog/x',
      'https://evil-daddyscraft.com/blog/x',
      'https://blog.daddyscraft.com/blog/x',
      'https://www.daddyscraft.com:8443/blog/x',
    ]) {
      expect(isOwnUrl(new URL(url), SITE), url).toBe(false);
    }
  });
});

describe('targetRef', () => {
  it('글 주소와 게임 주소를 읽는다', () => {
    expect(targetRef(`${SITE}/blog/yut-sticks`, SITE)).toEqual({
      kind: 'post',
      slug: 'yut-sticks',
    });
    expect(targetRef(`${SITE}/games/soccer`, SITE)).toEqual({
      kind: 'game',
      id: 'soccer',
    });
  });

  it('끝의 / · 질의 · # 뒤는 보지 않는다', () => {
    const plain = targetRef(`${SITE}/blog/yut-sticks`, SITE)!;
    for (const url of [
      `${SITE}/blog/yut-sticks/`,
      `${SITE}/blog/yut-sticks?utm_source=naver`,
      `${SITE}/blog/yut-sticks#comments`,
      'http://daddyscraft.com/blog/yut-sticks',
    ]) {
      const ref = targetRef(url, SITE);
      expect(ref && sameRef(ref, plain), url).toBe(true);
    }
  });

  it('인코딩된 슬러그를 풀어 읽는다', () => {
    expect(
      targetRef(`${SITE}/blog/${encodeURIComponent('윷가락')}`, SITE),
    ).toEqual({ kind: 'post', slug: '윷가락' });
  });

  it('멘션을 받는 화면이 아니면 대상이 아니다', () => {
    for (const url of [
      `${SITE}/`,
      `${SITE}/blog`,
      `${SITE}/games/soccer/rules`,
      `${SITE}/admin/posts`,
      `${SITE}/privacy/x`,
      'https://evil.example/blog/yut-sticks',
      'javascript:alert(1)',
      '주소가 아니다',
    ]) {
      expect(targetRef(url, SITE), url).toBeNull();
    }
  });

  it('깨진 인코딩에 던지지 않는다', () => {
    expect(targetRef(`${SITE}/blog/%E0%A4%A`, SITE)).toBeNull();
  });

  it('글과 게임은 이름이 같아도 다른 대상이다', () => {
    expect(
      sameRef({ kind: 'post', slug: 'soccer' }, { kind: 'game', id: 'soccer' }),
    ).toBe(false);
  });
});

describe('resolveTarget', () => {
  it('낸 글은 id 로 돌려준다 — 슬러그는 주인이 고칠 수 있는 값이다', async () => {
    withPosts([
      {
        id: 'p-1',
        slug: 'yut-sticks',
        title: '윷가락',
        publish_at: new Date(AT - 1).toISOString(),
      },
    ]);

    expect(await resolveTarget({ kind: 'post', slug: 'yut-sticks' })).toEqual({
      kind: 'post',
      targetId: 'p-1',
    });
  });

  it('안 낸 글 · 내려 둔 글 · 없는 글이 전부 같은 답이다', async () => {
    withPosts([
      { id: 'p-1', slug: 'draft', title: '초안', publish_at: null },
      {
        id: 'p-2',
        slug: 'hidden',
        title: '내린 글',
        publish_at: new Date(AT - 1).toISOString(),
        hidden: true,
      },
    ]);

    // 갈라서 답하면 받는 주소가 "여기 안 낸 글이 있다"를 알려 주는 창구가 된다.
    for (const slug of ['draft', 'hidden', 'nope']) {
      expect(await resolveTarget({ kind: 'post', slug }), slug).toBeNull();
    }
  });

  it('등록소에 있는 게임은 받고, 없는 게임은 받지 않는다', async () => {
    withPosts([]);

    expect(await resolveTarget({ kind: 'game', id: 'soccer' })).toEqual({
      kind: 'game',
      targetId: 'soccer',
    });
    expect(
      await resolveTarget({ kind: 'game', id: 'no-such-game' }),
    ).toBeNull();
  });
});

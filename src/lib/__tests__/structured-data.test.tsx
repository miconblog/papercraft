/**
 * 구조화 데이터 (SEO)
 *
 * 검색엔진이 읽는 값이라 눈으로는 틀린 것이 안 보인다. 지키는 것은 셋이다 —
 * **주소가 절대 주소다**, **안 적은 날짜를 지어내지 않는다**, **글자 속
 * `</script>` 가 태그를 닫지 못한다**.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from '@/components/JsonLd';
import { toPost } from '@/lib/blog/posts';
import { getGame } from '@/lib/games';
import {
  blogPostingLd,
  breadcrumbLd,
  gameLd,
  websiteLd,
} from '@/lib/structured-data';

const SITE = 'https://www.example.com';

const post = (row: Record<string, unknown>) => {
  const parsed = toPost({ id: '1', slug: 'hello', title: '첫 글', ...row });
  if (!parsed) throw new Error('픽스처가 글이 아니다');
  return parsed;
};

afterEach(() => vi.unstubAllEnvs());

describe('구조화 데이터', () => {
  it('홈은 사이트를 절대 주소로 알린다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    expect(websiteLd()).toMatchObject({
      '@type': 'WebSite',
      url: `${SITE}/`,
      inLanguage: 'ko-KR',
    });
  });

  it('글은 게시·수정 시각과 대표 사진을 싣는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const ld = blogPostingLd(
      post({
        summary: '요약',
        publish_at: '2020-01-01T00:00:00+09:00',
        updated_at: '2020-01-02T00:00:00+09:00',
        cover_url: 'https://cdn.example.com/x.jpg',
      }),
    );
    expect(ld).toMatchObject({
      '@type': 'BlogPosting',
      headline: '첫 글',
      description: '요약',
      url: `${SITE}/blog/hello`,
      datePublished: '2019-12-31T15:00:00.000Z',
      dateModified: '2020-01-01T15:00:00.000Z',
      image: 'https://cdn.example.com/x.jpg',
    });
  });

  it('대표 사진이 없으면 사이트 공유 이미지다 — 게시 시각이 없으면 적지 않는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const ld = blogPostingLd(post({ publish_at: null }));
    expect(ld.image).toBe(`${SITE}/opengraph-image`);
    expect(ld).not.toHaveProperty('datePublished');
    // 태그가 없으면 keywords 칸도 없다.
    expect(ld).not.toHaveProperty('keywords');
  });

  it('태그는 keywords 로 싣는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const ld = blogPostingLd(post({ tags: ['윷놀이', '나무'] }));
    expect(ld.keywords).toBe('윷놀이, 나무');
  });

  it('게임은 인원을 범위로 싣는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const game = getGame('soccer');
    if (!game) throw new Error('축구 게임판이 등록소에 없다');
    expect(gameLd(game, '/games/soccer')).toMatchObject({
      '@type': 'Game',
      name: game.title,
      url: `${SITE}/games/soccer`,
      numberOfPlayers: {
        minValue: game.players.min,
        maxValue: game.players.max,
      },
    });
  });

  it('경로는 홈에서 시작해 1부터 센다', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
    const ld = breadcrumbLd([{ name: '공방 일지', path: '/blog' }]);
    expect(ld.itemListElement).toEqual([
      expect.objectContaining({ position: 1, item: `${SITE}/` }),
      expect.objectContaining({
        position: 2,
        name: '공방 일지',
        item: `${SITE}/blog`,
      }),
    ]);
  });

  it('제목 속 `</script>` 가 태그를 닫지 못한다', () => {
    const { container } = render(
      <JsonLd
        data={{ '@context': 'https://schema.org', name: '</script><b>x' }}
      />,
    );
    const script = container.querySelector('script');
    expect(script?.innerHTML).not.toContain('</script>');
    expect(container.querySelector('b')).toBeNull();
    expect(JSON.parse(script?.textContent ?? '')).toMatchObject({
      name: '</script><b>x',
    });
  });
});

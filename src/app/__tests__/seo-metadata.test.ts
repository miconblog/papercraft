/**
 * 공유 카드·검색 메타데이터 (SEO)
 *
 * Next 는 메타데이터를 **얕게** 합친다. 페이지가 `openGraph` 를 적으면
 * 레이아웃의 `siteName`·`locale` 이 통째로 사라지고, 레이아웃의 `twitter` 에
 * 제목을 적어 두면 모든 페이지의 트위터 카드가 사이트 제목으로 나간다.
 * 둘 다 화면에서는 안 보이는 사고라 여기서 지킨다.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '', className: '' }),
  Geist_Mono: () => ({ variable: '', className: '' }),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('공유 카드', () => {
  it('레이아웃의 트위터 카드는 모양만 정한다 — 제목은 페이지의 openGraph 에서 온다', async () => {
    const { metadata } = await import('../layout');
    expect(metadata.twitter).toEqual({ card: 'summary_large_image' });
  });

  it.each([
    ['홈', async () => (await import('../page')).metadata],
    ['공방 일지', async () => (await import('../blog/page')).metadata],
    [
      '게임 만들기',
      async () =>
        (await import('../games/[id]/page')).generateMetadata(params('soccer')),
    ],
    [
      '게임 방법',
      async () =>
        (await import('../games/[id]/rules/page')).generateMetadata(
          params('soccer'),
        ),
    ],
  ])('%s 카드에 사이트 이름과 언어가 남는다', async (_, load) => {
    const meta = await load();
    expect(meta.openGraph).toMatchObject({
      siteName: '아빠 뭐해?, 아빠 공방',
      locale: 'ko_KR',
    });
  });

  it('홈과 공방 일지는 RSS 를 알린다', async () => {
    for (const { metadata } of [
      await import('../page'),
      await import('../blog/page'),
    ]) {
      expect(JSON.stringify(metadata.alternates?.types)).toContain('/feed.xml');
    }
  });

  it('인쇄 화면은 검색에 싣지 않는다', async () => {
    const { generateMetadata } = await import('../games/[id]/print/page');
    const meta = await generateMetadata(params('soccer'));
    expect(meta.robots).toMatchObject({ index: false });
  });
});

describe('robots.txt', () => {
  it('관리 화면과 도구 API 는 막고, 미리보기가 쓰는 API 는 열어 둔다', async () => {
    const { default: robots } = await import('../robots');
    const rules = robots().rules;
    const disallow = [rules]
      .flat()
      .flatMap((rule) => [rule.disallow ?? []].flat());

    expect(disallow).toEqual(
      expect.arrayContaining(['/admin', '/api/print/', '/api/analytics/']),
    );
    // 통째로 막으면 검색엔진이 그린 만들기 화면에서 게임판이 빈다.
    expect(disallow).not.toContain('/api/');
    expect(
      disallow.some((path) => '/api/games/soccer/artwork'.startsWith(path)),
    ).toBe(false);
  });

  it('사이트맵 주소를 알린다', async () => {
    const { default: robots } = await import('../robots');
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

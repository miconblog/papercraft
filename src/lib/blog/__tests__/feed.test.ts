/**
 * 공방 일지 RSS (SEO)
 *
 * 네이버 서치어드바이저가 받아 가는 파일이다. XML 이 한 글자만 깨져도 피드
 * 전체가 버려지므로, 사람이 쓴 제목의 `&`·`<` 가 그대로 새지 않는지를 본다.
 */
import { describe, expect, it } from 'vitest';
import { renderFeed } from '../feed';
import { toPost, type Post } from '../posts';

const SITE = 'https://www.example.com';

const post = (row: Record<string, unknown>): Post => {
  const parsed = toPost({ id: '1', slug: 'hello', title: '첫 글', ...row });
  if (!parsed) throw new Error('픽스처가 글이 아니다');
  return parsed;
};

describe('renderFeed', () => {
  it('글마다 주소·제목·게시 시각을 싣는다', () => {
    const xml = renderFeed(
      [post({ summary: '요약', publish_at: '2020-01-01T00:00:00+09:00' })],
      SITE,
    );
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`<link>${SITE}/blog/hello</link>`);
    expect(xml).toContain('<title>첫 글</title>');
    expect(xml).toContain('<description>요약</description>');
    expect(xml).toContain('<pubDate>Tue, 31 Dec 2019 15:00:00 GMT</pubDate>');
    expect(xml).toContain(`href="${SITE}/feed.xml"`);
  });

  it('제목의 특수 문자를 이스케이프한다 — XML 이 깨지지 않는다', () => {
    const xml = renderFeed(
      [
        post({
          title: '종이 & 가위 <첫 판>',
          publish_at: '2020-01-01T00:00:00Z',
        }),
      ],
      SITE,
    );
    expect(xml).toContain('<title>종이 &amp; 가위 &lt;첫 판&gt;</title>');
    expect(xml).not.toContain('<첫 판>');
  });

  it('글이 없어도 빈 채널로 선다', () => {
    const xml = renderFeed([], SITE);
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
    expect(xml).not.toContain('<lastBuildDate>');
  });
});

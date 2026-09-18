import type { Post } from './posts';
import { postSummary } from './summary';
import {
  BLOG_DESCRIPTION,
  BLOG_TITLE,
  SITE_AUTHOR,
  SITE_TITLE,
} from '@/lib/site';

/**
 * 공방 일지 RSS 본문 (SEO) — 라우트는 `app/feed.xml/route.ts` 다.
 *
 * 라우트 파일은 HTTP 메서드 말고는 내보낼 수 없어서 XML 만드는 일은 여기 둔다.
 * 테스트가 저장소 없이 글 목록만 넣어 본다.
 */

/** 한 번에 싣는 글 수. 구독기는 새 글만 보면 되고, 옛 글은 사이트맵이 싣는다. */
const FEED_LIMIT = 30;

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const rfc822 = (ms: number): string => new Date(ms).toUTCString();

function item(post: Post, base: string): string {
  const url = `${base}/blog/${post.slug}`;
  return [
    '<item>',
    `<title>${escapeXml(post.title)}</title>`,
    `<link>${escapeXml(url)}</link>`,
    `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `<description>${escapeXml(postSummary(post))}</description>`,
    `<dc:creator>${escapeXml(SITE_AUTHOR)}</dc:creator>`,
    `<pubDate>${rfc822(post.publishAt ?? post.updatedAt)}</pubDate>`,
    '</item>',
  ].join('');
}

/** 낸 글 목록(새 글부터)에서 XML 을 만든다. */
export function renderFeed(posts: readonly Post[], base: string): string {
  const newest = posts[0];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<channel>',
    `<title>${escapeXml(`${SITE_TITLE} · ${BLOG_TITLE}`)}</title>`,
    `<link>${escapeXml(`${base}/blog`)}</link>`,
    `<atom:link href="${escapeXml(`${base}/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(BLOG_DESCRIPTION)}</description>`,
    '<language>ko</language>',
    ...(newest
      ? [
          `<lastBuildDate>${rfc822(newest.publishAt ?? newest.updatedAt)}</lastBuildDate>`,
        ]
      : []),
    ...posts.slice(0, FEED_LIMIT).map((post) => item(post, base)),
    '</channel>',
    '</rss>',
  ].join('\n');
}

import type { Post } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';
import type { GameDefinition } from '@/lib/schema';
import {
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  siteUrl,
} from '@/lib/site';

/**
 * 구조화 데이터 (SEO)
 *
 * 검색엔진이 화면 글자만으로는 모르는 것 — 이 페이지가 **글**인지 **게임**인지,
 * 언제 썼고 누가 냈는지, 사이트 안 어디쯤인지 — 를 schema.org 어휘로 알린다.
 * 구글은 이것으로 검색 결과에 날짜·경로(breadcrumb)를 붙이고, 네이버·빙도
 * 같은 값을 읽는다.
 *
 * 값은 전부 **절대 주소**다. `metadataBase` 는 `<meta>` 에만 걸리고 JSON-LD
 * 안의 문자열은 건드리지 않는다.
 *
 * 그리는 쪽은 `components/JsonLd.tsx` 다. 여기는 객체만 만든다 — 테스트가
 * 렌더링 없이 값을 본다.
 */
export type JsonLdObject = { '@context': 'https://schema.org' } & Record<
  string,
  unknown
>;

const CONTEXT = 'https://schema.org' as const;
const LANGUAGE = 'ko-KR';

const absolute = (path: string): string =>
  /^https?:\/\//.test(path) ? path : `${siteUrl()}${path}`;

/** 사이트를 낸 쪽. 글의 지은이이자 모든 페이지의 발행처다. */
const publisher = () => ({
  '@type': 'Organization',
  name: SITE_AUTHOR,
  url: SITE_AUTHOR_URL,
});

/** 홈. 검색 결과에 사이트 이름을 이것으로 붙인다. */
export function websiteLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: absolute('/'),
    inLanguage: LANGUAGE,
    publisher: publisher(),
  };
}

/** 공방 일지 글 하나. */
export function blogPostingLd(post: Post): JsonLdObject {
  const url = absolute(`/blog/${post.slug}`);
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: post.title,
    description: postSummary(post),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: LANGUAGE,
    ...(post.publishAt !== null && {
      datePublished: new Date(post.publishAt).toISOString(),
    }),
    dateModified: new Date(post.updatedAt).toISOString(),
    // 대표 사진이 없으면 사이트 공유 이미지다 — `generateMetadata` 의 OG 와
    // 같은 순서다.
    image: absolute(post.coverUrl ?? '/opengraph-image'),
    author: publisher(),
    publisher: publisher(),
  };
}

/**
 * 게임 하나. `path` 는 이 값을 싣는 화면의 주소다 — 만들기(`/games/<id>`)와
 * 게임 방법(`/rules`)이 같은 게임을 서로 다른 주소에서 말한다.
 */
export function gameLd(game: GameDefinition, path: string): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Game',
    name: game.title,
    description: game.tagline,
    url: absolute(path),
    inLanguage: LANGUAGE,
    image: absolute(`/games/${game.id}/opengraph-image`),
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: game.players.min,
      maxValue: game.players.max,
    },
    publisher: publisher(),
  };
}

/**
 * 사이트 안 경로. 검색 결과의 주소 자리에 `아빠 공방 › 공방 일지` 처럼 뜬다.
 * 맨 앞의 홈은 부르는 쪽이 적지 않는다.
 */
export function breadcrumbLd(
  trail: readonly { name: string; path: string }[],
): JsonLdObject {
  const items = [{ name: SITE_TITLE, path: '/' }, ...trail];
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

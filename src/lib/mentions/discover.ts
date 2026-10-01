/**
 * 받는 주소 찾기 (IDE-046)
 *
 * 남의 글에 멘션을 보내려면 **그 글이 어디로 받는다고 적어 뒀는지**부터 알아야
 * 한다. 웹멘션 규약(W3C)이 순서를 정해 두었다.
 *
 * 1. 응답의 `Link` 헤더에 `rel="webmention"` 이 있으면 그것
 * 2. 없으면 문서의 `<link>` 나 `<a>` 가운데 `rel="webmention"` 이 붙은 **첫 번째**
 *
 * 둘 다 없으면 핑백을 본다 — `X-Pingback` 헤더, 그다음 `<link rel="pingback">`.
 * **웹멘션이 있으면 핑백은 보지 않는다.** 둘 다 받는 곳에 둘 다 보내면 같은
 * 멘션이 두 번 선다.
 *
 * 순수 함수다. 요청은 `send.ts` 가 걸고 여기는 받은 것을 읽기만 한다.
 */
import { baseUrl, hasRel, resolveUrl, startTags, stripInert } from './html';

export type MentionVia = 'webmention' | 'pingback';

export type Endpoint = { via: MentionVia; url: string };

/** 헤더는 짧다. 이보다 길면 읽지 않는다 — 정규식이 붙는 자리라 끝을 둔다. */
const MAX_HEADER = 8_192;

const LINK_VALUE =
  /<([^>]*)>((?:\s*;\s*[\w!#$%&'*+.^`|~-]+(?:\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^\s",;]*))?)*)/g;

const REL_PARAM = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s",;]+))/i;

/**
 * `Link` 헤더에서 그 `rel` 을 가진 첫 주소.
 *
 * 헤더가 여러 줄이면 쉼표로 이어져 온다. 주소 안에도 쉼표가 있을 수 있어서
 * 쉼표로 쪼개지 않고 `<…>` 단위로 읽는다.
 */
export function linkHeaderTarget(
  header: string | null,
  rel: string,
): string | null {
  if (!header || header.length > MAX_HEADER) return null;
  for (const match of header.matchAll(LINK_VALUE)) {
    const found = REL_PARAM.exec(match[2]);
    if (found && hasRel(found[1] ?? found[2], rel)) return match[1];
  }
  return null;
}

/** 보낼 수 있는 주소인가 — 웹 주소여야 한다. 나머지 검사는 요청을 거는 쪽이 한다. */
const webUrl = (url: string | null): string | null =>
  url !== null && /^https?:\/\//i.test(url) ? url : null;

export type Discoverable = {
  /** `Link` 응답 헤더. */
  linkHeader: string | null;
  /** `X-Pingback` 응답 헤더. */
  pingbackHeader: string | null;
  /** 본문. HTML 이 아니면 빈 글자를 준다. */
  html: string;
  /** 넘겨 주기를 다 따라간 문서 주소. */
  documentUrl: string;
};

export function discoverEndpoint(page: Discoverable): Endpoint | null {
  const fromHeader = linkHeaderTarget(page.linkHeader, 'webmention');
  if (fromHeader !== null) {
    // 헤더의 상대 주소는 **문서 주소**에 대고 푼다 — `<base>` 는 문서 안의 것만
    // 다스린다.
    const url = webUrl(resolveUrl(fromHeader, page.documentUrl));
    if (url) return { via: 'webmention', url };
  }

  const html = stripInert(page.html);
  const base = baseUrl(html, page.documentUrl);
  const tags = startTags(html, new Set(['link', 'a']));

  // `href` 가 **있기만 하면** 된다. 빈 값(`href=""`)은 "이 글 자신이 받는다"는
  // 뜻이라 버리면 안 된다.
  const mention = tags.find(
    (tag) => hasRel(tag.attrs.rel, 'webmention') && 'href' in tag.attrs,
  );
  if (mention) {
    const url = webUrl(resolveUrl(mention.attrs.href, base));
    if (url) return { via: 'webmention', url };
  }

  const pingback =
    page.pingbackHeader?.trim() ||
    tags.find(
      (tag) =>
        tag.name === 'link' &&
        hasRel(tag.attrs.rel, 'pingback') &&
        tag.attrs.href,
    )?.attrs.href;
  if (pingback) {
    const url = webUrl(resolveUrl(pingback, base));
    if (url) return { via: 'pingback', url };
  }

  return null;
}

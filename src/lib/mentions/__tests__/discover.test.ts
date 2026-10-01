/**
 * 받는 주소 찾기 (IDE-046)
 *
 * 웹멘션 규약이 정한 순서를 지킨다 — **헤더가 먼저, 그다음 문서의 첫 번째.**
 * 그리고 웹멘션이 있으면 핑백은 보지 않는다. 사례들은 규약의 시험장
 * (webmention.rocks)이 내는 문제들에서 가져왔다.
 */
import { describe, expect, it } from 'vitest';
import {
  discoverEndpoint,
  linkHeaderTarget,
  type Discoverable,
} from '../discover';

const DOC = 'https://blog.example/2026/post';

const page = (over: Partial<Discoverable> = {}): Discoverable => ({
  linkHeader: null,
  pingbackHeader: null,
  html: '',
  documentUrl: DOC,
  ...over,
});

describe('linkHeaderTarget', () => {
  it('rel 이 맞는 주소를 찾는다 — 따옴표가 있든 없든', () => {
    expect(
      linkHeaderTarget(
        '<https://a.example/wm>; rel="webmention"',
        'webmention',
      ),
    ).toBe('https://a.example/wm');
    expect(linkHeaderTarget('</wm>; rel=webmention', 'webmention')).toBe('/wm');
  });

  it('여러 주소가 쉼표로 이어져 와도 맞는 것을 고른다', () => {
    expect(
      linkHeaderTarget(
        '<https://a.example/feed>; rel="alternate"; type="application/rss+xml", ' +
          '<https://a.example/wm?a=1,2>; rel="webmention"',
        'webmention',
      ),
    ).toBe('https://a.example/wm?a=1,2');
  });

  it('rel 에 낱말이 여럿이어도 찾는다', () => {
    expect(
      linkHeaderTarget('</wm>; rel="other webmention"', 'webmention'),
    ).toBe('/wm');
  });

  it('다른 rel 만 있으면 없다', () => {
    expect(linkHeaderTarget('</x>; rel="preload"', 'webmention')).toBeNull();
    expect(linkHeaderTarget(null, 'webmention')).toBeNull();
  });
});

describe('discoverEndpoint — 웹멘션', () => {
  it('헤더의 상대 주소를 문서 주소에 대고 푼다', () => {
    expect(
      discoverEndpoint(page({ linkHeader: '</wm>; rel="webmention"' })),
    ).toEqual({ via: 'webmention', url: 'https://blog.example/wm' });
  });

  it('헤더가 문서보다 먼저다', () => {
    expect(
      discoverEndpoint(
        page({
          linkHeader: '<https://a.example/header>; rel="webmention"',
          html: '<link rel="webmention" href="https://a.example/html">',
        }),
      ),
    ).toMatchObject({ url: 'https://a.example/header' });
  });

  it('<link> 와 <a> 가운데 문서에서 먼저 나온 것이다', () => {
    expect(
      discoverEndpoint(
        page({
          html:
            '<p><a rel="webmention" href="/from-a">받는 곳</a></p>' +
            '<link rel="webmention" href="/from-link">',
        }),
      ),
    ).toMatchObject({ url: 'https://blog.example/from-a' });
  });

  it('빈 href 는 "이 글 자신이 받는다"는 뜻이다', () => {
    expect(
      discoverEndpoint(page({ html: '<link rel="webmention" href="">' })),
    ).toEqual({ via: 'webmention', url: DOC });
  });

  it('href 가 아예 없는 것은 건너뛰고 다음 것을 본다', () => {
    expect(
      discoverEndpoint(
        page({
          html: '<a rel="webmention">글자일 뿐</a><link rel="webmention" href="/real">',
        }),
      ),
    ).toMatchObject({ url: 'https://blog.example/real' });
  });

  it('주석 속에 적힌 것은 받는 주소가 아니다', () => {
    expect(
      discoverEndpoint(
        page({
          html:
            '<!-- <link rel="webmention" href="/commented"> -->' +
            '<link rel="webmention" href="/real">',
        }),
      ),
    ).toMatchObject({ url: 'https://blog.example/real' });
  });

  it('받는 주소의 질의는 그대로 지킨다', () => {
    expect(
      discoverEndpoint(
        page({ html: '<link rel="webmention" href="/wm?site=blog&amp;v=2">' }),
      ),
    ).toMatchObject({ url: 'https://blog.example/wm?site=blog&v=2' });
  });

  it('웹 주소가 아닌 받는 주소는 쓰지 않는다', () => {
    expect(
      discoverEndpoint(
        page({ html: '<link rel="webmention" href="javascript:alert(1)">' }),
      ),
    ).toBeNull();
  });
});

describe('discoverEndpoint — 핑백', () => {
  it('웹멘션이 없으면 X-Pingback 헤더를 본다', () => {
    expect(
      discoverEndpoint(
        page({ pingbackHeader: 'https://blog.example/xmlrpc.php' }),
      ),
    ).toEqual({ via: 'pingback', url: 'https://blog.example/xmlrpc.php' });
  });

  it('헤더가 없으면 문서의 <link rel="pingback"> 을 본다', () => {
    expect(
      discoverEndpoint(
        page({
          html: '<link rel="pingback" href="https://blog.example/xmlrpc.php">',
        }),
      ),
    ).toMatchObject({ via: 'pingback' });
  });

  it('둘 다 받는 곳에는 웹멘션으로만 보낸다 — 같은 멘션이 두 번 서지 않게', () => {
    expect(
      discoverEndpoint(
        page({
          pingbackHeader: 'https://blog.example/xmlrpc.php',
          html: '<link rel="webmention" href="/wm">',
        }),
      ),
    ).toEqual({ via: 'webmention', url: 'https://blog.example/wm' });
  });

  it('아무것도 없으면 받지 않는 곳이다', () => {
    expect(discoverEndpoint(page({ html: '<p>그냥 글</p>' }))).toBeNull();
  });
});

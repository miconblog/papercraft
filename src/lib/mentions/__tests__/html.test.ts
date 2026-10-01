/**
 * 남의 HTML 읽기 (IDE-046)
 *
 * 읽는 것이 **악의로 지은 문서일 수 있다**는 데서 지킬 것이 나온다. 주석 속의
 * 링크는 링크가 아니다 · 꺼낸 것은 글자다(태그가 남지 않는다) · 닫히지 않은
 * 태그 십만 개에도 멈추지 않는다.
 */
import { describe, expect, it } from 'vitest';
import {
  EXCERPT_MAX,
  TITLE_MAX,
  baseUrl,
  decodeEntities,
  excerptAround,
  hasRel,
  oneLine,
  pageTitle,
  startTags,
  stripInert,
} from '../html';

const anchors = (html: string) => startTags(html, new Set(['a']));

describe('stripInert', () => {
  it('주석 속의 태그를 걷어 낸다 — 핑백 스팸이 주소를 숨기는 자리다', () => {
    const html = stripInert(
      '앞 <!-- <a href="https://x.example/">몰래</a> --> 뒤',
    );
    expect(anchors(html)).toHaveLength(0);
    expect(html).toContain('앞');
    expect(html).toContain('뒤');
  });

  it('스크립트 · 스타일 안의 글자를 걷어 낸다', () => {
    const html = stripInert(
      '<script>var s = \'<a href="https://x.example/">x</a>\';</script>' +
        '<STYLE>a { content: "<a href=y>" }</STYLE><a href="/real">진짜</a>',
    );
    expect(anchors(html).map((tag) => tag.attrs.href)).toEqual(['/real']);
  });

  it('닫히지 않은 주석 뒤는 전부 버린다', () => {
    expect(stripInert('보인다 <!-- 안 닫힘 <a href="/x">x</a>')).toBe(
      '보인다  ',
    );
  });
});

describe('decodeEntities', () => {
  it('이름 · 십진 · 십육진을 푼다', () => {
    expect(decodeEntities('a&amp;b &lt;p&gt; &quot;x&quot; &#39;y&#x27;')).toBe(
      'a&b <p> "x" \'y\'',
    );
    expect(decodeEntities('&#54620;&#xAE00;')).toBe('한글');
  });

  it('모르는 이름과 말이 안 되는 번호는 그대로 둔다 — 던지지 않는다', () => {
    expect(decodeEntities('&unknown; &#0; &#x110000;')).toBe(
      '&unknown; &#0; &#x110000;',
    );
  });
});

describe('startTags', () => {
  it('속성을 따옴표 종류와 상관없이 읽는다', () => {
    const [tag] = anchors(
      `<A HREF='https://x.example/?a=1&amp;b=2' rel=nofollow data-x>글</a>`,
    );
    expect(tag.name).toBe('a');
    expect(tag.attrs).toEqual({
      href: 'https://x.example/?a=1&b=2',
      rel: 'nofollow',
      'data-x': '',
    });
  });

  it('따옴표 안의 > 는 태그의 끝이 아니다', () => {
    const [tag] = anchors('<a title="a > b" href="/x">글</a>');
    expect(tag.attrs.href).toBe('/x');
  });

  it('같은 속성이 두 번이면 앞엣것이다 — 브라우저가 그렇게 읽는다', () => {
    const [tag] = anchors('<a href="/first" href="/second">글</a>');
    expect(tag.attrs.href).toBe('/first');
  });

  it('고른 이름만, 문서 순서대로 돌려준다', () => {
    const tags = startTags(
      '<p><link rel="x" href="/1"><b>굵게</b><a href="/2">글</a></p>',
      new Set(['link', 'a']),
    );
    expect(tags.map((tag) => tag.name)).toEqual(['link', 'a']);
  });

  it('닫는 태그와 글자로 쓴 < 는 태그가 아니다', () => {
    expect(
      anchors('1 < 2 </a> <!doctype html> <a href="/x">글</a>'),
    ).toHaveLength(1);
  });

  it('닫히지 않은 태그가 십만 개여도 금방 끝난다', () => {
    // 정규식으로 "< 부터 > 까지"를 찾으면 시도마다 끝까지 훑어 제곱으로 느려진다.
    const hostile = '<a href="'.repeat(100_000);
    const started = performance.now();

    expect(anchors(hostile)).toEqual([]);
    expect(stripInert('<!--'.repeat(100_000))).toBe(' ');
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('hasRel', () => {
  it('빈칸으로 나눈 낱말 가운데서 찾는다', () => {
    expect(hasRel('nofollow WebMention', 'webmention')).toBe(true);
    expect(hasRel('not-webmention', 'webmention')).toBe(false);
    expect(hasRel(undefined, 'webmention')).toBe(false);
  });
});

describe('baseUrl', () => {
  it('<base> 가 있으면 상대 주소를 그것에 대고 푼다', () => {
    expect(baseUrl('<base href="/sub/">', 'https://blog.example/post')).toBe(
      'https://blog.example/sub/',
    );
  });

  it('없으면 문서 주소다', () => {
    expect(baseUrl('<p>글</p>', 'https://blog.example/post')).toBe(
      'https://blog.example/post',
    );
  });
});

describe('oneLine', () => {
  it('줄바꿈과 겹친 빈칸을 한 칸으로, 보이지 않는 글자는 뗀다', () => {
    expect(oneLine('  아빠\n\n  공방​ ‮뒤집기 ')).toBe('아빠 공방 뒤집기');
  });
});

describe('pageTitle', () => {
  it('og:title 이 있으면 그것을 쓴다 — <title> 에는 사이트 이름이 붙어 온다', () => {
    expect(
      pageTitle(
        '<title>윷가락 접기 : 네이버 블로그</title>' +
          '<meta property="og:title" content="윷가락 접기">',
      ),
    ).toBe('윷가락 접기');
  });

  it('없으면 <title> 이다', () => {
    expect(
      pageTitle('<head><title>\n  종이 &amp; 가위 \n</title></head>'),
    ).toBe('종이 & 가위');
  });

  it('제목 속의 태그 모양은 글자로 남는다 — 마크업이 되지 않는다', () => {
    expect(
      pageTitle(
        '<meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt;">',
      ),
    ).toBe('<script>alert(1)</script>');
  });

  it('길면 자른다', () => {
    const title = pageTitle(`<title>${'가'.repeat(500)}</title>`);
    expect(title.length).toBe(TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
  });

  it('없으면 빈 글자다', () => {
    expect(pageTitle('<p>제목 없는 글</p>')).toBe('');
  });
});

describe('excerptAround', () => {
  it('링크 앞뒤의 글자를 태그 없이 꺼낸다 — 원문의 띄어쓰기 그대로', () => {
    const html =
      '<p>지난 주말에 <b>아이와</b> <a href="https://www.daddyscraft.com/games/soccer">축구 게임판</a>을 뽑아 놀았다.</p>';
    const [anchor] = anchors(html);

    expect(excerptAround(html, anchor)).toBe(
      '지난 주말에 아이와 축구 게임판을 뽑아 놀았다.',
    );
  });

  it('링크가 든 문단 안에서만 꺼낸다 — 제목이나 옆 문단이 붙지 않는다', () => {
    const html =
      '<head><title>블로그 제목</title></head><body><p>앞 문단.</p>' +
      '<p>여기서 <a href="/x">링크</a>를 걸었다.</p><p>뒤 문단.</p></body>';
    const [anchor] = anchors(html);

    expect(excerptAround(html, anchor)).toBe('여기서 링크를 걸었다.');
  });

  it('길면 링크 둘레만 남기고 줄임표를 단다', () => {
    const html = `<p>${'앞'.repeat(400)}<a href="/x">링크</a>${'뒤'.repeat(400)}</p>`;
    const [anchor] = anchors(html);
    const excerpt = excerptAround(html, anchor);

    expect(excerpt.startsWith('…앞')).toBe(true);
    expect(excerpt.endsWith('뒤…')).toBe(true);
    expect(excerpt).toContain('링크');
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX);
  });

  it('자르다 끊긴 태그의 속성이 글자로 새지 않는다', () => {
    // 링크 앞 2,000자에서 자르면 긴 태그의 한가운데가 걸린다.
    const html = `<div class="${'x'.repeat(1_990)}">글머리 <a href="/x">링크</a> 끝</div>`;
    const [anchor] = anchors(html);

    expect(excerptAround(html, anchor)).toBe('글머리 링크 끝');
  });
});

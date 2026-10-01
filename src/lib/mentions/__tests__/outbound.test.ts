/**
 * 글이 가리키는 바깥 (IDE-046)
 *
 * 받는 쪽은 우리 글에 와서 **우리가 보낸 주소와 똑같은 `href`** 를 찾는다. 그래서
 * 가장 중요한 것이 "문서에 적힌 글자 그대로"다 — 다듬으면 확인에 떨어진다.
 */
import { describe, expect, it } from 'vitest';
import { toDoc, type Doc } from '@/lib/blog/doc';
import { MAX_OUTBOUND, outboundLinks } from '../outbound';

const SITE = 'https://www.daddyscraft.com';

const link = (href: string, text = '링크') => ({
  type: 'text',
  text,
  marks: [{ type: 'link', attrs: { href } }],
});

const paragraphs = (...hrefs: string[]): Doc =>
  toDoc(hrefs.map((href) => ({ type: 'paragraph', content: [link(href)] })));

describe('outboundLinks', () => {
  it('문단 · 제목 · 인용 · 목록의 링크를 문서 순서대로 모은다', () => {
    const doc = toDoc([
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [link('https://a.example/1')],
      },
      { type: 'paragraph', content: [link('https://b.example/2')] },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [link('https://c.example/3')] },
            ],
          },
        ],
      },
      {
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [link('https://d.example/4')] },
        ],
      },
    ]);

    expect(outboundLinks(doc, SITE)).toEqual([
      'https://a.example/1',
      'https://b.example/2',
      'https://c.example/3',
      'https://d.example/4',
    ]);
  });

  it('주소를 다듬지 않는다 — 화면의 href 와 한 글자도 다르면 안 된다', () => {
    const href = 'https://Blog.Example/Post/?utm=1#section';
    expect(outboundLinks(paragraphs(href), SITE)).toEqual([href]);
  });

  it('우리 사이트로 가는 링크는 뺀다 — www 가 있든 없든', () => {
    expect(
      outboundLinks(
        paragraphs(
          '/blog/other',
          '#top',
          'https://www.daddyscraft.com/games/soccer',
          'https://daddyscraft.com/blog/x',
          'https://blog.example/post',
        ),
        SITE,
      ),
    ).toEqual(['https://blog.example/post']);
  });

  it('메일 주소는 멘션을 받을 곳이 아니다', () => {
    expect(outboundLinks(paragraphs('mailto:me@example.com'), SITE)).toEqual(
      [],
    );
  });

  it('같은 주소는 한 번만', () => {
    expect(
      outboundLinks(
        paragraphs('https://blog.example/post', 'https://blog.example/post'),
        SITE,
      ),
    ).toEqual(['https://blog.example/post']);
  });

  it('사진 주소는 보지 않는다 — 끌어다 쓴 것은 이야기한 것이 아니다', () => {
    const doc = toDoc([
      { type: 'image', attrs: { src: 'https://cdn.example/a.jpg', alt: '' } },
    ]);
    expect(outboundLinks(doc, SITE)).toEqual([]);
  });

  it('한 글에서 보내는 수에 끝이 있고, 앞에서부터 보낸다', () => {
    const hrefs = Array.from(
      { length: MAX_OUTBOUND + 5 },
      (_, i) => `https://blog.example/${i}`,
    );
    const links = outboundLinks(paragraphs(...hrefs), SITE);

    expect(links).toHaveLength(MAX_OUTBOUND);
    expect(links[0]).toBe('https://blog.example/0');
  });
});

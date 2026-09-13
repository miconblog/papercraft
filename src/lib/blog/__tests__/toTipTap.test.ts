/**
 * 문서 → TipTap JSON (IDE-028)
 *
 * **`toDoc(docToTipTap(d))` 은 `d` 와 같아야 한다.**
 *
 * 이걸 안 지켜서 사고가 났다. 우리 문서를 편집기에 그대로 넘겼더니 TipTap 이
 * `attrs` 안을 보느라 **저장한 사진이 통째로 사라졌다**(2026-09-09 사용자 신고).
 * 값은 DB 에 멀쩡히 있는데 편집기만 못 읽으니, 눈으로는 "사진이 안 올라갔나
 * 보다"로 보였다. 제목 단수·링크·목록·코드도 함께 잃고 있었다.
 */
import { describe, expect, it } from 'vitest';
import { toDoc, type Doc } from '../doc';
import { docToTipTap } from '../toTipTap';
import { markdownToDoc } from '../fromMarkdown';

const rich: Doc = toDoc({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: '제목' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '링크',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
        { type: 'hardBreak' },
        { type: 'text', text: '굵게', marks: [{ type: 'bold' }] },
        { type: 'text', text: '코드', marks: [{ type: 'code' }] },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '하나' }] },
          ],
        },
      ],
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '첫째' }] },
          ],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '인용' }] },
      ],
    },
    { type: 'codeBlock', content: [{ type: 'text', text: 'const a = 1;' }] },
    { type: 'image', attrs: { src: 'https://x.co/a.jpg', alt: '사진' } },
    {
      type: 'image',
      attrs: { src: 'https://x.co/b.jpg', alt: '반쯤', width: 50 },
    },
    {
      type: 'image',
      attrs: {
        src: 'https://x.co/c.jpg',
        alt: '왼쪽',
        width: 45,
        align: 'left',
      },
    },
    {
      type: 'imageRow',
      attrs: {
        images: [
          { src: 'https://x.co/r1.jpg', alt: '' },
          { src: 'https://x.co/r2.jpg', alt: '둘째' },
        ],
      },
    },
    { type: 'horizontalRule' },
    { type: 'paragraph' },
  ],
});

describe('편집기로 넘겼다 되받아도 그대로다', () => {
  it('한 바퀴 돌아도 문서가 같다', () => {
    expect(toDoc(docToTipTap(rich))).toEqual(rich);
  });

  it('두 바퀴 돌아도 같다 — 저장·열기를 되풀이해도 무너지지 않는다', () => {
    expect(toDoc(docToTipTap(toDoc(docToTipTap(rich))))).toEqual(rich);
  });

  it('사진이 살아남는다 — 이것이 실제로 사라졌던 것이다', () => {
    const tiptap = docToTipTap(rich);
    // TipTap 은 `attrs` 안에서 찾는다. 밖에 두면 못 읽는다.
    expect(JSON.stringify(tiptap)).toContain(
      '"attrs":{"src":"https://x.co/a.jpg"',
    );
    expect(toDoc(tiptap).content.some((n) => n.type === 'image')).toBe(true);
  });

  it('사진 너비도 왕복한다 — 조절한 크기가 다시 열 때 살아 있어야 한다', () => {
    expect(JSON.stringify(docToTipTap(rich))).toContain('"width":50');
    const back = toDoc(docToTipTap(rich)).content.filter(
      (n) => n.type === 'image',
    );
    expect(back.map((n) => (n.type === 'image' ? n.width : null))).toEqual([
      undefined,
      50,
      45,
    ]);
  });

  it('나란히 선 사진 줄도 왕복한다', () => {
    expect(JSON.stringify(docToTipTap(rich))).toContain('"imageRow"');
    const back = toDoc(docToTipTap(rich)).content.find(
      (n) => n.type === 'imageRow',
    );
    expect(back?.type === 'imageRow' && back.images).toEqual([
      { src: 'https://x.co/r1.jpg', alt: '' },
      { src: 'https://x.co/r2.jpg', alt: '둘째' },
    ]);
  });

  it('사진 정렬도 왕복한다', () => {
    expect(JSON.stringify(docToTipTap(rich))).toContain('"align":"left"');
    const back = toDoc(docToTipTap(rich)).content.filter(
      (n) => n.type === 'image',
    );
    expect(back.map((n) => (n.type === 'image' ? n.align : null))).toEqual([
      undefined,
      undefined,
      'left',
    ]);
  });

  it('제목 단수·링크 주소도 `attrs` 로 간다', () => {
    const json = JSON.stringify(docToTipTap(rich));
    expect(json).toContain('"attrs":{"level":3}');
    expect(json).toContain('"attrs":{"href":"https://example.com"}');
  });

  it('목록은 `listItem > paragraph` 로 다시 감싼다', () => {
    expect(JSON.stringify(docToTipTap(rich))).toContain(
      '"listItem","content":[{"type":"paragraph"',
    );
  });

  it('빈 글에도 문단 하나를 준다 — 커서를 놓을 자리가 있어야 한다', () => {
    expect(docToTipTap({ type: 'doc', content: [] })).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
  });
});

describe('마크다운으로 쓴 글도 편집기에서 온전하다', () => {
  it('옮겨서 편집기에 넘겼다 되받아도 같다', () => {
    const doc = markdownToDoc(
      '# 배경\n\n**굵게**\n둘째 줄\n\n- 하나\n\n![사진](https://x.co/a.jpg)',
    );
    expect(toDoc(docToTipTap(doc))).toEqual(doc);
  });
});

describe('줄 칸의 너비도 왕복한다 (2026-09-10)', () => {
  it('편집기로 넘겼다 되받아도 칸마다 너비가 그대로다', () => {
    const doc = toDoc([
      {
        type: 'imageRow',
        attrs: {
          images: [
            { src: 'https://x.co/a.jpg', alt: '', width: 30 },
            { src: 'https://x.co/b.jpg', alt: '둘째' },
            { src: 'https://x.co/c.jpg', alt: '', width: 25 },
          ],
        },
      },
    ]);
    expect(toDoc(docToTipTap(doc))).toEqual(doc);
  });
});

describe('줄 정렬도 왕복한다 (2026-09-10)', () => {
  it('편집기로 넘겼다 되받아도 줄의 정렬과 칸 너비가 그대로다', () => {
    const doc = toDoc([
      {
        type: 'imageRow',
        attrs: {
          align: 'left',
          images: [
            { src: 'https://x.co/a.jpg', alt: '', width: 30 },
            { src: 'https://x.co/b.jpg', alt: '' },
          ],
        },
      },
    ]);
    expect(doc.content[0]).toMatchObject({ type: 'imageRow', align: 'left' });
    expect(toDoc(docToTipTap(doc))).toEqual(doc);
  });
});

/**
 * 문서 검사와 그리기 (IDE-028)
 *
 * `IDE-023` 때는 파서가 유일한 입구라 모양이 저절로 좁았다. 이제는 **브라우저가
 * 트리를 통째로 보낸다** — 그래서 여기가 문이다.
 *
 * 두 겹을 함께 지킨다. **검사**(`toDoc`)가 모르는 것을 버리고, **그리기**
 * (`renderDoc`)는 HTML 문자열을 만들지 않는다. 아래 시험은 조작한 JSON 을 넣고
 * **실제로 그려서** 스크립트가 안 생기는지 본다.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderDoc } from '../DocView';
import {
  docImageUrls,
  docText,
  isEmptyDoc,
  parseDoc,
  toDoc,
  toWidth,
} from '../doc';

const draw = (raw: unknown) => {
  const view = render(<div data-testid="body">{renderDoc(toDoc(raw))}</div>);
  return { ...view, text: () => screen.getByTestId('body').textContent ?? '' };
};

const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => ({ type: 'text', text, marks });

describe('모르는 것은 버린다', () => {
  it('모르는 마디는 통째로 버린다 — 안에 무엇이 들었든', () => {
    const { container } = draw([
      { type: 'script', content: [t('alert(1)')] },
      { type: 'iframe', attrs: { src: 'https://evil.example' } },
      para(t('남는 글')),
    ]);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('모르는 서식은 떼고 글자는 남긴다', () => {
    const { container, text } = draw([
      para(t('글자', [{ type: 'onerror' }, { type: 'textStyle' }])),
    ]);
    expect(text()).toBe('글자');
    expect(container.querySelector('[onerror]')).toBeNull();
  });

  it('마디에 실린 아무 속성도 그리지 않는다', () => {
    const { container } = draw([
      {
        type: 'paragraph',
        attrs: { onclick: 'alert(1)', style: 'x', dangerouslySetInnerHTML: 1 },
        content: [t('글자')],
      },
    ]);
    const p = container.querySelector('p')!;
    expect(p.getAttribute('onclick')).toBeNull();
    expect(p.getAttribute('style')).toBeNull();
  });

  it('글자로 들어온 태그는 글자로 나온다', () => {
    const { container, text } = draw([para(t('<script>alert(1)</script>'))]);
    expect(container.querySelector('script')).toBeNull();
    expect(text()).toBe('<script>alert(1)</script>');
  });

  it('망가진 것을 넣어도 던지지 않는다 — 조작한 JSON 하나로 화면이 죽으면 안 된다', () => {
    for (const bad of [null, 3, 'x', [], [null, 3], { type: 'doc' }]) {
      expect(() => toDoc(bad), JSON.stringify(bad)).not.toThrow();
    }
    expect(parseDoc('{{{')).toEqual({ type: 'doc', content: [] });
  });
});

describe('주소', () => {
  it('`javascript:` 링크는 서식만 떼고 글자를 남긴다', () => {
    const { container, text } = draw([
      para(
        t('눌러', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
      ),
    ]);
    expect(container.querySelector('a')).toBeNull();
    expect(text()).toBe('눌러');
  });

  it('`data:` 사진은 마디째 버린다', () => {
    const { container } = draw([
      { type: 'image', attrs: { src: 'data:text/html,<script>x</script>' } },
    ]);
    expect(container.querySelector('img')).toBeNull();
  });

  it('쓸 수 있는 주소는 그대로 통과한다', () => {
    draw([
      para(t('밖', [{ type: 'link', attrs: { href: 'https://example.com' } }])),
      para(t('안', [{ type: 'link', attrs: { href: '/games/soccer' } }])),
    ]);
    expect(screen.getByRole('link', { name: '밖' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByRole('link', { name: '안' })).not.toHaveAttribute(
      'target',
    );
  });
});

describe('그리기', () => {
  it('제목은 h2 부터다 — h1 은 글 제목이 이미 쓴다', () => {
    draw([
      { type: 'heading', attrs: { level: 1 }, content: [t('배경')] },
      { type: 'heading', attrs: { level: 3 }, content: [t('안쪽')] },
    ]);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('배경');
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('안쪽');
  });

  it('서식을 겹쳐 쓸 수 있다', () => {
    const { container } = draw([
      para(t('둘 다', [{ type: 'bold' }, { type: 'italic' }])),
    ]);
    expect(container.querySelector('strong em, em strong')).not.toBeNull();
  });

  it('줄바꿈을 그린다 — 엔터를 누른 자리다', () => {
    const { container } = draw([
      para(t('물어본다.'), { type: 'hardBreak' }, t('"아빠 일해!"')),
    ]);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelectorAll('p br')).toHaveLength(1);
  });

  it('목록은 한 겹 더 감싼 모양(listItem > paragraph)을 펴서 읽는다', () => {
    const item = (s: string) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [t(s)] }],
    });
    const { container } = draw([
      { type: 'bulletList', content: [item('하나'), item('둘')] },
      { type: 'orderedList', content: [item('첫째')] },
    ]);
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(1);
  });

  it('빈 문단도 자리를 지킨다 — 일부러 띄운 곳이다', () => {
    const { container } = draw([para(t('앞')), para(), para(t('뒤'))]);
    expect(container.querySelectorAll('p')).toHaveLength(3);
  });

  it('코드 블록·가로줄·사진을 그린다', () => {
    const { container } = draw([
      { type: 'codeBlock', content: [t('const a = 1;')] },
      { type: 'horizontalRule' },
      {
        type: 'image',
        attrs: { src: 'https://x.supabase.co/a.jpg', alt: '접은 윷가락' },
      },
    ]);
    expect(container.querySelector('pre')).toHaveTextContent('const a = 1;');
    expect(container.querySelector('hr')).not.toBeNull();
    expect(screen.getByAltText('접은 윷가락')).toHaveAttribute(
      'src',
      'https://x.supabase.co/a.jpg',
    );
  });
});

/**
 * **`toDoc(toDoc(x))` 은 `toDoc(x)` 와 같아야 한다.**
 *
 * 검사기가 자기 출력을 다시 읽지 못하면 **저장한 글이 읽을 때마다 조금씩
 * 무너진다** — 저장할 때 한 번(우리 모양으로), 읽을 때 또 한 번 지나기 때문이다.
 * 처음에 이걸 놓쳐서 제목이 문단이 되고 사진과 링크가 사라졌다. 사진 넣기
 * 테스트가 잡았고, 이 시험이 다시 그러지 못하게 한다.
 */
describe('두 번 읽어도 같다', () => {
  const tiptap = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [t('제목')] },
      para(
        t('링크', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
        { type: 'hardBreak' },
        t('굵게', [{ type: 'bold' }]),
      ),
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [t('하나')] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [t('둘')] }],
          },
        ],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [t('첫째')] }],
          },
        ],
      },
      {
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [t('첫 줄')] },
          { type: 'paragraph', content: [t('둘째 줄')] },
        ],
      },
      { type: 'codeBlock', content: [t('const a = 1;')] },
      { type: 'image', attrs: { src: 'https://x.co/a.jpg', alt: '사진' } },
      { type: 'horizontalRule' },
    ],
  };

  it('한 번 읽은 것을 다시 읽어도 그대로다', () => {
    const once = toDoc(tiptap);
    expect(toDoc(once)).toEqual(once);
    // 세 번째까지 본다 — 사진 넣기가 실제로 그만큼 지난다.
    expect(toDoc(toDoc(once))).toEqual(once);
  });

  it('다시 읽어도 무엇 하나 사라지지 않는다', () => {
    const twice = toDoc(toDoc(tiptap));
    const kinds = twice.content.map((n) => n.type);
    expect(kinds).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'image',
      'rule',
    ]);
    // 값을 들고 있는 것들이 특히 위험하다.
    expect(JSON.stringify(twice)).toContain('https://example.com');
    expect(JSON.stringify(twice)).toContain('https://x.co/a.jpg');
    expect(JSON.stringify(twice)).toContain('const a = 1;');
  });

  it('다시 읽어도 그리는 결과가 같다', () => {
    const once = renderDoc(toDoc(tiptap));
    const twice = renderDoc(toDoc(toDoc(tiptap)));
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe('사진 너비', () => {
  // 사용자 요청(2026-09-09)으로 사진 크기를 조절할 수 있게 됐다. 그 값이
  // **브라우저에서 온다** — 그리는 쪽이 CSS 에 그대로 쓰므로 여기서 가둔다.
  const image = (width: unknown) => ({
    type: 'image',
    attrs: { src: 'https://x.co/a.jpg', width },
  });
  const widthOf = (raw: unknown) => {
    const node = toDoc([raw]).content[0];
    return node?.type === 'image' ? node.width : 'not-image';
  };

  it('정한 너비를 그림에 입힌다', () => {
    const { container } = draw([image(60)]);
    expect(container.querySelector('img')).toHaveStyle({ width: '60%' });
  });

  it('100% 는 값을 담지 않는다 — 기본이라 담아 둘 이유가 없다', () => {
    expect(widthOf(image(100))).toBeUndefined();
    expect(widthOf(image(140))).toBeUndefined();
    const { container } = draw([image(100)]);
    expect(container.querySelector('img')?.getAttribute('style')).toBeNull();
  });

  it('너무 작은 값은 끌어올린다 — 무엇을 찍었는지 알아볼 수 없다', () => {
    expect(widthOf(image(1))).toBe(20);
    expect(widthOf(image(-999))).toBe(20);
  });

  it('숫자가 아닌 것은 없는 것으로 친다', () => {
    for (const bad of ['60%; background:url(x)', {}, null, NaN, Infinity]) {
      expect(widthOf(image(bad)), String(bad)).toBeUndefined();
    }
  });

  it('숫자로 읽히는 문자열은 받는다 — 속성은 문자열로 오기도 한다', () => {
    expect(widthOf(image('60'))).toBe(60);
  });
});

describe('사진 정렬', () => {
  const aligned = (align: unknown) => ({
    type: 'image',
    attrs: { src: 'https://x.co/a.jpg', align },
  });
  const alignOf = (raw: unknown) => {
    const node = toDoc([raw]).content[0];
    return node?.type === 'image' ? node.align : 'not-image';
  };

  it('정렬만 한다 — 띄우지 않는다', () => {
    // 한때 띄우기(float)로 나란히 서기까지 겸했는데, 그러려면 둘의 너비를 손으로
    // 맞춰야 했다. 나란히는 `imageRow` 가 맡는다(2026-09-09 사용자 요청).
    const { container } = draw([
      aligned('left'),
      aligned('right'),
      aligned(null),
    ]);
    const [left, right, center] = [...container.querySelectorAll('img')];
    expect(left.className).toContain('mr-auto');
    expect(right.className).toContain('ml-auto');
    expect(center.className).toContain('mx-auto');
    for (const img of [left, right, center]) {
      expect(img.className).not.toContain('float-');
      expect(img.className).not.toContain('clear-');
    }
  });

  it('모르는 정렬은 가운데로 떨어진다', () => {
    for (const bad of ['middle', 'JUSTIFY', 1, {}, null]) {
      expect(alignOf(aligned(bad)), String(bad)).toBeUndefined();
    }
    expect(alignOf(aligned('left'))).toBe('left');
    expect(alignOf(aligned('right'))).toBe('right');
  });
});

describe('나란히 선 사진들', () => {
  // 사용자 요청(2026-09-09) — "이미지를 2컬럼으로 배치하고 싶어."
  const row = (...srcs: string[]) => ({
    type: 'imageRow',
    attrs: { images: srcs.map((src) => ({ src, alt: '' })) },
  });

  it('폭을 똑같이 나눠 한 줄에 선다', () => {
    const { container } = draw([
      row('https://x.co/a.jpg', 'https://x.co/b.jpg'),
    ]);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img.className).toContain('flex-1');
      // 가로로 긴 사진 하나가 제 원본 폭을 우겨 넣지 못하게 한다.
      expect(img.className).toContain('min-w-0');
    }
  });

  it('칸마다 정해 둔 너비를 지킨다 — 옆으로 끌어 붙여도 풀리지 않는다 (2026-09-10)', () => {
    const { container } = draw([
      {
        type: 'imageRow',
        attrs: {
          images: [
            { src: 'https://x.co/a.jpg', alt: '', width: 30 },
            { src: 'https://x.co/b.jpg', alt: '' },
          ],
        },
      },
    ]);
    const [sized, free] = [...container.querySelectorAll('img')];
    expect(sized.style.flex).toBe('0 1 30%');
    expect(sized.className).not.toContain('flex-1');
    // 너비가 없는 칸만 남은 폭을 나눠 가진다.
    expect(free.className).toContain('flex-1');
    // 너비를 준 칸들이 폭을 다 못 채우면 가운데에 모인다.
    expect(sized.parentElement?.className).toContain('justify-center');
  });

  it('줄 칸의 너비도 가둔다', () => {
    const node = toDoc([
      {
        type: 'imageRow',
        attrs: {
          images: [
            { src: 'https://x.co/a.jpg', width: 5 },
            { src: 'https://x.co/b.jpg', width: '60%; background:red' },
            { src: 'https://x.co/c.jpg', width: 100 },
          ],
        },
      },
    ]).content[0];
    expect(
      node?.type === 'imageRow' && node.images.map((i) => i.width),
    ).toEqual([20, undefined, undefined]);
  });

  it('한 장으로 떨어질 때도 너비를 들고 간다', () => {
    const node = toDoc([
      {
        type: 'imageRow',
        attrs: { images: [{ src: 'https://x.co/a.jpg', alt: '', width: 40 }] },
      },
    ]).content[0];
    expect(node).toEqual({
      type: 'image',
      src: 'https://x.co/a.jpg',
      alt: '',
      width: 40,
    });
  });

  it('줄 전체를 왼쪽·가운데·오른쪽에 세운다 (2026-09-10)', () => {
    const justifyOf = (align: unknown) => {
      const { container } = draw([
        {
          type: 'imageRow',
          attrs: {
            align,
            images: [
              { src: 'https://x.co/a.jpg', alt: '', width: 30 },
              { src: 'https://x.co/b.jpg', alt: '', width: 30 },
            ],
          },
        },
      ]);
      return container.querySelector('img')!.parentElement!.className;
    };
    expect(justifyOf('left')).toContain('justify-start');
    expect(justifyOf('right')).toContain('justify-end');
    expect(justifyOf(null)).toContain('justify-center');
    // 모르는 값은 가운데다.
    expect(justifyOf('middle')).toContain('justify-center');
  });

  it('한 장으로 떨어질 때 줄의 정렬을 들고 간다', () => {
    const node = toDoc([
      {
        type: 'imageRow',
        attrs: {
          align: 'right',
          images: [{ src: 'https://x.co/a.jpg', alt: '', width: 40 }],
        },
      },
    ]).content[0];
    expect(node).toEqual({
      type: 'image',
      src: 'https://x.co/a.jpg',
      alt: '',
      width: 40,
      align: 'right',
    });
  });

  it('한 장뿐이면 줄로 두지 않는다 — 평범한 사진이 된다', () => {
    expect(toDoc([row('https://x.co/a.jpg')]).content[0]).toEqual({
      type: 'image',
      src: 'https://x.co/a.jpg',
      alt: '',
    });
  });

  it('넉 장을 넘기면 자른다 — 글 폭에서 알아볼 수 없어진다', () => {
    const node = toDoc([
      row(
        'https://x.co/1.jpg',
        'https://x.co/2.jpg',
        'https://x.co/3.jpg',
        'https://x.co/4.jpg',
        'https://x.co/5.jpg',
      ),
    ]).content[0];
    expect(node?.type === 'imageRow' && node.images).toHaveLength(4);
  });

  it('못 쓰는 주소는 칸째 버린다', () => {
    const node = toDoc([
      row('javascript:alert(1)', 'https://x.co/b.jpg', 'https://x.co/c.jpg'),
    ]).content[0];
    expect(node?.type === 'imageRow' && node.images.map((i) => i.src)).toEqual([
      'https://x.co/b.jpg',
      'https://x.co/c.jpg',
    ]);
  });

  it('사진이 하나도 없으면 마디째 사라진다', () => {
    expect(toDoc([row()]).content).toEqual([]);
    expect(toDoc([{ type: 'imageRow' }]).content).toEqual([]);
  });
});

describe('발췌', () => {
  it('문단만 모은다 — 제목이 검색 결과의 설명에 뜨면 안 된다', () => {
    const doc = toDoc([
      { type: 'heading', attrs: { level: 1 }, content: [t('제목')] },
      para(t('첫 문단이다.')),
      {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [t('인용')] }],
      },
    ]);
    expect(docText(doc)).toBe('첫 문단이다.');
  });

  it('길면 자르고 말줄임을 붙인다', () => {
    const doc = toDoc([para(t('가'.repeat(300)))]);
    expect(docText(doc, 20)).toHaveLength(20);
    expect(docText(doc, 20).endsWith('…')).toBe(true);
  });

  it('빈 글을 가려낸다', () => {
    expect(isEmptyDoc(toDoc([para()]))).toBe(true);
    expect(isEmptyDoc(toDoc([para(t('글'))]))).toBe(false);
  });
});

describe('toWidth', () => {
  it('"값 없음"을 20% 로 바꾸지 않는다', () => {
    // `Number(null)`·`Number('')` 은 0 이라 최솟값 20 으로 둔갑하던 결함이 있었다.
    // 줄 칸의 너비를 직접 읽게 되면서 드러날 자리라 함께 막았다(2026-09-10).
    for (const empty of [null, undefined, '', '   ', false, []]) {
      expect(toWidth(empty), JSON.stringify(empty)).toBeUndefined();
    }
  });

  it('숫자와 숫자로 읽히는 글자는 받는다', () => {
    expect(toWidth(45)).toBe(45);
    expect(toWidth('45')).toBe(45);
    expect(toWidth(0)).toBe(20);
    expect(toWidth(100)).toBeUndefined();
  });
});

describe('docImageUrls', () => {
  // 저장할 때 글에서 빠진 사진 파일을 치우려고 쓴다(2026-09-10).
  it('낱장과 줄의 칸 주소를 모두 모은다', () => {
    const doc = toDoc([
      { type: 'image', attrs: { src: 'https://x.co/a.jpg' } },
      para(t('글')),
      {
        type: 'imageRow',
        attrs: {
          images: [
            { src: 'https://x.co/b.jpg', alt: '' },
            { src: 'https://x.co/c.jpg', alt: '' },
          ],
        },
      },
    ]);
    expect(docImageUrls(doc)).toEqual([
      'https://x.co/a.jpg',
      'https://x.co/b.jpg',
      'https://x.co/c.jpg',
    ]);
  });

  it('사진이 없으면 빈 목록이다', () => {
    expect(docImageUrls(toDoc([para(t('글'))]))).toEqual([]);
  });
});

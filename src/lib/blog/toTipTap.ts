/**
 * 문서 → TipTap JSON (IDE-028)
 *
 * 편집기에 글을 열어 줄 때 쓴다. **모양이 서로 다르다** — TipTap 은 값을
 * `attrs` 안에 넣고 목록을 `listItem > paragraph` 로 감싸는데, 우리 문서는
 * 칸을 밖에 두고 목록을 글자 배열로 편다.
 *
 * 이걸 안 하고 우리 문서를 그대로 넘겨서 **저장한 사진이 편집기에서 통째로
 * 사라졌다**(2026-09-09 사용자 신고). 값은 DB 에 멀쩡히 있는데 편집기만 못 읽는,
 * 눈으로는 "안 올라갔나 보다"로 보이는 사고였다. 제목의 단수와 링크·목록·코드도
 * 같이 잃고 있었다.
 *
 * `toDoc` 이 두 모양을 다 읽는 것과 짝이다. **`toDoc(docToTipTap(d))` 는 `d` 와
 * 같아야 한다** — 시험이 그것을 지킨다.
 */
import type { Doc, Inline, Node } from './doc';

type Json = Record<string, unknown>;

const marks = (inline: Extract<Inline, { type: 'text' }>): Json[] =>
  (inline.marks ?? []).map((mark) =>
    mark.type === 'link'
      ? { type: 'link', attrs: { href: mark.href } }
      : { type: mark.type },
  );

function inline(node: Inline): Json {
  if (node.type === 'hardBreak') return { type: 'hardBreak' };
  const list = marks(node);
  return list.length > 0
    ? { type: 'text', text: node.text, marks: list }
    : { type: 'text', text: node.text };
}

/** 빈 문단은 `content` 를 아예 안 적는다 — 빈 배열을 싫어하는 마디가 있다. */
const paragraph = (content: Inline[]): Json =>
  content.length === 0
    ? { type: 'paragraph' }
    : { type: 'paragraph', content: content.map(inline) };

const listItem = (content: Inline[]): Json => ({
  type: 'listItem',
  content: [paragraph(content)],
});

function node(block: Node): Json {
  switch (block.type) {
    case 'paragraph':
      return paragraph(block.content);
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: block.level },
        content: block.content.map(inline),
      };
    case 'bulletList':
    case 'orderedList':
      return { type: block.type, content: block.items.map(listItem) };
    case 'blockquote':
      return { type: 'blockquote', content: [paragraph(block.content)] };
    case 'codeBlock':
      return {
        type: 'codeBlock',
        content: block.text ? [{ type: 'text', text: block.text }] : [],
      };
    case 'image':
      return {
        type: 'image',
        attrs: {
          src: block.src,
          alt: block.alt,
          width: block.width ?? null,
          align: block.align ?? null,
        },
      };
    case 'imageRow':
      return {
        type: 'imageRow',
        attrs: { images: block.images, align: block.align ?? null },
      };
    case 'rule':
      return { type: 'horizontalRule' };
  }
}

export const docToTipTap = (doc: Doc): Json => ({
  type: 'doc',
  // 글이 비어 있어도 문단 하나는 있어야 커서를 놓을 자리가 생긴다.
  content:
    doc.content.length === 0 ? [{ type: 'paragraph' }] : doc.content.map(node),
});

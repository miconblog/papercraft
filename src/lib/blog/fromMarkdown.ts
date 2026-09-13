/**
 * 마크다운으로 쓴 글을 문서로 옮긴다 (IDE-028)
 *
 * `IDE-023` 때 쓴 글이 편집기에서 그대로 열려야 한다. 다시 쓰게 하는 것은
 * 답이 아니고, 두 형식을 나란히 그리는 것도 답이 아니다 — 그리는 길이 둘이면
 * 한쪽만 고쳐 놓고 왜 다르게 보이는지 찾게 된다.
 *
 * 그래서 **읽을 때 한 번 옮긴다.** 그 글을 편집기에서 저장하는 순간 문서 칸에
 * 담기고, 그 뒤로는 이 파일을 지나지 않는다.
 *
 * 옮기는 일에 `IDE-023` 의 파서를 그대로 쓴다. 그 이슈가 만든 것이 여기서
 * **수입기**가 됐다 — 버리지 않아도 되는 자리다.
 */
import type { Doc, Inline, Mark, Node } from './doc';
import { parseMarkdown, safeUrl } from './markdown';

/** `IDE-023` 의 인라인 문법. 굵게가 기울임보다 먼저다. */
const INLINE =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;

const text = (value: string, marks?: Mark[]): Inline =>
  marks && marks.length > 0
    ? { type: 'text', text: value, marks }
    : { type: 'text', text: value };

/**
 * 줄바꿈을 `hardBreak` 으로 편다.
 *
 * `IDE-023` 이 "엔터 한 번 = 줄바꿈 한 번"으로 정했으니 옮길 때도 그렇게 읽는다
 * — 안 그러면 옮기고 나서 글의 모양이 바뀐다.
 */
function withBreaks(value: string, marks?: Mark[]): Inline[] {
  const lines = value.split('\n');
  return lines.flatMap((line, i) =>
    i === 0
      ? line
        ? [text(line, marks)]
        : []
      : [{ type: 'hardBreak' as const }, ...(line ? [text(line, marks)] : [])],
  );
}

/** 마크다운 한 줄 → 글자들. 사진은 문단 밖으로 빠지므로 여기서는 뺀다. */
function toInlines(source: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;

  for (const m of source.matchAll(INLINE)) {
    if (m.index > last) out.push(...withBreaks(source.slice(last, m.index)));
    last = m.index + m[0].length;

    const [, , imgSrc, linkText, linkHref, code, strong, em1, em2] = m;

    if (imgSrc !== undefined) continue; // 사진은 `toNodes` 가 따로 집는다
    if (linkHref !== undefined) {
      const href = safeUrl(linkHref);
      out.push(
        ...withBreaks(linkText, href === null ? [] : [{ type: 'link', href }]),
      );
    } else if (code !== undefined) {
      out.push(text(code, [{ type: 'code' }]));
    } else if (strong !== undefined) {
      out.push(...withBreaks(strong, [{ type: 'bold' }]));
    } else {
      const em = em1 ?? em2;
      if (em !== undefined) out.push(...withBreaks(em, [{ type: 'italic' }]));
    }
  }

  if (last < source.length) out.push(...withBreaks(source.slice(last)));
  return out;
}

/** 문단 안에 홀로 선 사진을 집어낸다 — 문서에서는 사진이 마디다. */
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

function paragraphNodes(source: string): Node[] {
  const nodes: Node[] = [];
  let rest = '';

  for (const line of source.split('\n')) {
    const images = [...line.matchAll(IMAGE)];
    const withoutImages = line.replace(IMAGE, '').trim();

    if (images.length > 0 && withoutImages === '') {
      // 사진만 있는 줄. 모아 두던 글을 먼저 내보내고 사진을 마디로 세운다.
      if (rest.trim())
        nodes.push({ type: 'paragraph', content: toInlines(rest) });
      rest = '';
      for (const img of images) {
        const src = safeUrl(img[2]);
        if (src !== null) nodes.push({ type: 'image', src, alt: img[1] ?? '' });
      }
    } else {
      rest = rest ? `${rest}\n${line}` : line;
    }
  }

  if (rest.trim()) nodes.push({ type: 'paragraph', content: toInlines(rest) });
  return nodes;
}

export function markdownToDoc(markdown: string): Doc {
  const content: Node[] = [];

  for (const block of parseMarkdown(markdown)) {
    switch (block.kind) {
      case 'heading':
        content.push({
          type: 'heading',
          // 마크다운 `#` 하나가 문서의 1단이다. 그리는 쪽이 `h2` 로 내린다.
          level: block.level <= 1 ? 1 : block.level === 2 ? 2 : 3,
          content: toInlines(block.text),
        });
        break;
      case 'paragraph':
        content.push(...paragraphNodes(block.text));
        break;
      case 'list':
        content.push({
          type: block.ordered ? 'orderedList' : 'bulletList',
          items: block.items.map(toInlines),
        });
        break;
      case 'quote':
        content.push({ type: 'blockquote', content: toInlines(block.text) });
        break;
      case 'code':
        content.push({ type: 'codeBlock', text: block.text });
        break;
      case 'rule':
        content.push({ type: 'rule' });
        break;
    }
  }

  return { type: 'doc', content };
}

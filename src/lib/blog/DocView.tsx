import type { ReactNode } from 'react';
import type { Doc, Inline, Node } from './doc';

/**
 * 문서를 그린다 (IDE-028)
 *
 * `IDE-023` 의 마크다운 렌더러가 있던 자리다. 그 이슈가 세운 규칙을 그대로
 * 잇는다 — **HTML 문자열을 한 번도 만들지 않는다.** `dangerouslySetInnerHTML`
 * 이 이 파일에 없어서, 검사(`doc.ts`)를 어떻게든 지나온 값이 있더라도
 * 마크업이 되지 않고 글자로 나온다.
 *
 * 주소는 이미 `doc.ts` 가 씻어 놓았다. 여기서는 받은 대로 그린다.
 */

function renderInline(content: Inline[], key: string): ReactNode[] {
  return content.map((node, i) => {
    const k = `${key}-${i}`;
    if (node.type === 'hardBreak') return <br key={k} />;

    // 서식이 없으면 글자를 그대로 둔다. 배열 안의 문자열은 키가 필요 없어서,
    // 이것만으로 `<span>` 이 글자마다 하나씩 생기는 것을 막는다.
    if (!node.marks || node.marks.length === 0) return node.text;

    let out: ReactNode = node.text;
    // 안에서 바깥으로 감싼다. 코드가 가장 안쪽이라 그 안의 별표가 서식이 되지
    // 않는 것이 눈에 보인다.
    for (const mark of node.marks ?? []) {
      if (mark.type === 'code') {
        out = (
          <code
            key={k}
            className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]"
          >
            {out}
          </code>
        );
      } else if (mark.type === 'bold') {
        out = (
          <strong key={k} className="font-semibold">
            {out}
          </strong>
        );
      } else if (mark.type === 'italic') {
        out = <em key={k}>{out}</em>;
      } else {
        out = (
          <a
            key={k}
            href={mark.href}
            className="font-medium underline underline-offset-4 outline-none hover:text-retro-brick focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            {...(mark.href.startsWith('http')
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {out}
          </a>
        );
      }
    }
    return out;
  });
}

const HEADING_CLASS = [
  'mt-10 text-2xl font-bold tracking-tight',
  'mt-8 text-xl font-bold tracking-tight',
  'mt-6 text-lg font-semibold',
] as const;

/**
 * 사진 정렬 (IDE-028)
 *
 * **정렬만 한다.** 한때 띄우기(float)로 만들어 "같은 쪽 사진끼리 한 줄에 선다"
 * 까지 겸하게 했는데, 나란히 놓으려면 둘의 너비를 손으로 맞춰야 해서 결국 손이
 * 갔다. 나란히는 `imageRow` 가 맡고, 여기는 자리만 정한다 — 규칙이 하나씩
 * 맡으니 띄운 것을 흘려보내는 잔손질도 사라졌다.
 */
const ALIGN_CLASS = {
  left: 'mr-auto',
  right: 'ml-auto',
  center: 'mx-auto',
} as const;

/**
 * 사진 줄의 정렬 — 칸들을 어디로 모으나 (2026-09-10 사용자 요청).
 *
 * 편집기(`components/blog/ImageRow.tsx`)와 같은 값이다. 칸들이 폭을 다 채우고
 * 있으면 차이가 보이지 않는다.
 */
const ROW_JUSTIFY = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;

const LIST_CLASS = {
  bulletList: 'mt-4 list-disc space-y-1.5 pl-6 leading-8',
  orderedList: 'mt-4 list-decimal space-y-1.5 pl-6 leading-8',
} as const;

function renderNode(node: Node, key: string): ReactNode {
  switch (node.type) {
    case 'paragraph':
      // 빈 문단도 자리를 차지한다 — 글쓴이가 일부러 띄운 곳이다.
      return (
        <p key={key} className="mt-4 leading-8">
          {node.content.length === 0 ? ' ' : renderInline(node.content, key)}
        </p>
      );
    case 'heading': {
      // `h1` 은 글 제목 몫이라 한 단씩 내린다.
      const Tag = (['h2', 'h3', 'h4'] as const)[node.level - 1];
      return (
        <Tag key={key} className={HEADING_CLASS[node.level - 1]}>
          {renderInline(node.content, key)}
        </Tag>
      );
    }
    case 'bulletList':
    case 'orderedList': {
      const Tag = node.type === 'orderedList' ? 'ol' : 'ul';
      return (
        <Tag key={key} className={LIST_CLASS[node.type]}>
          {node.items.map((item, i) => (
            <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </Tag>
      );
    }
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="mt-6 border-l-4 border-retro-teal/50 pl-4 text-muted-foreground italic"
        >
          {renderInline(node.content, key)}
        </blockquote>
      );
    case 'codeBlock':
      return (
        <pre
          key={key}
          className="mt-6 overflow-x-auto rounded-lg border border-border bg-secondary/60 p-4 font-mono text-sm"
        >
          <code>{node.text}</code>
        </pre>
      );
    case 'image':
      return (
        // 너비 값은 `doc.ts` 가 20~100 사이 정수로 가둬 둔 것이라 CSS 에 그대로
        // 써도 된다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={node.src}
          alt={node.alt}
          loading="lazy"
          style={node.width ? { width: `${node.width}%` } : undefined}
          className={`my-6 block h-auto w-full rounded-lg border border-border-strong ${
            ALIGN_CLASS[node.align ?? 'center']
          }`}
        />
      );
    case 'imageRow':
      return (
        // **칸마다 정해 둔 너비를 지킨다**(2026-09-10 사용자 신고 — 옆으로
        // 끌어 붙이자 너비가 풀렸다). 너비가 없는 칸만 남은 폭을 똑같이 나눈다.
        //
        // - 너비는 `flex-basis` 로 준다. 합이 폭을 넘으면 비율대로 줄어든다.
        // - 너비를 준 칸들이 폭을 다 못 채우면 **줄의 정렬 쪽으로 모인다**(기본은
        //   가운데 — 낱장 사진과 같다).
        // - `min-w-0` 이 없으면 가로로 긴 사진 하나가 제 원본 폭을 우겨 넣는다.
        <div
          key={key}
          className={`my-6 flex items-start gap-3 ${ROW_JUSTIFY[node.align ?? 'center']}`}
        >
          {node.images.map((image, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={image.src}
              alt={image.alt}
              loading="lazy"
              style={image.width ? { flex: `0 1 ${image.width}%` } : undefined}
              className={`h-auto min-w-0 rounded-lg border border-border-strong ${
                image.width ? '' : 'w-full flex-1'
              }`}
            />
          ))}
        </div>
      );
    case 'rule':
      return <hr key={key} className="mt-8 border-border" />;
  }
}

export const renderDoc = (doc: Doc): ReactNode[] =>
  doc.content.map((node, i) => renderNode(node, `n${i}`));

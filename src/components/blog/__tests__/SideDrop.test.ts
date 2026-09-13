/**
 * 사진을 사진 옆에 끌어 놓으면 한 줄로 합친다 — 문서 변경 (IDE-028)
 *
 * 사용자가 그린 그대로를 시험한다. 위아래로 쌓인 사진 셋을
 *
 *   ㅁ
 *   ㅁ   →   ㅁㅁㅁ
 *   ㅁ
 *
 * 끌기 이벤트는 브라우저에서만 되므로, 이벤트가 결국 부르는
 * `sideDropTransaction` 을 편집기와 **같은 스키마** 위에서 직접 돌린다.
 */
import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { StarterKit } from '@tiptap/starter-kit';
import { ImageRow } from '../ImageRow';
import { ResizableImage } from '../ResizableImage';
import { sideDropTransaction } from '../SideDrop';

const schema = getSchema([
  StarterKit.configure({ link: false }),
  ResizableImage,
  ImageRow,
]);

type Block = string | string[];

/** `'a'` 는 낱장, `['a','b']` 는 줄. 모두 크기 1 짜리 통마디라 차례가 곧 위치다. */
const stateOf = (...blocks: Block[]) =>
  EditorState.create({
    schema,
    doc: schema.nodeFromJSON({
      type: 'doc',
      content: blocks.map((b) =>
        typeof b === 'string'
          ? { type: 'image', attrs: { src: b } }
          : {
              type: 'imageRow',
              attrs: { images: b.map((src) => ({ src, alt: '' })) },
            },
      ),
    }),
  });

/** 문서를 다시 `Block[]` 모양으로 읽는다. */
const shape = (state: EditorState): Block[] => {
  const out: Block[] = [];
  state.doc.forEach((node) => {
    out.push(
      node.type.name === 'imageRow'
        ? (node.attrs.images as { src: string }[]).map((i) => i.src)
        : String(node.attrs.src),
    );
  });
  return out;
};

const drop = (
  state: EditorState,
  from: number,
  onto: number,
  index: number,
) => {
  const tr = sideDropTransaction(state, from, onto, index);
  return tr ? state.apply(tr) : null;
};

describe('세로로 쌓인 사진을 한 줄로', () => {
  it('둘째를 첫째 오른쪽에, 셋째를 그 줄 끝에 놓으면 ㅁㅁㅁ 이 된다', () => {
    const start = stateOf('a', 'b', 'c');

    const two = drop(start, 1, 0, 1)!;
    expect(shape(two)).toEqual([['a', 'b'], 'c']);

    const three = drop(two, 1, 0, 2)!;
    expect(shape(three)).toEqual([['a', 'b', 'c']]);
  });

  it('위에 있던 사진을 아래 사진의 왼쪽에 놓아도 맞는다', () => {
    const next = drop(stateOf('a', 'b', 'c'), 0, 2, 0)!;
    expect(shape(next)).toEqual(['b', ['a', 'c']]);
  });

  it('줄의 가운데 틈에 끼운다', () => {
    const next = drop(stateOf(['a', 'b'], 'x'), 1, 0, 1)!;
    expect(shape(next)).toEqual([['a', 'x', 'b']]);
  });

  it('줄을 끌어 사진 옆에 놓으면 한 줄로 모두 합친다', () => {
    const next = drop(stateOf('a', ['x', 'y']), 1, 0, 1)!;
    expect(shape(next)).toEqual([['a', 'x', 'y']]);
  });

  it('합친 뒤에는 새 줄이 골라져 있다 — 「풀기」 단추가 바로 보인다', () => {
    const next = drop(stateOf('a', 'b'), 1, 0, 1)!;
    expect(next.selection.from).toBe(0);
    expect(next.doc.nodeAt(next.selection.from)?.type.name).toBe('imageRow');
  });
});

describe('합치지 않는 경우 — 평소 끌어 놓기로 넘긴다', () => {
  it('자기 자신 위에 놓으면 아무것도 안 한다', () => {
    expect(sideDropTransaction(stateOf('a', 'b'), 0, 0, 1)).toBeNull();
  });

  it('넉 장을 넘기게 되면 합치지 않는다', () => {
    expect(
      sideDropTransaction(stateOf(['a', 'b', 'c', 'd'], 'x'), 1, 0, 4),
    ).toBeNull();
  });

  it('사진이 아닌 마디 위에 놓으면 합치지 않는다', () => {
    const state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '글' }] },
          { type: 'image', attrs: { src: 'a' } },
        ],
      }),
    });
    const imageAt = state.doc.child(0).nodeSize;
    expect(sideDropTransaction(state, imageAt, 0, 1)).toBeNull();
  });
});

describe('정해 둔 너비를 들고 간다 (2026-09-10 사용자 신고)', () => {
  // "옆으로 잘 붙는데, 내가 지정한 너비가 풀려." 합칠 때 주소와 대체 글만
  // 옮기고 너비를 버렸기 때문이다.
  const sized = (...cells: [string, number | null][]) =>
    EditorState.create({
      schema,
      doc: schema.nodeFromJSON({
        type: 'doc',
        content: cells.map(([src, width]) => ({
          type: 'image',
          attrs: { src, width },
        })),
      }),
    });

  const widths = (state: EditorState) => {
    const row = state.doc.child(0);
    return (row.attrs.images as { src: string; width?: number }[]).map((i) => [
      i.src,
      i.width ?? null,
    ]);
  };

  it('낱장 둘을 합치면 칸마다 원래 너비가 남는다', () => {
    const next = drop(sized(['a', 30], ['b', 45]), 1, 0, 1)!;
    expect(widths(next)).toEqual([
      ['a', 30],
      ['b', 45],
    ]);
  });

  it('너비를 안 정한 사진은 너비 없이 들어간다 — 20% 로 둔갑하지 않는다', () => {
    const next = drop(sized(['a', null], ['b', 40]), 1, 0, 0)!;
    expect(widths(next)).toEqual([
      ['b', 40],
      ['a', null],
    ]);
  });

  it('줄에 끼워도 기존 칸들의 너비가 그대로다', () => {
    const two = drop(sized(['a', 30], ['b', 30], ['c', 25]), 1, 0, 1)!;
    const three = drop(two, 1, 0, 2)!;
    expect(widths(three)).toEqual([
      ['a', 30],
      ['b', 30],
      ['c', 25],
    ]);
  });
});

describe('옆에 끌어 붙일 때 정렬을 이어받는다 (2026-09-10)', () => {
  it('정렬해 둔 줄에 끼워도 줄의 정렬이 그대로다', () => {
    const state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON({
        type: 'doc',
        content: [
          {
            type: 'imageRow',
            attrs: {
              align: 'right',
              images: [
                { src: 'a', alt: '' },
                { src: 'b', alt: '' },
              ],
            },
          },
          { type: 'image', attrs: { src: 'c' } },
        ],
      }),
    });
    const next = drop(state, 1, 0, 2)!;
    expect(next.doc.child(0).attrs.align).toBe('right');
    expect(shape(next)).toEqual([['a', 'b', 'c']]);
  });

  it('왼쪽 정렬한 낱장 옆에 붙이면 왼쪽 정렬 줄이 된다', () => {
    const state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON({
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'a', align: 'left' } },
          { type: 'image', attrs: { src: 'b' } },
        ],
      }),
    });
    const next = drop(state, 1, 0, 1)!;
    expect(next.doc.child(0).attrs.align).toBe('left');
  });
});

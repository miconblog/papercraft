/**
 * 사진을 사진 옆에 끌어 놓으면 한 줄로 합친다 (IDE-028)
 *
 * 사용자 요청(2026-09-10) — 위아래로 쌓인 사진 셋을 끌어서 한 줄로 놓고 싶다.
 * 노션처럼. 편집기의 기본 끌어 놓기는 사진을 다른 마디의 **위나 아래**로만
 * 옮긴다. 그래서 **사진(또는 사진 줄) 위에 놓았을 때만** 가로채 `imageRow` 로
 * 합친다.
 *
 * - 사진의 **가운데 띠**에 놓으면 옆으로 붙는다 — 왼쪽 절반이면 왼쪽, 오른쪽
 *   절반이면 오른쪽. 줄 위라면 가장 가까운 틈에 끼운다.
 * - 사진의 **위·아래 가장자리**에 놓으면 평소처럼 위나 아래로 옮겨진다.
 * - 넉 장을 넘기게 되면 합치지 않고 평소 끌어 놓기로 떨어진다.
 *
 * 끄는 동안 붙을 자리에 **세로 막대**를 보여 준다. 그 자리에서는 기본 드롭
 * 커서(가로줄)를 끈다 — 둘이 함께 뜨면 어디에 들어갈지 헷갈린다.
 *
 * 줄을 다시 낱장으로 되돌리는 것은 줄 위의 「풀기」다(`ImageRow.tsx`).
 */
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { toWidth } from '@/lib/blog/doc';
import {
  gapX,
  joinRow,
  sideDropIndex,
  type Box,
  type RowImage,
} from '@/lib/blog/sideDrop';

const PHOTO = new Set(['image', 'imageRow']);

/**
 * 이 마디가 든 사진들. 낱장이면 한 장, 줄이면 그 목록.
 *
 * **정해 둔 너비를 함께 읽는다.** 처음에는 주소와 대체 글만 옮겨서, 옆으로 끌어
 * 붙이면 사진이 칸을 똑같이 나눠 가지며 너비가 풀렸다(2026-09-10 사용자 신고).
 */
export function imagesOf(node: PMNode): RowImage[] {
  const cell = (raw: Record<string, unknown>): RowImage[] => {
    const { src, alt } = raw;
    if (typeof src !== 'string' || !src) return [];
    const one: RowImage = { src, alt: typeof alt === 'string' ? alt : '' };
    const width = toWidth(raw.width);
    if (width !== undefined) one.width = width;
    return [one];
  };

  if (node.type.name === 'image') return cell(node.attrs);
  if (node.type.name === 'imageRow' && Array.isArray(node.attrs.images)) {
    return (node.attrs.images as unknown[]).flatMap((one) =>
      typeof one === 'object' && one !== null
        ? cell(one as Record<string, unknown>)
        : [],
    );
  }
  return [];
}

/**
 * `sourceFrom` 의 사진을 `targetFrom` 사진(줄)의 `index` 번째 틈에 끼워 한 줄로
 * 만든다. 할 수 없으면 `null` — 부르는 쪽이 평소 끌어 놓기로 넘긴다.
 *
 * **맨 윗단의 사진끼리만** 합친다. 인용 안에 든 사진 같은 것은 저장할 때 어차피
 * 문서 규격이 받지 않는다(`lib/blog/doc.ts`).
 */
export function sideDropTransaction(
  state: EditorState,
  sourceFrom: number,
  targetFrom: number,
  index: number,
): Transaction | null {
  if (sourceFrom === targetFrom) return null;

  const source = state.doc.nodeAt(sourceFrom);
  const target = state.doc.nodeAt(targetFrom);
  if (!source || !target) return null;
  if (!PHOTO.has(source.type.name) || !PHOTO.has(target.type.name)) return null;
  if (
    state.doc.resolve(sourceFrom).depth !== 0 ||
    state.doc.resolve(targetFrom).depth !== 0
  ) {
    return null;
  }

  const images = joinRow(imagesOf(target), imagesOf(source), index);
  const rowType = state.schema.nodes.imageRow;
  if (!images || !rowType) return null;

  // 먼저 과녁을 줄로 바꾸고, 끌어 온 사진은 **바뀐 문서 위의 자리로 옮겨서**
  // 지운다. 순서를 손으로 따지지 않고 매핑에 맡긴다 — 위에서 끌었든 아래에서
  // 끌었든 같은 코드로 맞는다.
  const tr = state.tr.replaceWith(
    targetFrom,
    targetFrom + target.nodeSize,
    // 과녁의 정렬을 줄이 이어받는다 — 이미 정렬해 둔 줄에 사진을 끼워도,
    // 정렬해 둔 낱장 옆에 붙여도 그 자리에 그대로 선다(2026-09-10).
    rowType.create({ images, align: target.attrs.align ?? null }),
  );
  tr.delete(
    tr.mapping.map(sourceFrom),
    tr.mapping.map(sourceFrom + source.nodeSize),
  );

  // 방금 만든 줄을 골라 둔다 — 「풀기」 단추가 바로 보인다.
  const rowAt = tr.mapping.map(targetFrom, -1);
  if (tr.doc.nodeAt(rowAt)?.type === rowType) {
    tr.setSelection(NodeSelection.create(tr.doc, rowAt));
  }
  return tr;
}

type Plan = {
  sourceFrom: number;
  targetFrom: number;
  index: number;
  box: Box;
  count: number;
};

/** 지금 끌고 있는 사진. 끄는 중이 아니거나 사진이 아니면 `null`. */
function draggedPhoto(view: EditorView): { from: number; node: PMNode } | null {
  const selection = view.state.selection;
  if (!view.dragging || !(selection instanceof NodeSelection)) return null;
  if (!PHOTO.has(selection.node.type.name)) return null;
  return { from: selection.from, node: selection.node };
}

/** 이 끌기를 옆에 붙이기로 받을 수 있나. 받을 수 없으면 `null`. */
function plan(view: EditorView, event: DragEvent): Plan | null {
  const source = draggedPhoto(view);
  if (!source) return null;

  const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!found || found.inside < 0 || found.inside === source.from) return null;

  const target = view.state.doc.nodeAt(found.inside);
  if (!target || !PHOTO.has(target.type.name)) return null;

  const dom = view.nodeDOM(found.inside);
  if (!(dom instanceof HTMLElement)) return null;
  // 너비를 줄인 사진은 바깥 칸이 글 폭 전체라, 실제 사진 상자를 잰다.
  const frame =
    dom.querySelector<HTMLElement>('[data-node-view-wrapper]') ?? dom;
  const rect = frame.getBoundingClientRect();
  const box = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };

  const targetImages = imagesOf(target);
  const count = targetImages.length;
  const index = sideDropIndex(box, event.clientX, event.clientY, count);
  if (index === null) return null;
  if (!joinRow(targetImages, imagesOf(source.node), index)) return null;

  return {
    sourceFrom: source.from,
    targetFrom: found.inside,
    index,
    box,
    count,
  };
}

/**
 * 붙을 자리를 보여 주는 세로 막대.
 *
 * 기본 드롭 커서(`prosemirror-dropcursor`)와 같은 방식으로 편집기의 위치
 * 부모에 얹는다. 화면 좌표를 그 부모 기준으로 옮겨 적는다.
 */
class DropLine {
  private element: HTMLDivElement | null = null;

  constructor(private readonly view: EditorView) {}

  show(x: number, top: number, height: number): void {
    const parent = this.view.dom.offsetParent as HTMLElement | null;
    if (!parent) return;

    if (!this.element) {
      const line = document.createElement('div');
      Object.assign(line.style, {
        position: 'absolute',
        width: '4px',
        borderRadius: '2px',
        pointerEvents: 'none',
        zIndex: '50',
        background: 'var(--color-retro-teal, #277678)',
      });
      this.element = parent.appendChild(line);
    }

    const staticBody =
      parent === document.body &&
      getComputedStyle(parent).position === 'static';
    const rect = parent.getBoundingClientRect();
    const originLeft = staticBody
      ? -window.scrollX
      : rect.left - parent.scrollLeft;
    const originTop = staticBody
      ? -window.scrollY
      : rect.top - parent.scrollTop;

    this.element.style.left = `${x - originLeft - 2}px`;
    this.element.style.top = `${top - originTop}px`;
    this.element.style.height = `${height}px`;
  }

  hide(): void {
    this.element?.remove();
    this.element = null;
  }
}

export const SideDrop = Extension.create({
  name: 'sideDrop',

  /**
   * 옆에 붙일 자리에서는 기본 드롭 커서(가로줄)를 끈다. 가로줄은 "위나 아래로
   * 들어간다"는 뜻이라, 세로 막대와 함께 뜨면 어디에 들어갈지 헷갈린다.
   */
  extendNodeSchema(extension) {
    if (!PHOTO.has(extension.name)) return {};
    return {
      disableDropCursor: (view: EditorView, _pos: unknown, event: DragEvent) =>
        plan(view, event) !== null,
    };
  },

  addProseMirrorPlugins() {
    let line: DropLine | null = null;

    return [
      new Plugin({
        key: new PluginKey('sideDrop'),

        view(view) {
          line = new DropLine(view);
          return {
            destroy() {
              line?.hide();
              line = null;
            },
          };
        },

        props: {
          handleDOMEvents: {
            dragover(view, event) {
              const next = plan(view, event);
              if (next) {
                line?.show(
                  gapX(next.box, next.index, next.count),
                  next.box.top,
                  next.box.height,
                );
              } else {
                line?.hide();
              }
              return false;
            },
            dragleave(view, event) {
              const to = event.relatedTarget;
              if (!(to instanceof Node) || !view.dom.contains(to)) line?.hide();
              return false;
            },
            dragend() {
              line?.hide();
              return false;
            },
          },

          /**
           * 옆에 붙이기로 받을 수 있을 때만 가로챈다. 아니면 `false` 를 돌려
           * 평소 끌어 놓기(위·아래로 옮기기)가 그대로 돈다.
           *
           * 파일을 끌어 온 경우는 편집기(`Editor.tsx`)가 먼저 받는다 — 그쪽이
           * 편집기 속성이라 플러그인보다 앞선다.
           */
          handleDrop(view, event, _slice, moved) {
            line?.hide();
            if (!moved) return false;
            const next = plan(view, event as DragEvent);
            if (!next) return false;
            const tr = sideDropTransaction(
              view.state,
              next.sourceFrom,
              next.targetFrom,
              next.index,
            );
            if (!tr) return false;
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

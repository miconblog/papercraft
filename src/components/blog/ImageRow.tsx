'use client';

/**
 * 나란히 선 사진들 (IDE-028 · 사용자 요청 2026-09-09)
 *
 * "이미지를 2컬럼으로 배치하고 싶어."
 *
 * 정렬(띄우기)로도 나란히 놓을 수는 있었지만 **둘의 너비를 손으로 맞춰야 했다**
 * — 45%씩 끌어 놓고 자리가 되는지 눈으로 확인하는 일이다. 그래서 **명시적인
 * 마디**로 만들었다.
 *
 * ## 칸마다 너비, 줄 전체에 정렬 (2026-09-10 사용자 요청)
 *
 * "2단이든 3단으로 묶었을 때 각 사진의 너비를 각각 다시 조정할 수 있으면 좋겠고,
 * 묶인 줄도 왼쪽·중앙·오른쪽으로 정렬할 수 있으면 좋겠어."
 *
 * - **칸마다 너비 손잡이**가 붙는다. 너비는 낱장 사진과 같은 뜻(글 폭에 대한 %)
 *   이고, 정하지 않은 칸은 남은 폭을 똑같이 나눠 가진다.
 * - **줄 전체의 정렬**은 칸들을 어디로 모으나다. 칸들이 폭을 다 채우고 있으면
 *   차이가 보이지 않는다.
 * - **칸의 정렬은 두지 않는다.** 줄 안에서 칸 하나만 오른쪽이라는 뜻이 없다.
 *
 * 손잡이·정렬 단추는 낱장 사진과 **같은 조각**을 쓴다(`imageControls.tsx`).
 *
 * ## 마디 안에 사진 마디를 넣지 않는다
 *
 * ProseMirror 로는 `imageRow > image+` 처럼 자식을 둘 수도 있었다. 그러면 칸이
 * 제각기 끌 수 있는 마디가 되어 줄 밖으로 새어 나가고, 칸의 정렬 같은 뜻 없는
 * 값도 따라온다. 사진 목록을 값(`attrs.images`)으로 들고 있는 통마디로 둔다.
 */
import { Node as TipTapNode, mergeAttributes } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { Columns2Icon, XIcon } from 'lucide-react';
import { MAX_ROW_IMAGES, toWidth } from '@/lib/blog/doc';
import {
  AlignButtons,
  CoverButton,
  WidthBadge,
  WidthHandle,
  clampWidth,
  storedWidth,
  useWidthDrag,
  viewAlign,
  widthFactor,
} from './imageControls';

/** 줄의 한 칸. `width` 는 칸의 너비(글 폭에 대한 %)다. */
export type RowImage = { src: string; alt: string; width?: number };

const toImages = (value: unknown): RowImage[] =>
  (Array.isArray(value) ? value : [])
    .filter((one): one is RowImage => {
      return (
        typeof one === 'object' &&
        one !== null &&
        typeof (one as RowImage).src === 'string'
      );
    })
    .slice(0, MAX_ROW_IMAGES)
    .map((one) => {
      const cell: RowImage = { src: one.src, alt: one.alt ?? '' };
      const width = toWidth(one.width);
      if (width !== undefined) cell.width = width;
      return cell;
    });

/** 줄 정렬 → 칸들을 어디로 모으나. 공개 화면(`DocView`)과 같은 값이다. */
const JUSTIFY = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;

const CHIP =
  'inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

function RowView({
  node,
  editor,
  getPos,
  deleteNode,
  selected,
  updateAttributes,
}: ReactNodeViewProps) {
  const images = toImages(node.attrs.images);
  const align = viewAlign(node.attrs.align);
  const { preview, grab } = useWidthDrag<number>();

  /**
   * 칸 하나의 너비를 바꾼다. `null` 이면 너비를 지워 남은 폭을 나눠 갖게 한다.
   *
   * **이 마디를 짚는 `updateAttributes` 를 쓴다.** 전에는 칸 빼기가
   * `editor.commands.updateAttributes('imageRow', …)` 였는데, 그것은 **골라 둔
   * 줄**을 고친다 — 글에 줄이 둘 이상이면 엉뚱한 줄이 바뀔 수 있었다.
   */
  const setWidth = (index: number, width: number | null) =>
    updateAttributes({
      images: images.map((image, i) => {
        if (i !== index) return image;
        const cell: RowImage = { src: image.src, alt: image.alt };
        if (width !== null) cell.width = width;
        return cell;
      }),
    });

  /** 낱장으로 되돌아갈 때 들고 나갈 값 — 자기 너비와 줄의 정렬. */
  const asImage = (image: RowImage) => ({
    type: 'image',
    attrs: {
      src: image.src,
      alt: image.alt,
      width: image.width ?? null,
      align: node.attrs.align ?? null,
    },
  });

  /**
   * 줄을 푼다 — 사진 하나하나로 되돌린다.
   *
   * 되돌릴 길이 없으면 사람은 줄을 만들기를 주저한다. 만드는 조작 옆에 늘
   * 푸는 조작을 둔다.
   */
  const split = () => {
    const pos = getPos();
    if (pos === undefined) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: pos, to: pos + node.nodeSize },
        images.map(asImage),
      )
      .run();
  };

  /** 한 칸을 뺀다. 둘이던 것이 하나가 되면 줄일 이유가 없어 사진으로 돌아간다. */
  const removeAt = (index: number) => {
    const rest = images.filter((_, i) => i !== index);
    const pos = getPos();
    if (pos === undefined) return;

    if (rest.length === 0) return deleteNode();
    if (rest.length === 1) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: pos, to: pos + node.nodeSize },
          asImage(rest[0]),
        )
        .run();
      return;
    }
    updateAttributes({ images: rest });
  };

  return (
    <NodeViewWrapper
      data-dc-image=""
      className={`group relative my-4 rounded-md ${
        selected ? 'ring-2 ring-retro-teal' : ''
      }`}
      data-drag-handle
    >
      {/* 공개 화면(`DocView`)과 같은 규칙이다 — 너비를 준 칸은 그 폭, 없는 칸은
          남은 폭을 똑같이, 다 못 채우면 줄의 정렬 쪽으로 모인다. */}
      <div className={`flex items-start gap-3 ${JUSTIFY[align]}`}>
        {images.map((image, i) => {
          const dragging = preview?.key === i;
          const width = dragging ? preview.width : image.width;
          // 너비를 정하지 않은 칸은 지금 차지한 몫에서 한 칸씩 움직인다.
          // 100 에서 시작하면 키 한 번에 칸이 95% 로 튄다.
          const base = image.width ?? Math.round(100 / images.length);

          const handle = (side: 1 | -1) => (
            <WidthHandle
              side={side}
              label={`${i + 1}번째 사진 ${side === 1 ? '오른쪽' : '왼쪽'}에서 너비 조절`}
              reveal="group-hover/cell:opacity-100"
              visible={dragging}
              onPointerDown={(event) =>
                grab(event, i, side, widthFactor(align), (next) =>
                  setWidth(i, next),
                )
              }
              onStep={(delta) =>
                setWidth(i, storedWidth(clampWidth(base + delta)))
              }
            />
          );

          return (
            <div
              key={i}
              className={`group/cell relative min-w-0 ${width ? '' : 'flex-1'}`}
              style={width ? { flex: `0 1 ${width}%` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                className="block h-auto w-full rounded-md border border-border"
              />
              {handle(-1)}
              {handle(1)}

              {/* 대표 사진 단추(2026-09-19). 줄의 왼쪽 위 막대는 **줄 전체**의
                  것이라 어느 칸인지 말할 수 없다 — 칸마다 빼기 단추 곁에 둔다. */}
              <div className="absolute top-1.5 right-9 z-10">
                <CoverButton
                  src={image.src}
                  compact
                  reveal="group-hover/cell:opacity-100"
                />
              </div>

              <button
                type="button"
                aria-label={`${i + 1}번째 사진 빼기`}
                title="이 사진 빼기"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeAt(i)}
                className="absolute top-1.5 right-1.5 z-10 inline-flex size-6 items-center justify-center rounded-full border border-border bg-popover/95 text-muted-foreground opacity-0 transition-opacity outline-none group-hover/cell:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>

              {dragging && (
                <WidthBadge
                  width={preview.width}
                  className="bottom-1.5 left-1/2 -translate-x-1/2"
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        className={`absolute top-1.5 left-1.5 z-20 flex items-center gap-0.5 rounded-md border border-border bg-popover/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${
          selected ? 'opacity-100' : ''
        }`}
      >
        <span className="inline-flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground">
          <Columns2Icon className="size-3.5" aria-hidden />
          {images.length}단
        </span>
        <AlignButtons
          align={align}
          onChange={(value) => updateAttributes({ align: value })}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={split}
          className={CHIP}
        >
          풀기
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const ImageRow = TipTapNode.create({
  name: 'imageRow',
  group: 'block',
  atom: true,
  draggable: true,
  // 사진 목록을 값으로 들고 있는 통마디다 — 위 주석 참고.
  selectable: true,

  addAttributes() {
    return {
      images: {
        default: [] as RowImage[],
        parseHTML: (element) => {
          try {
            return toImages(
              JSON.parse(element.getAttribute('data-images') ?? '[]'),
            );
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          'data-images': JSON.stringify(toImages(attrs.images)),
        }),
      },
      /** 줄 전체를 어디에 세우나. 없으면 가운데. */
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attrs) =>
          attrs.align ? { 'data-align': String(attrs.align) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-image-row]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-image-row': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RowView);
  },
});

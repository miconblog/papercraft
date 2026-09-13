'use client';

/**
 * 크기를 조절하는 사진 (IDE-028)
 *
 * 사용자 요청(2026-09-09) — "사진의 모서리를 잡고 드래그해서 너비를 조절할 수
 * 있으면 좋겠어. 노션 에디터의 이미지처럼."
 *
 * TipTap 의 기본 `Image` 는 마디를 `<img>` 하나로 그린다. 손잡이를 붙이려면
 * 그 자리에 우리 컴포넌트를 세워야 해서(`ReactNodeViewRenderer`) 확장한다.
 *
 * ## 담는 값은 픽셀이 아니라 백분율이다
 *
 * 화면 폭이 제각각이다. 600px 로 박아 두면 폰에서 글 밖으로 삐져나가고, 큰
 * 화면에서는 되레 작아 보인다. **글 폭에 대한 비율**로 담으면 어디서 보든 글과
 * 같은 비례로 줄어든다. 높이는 따로 담지 않는다 — 원본 비율을 지키는 것이
 * 사진을 다루는 기본이고, 노션도 그렇게 한다.
 *
 * 손잡이·정렬 단추·끄는 계산은 줄(`ImageRow`)과 함께 쓴다(`imageControls.tsx`).
 */
import { XIcon } from 'lucide-react';
import { Image as TipTapImage } from '@tiptap/extension-image';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import {
  AlignButtons,
  WidthBadge,
  WidthHandle,
  clampWidth,
  storedWidth,
  useWidthDrag,
  viewAlign,
  widthFactor,
} from './imageControls';

/**
 * 정렬 (IDE-028)
 *
 * **정렬만 한다.** 한때 띄우기(float)로 만들어 나란히 서기까지 겸했는데, 그러려면
 * 둘의 너비를 손으로 맞춰야 했다. 나란히는 `ImageRow` 가 맡는다.
 *
 * 공개 화면(`lib/blog/DocView.tsx`)도 같은 규칙을 쓴다 — 편집기에서 본 자리에
 * 그대로 나가야 미리 본 뜻이 있다.
 */
const ALIGN_CLASS = {
  left: 'mr-auto',
  right: 'ml-auto',
  center: 'mx-auto',
} as const;

function ImageView({
  node,
  updateAttributes,
  selected,
  deleteNode,
}: ReactNodeViewProps) {
  const { preview, grab } = useWidthDrag<'self'>();

  const saved = typeof node.attrs.width === 'number' ? node.attrs.width : 100;
  const width = preview?.width ?? saved;
  const align = viewAlign(node.attrs.align);

  const commit = (next: number | null) => updateAttributes({ width: next });

  const handle = (side: 1 | -1) => (
    <WidthHandle
      side={side}
      reveal="group-hover:opacity-100"
      visible={selected || preview !== null}
      onPointerDown={(event) =>
        grab(event, 'self', side, widthFactor(align), commit)
      }
      onStep={(delta) => commit(storedWidth(clampWidth(saved + delta)))}
    />
  );

  return (
    <NodeViewWrapper
      data-dc-image=""
      className={`group relative my-4 ${ALIGN_CLASS[align]}`}
      style={{ width: `${width}%` }}
      data-drag-handle
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.attrs.src}
        alt={node.attrs.alt ?? ''}
        className={`block h-auto w-full rounded-md border ${
          selected ? 'border-retro-teal' : 'border-border'
        }`}
      />
      {handle(-1)}
      {handle(1)}

      {/* 정렬 단추. 노션처럼 사진 위에 얹는다 — 도구 막대에 두면 사진을 고르고
          눈을 위로 옮겨야 한다. */}
      <div
        className={`absolute top-2 left-2 z-10 flex gap-0.5 rounded-md border border-border bg-popover/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${
          selected ? 'opacity-100' : ''
        }`}
      >
        <AlignButtons
          align={align}
          onChange={(value) => updateAttributes({ align: value })}
        />
      </div>

      {/* 사진 빼기 (2026-09-10 사용자 요청). 줄의 칸에만 있던 것을 낱장에도
          붙였다 — 커서를 사진 곁에 두고 지우개를 누르는 일은 사진이 글 맨 앞이나
          끝에 있으면 잘 안 된다. **파일은 저장할 때** 스토리지에서 치운다
          (`lib/blog/cleanup.ts`). */}
      <button
        type="button"
        aria-label="사진 빼기"
        title="이 사진 빼기"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => deleteNode()}
        className={`absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-full border border-border bg-popover/95 text-muted-foreground opacity-0 shadow-sm transition-opacity outline-none group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
          selected ? 'opacity-100' : ''
        }`}
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>

      {/* 오른쪽 위를 빼기 단추가 쓰므로 너비 표시는 아래 가운데 — 줄의 칸과 같다. */}
      {preview && (
        <WidthBadge
          width={preview.width}
          className="bottom-2 left-1/2 -translate-x-1/2"
        />
      )}
    </NodeViewWrapper>
  );
}

/**
 * 너비·정렬을 담는 칸을 더한 `Image`.
 *
 * `renderHTML` 도 함께 고친다 — 편집기 밖(붙여넣기·복사)에서도 너비가 따라가야
 * 하고, 무엇보다 **저장할 JSON 에 이 칸이 실려야** 한다.
 */
export const ResizableImage = TipTapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align'),
        renderHTML: (attrs) =>
          attrs.align ? { 'data-align': String(attrs.align) } : {},
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-width');
          const n = raw === null ? NaN : Number(raw);
          return Number.isFinite(n) ? clampWidth(n) : null;
        },
        renderHTML: (attrs) =>
          attrs.width
            ? {
                'data-width': String(attrs.width),
                style: `width:${attrs.width}%`,
              }
            : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

'use client';

/**
 * 보이는 대로 쓰는 편집기 (IDE-028)
 *
 * TipTap(ProseMirror)이다. 고른 이유와 다른 후보는 이슈 결정 기록에 적었다 —
 * 요약하면 **HTML 이 아니라 JSON 을 낼 수 있어서**다. 그 JSON 을 서버가 좁히고
 * (`lib/blog/doc.ts`) React 엘리먼트로 그리므로(`DocView`), `IDE-023` 이 세운
 * "HTML 문자열을 한 번도 만들지 않는다"가 그대로 남는다.
 *
 * **폼과는 숨은 칸 하나로 이어진다.** 편집기 상태를 서버 액션에 넘기는 다른
 * 길(`onSubmit` 가로채기 따위)을 쓰지 않는 것은, 편집 화면의 버튼이 넷이고
 * (`저장`·`지금 내기`·`사진 넣기`·`대표 사진으로`) 그 넷이 전부 같은 폼을
 * 통째로 보내기 때문이다. 숨은 칸이면 어느 버튼을 눌러도 지금 글이 함께 간다.
 *
 * `'use client'` 는 여기까지다 — 편집기 코드는 관리자 화면에만 실리고 글을
 * 읽는 사람은 받지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EditorContent,
  useEditor,
  type Editor as TipTapEditor,
} from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { ImageRow } from '@/components/blog/ImageRow';
import { ResizableImage } from '@/components/blog/ResizableImage';
import { CoverContext, type CoverPick } from '@/components/blog/imageControls';
import { SideDrop } from '@/components/blog/SideDrop';
import { Link } from '@tiptap/extension-link';
import {
  BoldIcon,
  CodeIcon,
  ImageIcon,
  LoaderCircleIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Undo2Icon,
  Redo2Icon,
} from 'lucide-react';
import type { Doc } from '@/lib/blog/doc';
import { docToTipTap } from '@/lib/blog/toTipTap';
import { shrinkPhoto } from '@/lib/blog/photo';

const BUTTON =
  'inline-flex size-9 items-center justify-center rounded-md text-sm transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';
const ACTIVE = 'bg-secondary font-semibold text-foreground';

type ToolProps = {
  editor: TipTapEditor;
  /** 켜져 있나 — 눌린 상태를 스크린리더에도 알린다. */
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function Tool({ editor, active, label, onClick, children }: ToolProps) {
  return (
    <button
      type="button"
      // 누를 때 글에서 커서가 빠지지 않게 한다 — 빠지면 서식이 엉뚱한 데 걸린다.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onClick();
        editor.commands.focus();
      }}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={active ? `${BUTTON} ${ACTIVE}` : BUTTON}
    >
      {children}
    </button>
  );
}

/**
 * 도구 막대.
 *
 * **`editor.state` 를 구독해 다시 그린다.** 안 그리면 굵게가 켜졌는지 꺼졌는지가
 * 버튼에 안 보인다.
 */
function Toolbar({
  editor,
  onPickPhoto,
  busy,
}: {
  editor: TipTapEditor;
  onPickPhoto: () => void;
  busy: boolean;
}) {
  const [, bump] = useState(0);
  useEffect(() => {
    const rerender = () => bump((n) => n + 1);
    editor.on('transaction', rerender);
    return () => {
      editor.off('transaction', rerender);
    };
  }, [editor]);

  const heading = (level: 1 | 2 | 3) => (
    <Tool
      key={level}
      editor={editor}
      label={`제목 ${level}`}
      active={editor.isActive('heading', { level })}
      onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
    >
      <span className="font-bold">
        H<span className="text-xs">{level}</span>
      </span>
    </Tool>
  );

  return (
    <div
      role="toolbar"
      aria-label="서식"
      className="flex flex-wrap items-center gap-0.5 border-b border-border-strong bg-secondary/40 p-1"
    >
      <Tool
        editor={editor}
        label="굵게"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="size-4" aria-hidden />
      </Tool>
      <Tool
        editor={editor}
        label="기울임"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="size-4" aria-hidden />
      </Tool>
      <Tool
        editor={editor}
        label="코드"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon className="size-4" aria-hidden />
      </Tool>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      {([1, 2, 3] as const).map(heading)}

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool
        editor={editor}
        label="점 목록"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon className="size-4" aria-hidden />
      </Tool>
      <Tool
        editor={editor}
        label="번호 목록"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon className="size-4" aria-hidden />
      </Tool>
      <Tool
        editor={editor}
        label="인용"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuoteIcon className="size-4" aria-hidden />
      </Tool>
      <Tool
        editor={editor}
        label="가로줄"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <MinusIcon className="size-4" aria-hidden />
      </Tool>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool
        editor={editor}
        label="링크"
        active={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          // 관리자 한 사람이 쓰는 화면이라 `prompt` 로 충분하다. 주소는 어차피
          // 서버가 다시 씻는다(`doc.ts`).
          const href = window.prompt('링크 주소', 'https://');
          if (href) editor.chain().focus().setLink({ href }).run();
        }}
      >
        <LinkIcon className="size-4" aria-hidden />
      </Tool>

      <Tool editor={editor} label="사진 넣기" onClick={onPickPhoto}>
        {busy ? (
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        ) : (
          <ImageIcon className="size-4" aria-hidden />
        )}
      </Tool>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Tool
        editor={editor}
        label="되돌리기"
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2Icon className="size-4" aria-hidden />
      </Tool>
      <Tool
        editor={editor}
        label="다시 하기"
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2Icon className="size-4" aria-hidden />
      </Tool>
    </div>
  );
}

/** 끌어 온 것 가운데 그림만. 하나도 없으면 ProseMirror 에게 도로 넘긴다. */
const imageFiles = (list: FileList | null | undefined): File[] =>
  [...(list ?? [])].filter((f) => f.type.startsWith('image/'));

export function Editor({
  name,
  initial,
  upload,
  coverUrl = null,
  pickCover,
}: {
  name: string;
  initial: Doc;
  /** 사진 한 장을 올리고 주소를 돌려주는 서버 액션. */
  upload: (
    form: FormData,
  ) => Promise<{ ok: true; url: string } | { ok: false; message: string }>;
  /** 지금 대표 사진. 같은 사진의 단추가 눌린 채로 선다. */
  coverUrl?: string | null;
  /**
   * 본문 사진을 대표 사진으로 세우는 서버 액션. 없으면 사진 위에 단추가 없다.
   * 폼 전체와 함께 `coverPick` 으로 고른 주소를 받는다.
   */
  pickCover?: (form: FormData) => Promise<void>;
}) {
  const [json, setJson] = useState(() => JSON.stringify(initial));
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /**
   * 이 화면에서 올린 사진 주소들.
   *
   * 저장할 때 **글에 안 남은 것**을 스토리지에서 치우는 데 쓴다(2026-09-10).
   * 올렸다가 저장 전에 지운 사진은 글 어디에도 흔적이 없어서, 이것 없이는 찾을
   * 길이 없다. 지우는 쪽이 이 목록을 믿지는 않는다 — 우리 버킷의 우리 이름인지,
   * 어느 글도 안 쓰는지를 서버가 다시 본다(`lib/blog/cleanup.ts`).
   */
  const [uploaded, setUploaded] = useState<string[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const coverSubmit = useRef<HTMLButtonElement>(null);
  const coverPick = useRef<HTMLInputElement>(null);

  /**
   * 대표 사진 고르기 (2026-09-19 사용자 요청)
   *
   * 사진 위 단추가 부른다. **폼 전체를 보낸다** — 대표 사진만 바꾸는 액션을 따로
   * 두면 쓰던 본문이 저장되지 않은 채 화면이 새로 그려져 날아간다(`attach` 가
   * 같은 이유로 먼저 저장한다).
   *
   * 고른 주소는 **숨은 칸**(`coverPick`)에 실었다가 보내자마자 비운다 — 다른
   * 버튼으로 저장할 때 따라가지 않게. 제출 단추의 `name`·`value` 에 실으면 안
   * 된다: 서버 액션을 `formAction` 으로 단 단추는 React 가 `name` 을 액션
   * 식별자(`$ACTION_ID_…`)로 덮어써서 **값이 서버에 안 가고**, 서버가 그린
   * HTML 과 이름이 달라 하이드레이션도 어긋난다(2026-09-19 사용자 신고).
   * React 는 제출 이벤트 안에서 폼 값을 **곧바로** 읽으므로
   * `requestSubmit` 뒤에 비워도 이미 실린 뒤다.
   */
  const cover = useMemo<CoverPick | null>(
    () =>
      pickCover
        ? {
            current: coverUrl,
            pick: (src) => {
              const button = coverSubmit.current;
              const field = coverPick.current;
              if (!button?.form || !field) return;
              field.value = src;
              button.form.requestSubmit(button);
              field.value = '';
            },
          }
        : null,
    [coverUrl, pickCover],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 제목은 셋만 쓴다 — `h1` 은 글 제목 몫이라 그리는 쪽이 한 단씩 내린다.
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Link.configure({ openOnClick: false, autolink: false }),
      ResizableImage,
      ImageRow,
      // 사진을 사진 옆에 끌어 놓으면 한 줄로 합친다(2026-09-10 사용자 요청).
      SideDrop,
    ],
    // **모양을 바꿔서 넘긴다.** 우리 문서를 그대로 주면 TipTap 이 `attrs` 안을
    // 보느라 사진·제목 단수·링크·목록을 통째로 놓친다(IDE-028 사고).
    content: docToTipTap(initial),
    // 서버가 그린 HTML 과 브라우저가 그린 것이 다를 수 있다고 TipTap 이 일러 준다.
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => setJson(JSON.stringify(e.getJSON())),
    editorProps: {
      attributes: {
        class:
          'min-h-72 max-w-none px-3 py-3 leading-8 outline-none [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:mt-3 [&_blockquote]:border-l-4 [&_blockquote]:border-retro-teal/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:mt-3 [&_pre]:rounded-md [&_pre]:bg-secondary/60 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_img]:my-4 [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_hr]:my-5 [&_hr]:border-border [&_p]:mt-3',
      },

      /**
       * 끌어다 놓기 (2026-09-09 사용자 요청)
       *
       * "본문에 이미지를 첨부할 수 있으면 가장 직관적일 것 같아." 맞는 말이다 —
       * 폼 버튼으로 넣으면 저장·리다이렉트를 한 바퀴 돌아 **글이 어디까지
       * 반영됐는지 알 수 없고**, 넣은 사진이 글의 어디에 붙었는지도 안 보인다.
       *
       * `false` 를 돌려주면 ProseMirror 가 기본 처리를 이어 간다 — 글자를 끌어
       * 옮기는 조작을 뺏지 않으려고 **사진이 실렸을 때만** 가로챈다.
       */
      handleDrop(_view, event) {
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        // 놓은 자리에 꽂는다 — 커서가 아니라 손이 가리킨 곳이다.
        const at = _view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos;
        void insert(files, at);
        return true;
      },

      /** 붙여넣기도 같은 길이다 — 화면 캡처를 그대로 붙이는 것이 흔하다. */
      handlePaste(_view, event) {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        void insert(files);
        return true;
      },
    },
  });

  /**
   * 사진 여러 장을 차례로 올려 그 자리에 꽂는다.
   *
   * 올리는 동안 글은 그대로 쓸 수 있다. 실패하면 **말로 알린다** — 조용히
   * 아무 일도 안 일어나면 사용자는 다시 끌어다 놓기만 반복한다.
   */
  const insert = useCallback(
    async (files: File[], at?: number) => {
      if (!editor) return;
      setError(null);
      setBusy((n) => n + files.length);

      const urls: string[] = [];
      for (const file of files) {
        try {
          const form = new FormData();
          form.set('image', await shrinkPhoto(file));
          const result = await upload(form);

          if (!result.ok) {
            setError(result.message);
            continue;
          }
          urls.push(result.url);
          const url = result.url;
          setUploaded((list) => [...list, url]);
        } catch {
          setError('사진을 올리지 못했습니다.');
        } finally {
          setBusy((n) => n - 1);
        }
      }

      if (urls.length === 0) return;

      const chain = editor.chain().focus();
      if (at !== undefined) chain.setTextSelection(at);

      // **여러 장을 한 번에 넣으면 한 줄로 선다**(사용자 요청 2026-09-09).
      // 두 장을 끌어다 놓는 것이 곧 "2컬럼으로 놓고 싶다"는 뜻이라, 그 자리에서
      // 바로 그 모양이 되는 편이 낫다. 낱장으로 갈라 놓고 다시 묶게 하면 조작이
      // 두 번이다. 되돌리는 길(줄의 「풀기」)은 그 마디가 들고 있다.
      if (urls.length === 1) {
        chain.setImage({ src: urls[0] }).run();
      } else {
        chain
          .insertContent({
            type: 'imageRow',
            attrs: { images: urls.map((src) => ({ src, alt: '' })) },
          })
          .run();
      }
    },
    [editor, upload],
  );

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-border-strong bg-popover">
      {editor && (
        <Toolbar
          editor={editor}
          busy={busy > 0}
          onPickPhoto={() => picker.current?.click()}
        />
      )}
      <CoverContext.Provider value={cover}>
        <EditorContent editor={editor} />
      </CoverContext.Provider>

      {/* 도구 막대의 사진 버튼이 여는 자리. 폼에 실리면 안 되므로 이름이 없다
          — 사진은 위 `upload` 액션으로 따로 간다. */}
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = imageFiles(e.target.files);
          e.target.value = '';
          if (files.length > 0) void insert(files);
        }}
      />

      <p
        aria-live="polite"
        className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground"
      >
        {error ? (
          <span className="text-retro-brick">{error}</span>
        ) : busy > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            사진 {busy}장을 올리는 중…
          </span>
        ) : (
          '사진은 끌어다 놓거나 붙여 넣으면 그 자리에 들어갑니다. 사진을 다른 사진의 옆으로 끌어 놓으면 한 줄로 합쳐집니다.'
        )}
      </p>

      {/* 폼이 실제로 보내는 값. 버튼 넷이 전부 이걸 함께 가져간다. */}
      <input type="hidden" name={name} value={json} readOnly />
      {pickCover && (
        <>
          <input ref={coverPick} type="hidden" name="coverPick" />
          <button
            ref={coverSubmit}
            type="submit"
            formAction={pickCover}
            hidden
            tabIndex={-1}
          />
        </>
      )}
      <input
        type="hidden"
        name="uploadedImages"
        value={JSON.stringify(uploaded)}
        readOnly
      />
    </div>
  );
}

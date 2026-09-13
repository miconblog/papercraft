/**
 * 글 문서 규격과 검사 (IDE-028)
 *
 * TipTap 이 브라우저에서 만들어 보내는 JSON 이다. **믿지 않는다.**
 *
 * `IDE-023` 때는 파서가 유일한 입구라 모양이 저절로 좁았다 — 마크다운 문자열이
 * 무엇이든 나오는 것은 우리가 아는 블록뿐이었다. 이제는 **브라우저가 트리를
 * 통째로 보낸다.** 관리자만 쓰는 화면이지만 그 세션은 비밀번호 하나로 지켜지고,
 * 서버 액션은 URL 만 알면 밖에서도 부를 수 있다.
 *
 * 그래서 **여기가 문이다.** 아는 마디·아는 서식만 통과하고 나머지는 버린다.
 * 통과한 것을 그리는 `DocView` 는 여전히 HTML 문자열을 만들지 않으므로,
 * 설령 이 검사가 뚫려도 스크립트가 되지는 않는다 — 두 겹이다.
 *
 * `import 'server-only'` 를 붙이지 않는다. 편집기(브라우저)도 같은 규격을 본다.
 */
import { safeUrl } from './markdown';

/** 글자에 붙는 서식. 이 셋뿐이다. */
export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'link'; href: string };

export type Inline =
  | { type: 'text'; text: string; marks?: Mark[] }
  /** 줄바꿈. 문단 안에서 엔터를 누른 자리다. */
  | { type: 'hardBreak' };

export type Node =
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { type: 'bulletList'; items: Inline[][] }
  | { type: 'orderedList'; items: Inline[][] }
  | { type: 'blockquote'; content: Inline[] }
  | { type: 'codeBlock'; text: string }
  | {
      type: 'image';
      src: string;
      alt: string;
      /**
       * 글 폭에 대한 **백분율**(20~100). 없으면 폭을 다 쓴다.
       *
       * 픽셀이 아니라 비율인 이유는 화면 폭이 제각각이기 때문이다 — 폰에서
       * 600px 로 박아 두면 글 밖으로 삐져나간다. 비율이면 어디서 보든 글과
       * 같은 비례로 줄어든다.
       */
      width?: number;
      /**
       * 어디에 서나. 없으면 **가운데**다.
       *
       * **정렬만 한다.** 한때 띄우기(float)로 만들어 "같은 쪽 사진끼리 한 줄에
       * 선다"까지 겸하게 했는데, 나란히 놓으려면 둘의 너비를 손으로 맞춰야 해서
       * 결국 손이 갔다. 나란히는 `imageRow` 가 맡는다(2026-09-09 사용자 요청).
       */
      align?: 'left' | 'right';
    }
  | {
      /**
       * 한 줄에 나란히 서는 사진들 (IDE-028 · 사용자 요청 2026-09-09)
       *
       * "이미지를 2컬럼으로 배치하고 싶어." **폭을 똑같이 나눠 가진다** — 몇
       * 장인지만 정하면 되고 사람이 퍼센트를 맞출 일이 없다.
       *
       * **칸마다 너비를 지킨다**(2026-09-10 사용자 신고). 처음에는 칸을 똑같이만
       * 나눴는데, 사진을 옆으로 끌어 붙이자 **정해 둔 너비가 풀렸다.** **칸의** 정렬은
       * 두지 않는다 — 줄 안에서 칸의 정렬은 뜻이 없다. 줄 전체를 어디에 세울지는
       * `align` 이 정한다.
       */
      type: 'imageRow';
      /**
       * 칸마다 너비(글 폭에 대한 %)를 들 수 있다 — 낱장 사진의 `width` 와 같은 뜻.
       * 없는 칸은 남은 폭을 똑같이 나눠 가진다.
       */
      images: { src: string; alt: string; width?: number }[];
      /**
       * 줄 전체를 어디에 세우나. 없으면 **가운데** — 낱장 사진의 `align` 과 같은
       * 뜻이다(2026-09-10 사용자 요청). 칸들이 폭을 다 채우고 있으면 차이가
       * 보이지 않는다.
       */
      align?: 'left' | 'right';
    }
  | { type: 'rule' };

/** 글 한 편의 본문. */
export type Doc = { type: 'doc'; content: Node[] };

export const EMPTY_DOC: Doc = { type: 'doc', content: [] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * 값 하나를 **두 모양에서** 읽는다 (IDE-028)
 *
 * 들어오는 것이 늘 TipTap 모양(`attrs` 안에 값)인 것은 아니다. **우리가 저장한
 * 것을 다시 읽을 때는 우리 모양**(칸이 밖에 있다)이다 — 글을 읽을 때마다
 * `toDoc` 을 한 번 더 지나고, 사진을 넣을 때도 한 번 더 지난다.
 *
 * 그래서 이 함수가 두 모양을 다 읽는다. 안 그러면 **저장한 글이 읽을 때마다
 * 조금씩 무너진다** — 제목이 문단이 되고 사진과 링크가 사라진다. 처음에 이걸
 * 놓쳐서 사진 넣기 테스트가 잡아냈다.
 *
 * 이 성질에는 이름이 있다. `toDoc(toDoc(x))` 이 `toDoc(x)` 와 같아야 한다 —
 * 시험이 그것을 지킨다.
 */
function attr(raw: Record<string, unknown>, key: string): unknown {
  const attrs = isObject(raw.attrs) ? raw.attrs : {};
  return attrs[key] ?? raw[key];
}

/** 글자 마디인가 — 마디 목록이 인라인인지 블록인지 가른다. */
const isInlineNode = (v: unknown): boolean =>
  isObject(v) && (v.type === 'text' || v.type === 'hardBreak');

// ── 서식 ────────────────────────────────────────────────────────────

/**
 * **링크만 값을 들고 온다.** 그래서 링크만 따로 씻는다 — `IDE-023` 이 쓰던
 * 허용 목록(`http`·`https`·`mailto`·사이트 안 주소)을 그대로 쓴다. React 도
 * `href="javascript:…"` 는 막아 주지 않는다.
 *
 * 못 쓰는 주소면 **서식만 떼고 글자는 남긴다.** 통째로 버리면 글쓴이는 무엇이
 * 사라졌는지 모른다.
 */
function toMark(raw: unknown): Mark | null {
  if (!isObject(raw)) return null;
  switch (raw.type) {
    case 'bold':
    case 'strong':
      return { type: 'bold' };
    case 'italic':
    case 'em':
      return { type: 'italic' };
    case 'code':
      return { type: 'code' };
    case 'link': {
      const href = safeUrl(str(attr(raw, 'href')));
      return href === null ? null : { type: 'link', href };
    }
    default:
      // `textStyle`·`highlight` 처럼 우리가 안 그리는 것은 조용히 뗀다.
      return null;
  }
}

const toMarks = (raw: unknown): Mark[] => {
  const marks = list(raw)
    .map(toMark)
    .filter((m): m is Mark => m !== null);
  return marks;
};

// ── 글자 ────────────────────────────────────────────────────────────

function toInline(raw: unknown): Inline | null {
  if (!isObject(raw)) return null;
  if (raw.type === 'hardBreak') return { type: 'hardBreak' };
  if (raw.type !== 'text') return null;

  const text = str(raw.text);
  if (!text) return null;

  const marks = toMarks(raw.marks);
  return marks.length > 0
    ? { type: 'text', text, marks }
    : { type: 'text', text };
}

const toInlines = (raw: unknown): Inline[] =>
  list(raw)
    .map(toInline)
    .filter((i): i is Inline => i !== null);

/**
 * 목록 한 칸.
 *
 * TipTap 은 `listItem > paragraph > text` 로 한 겹 더 감싸고, 우리가 저장한
 * 것은 글자가 바로 온다. 둘 다 읽는다.
 */
function toListItem(raw: unknown): Inline[] | null {
  if (Array.isArray(raw)) {
    const inlines = toInlines(raw);
    return inlines.length > 0 ? inlines : null;
  }
  if (!isObject(raw)) return null;
  const inlines = list(raw.content).flatMap((child) =>
    isInlineNode(child)
      ? toInlines([child])
      : isObject(child)
        ? toInlines(child.content)
        : [],
  );
  return inlines.length > 0 ? inlines : null;
}

/**
 * 블록 안의 글자.
 *
 * 문단으로 한 겹 감싸 온 것(TipTap)과 글자가 바로 온 것(우리가 저장한 것)을
 * 모두 읽는다. 여러 문단은 줄바꿈으로 잇는다 — 그리는 쪽이 단순해진다.
 */
function toFlatInlines(content: unknown): Inline[] {
  const children = list(content);
  if (children.every(isInlineNode)) return toInlines(children);

  return children.flatMap((child, i) => {
    const inlines = isInlineNode(child)
      ? toInlines([child])
      : isObject(child)
        ? toInlines(child.content)
        : [];
    return i === 0 || inlines.length === 0
      ? inlines
      : [{ type: 'hardBreak' as const }, ...inlines];
  });
}

// ── 마디 ────────────────────────────────────────────────────────────

/** 사진 너비의 아래 끝. 이보다 작으면 무엇을 찍었는지 알아볼 수 없다. */
const MIN_IMAGE_WIDTH = 20;

/** 한 줄에 세울 수 있는 사진 수. 넷을 넘기면 글 폭에서 알아볼 수 없어진다. */
export const MAX_ROW_IMAGES = 4;

/**
 * 사진 너비를 읽는다. 값이 없거나 읽을 수 없으면 **없는 것**(폭을 다 쓴다)이다.
 *
 * 브라우저가 보낸 값이라 **가둔다** — 그리는 쪽이 이 값을 그대로 CSS 에 쓰므로,
 * 여기서 숫자이고 범위 안임을 보장한다.
 */
export function toWidth(value: unknown): number | undefined {
  // `Number(null)`·`Number('')` 은 0 이라, 그대로 두면 **"값 없음"이 20% 로
  // 둔갑한다.** 숫자이거나 숫자로 읽히는 글자일 때만 받는다.
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  if (rounded >= 100) return undefined;
  return Math.max(MIN_IMAGE_WIDTH, rounded);
}

/** 정렬. 아는 두 값만 받고 나머지는 **가운데**(값 없음)로 떨어뜨린다. */
const toAlign = (value: unknown): 'left' | 'right' | undefined =>
  value === 'left' || value === 'right' ? value : undefined;

/**
 * 제목은 **2·3·4 만** 쓴다.
 *
 * `h1` 은 글 제목이 이미 쓴다(`IDE-023` 이 마크다운 렌더러에 둔 규칙과 같다).
 * 편집기에서는 1·2·3 으로 보이고 그리는 쪽에서 한 단씩 내린다.
 */
const toLevel = (v: unknown): 1 | 2 | 3 => (v === 2 ? 2 : v === 3 ? 3 : 1);

function toNode(raw: unknown): Node | null {
  if (!isObject(raw)) return null;

  switch (raw.type) {
    case 'paragraph': {
      const content = toInlines(raw.content);
      // 빈 문단은 버리지 않는다 — 글쓴이가 일부러 띄운 자리다.
      return { type: 'paragraph', content };
    }
    case 'heading': {
      const content = toInlines(raw.content);
      return content.length === 0
        ? null
        : { type: 'heading', level: toLevel(attr(raw, 'level')), content };
    }
    case 'bulletList':
    case 'orderedList': {
      const items = (Array.isArray(raw.items) ? raw.items : list(raw.content))
        .map(toListItem)
        .filter((i): i is Inline[] => i !== null);
      return items.length === 0
        ? null
        : {
            type: raw.type === 'orderedList' ? 'orderedList' : 'bulletList',
            items,
          };
    }
    case 'blockquote': {
      const content = toFlatInlines(raw.content);
      return content.length === 0 ? null : { type: 'blockquote', content };
    }
    case 'codeBlock': {
      const text =
        typeof raw.text === 'string'
          ? raw.text
          : list(raw.content)
              .map((child) => (isObject(child) ? str(child.text) : ''))
              .join('');
      return { type: 'codeBlock', text };
    }
    case 'image': {
      const src = safeUrl(str(attr(raw, 'src')));
      if (src === null) return null;
      // 기본값(100% · 가운데)이면 칸을 아예 안 만든다 — 저장된 문서가 조용히
      // 커지지 않고, 왕복 시험(`toDoc(docToTipTap(d)) === d`)도 단순해진다.
      const image: Node = { type: 'image', src, alt: str(attr(raw, 'alt')) };
      const width = toWidth(attr(raw, 'width'));
      if (width !== undefined) image.width = width;
      const align = toAlign(attr(raw, 'align'));
      if (align !== undefined) image.align = align;
      return image;
    }
    case 'imageRow': {
      // TipTap 은 `attrs.images` 에, 우리 문서는 칸 밖에 둔다 — 둘 다 읽는다.
      const raws = Array.isArray(raw.images)
        ? raw.images
        : list(attr(raw, 'images'));
      const images = raws
        .map((one) => {
          if (!isObject(one)) return null;
          const src = safeUrl(str(attr(one, 'src')));
          if (src === null) return null;
          const cell: { src: string; alt: string; width?: number } = {
            src,
            alt: str(attr(one, 'alt')),
          };
          const width = toWidth(attr(one, 'width'));
          if (width !== undefined) cell.width = width;
          return cell;
        })
        .filter(
          (one): one is { src: string; alt: string; width?: number } =>
            one !== null,
        )
        .slice(0, MAX_ROW_IMAGES);

      // 한 장뿐이면 줄로 둘 이유가 없다 — 평범한 사진으로 떨어뜨린다.
      if (images.length === 0) return null;
      const rowAlign = toAlign(attr(raw, 'align'));
      if (images.length === 1) {
        const [only] = images;
        const image: Node = { type: 'image', src: only.src, alt: only.alt };
        if (only.width !== undefined) image.width = only.width;
        // 줄의 정렬을 들고 간다 — 줄로 서 있던 자리에 그대로 선다.
        if (rowAlign !== undefined) image.align = rowAlign;
        return image;
      }
      const row: Node = { type: 'imageRow', images };
      if (rowAlign !== undefined) row.align = rowAlign;
      return row;
    }
    case 'horizontalRule':
    case 'rule':
      return { type: 'rule' };
    default:
      // 모르는 마디는 **통째로 버린다.** 안에 무엇이 들었든 그리지 않는다.
      return null;
  }
}

/**
 * 무엇이 들어와도 그릴 수 있는 문서로 좁힌다. 던지지 않는다 — 이 함수가
 * 던지면 조작한 JSON 하나로 관리자 화면이 통째로 안 뜬다.
 */
export function toDoc(raw: unknown): Doc {
  const source = isObject(raw) && raw.type === 'doc' ? raw.content : raw;
  return {
    type: 'doc',
    content: list(source)
      .map(toNode)
      .filter((n): n is Node => n !== null),
  };
}

/** 저장하기 전에 문자열에서 읽는다. 못 읽으면 빈 문서다. */
export function parseDoc(json: string): Doc {
  try {
    return toDoc(JSON.parse(json));
  } catch {
    return EMPTY_DOC;
  }
}

// ── 문서에서 글자만 ─────────────────────────────────────────────────

const inlineText = (content: Inline[]): string =>
  content.map((i) => (i.type === 'text' ? i.text : ' ')).join('');

/**
 * 발췌에 쓸 문단 글자.
 *
 * `IDE-023` 의 `excerpt` 와 같은 규칙이다 — **문단만 본다.** 제목·코드·인용을
 * 섞으면 "배경" 같은 것이 검색 결과의 설명에 그대로 뜬다.
 */
export function docText(doc: Doc, limit = 160): string {
  const text = doc.content
    .filter((n) => n.type === 'paragraph')
    .map((n) => inlineText(n.content))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
}

/** 글이 비어 있나 — 저장할 것이 있는지 본다. */
export const isEmptyDoc = (doc: Doc): boolean =>
  doc.content.every((n) => n.type === 'paragraph' && n.content.length === 0);

/**
 * 글이 쓰는 사진 주소들 — 낱장과 줄의 칸 (IDE-028)
 *
 * 저장할 때 **글에서 빠진 사진 파일을 스토리지에서 치우려고** 쓴다
 * (`lib/blog/cleanup.ts`, 2026-09-10 사용자 요청). 대표 사진은 문서 밖의 칸이라
 * 여기에 없다 — 부르는 쪽이 함께 넣는다.
 */
export function docImageUrls(doc: Doc): string[] {
  return doc.content.flatMap((node) =>
    node.type === 'image'
      ? [node.src]
      : node.type === 'imageRow'
        ? node.images.map((image) => image.src)
        : [],
  );
}

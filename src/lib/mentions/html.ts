/**
 * 남의 HTML 읽기 — 태그와 속성만 (IDE-046)
 *
 * 멘션은 남의 글을 두 번 읽는다. 받을 때는 **그 글이 정말 우리를 가리키나**를,
 * 보낼 때는 **그 글이 어디로 받는다고 적어 뒀나**를. 둘 다 필요한 것은 태그
 * 몇 종류의 속성뿐이라 HTML 파서를 들이지 않았다 — 여기 있는 것은 "시작 태그를
 * 차례로 훑는다" 하나다.
 *
 * ## 읽은 것을 그리지 않는다
 *
 * 이 파일이 꺼내는 것은 주소와 **글자**다. 태그는 여기서 전부 떨어지고, 화면은
 * 그 글자를 React 가 글자로 그린다(`MentionSection`) — 공방 일지 본문과 댓글이
 * 지켜 온 "HTML 문자열을 거치지 않는다"가 여기서도 그대로다.
 *
 * ## 느려지지 않게
 *
 * 읽는 것은 **악의로 지은 문서일 수 있다.** `<a` 를 십만 번 적고 한 번도 닫지
 * 않은 1MB 짜리 같은 것. 정규식으로 "`<` 부터 `>` 까지"를 찾으면 그런 문서에서
 * 시도마다 끝까지 훑어 제곱으로 느려진다. 그래서 큰 문서를 훑는 자리는 전부
 * **앞으로만 가는 손 스캐너**이고, 정규식은 짧게 잘라 낸 조각에만 쓴다.
 *
 * `import 'server-only'` 를 붙이지 않는다 — 순수 함수뿐이고 시험이 그대로 쓴다.
 */
import { stripInvisible } from '@/lib/comments/input';

const INERT_OPEN = /<!--|<(script|style|template|textarea)\b/gi;

/**
 * 주석과, 안의 글자가 마크업이 아닌 요소를 걷어 낸다.
 *
 * `<!-- <a href="우리 글"> -->` 은 링크가 아니다. 주석 안에 주소만 적어 두고
 * 멘션을 보내는 것이 핑백 스팸의 오래된 수법이라, 훑기 전에 먼저 지운다.
 *
 * 닫히지 않은 것을 만나면 **거기서부터 끝까지 버린다** — 브라우저도 닫히지 않은
 * `<script>` 뒤를 화면에 그리지 않는다.
 */
export function stripInert(html: string): string {
  let out = '';
  let at = 0;
  INERT_OPEN.lastIndex = 0;

  for (;;) {
    const open = INERT_OPEN.exec(html);
    if (!open) return out + html.slice(at);

    out += `${html.slice(at, open.index)} `;

    let close: number;
    if (open[1] === undefined) {
      const end = html.indexOf('-->', open.index + 4);
      close = end < 0 ? -1 : end + 3;
    } else {
      const closer = new RegExp(`</${open[1]}\\s*>`, 'gi');
      closer.lastIndex = open.index;
      const end = closer.exec(html);
      close = end ? end.index + end[0].length : -1;
    }
    if (close < 0) return out;

    at = close;
    INERT_OPEN.lastIndex = close;
  }
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** `&amp;` · `&#38;` · `&#x26;` 를 글자로. 모르는 이름은 그대로 둔다. */
export const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, body) => {
    const name = String(body);
    if (name[0] !== '#') return NAMED[name.toLowerCase()] ?? whole;
    const code =
      name[1].toLowerCase() === 'x'
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });

export type Tag = {
  /** 소문자. */
  name: string;
  /** 속성 이름은 소문자, 값은 엔티티를 푼 것. 값 없는 속성은 빈 글자다. */
  attrs: Record<string, string>;
  /** `<` 의 자리. */
  start: number;
  /** `>` 다음 자리. */
  end: number;
};

/** 이보다 긴 태그는 읽지 않는다. 링크 하나가 이만큼 길 일이 없다. */
const MAX_TAG_LENGTH = 8_192;

const ATTR =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(ATTR)) {
    const name = match[1].toLowerCase();
    // 같은 이름이 두 번이면 **앞엣것**이 이긴다 — 브라우저가 그렇게 읽는다.
    if (name in attrs) continue;
    attrs[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

const isNameChar = (code: number): boolean =>
  (code >= 97 && code <= 122) || // a-z
  (code >= 65 && code <= 90) || // A-Z
  (code >= 48 && code <= 57); // 0-9

/**
 * 고른 이름의 시작 태그를 문서 순서대로.
 *
 * 한 글자를 한 번씩만 본다. 닫히지 않은 태그를 만나면 **거기서 멈춘다** — 그
 * 뒤에는 어차피 온전한 태그가 올 수 없다.
 *
 * 먼저 `stripInert` 를 지난 글자를 줘야 한다. 주석 안의 태그까지 세지 않으려면
 * 그렇다.
 */
export function startTags(html: string, names: ReadonlySet<string>): Tag[] {
  const tags: Tag[] = [];
  const length = html.length;
  let at = 0;

  for (;;) {
    const lt = html.indexOf('<', at);
    if (lt < 0) return tags;

    let nameEnd = lt + 1;
    while (nameEnd < length && isNameChar(html.charCodeAt(nameEnd))) nameEnd++;
    if (nameEnd === lt + 1) {
      // `</a>` · `<!doctype>` · 글자로 쓴 `<` — 시작 태그가 아니다.
      at = lt + 1;
      continue;
    }

    // 따옴표 안의 `>` 는 태그의 끝이 아니다.
    let quote = 0;
    let gt = -1;
    for (let i = nameEnd; i < length; i++) {
      const code = html.charCodeAt(i);
      if (quote !== 0) {
        if (code === quote) quote = 0;
      } else if (code === 34 || code === 39) {
        quote = code;
      } else if (code === 62) {
        gt = i;
        break;
      }
    }
    if (gt < 0) return tags;

    const name = html.slice(lt + 1, nameEnd).toLowerCase();
    if (names.has(name) && gt - nameEnd <= MAX_TAG_LENGTH) {
      tags.push({
        name,
        attrs: parseAttrs(html.slice(nameEnd, gt)),
        start: lt,
        end: gt + 1,
      });
    }
    at = gt + 1;
  }
}

/** `rel="nofollow webmention"` 처럼 빈칸으로 나눈 낱말 가운데 그것이 있나. */
export const hasRel = (rel: string | undefined, word: string): boolean =>
  (rel ?? '').toLowerCase().split(/\s+/).includes(word);

/**
 * 상대 주소를 푸는 기준. 문서에 `<base href>` 가 있으면 그것, 없으면 문서 주소.
 *
 * 풀 수 없는 `<base>` 는 없는 것으로 친다.
 */
export function baseUrl(html: string, documentUrl: string): string {
  const base = startTags(html, new Set(['base'])).find(
    (tag) => 'href' in tag.attrs,
  );
  if (!base) return documentUrl;
  try {
    return new URL(base.attrs.href.trim(), documentUrl).href;
  } catch {
    return documentUrl;
  }
}

/** 주소를 푼다. 풀 수 없으면 `null`. */
export function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href.trim(), base).href;
  } catch {
    return null;
  }
}

// ── 글자 꺼내기 ─────────────────────────────────────────────────────

/** 제목 한도. 목록 한 줄에 서는 값이다. */
export const TITLE_MAX = 140;

/** 발췌 한도. 링크 앞뒤로 한두 문장이다. */
export const EXCERPT_MAX = 280;

/** 링크 앞뒤에서 발췌로 가져오는 글자 수. */
const AROUND = 110;

/** 발췌를 만들려고 링크 앞뒤에서 떼어 오는 HTML 길이. 태그가 섞여 있어 넉넉히 뗀다. */
const WINDOW = 2_000;

/**
 * 남의 서버가 준 글자를 한 줄로 다듬는다.
 *
 * 댓글(`comments/input.ts`)과 같은 잣대다 — 보이지 않는 글자를 떼고, 빈칸을
 * 하나로 접는다. 줄바꿈도 빈칸이 된다. 목록의 한 줄 배치를 남의 글이 밀어내지
 * 못하게 한다.
 */
export const oneLine = (value: string): string =>
  stripInvisible(decodeEntities(value)).replace(/\s+/g, ' ').trim();

const clip = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`;

/**
 * 조각에서 태그를 떼고 글자만. **짧게 자른 조각에만 쓴다** — 정규식이라 큰
 * 문서에 쓰면 위에 적은 대로 느려질 수 있다.
 *
 * 아무 데서나 자른 조각은 태그 한가운데가 끊겨 있다(`…ass="x">글자`). 앞을
 * 잘랐으면(`head`) 앞머리에 닫는 꺾쇠만 남은 데까지 버리고, 뒤를 잘랐으면
 * (`tail`) 꼬리에 여는 꺾쇠만 남은 데서부터 버린다.
 *
 * **앞뒤 빈칸을 떼지 않는다.** 조각들을 이어 붙일 때 원문의 띄어쓰기가 그대로
 * 살아야 한다 — `<a>윷가락</a>이` 는 "윷가락이"이고, 태그 자리에 빈칸을 넣으면
 * 조사가 떨어져 "윷가락 이"가 된다. 여기 오는 조각은 한 문단 안이라 남은 태그는
 * 글자 사이에 낀 것(`<b>` · `<span>`)뿐이다.
 */
function textOf(
  fragment: string,
  cut: { head?: boolean; tail?: boolean } = {},
): string {
  let body = fragment;

  if (cut.head) {
    const gt = body.indexOf('>');
    const lt = body.indexOf('<');
    if (gt >= 0 && (lt < 0 || gt < lt)) body = body.slice(gt + 1);
  }
  if (cut.tail) {
    const lt = body.lastIndexOf('<');
    if (lt >= 0 && body.indexOf('>', lt) < 0) body = body.slice(0, lt);
  }

  return stripInvisible(decodeEntities(body.replace(/<[^>]*>/g, ''))).replace(
    /\s+/g,
    ' ',
  );
}

/**
 * 글의 제목. `og:title` 이 있으면 그것, 없으면 `<title>`.
 *
 * `og:title` 을 먼저 보는 것은 `<title>` 에 사이트 이름이 붙어 오는 일이 많아서다
 * ("글 제목 : 네이버 블로그"). 못 찾으면 빈 글자이고, 화면이 호스트 이름으로
 * 대신한다.
 */
export function pageTitle(html: string): string {
  const meta = startTags(html, new Set(['meta'])).find(
    (tag) =>
      (tag.attrs.property ?? tag.attrs.name ?? '').toLowerCase() ===
        'og:title' && tag.attrs.content,
  );
  if (meta) return clip(oneLine(meta.attrs.content), TITLE_MAX);

  const [title] = startTags(html, new Set(['title']));
  if (!title) return '';
  const close = html.indexOf('</', title.end);
  return clip(
    oneLine(html.slice(title.end, close < 0 ? title.end + 1_000 : close)),
    TITLE_MAX,
  );
}

/**
 * 문단을 가르는 태그. 발췌는 **링크가 든 문단 안에서만** 꺼낸다 — 안 그러면
 * 링크가 글 첫머리에 있을 때 `<title>` 이나 메뉴의 글자가 발췌 앞에 붙는다.
 */
const BLOCK =
  /<\/?(?:p|div|li|ul|ol|h[1-6]|blockquote|section|article|header|footer|main|nav|aside|table|tr|td|th|dl|dd|dt|pre|figure|figcaption|title|head|body|br|hr)\b[^>]*>/gi;

/**
 * 링크 둘레의 글자 — "그 글이 우리를 두고 뭐라고 했나".
 *
 * 관리자가 승인할지 말지를 이것으로 정한다. 링크만 덩그러니 건 스팸은 여기가
 * 비거나 엉뚱한 낱말로 차 있어서 한눈에 보인다.
 */
export function excerptAround(html: string, anchor: Tag): string {
  const from = Math.max(0, anchor.start - WINDOW);
  const lead = html.slice(from, anchor.start);
  const lastBlock = [...lead.matchAll(BLOCK)].at(-1);
  const before = lastBlock
    ? textOf(lead.slice(lastBlock.index + lastBlock[0].length))
    : textOf(lead, { head: from > 0 });

  // 닫는 태그는 가까운 데서만 찾는다. 못 찾으면 링크 글자 없이 뒤를 그대로 쓴다.
  const rest = html.slice(anchor.end, anchor.end + 2 * WINDOW);
  const close = /<\/a\s*>/i.exec(rest);
  const linked = close ? textOf(rest.slice(0, close.index)) : '';
  const trail = (
    close ? rest.slice(close.index + close[0].length) : rest
  ).slice(0, WINDOW);
  BLOCK.lastIndex = 0;
  const nextBlock = BLOCK.exec(trail);
  const after = nextBlock
    ? textOf(trail.slice(0, nextBlock.index))
    : textOf(trail, { tail: true });

  const head =
    before.length > AROUND ? `…${before.slice(-AROUND).trimStart()}` : before;
  const tail =
    after.length > AROUND ? `${after.slice(0, AROUND).trimEnd()}…` : after;

  return clip(oneLine(head + linked + tail), EXCERPT_MAX);
}

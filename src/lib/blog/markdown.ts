/**
 * 마크다운 읽기 (IDE-023 · 그리는 몫은 IDE-028 이 가져갔다)
 *
 * 원래 이 파일이 마크다운을 **React 엘리먼트로 그리는** 일까지 했다. 그때
 * 세운 규칙이 이 프로젝트 보안의 뼈대다 — HTML 문자열을 한 번도 만들지 않아서
 * 본문이 `<script>` 든 `onerror` 든 글자로 나온다.
 *
 * `IDE-028` 이 보이는 대로 쓰는 편집기를 붙이면서 그리는 쪽은 `DocView.tsx` 로
 * 옮겼다. **규칙은 그대로 갔다.** 여기 남은 것은 둘이다.
 *
 * - `safeUrl` — 링크·사진 주소의 허용 목록. 문서 검사(`doc.ts`)도 이걸 쓴다.
 *   React 도 `href="javascript:…"` 는 막아 주지 않는다.
 * - `parseMarkdown` — `IDE-023` 때 쓴 글을 문서로 옮기는 **수입기**의 앞단
 *   (`fromMarkdown.ts`). 이제 화면에 직접 닿지 않는다.
 */

/** 링크·사진에 허용하는 스킴. 나머지는 링크가 되지 않는다. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * 쓸 수 있는 주소면 그대로, 아니면 `null`.
 *
 * 상대 주소(`/blog/…` · `#어디`)는 스킴이 없어 `URL` 로 못 읽는다. 먼저 걸러
 * 통과시킨다 — 단 `//evil.example` 은 스킴만 생략한 절대 주소라 상대가 아니다.
 */
export function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('#')) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    return SAFE_SCHEMES.includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

// ── 블록 ────────────────────────────────────────────────────────────

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBER = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const FENCE = /^```/;

/**
 * 줄 단위로 훑어 블록으로 접는다.
 *
 * `\r\n` 을 먼저 없앤다 — 폰 브라우저에서 붙여 넣은 글에 섞여 들어오면 목록
 * 표시(`- `)가 줄 끝의 `\r` 때문에 안 잡힌다.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];

  // 문단은 빈 줄을 만날 때까지 모았다가 한 번에 접는다.
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (FENCE.test(trimmed)) {
      flush();
      // 닫는 울타리를 찾는다. 없으면 글 끝까지가 코드다 — 여기서 던지면 쓰다
      // 만 글의 미리보기가 통째로 안 뜬다.
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i].trim())) {
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    if (trimmed === '') {
      flush();
      continue;
    }

    if (RULE.test(trimmed)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: heading[2],
      });
      continue;
    }

    const quote = QUOTE.exec(trimmed);
    if (quote) {
      flush();
      const last = blocks.at(-1);
      // 잇달아 오는 `>` 줄은 한 인용으로 묶는다.
      if (last?.kind === 'quote') last.text += `\n${quote[1]}`;
      else blocks.push({ kind: 'quote', text: quote[1] });
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    const numbered = bullet ? null : NUMBER.exec(trimmed);
    if (bullet || numbered) {
      flush();
      const ordered = numbered !== null;
      const item = (bullet ?? numbered)![1];
      const last = blocks.at(-1);
      if (last?.kind === 'list' && last.ordered === ordered) {
        last.items.push(item);
      } else {
        blocks.push({ kind: 'list', ordered, items: [item] });
      }
      continue;
    }

    paragraph.push(trimmed);
  }

  flush();
  return blocks;
}

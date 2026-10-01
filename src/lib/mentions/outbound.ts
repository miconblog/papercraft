/**
 * 글이 가리키는 바깥 — 멘션을 보낼 주소들 (IDE-046)
 *
 * 본문 문서(`lib/blog/doc.ts`)에서 **링크 서식의 주소**만 모은다. 사진 주소는
 * 보지 않는다 — 남의 사진을 끌어다 쓴 것은 그 글을 이야기한 것이 아니다.
 *
 * 순수 함수다. 주소가 받는 곳을 두었는지는 가 봐야 알고(`send.ts`), 여기는
 * 문서만 읽는다.
 */
import type { Doc, Inline } from '@/lib/blog/doc';
import { siteUrl } from '@/lib/site';

/**
 * 한 글에서 보내는 최대 개수.
 *
 * 링크마다 남의 서버를 두 번 두드린다(받는 주소 찾기 · 보내기). 링크를 백 개 건
 * 글 하나가 저장 한 번에 요청 이백 개를 쏘지 않게 한다. 넘치는 것은 **앞에서부터**
 * 보낸다 — 글의 앞머리에 건 링크가 대개 그 글이 이야기하는 대상이다.
 */
export const MAX_OUTBOUND = 20;

/** 017 의 기본 키에 들어가는 값이라 길이에 끝을 둔다(`receive.ts` 와 같은 값). */
const MAX_URL_LENGTH = 2_000;

const bare = (host: string): string => host.toLowerCase().replace(/^www\./, '');

/** 문서의 글자 마디를 전부. 문단 · 제목 · 인용 · 목록의 칸. */
function inlines(doc: Doc): Inline[] {
  return doc.content.flatMap((node) => {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
      case 'blockquote':
        return node.content;
      case 'bulletList':
      case 'orderedList':
        return node.items.flat();
      default:
        return [];
    }
  });
}

/**
 * 멘션을 보낼 주소들 — 문서에 나온 순서대로, 겹침 없이.
 *
 * **문서에 적힌 글자 그대로 돌려준다.** 받는 쪽은 우리 글에 와서 이 주소와
 * **똑같은** `href` 를 찾는다. 여기서 주소를 다듬으면(끝의 `/` 를 떼거나 `#` 뒤를
 * 자르거나) 화면에 그려진 것과 달라져서 확인에 떨어진다.
 *
 * 우리 사이트로 가는 링크는 뺀다. `www` 는 있든 없든 우리다.
 */
export function outboundLinks(doc: Doc, site: string = siteUrl()): string[] {
  const own = bare(new URL(site).hostname);
  const found = new Set<string>();

  for (const inline of inlines(doc)) {
    if (inline.type !== 'text') continue;
    for (const mark of inline.marks ?? []) {
      if (mark.type !== 'link' || mark.href.length > MAX_URL_LENGTH) continue;
      let url: URL;
      try {
        // 상대 주소(`/blog/…` · `#어디`)는 여기서 던져진다 — 우리 사이트 안이다.
        url = new URL(mark.href);
      } catch {
        continue;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (bare(url.hostname) === own) continue;
      found.add(mark.href);
    }
  }

  return [...found].slice(0, MAX_OUTBOUND);
}

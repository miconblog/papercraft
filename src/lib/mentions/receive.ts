import 'server-only';

/**
 * 멘션 받기 — 웹멘션과 핑백이 함께 지나는 한 길 (IDE-046)
 *
 * 두 규약은 싣고 오는 봉투만 다르다(폼 · XML-RPC). 안에 든 것은 똑같이 주소
 * 둘이다 — **출처**(우리를 가리켰다는 글)와 **대상**(가리켜진 우리 글). 그래서
 * 봉투는 라우트가 뜯고(`app/api/webmention` · `app/api/pingback`) 여기는 그
 * 둘만 받는다.
 *
 * ## 아무도 확인하지 않고 받는다 — 대신 전부 여기서 막는다
 *
 * 댓글 쓰기(`comments/actions.ts`)와 같은 자리다. 누구나 부를 수 있는 문이라
 * 믿을 것이 하나도 없다. 순서가 뜻을 가진다 — **싼 검사가 먼저, 남의 서버를
 * 두드리는 일이 맨 뒤다.**
 *
 * 1. 주소 둘이 웹 주소인가, 출처가 우리 자신은 아닌가
 * 2. 대상이 **지금 열려 있는** 우리 글 · 게임인가
 * 3. 저장소에 닿나, 대기 줄에 자리가 있나
 * 4. 출처에 **직접 가서** 우리로 오는 링크가 정말 있나
 *
 * 4번이 이 규약의 전부다. 확인 없이 받으면 `source` 에 아무 주소나 적어 보내는
 * 것으로 우리 글 아래에 링크를 세울 수 있다. 그리고 그 4번이 가장 위험한
 * 일이기도 하다 — 남이 고른 주소로 요청을 건다(`fetchPublic.ts`).
 *
 * 다 지나도 **승인 전에는 어디에도 보이지 않는다**(017). 마지막 문지기는
 * 사람이다.
 */
import { revalidateTag } from 'next/cache';
import type { MentionVia } from './discover';
import { fetchPublic, type PublicFetch } from './fetchPublic';
import {
  baseUrl,
  excerptAround,
  pageTitle,
  resolveUrl,
  startTags,
  stripInert,
  type Tag,
} from './html';
import {
  createMention,
  deleteMention,
  hasPendingRoom,
  isApproved,
  mentionFrom,
  mentionsTag,
  reviseMention,
  type Mention,
} from './mentions';
import {
  isOwnUrl,
  resolveTarget,
  sameRef,
  targetRef,
  type MentionTarget,
  type TargetRef,
} from './target';

export type ReceiveOutcome =
  /** 새로 받았다. 승인을 기다린다. */
  | { status: 'accepted' }
  /** 이미 있던 멘션의 내용이 바뀌었다. 다시 승인을 기다린다. */
  | { status: 'updated' }
  /** 이미 있고 바뀐 것도 없다. */
  | { status: 'unchanged' }
  /** 출처가 링크를 거뒀거나 글이 사라졌다. 있던 멘션을 지웠다. */
  | { status: 'removed' }
  | { status: 'rejected'; reason: RejectReason };

export type RejectReason =
  /** 주소 둘 가운데 읽을 수 없는 것이 있다. */
  | 'bad-request'
  /** 출처가 우리 사이트다. 우리 글끼리의 링크는 멘션이 아니다. */
  | 'own-source'
  /** 대상이 우리 글 · 게임이 아니거나 열려 있지 않다. */
  | 'target-not-found'
  /** 출처에 닿지 못했다. 잠깐일 수 있다. */
  | 'source-unreachable'
  /** 출처에 닿았는데 우리로 오는 링크가 없다. */
  | 'no-link'
  /** 대기 줄이 찼다. */
  | 'too-many'
  /** 저장소에 닿지 못했다. */
  | 'store-failed';

const reject = (reason: RejectReason): ReceiveOutcome => ({
  status: 'rejected',
  reason,
});

/** 주소 한도. 017 의 유일 인덱스가 담을 수 있는 길이 안쪽이다. */
export const MAX_URL_LENGTH = 2_000;

/**
 * 출처 주소를 담을 모양으로. 못 쓰는 주소면 `null`.
 *
 * `#` 뒤를 뗀다 — 같은 글의 다른 자리를 가리킨 것이 다른 멘션이 되면 안 된다.
 */
function toSource(raw: string): URL | null {
  if (raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.href.length > MAX_URL_LENGTH ? null : url;
}

/**
 * 출처의 링크 가운데 이 대상으로 오는 첫 번째.
 *
 * **`<a>` 만 본다.** 규약은 `<img src>` 같은 것도 치지만, 우리 글 주소를 그림으로
 * 끌어다 쓴 것은 "이야기했다"가 아니다.
 *
 * 견주는 방식은 `target.ts` 에 적었다 — 글자가 아니라 **대상으로 읽은 뒤에**
 * 견준다.
 */
function linkTo(html: string, documentUrl: string, ref: TargetRef): Tag | null {
  const base = baseUrl(html, documentUrl);
  return (
    startTags(html, new Set(['a'])).find((tag) => {
      const href = tag.attrs.href;
      if (!href) return false;
      const url = resolveUrl(href, base);
      const linked = url === null ? null : targetRef(url);
      return linked !== null && sameRef(linked, ref);
    }) ?? null
  );
}

/**
 * 승인돼 서 있던 멘션이 바뀌거나 사라졌으면 그 화면을 다시 그리게 한다.
 *
 * 대기 중이던 것은 깨울 것이 없다 — 화면에 없었다. 요청 스코프 밖(시험)에서는
 * 이 함수가 던지므로 삼킨다. 깨우지 못해도 1분 뒤에는 다시 그려진다.
 */
function refresh(existing: Mention): void {
  if (!isApproved(existing)) return;
  try {
    revalidateTag(mentionsTag(existing.kind, existing.targetId), 'max');
  } catch (cause) {
    console.warn('[mentions] 화면을 깨우지 못했다:', cause);
  }
}

async function remove(existing: Mention): Promise<ReceiveOutcome> {
  const result = await deleteMention(existing.id);
  if (!result.ok) return reject('store-failed');
  refresh(existing);
  return { status: 'removed' };
}

export type Incoming = { source: string; target: string; via: MentionVia };

export async function receiveMention(
  { source: rawSource, target: rawTarget, via }: Incoming,
  fetcher: PublicFetch = fetchPublic,
): Promise<ReceiveOutcome> {
  // 1. 주소
  const source = toSource(rawSource);
  if (!source || rawTarget.length > MAX_URL_LENGTH)
    return reject('bad-request');
  // 워드프레스는 제 글끼리도 핑백을 보낸다. 우리 글이 우리 글을 가리키는 것을
  // 글 아래에 "이야기한 곳"으로 세울 이유가 없다.
  if (isOwnUrl(source)) return reject('own-source');

  // 2. 대상
  const ref = targetRef(rawTarget);
  const target: MentionTarget | null = ref ? await resolveTarget(ref) : null;
  if (!ref || !target) return reject('target-not-found');

  // 3. 저장소 — 남의 서버를 두드리기 **전에** 본다. 담을 수 없는 멘션을 위해
  //    요청을 걸면, 저장소가 꺼진 동안 이 주소는 "아무 데나 요청을 대신 걸어
  //    주는 곳"이 된다.
  const existing = await mentionFrom(source.href, target);
  if (existing === undefined) return reject('store-failed');
  if (!existing && !(await hasPendingRoom(source.hostname))) {
    return reject('too-many');
  }

  // 4. 출처에 가 본다
  const page = await fetcher(source.href, {
    headers: { Accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1' },
  });
  if (!page.reached) return reject('source-unreachable');

  // 글이 사라졌다(404 · 410) — 규약이 "있던 멘션을 지우라"고 하는 경우다.
  if (page.status === 404 || page.status === 410) {
    return existing ? remove(existing) : reject('source-unreachable');
  }
  if (page.status < 200 || page.status >= 300) {
    return reject('source-unreachable');
  }

  const type = page.headers.get('content-type') ?? '';
  const html = type && !/html/i.test(type) ? '' : stripInert(page.text);
  const anchor = linkTo(html, page.url, ref);
  if (!anchor) return existing ? remove(existing) : reject('no-link');

  const title = pageTitle(html);
  const excerpt = excerptAround(html, anchor);

  if (existing) {
    if (existing.title === title && existing.excerpt === excerpt) {
      return { status: 'unchanged' };
    }
    const revised = await reviseMention(existing.id, { title, excerpt, via });
    if (!revised.ok) return reject('store-failed');
    refresh(existing);
    return { status: 'updated' };
  }

  const created = await createMention({
    ...target,
    sourceUrl: source.href,
    sourceHost: source.hostname,
    title,
    excerpt,
    via,
  });
  return created.ok ? { status: 'accepted' } : reject('store-failed');
}

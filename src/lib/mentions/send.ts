import 'server-only';

/**
 * 멘션 보내기 — 글이 가리킨 곳에 알린다 (IDE-046)
 *
 * 글에 남의 블로그 링크를 걸면, 그 블로그에 "여기서 당신 글을 이야기했다"를
 * 보낸다(사용자 요청 2026-10-01). 받는 곳이 웹멘션을 받으면 웹멘션으로, 핑백만
 * 받으면 핑백으로 간다. 둘 다 안 받는 곳에는 아무것도 가지 않는다.
 *
 * ## 언제 보내나 — 두 자리
 *
 * 1. **저장할 때**(`admin/posts/actions.ts`). 글이 열려 있으면 곧장 보낸다.
 *    실패했던 것을 다시 해 보고, 본문에서 뺀 링크에는 뺐다고 알린다.
 * 2. **글 화면이 다시 그려질 때**(`blog/[slug]/page.tsx`). 예약해 둔 글은 시각이
 *    지나면 사람 손 없이 열리는데(`IDE-023`), 그 순간에는 저장이 없다. 그래서
 *    글 화면이 그려질 때 **아직 한 번도 안 보낸 링크**가 있는지 본다. 보낸 적
 *    있는 링크는 건드리지 않고, 한 번 확인한 글은 다시 묻지 않는다(`settled`).
 *
 * 둘이 겹쳐 같은 멘션이 두 번 나가도 탈이 없다 — 받는 쪽은 같은 출처 · 같은
 * 대상을 한 줄로 본다(우리도 그렇게 받는다, 017).
 *
 * ## 두 번 보내지 않는다
 *
 * 보낸 것을 적어 두고(`sent.ts`) **적힌 링크는 다시 보내지 않는다.** 규약은 글을
 * 고칠 때마다 다시 보내라고 권하지만, 그러면 오타 하나 고칠 때마다 남의 서버를
 * 두드린다. 다시 보내는 것은 주인이 눌렀을 때뿐이다(관리자 화면의 「다시
 * 보내기」).
 *
 * ## 절대 던지지 않는다
 *
 * 응답을 보낸 **뒤에** 도는 일이다. 여기서 던지면 받아 줄 곳이 없다 — 저장은
 * 이미 끝났고 사람은 화면을 보고 있다. 결과는 기록으로 남고 관리자 화면이
 * 보여 준다.
 */
import { isPublished, type Post } from '@/lib/blog/posts';
import { siteUrl } from '@/lib/site';
import { REQUEST_TTL_MS } from '@/lib/supabase/rest';
import { mentionsSendEnabled } from './config';
import { discoverEndpoint, type MentionVia } from './discover';
import { fetchPublic, type PublicFetch } from './fetchPublic';
import { outboundLinks } from './outbound';
import {
  forgetSent,
  recordSent,
  sentForPost,
  type SentMention,
  type SentStatus,
} from './sent';
import { PINGBACK_FAULT, parsePingbackReply, pingbackCallXml } from './xmlrpc';

export type Delivery = {
  status: SentStatus;
  via: MentionVia | null;
  endpoint: string | null;
  detail: string;
};

/** 받는 쪽의 답은 짧다. 본문을 길게 돌려주는 곳에 묶이지 않는다. */
const REPLY_MAX_BYTES = 16_384;

const ok = (status: number): boolean => status >= 200 && status < 300;

/**
 * 링크 하나에 보낸다 — 받는 주소를 찾고, 있으면 그 규약으로.
 *
 * 요청은 전부 `fetchPublic` 을 지난다. **받는 주소는 남의 글이 알려 준 값**이라
 * 믿을 수 없기는 받을 때의 출처 주소와 같다 — 글에 `rel="webmention"
 * href="http://localhost/…"` 라고 적어 두면 우리 서버가 안쪽을 두드리게 된다.
 */
export async function deliver(
  source: string,
  target: string,
  fetcher: PublicFetch = fetchPublic,
): Promise<Delivery> {
  const page = await fetcher(target, {
    headers: { Accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.1' },
  });
  if (!page.reached) {
    return {
      status: 'failed',
      via: null,
      endpoint: null,
      detail: `링크한 글에 닿지 못했습니다 (${page.reason}).`,
    };
  }
  if (!ok(page.status)) {
    return {
      status: 'failed',
      via: null,
      endpoint: null,
      detail: `링크한 글이 ${page.status} 로 답했습니다.`,
    };
  }

  const type = page.headers.get('content-type') ?? '';
  const endpoint = discoverEndpoint({
    linkHeader: page.headers.get('link'),
    pingbackHeader: page.headers.get('x-pingback'),
    html: type && !/html/i.test(type) ? '' : page.text,
    documentUrl: page.url,
  });
  if (!endpoint) {
    return {
      status: 'none',
      via: null,
      endpoint: null,
      detail: '웹멘션도 핑백도 받지 않는 곳입니다.',
    };
  }

  const base = { via: endpoint.via, endpoint: endpoint.url };
  const failed = (detail: string): Delivery => ({
    ...base,
    status: 'failed',
    detail,
  });

  if (endpoint.via === 'webmention') {
    const reply = await fetcher(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ source, target }).toString(),
      maxBytes: REPLY_MAX_BYTES,
    });
    if (!reply.reached) {
      return failed(`받는 주소에 닿지 못했습니다 (${reply.reason}).`);
    }
    return ok(reply.status)
      ? { ...base, status: 'sent', detail: '' }
      : failed(`받는 쪽이 ${reply.status} 로 답했습니다.`);
  }

  const reply = await fetcher(endpoint.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: pingbackCallXml(source, target),
    maxBytes: REPLY_MAX_BYTES,
  });
  if (!reply.reached) {
    return failed(`받는 주소에 닿지 못했습니다 (${reply.reason}).`);
  }
  if (!ok(reply.status)) {
    return failed(`받는 쪽이 ${reply.status} 로 답했습니다.`);
  }

  const parsed = parsePingbackReply(reply.text);
  // "이미 받은 핑백"은 실패가 아니다 — 받는 쪽에 이미 서 있다.
  if (parsed.ok || parsed.code === PINGBACK_FAULT.alreadyRegistered) {
    return { ...base, status: 'sent', detail: '' };
  }
  return failed(`받는 쪽이 거절했습니다 (${parsed.code}) ${parsed.message}`);
}

/** 보내는 데 필요한 칸만. 저장 액션은 `Post` 전체를 다시 읽지 않고 이것만 넘긴다. */
export type Dispatchable = Pick<
  Post,
  'id' | 'slug' | 'doc' | 'publishAt' | 'hidden'
>;

export type DispatchMode =
  /** 글 화면이 그려질 때 — 한 번도 안 보낸 링크만. */
  | 'catch-up'
  /** 저장할 때 — 거기에 실패했던 것과 본문에서 빠진 것까지. */
  | 'save'
  /** 주인이 눌렀을 때 — 지금 걸린 링크 전부. */
  | 'force';

export type DispatchSummary = {
  sent: number;
  failed: number;
  /** 받는 곳이 없던 링크. */
  none: number;
  /** 본문에서 빠져 기록을 지운 링크. */
  withdrawn: number;
};

export type DispatchOptions = {
  /**
   * 방금 열린 글인가 — 내려 뒀다가 올렸거나 초안을 낸 경우다. 부르는 쪽이
   * 저장 전 모습을 알 때 알려 준다. 모르면 게시 시각만 보고 정한다.
   */
  justOpened?: boolean;
  fetcher?: PublicFetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  env?: Record<string, string | undefined>;
};

/** 한 번에 나란히 보내는 수. 링크가 많은 글이 남의 서버들을 한꺼번에 두드리지 않게. */
const CONCURRENCY = 4;

/** 문지기의 메모가 비워지고도 조금 더. */
const SETTLE_MARGIN_MS = 2_000;

/**
 * 문지기가 이 글을 열어 줄 때까지 기다릴 시간.
 *
 * 받는 쪽은 멘션을 받자마자 **우리 글에 와서 링크를 확인한다.** 그런데 문지기
 * (`proxy.ts`)는 "낸 글 목록"을 30초 동안 메모해 둔다(`REQUEST_TTL_MS`). 방금 낸
 * 글은 그 사이에 아직 404 일 수 있고, 그때 확인하러 온 쪽은 "그런 글이 없다"로
 * 멘션을 버린다. 그래서 막 열린 글은 메모가 비워질 때까지 기다렸다 보낸다.
 *
 * 오래전에 낸 글을 고칠 때는 기다리지 않는다.
 */
function settleMs(
  post: Dispatchable,
  justOpened: boolean,
  now: number,
): number {
  const window = REQUEST_TTL_MS + SETTLE_MARGIN_MS;
  if (justOpened) return window;
  const sinceOpen = now - (post.publishAt ?? 0);
  return sinceOpen >= window ? 0 : window - Math.max(0, sinceOpen);
}

async function inBatches<T>(
  items: T[],
  run: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
  }
}

/**
 * "이 글은 더 볼 것이 없다"고 확인한 기억 — 이 인스턴스 안에서만 안다.
 *
 * 글 화면은 **방문마다 그려진다**(슬러그 목록을 미리 내주지 않아 요청마다
 * 서버가 그린다). 화면 쪽 챙기기가 그때마다 보낸 기록을 읽으면 글 한 번 읽힐
 * 때마다 저장소를 한 번 두드린다 — 크롤러가 몰리면 그만큼이다.
 *
 * 그래서 글마다 **우리 주소와 링크 목록**을 적어 두고, 그것이 그대로면 묻지
 * 않는다. 링크를 고치거나 슬러그를 바꾸면 값이 달라져 다시 본다. 인스턴스가 새로
 * 뜨면 한 번 다시 읽을 뿐이라 틀릴 일이 없다 — 기억은 읽기를 아끼는 것이고,
 * 보냈는지의 원본은 여전히 표다.
 */
const settled = new Map<string, string>();

/** 기억의 한도. 글이 수십 편 규모라 닿을 일이 없지만 끝은 둔다. */
const SETTLED_MAX = 500;

function remember(postId: string, signature: string): void {
  if (settled.size >= SETTLED_MAX) settled.clear();
  settled.set(postId, signature);
}

async function run(
  post: Dispatchable,
  mode: DispatchMode,
  options: DispatchOptions,
): Promise<DispatchSummary | null> {
  const {
    fetcher = fetchPublic,
    now = Date.now,
    sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms)),
    env = process.env,
  } = options;

  if (!mentionsSendEnabled(env)) return null;
  // 안 낸 글의 멘션은 나가지 않는다. 받는 쪽이 확인하러 와도 글이 없고, 무엇보다
  // **아직 세상에 안 낸 글의 주소**를 남의 서버에 알려 주게 된다.
  if (!isPublished(post, now())) return null;

  const links = outboundLinks(post.doc);
  // 화면이 그려질 때마다 도는 길이다. 바깥 링크가 없는 글은 저장소도 묻지 않는다.
  if (mode === 'catch-up' && links.length === 0) return null;

  const source = `${siteUrl()}/blog/${post.slug}`;
  const signature = [source, ...links].join('\n');
  if (mode === 'catch-up' && settled.get(post.id) === signature) return null;

  const rows = await sentForPost(post.id);
  if (rows === null) return null;

  const recorded = new Map(rows.map((row) => [row.targetUrl, row]));

  const due = links.filter((link) => {
    const row = recorded.get(link);
    // 처음 보는 링크이거나, 슬러그를 고쳐 우리 주소가 달라졌다.
    if (!row || row.sourceUrl !== source) return true;
    if (mode === 'force') return true;
    return mode === 'save' && row.status === 'failed';
  });
  // 본문에서 빠진 링크. 화면이 그려질 때는 손대지 않는다 — 치우는 것은 사람이
  // 글을 고쳤을 때의 일이다.
  const gone: SentMention[] =
    mode === 'catch-up'
      ? []
      : rows.filter((row) => !links.includes(row.targetUrl));

  const summary: DispatchSummary = {
    sent: 0,
    failed: 0,
    none: 0,
    withdrawn: 0,
  };
  if (due.length === 0 && gone.length === 0) {
    remember(post.id, signature);
    return summary;
  }

  const wait = settleMs(post, options.justOpened ?? false, now());
  if (wait > 0) await sleep(wait);

  await inBatches(due, async (target) => {
    const delivery = await deliver(source, target, fetcher);
    summary[delivery.status] += 1;
    await recordSent({
      postId: post.id,
      targetUrl: target,
      sourceUrl: source,
      ...delivery,
    });
  });

  await inBatches(gone, async (row) => {
    // 받았던 곳에는 한 번 더 보낸다. 받는 쪽이 다시 와서 링크가 사라진 것을
    // 보고 멘션을 내린다 — 규약이 정한 "뺐다"는 알림이 이것이다.
    if (row.status === 'sent')
      await deliver(row.sourceUrl, row.targetUrl, fetcher);
    await forgetSent(post.id, row.targetUrl);
    summary.withdrawn += 1;
  });

  // 실패한 것이 있어도 기억한다. 화면 쪽은 실패를 다시 하지 않으므로 더 볼 것이
  // 없기는 마찬가지다 — 다시 해 보는 것은 저장할 때다.
  remember(post.id, signature);
  return summary;
}

/**
 * 지금 보내고 있는 글들 — 이 인스턴스 안에서만 안다.
 *
 * 받는 쪽은 멘션을 받자마자 **우리 글에 와서 링크를 확인한다.** 그 요청이 글
 * 화면을 다시 그리면 화면은 또 "안 보낸 링크"를 챙기는데, 첫 번째 보내기가 아직
 * 답을 기다리는 중이라 기록이 없다 — 같은 멘션이 한 번 더 나간다(2026-10-01
 * 로컬에서 확인). 그래서 보내는 중인 글은 화면 쪽에서 건너뛴다.
 *
 * 다른 인스턴스까지는 막지 못한다. 그래도 탈이 없는 것은 위에 적은 대로다 —
 * 받는 쪽이 같은 출처 · 같은 대상을 한 줄로 본다.
 */
const inFlight = new Set<string>();

/**
 * 글의 멘션을 보낸다. 보내지 않았으면 `null` — 꺼져 있거나, 안 낸 글이거나,
 * 기록을 읽지 못했거나, 이미 보내는 중이거나, 더 볼 것이 없다고 기억하고 있다.
 */
export async function dispatchMentions(
  post: Dispatchable,
  mode: DispatchMode,
  options: DispatchOptions = {},
): Promise<DispatchSummary | null> {
  if (mode === 'catch-up' && inFlight.has(post.id)) return null;

  inFlight.add(post.id);
  try {
    return await run(post, mode, options);
  } catch (cause) {
    console.warn('[mentions] 보내지 못했다:', cause);
    return null;
  } finally {
    inFlight.delete(post.id);
  }
}

/** 이 인스턴스의 기억을 비운다. 시험이 쓴다 — 시험끼리 기억을 물려받지 않게. */
export function forgetDispatches(): void {
  settled.clear();
  inFlight.clear();
}

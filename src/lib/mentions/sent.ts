import 'server-only';

/**
 * 보낸 멘션의 기록 (IDE-046)
 *
 * 글 하나가 어느 주소에 무엇을 보냈는지 적어 둔다(017 의 `mentions_sent`). 이
 * 기록이 하는 일은 하나다 — **같은 곳에 두 번 보내지 않는다.**
 *
 * ## 못 읽은 것은 "보낸 적 없다"가 아니다
 *
 * 다른 읽기는 실패를 빈 목록으로 삼키지만 여기는 **`null` 을 돌려준다.**
 * 빈 목록으로 읽으면 "아무 데도 안 보냈다"가 되어, 저장소가 잠깐 흔들리는
 * 동안 글이 다시 그려질 때마다 모든 링크에 멘션이 다시 나간다. 사진 정리
 * (`blog/posts.ts` 의 `referencedText`)가 같은 이유로 같은 선택을 했다 —
 * **모르면 아무것도 하지 않는다.**
 */
import { restRead, restWrite, type WriteResult } from '@/lib/supabase/rest';
import type { MentionVia } from './discover';

export type SentStatus =
  /** 받는 쪽이 받았다고 답했다. */
  | 'sent'
  /** 보내려다 실패했다. 다음에 글을 저장할 때 다시 해 본다. */
  | 'failed'
  /** 받는 주소를 두지 않은 곳이다. 다시 두드리지 않는다. */
  | 'none';

export type SentMention = {
  postId: string;
  /** 본문에 건 링크. 문서에 적힌 글자 그대로다. */
  targetUrl: string;
  /** 그때 우리 글의 주소. 슬러그를 고치면 달라진다. */
  sourceUrl: string;
  via: MentionVia | null;
  endpoint: string | null;
  status: SentStatus;
  /** 실패한 이유. 관리자 화면에 그대로 선다. */
  detail: string;
  sentAt: number;
};

const TABLE = 'mentions_sent';
const LABEL = 'mentions';

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const isStatus = (value: unknown): value is SentStatus =>
  value === 'sent' || value === 'failed' || value === 'none';

export function toSent(row: unknown): SentMention | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;

  const postId = text(r.post_id);
  const targetUrl = text(r.target_url);
  if (!postId || !targetUrl || !isStatus(r.status)) return null;

  const sentAt = Date.parse(text(r.sent_at));
  return {
    postId,
    targetUrl,
    sourceUrl: text(r.source_url),
    via: r.via === 'webmention' || r.via === 'pingback' ? r.via : null,
    endpoint: text(r.endpoint) || null,
    status: r.status,
    detail: text(r.detail),
    sentAt: Number.isNaN(sentAt) ? 0 : sentAt,
  };
}

const toSentList = (rows: unknown[]): SentMention[] =>
  rows.flatMap((row) => {
    const sent = toSent(row);
    if (!sent) console.warn('[mentions] 읽을 수 없는 줄을 건너뛴다:', row);
    return sent ? [sent] : [];
  });

const eq = (value: string): string => `eq.${encodeURIComponent(value)}`;

/** 이 글이 보낸 것 전부. **못 읽으면 `null`** — 위에 적은 이유다. */
export async function sentForPost(
  postId: string,
): Promise<SentMention[] | null> {
  const rows = await restRead({
    table: TABLE,
    query: `?select=*&post_id=${eq(postId)}`,
    init: { cache: 'no-store' },
    label: LABEL,
  });
  return rows === null ? null : toSentList(rows);
}

/** 관리자 화면이 한 번에 보여 주는 최대 줄 수. */
export const SENT_PAGE_SIZE = 100;

/** 최근에 보낸 것. 화면에 세울 뿐이라 못 읽으면 빈 목록이다. */
export async function recentSent(): Promise<SentMention[]> {
  const rows = await restRead({
    table: TABLE,
    query: `?select=*&order=sent_at.desc&limit=${SENT_PAGE_SIZE}`,
    init: { cache: 'no-store' },
    label: LABEL,
  });
  return rows === null ? [] : toSentList(rows);
}

/** 실패 이유의 한도. 남의 서버가 돌려준 글자가 섞이는 칸이다. */
const DETAIL_MAX = 200;

/**
 * 보낸 결과를 적는다 — 같은 글 · 같은 주소면 **덮어쓴다.**
 *
 * 다시 보낸 결과가 옛 줄 옆에 쌓이면 "이 주소에 보냈나?"의 답이 둘이 된다.
 */
export const recordSent = (
  sent: Omit<SentMention, 'sentAt'>,
  now: number = Date.now(),
): Promise<WriteResult> =>
  restWrite({
    table: TABLE,
    query: '?on_conflict=post_id,target_url',
    init: {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        post_id: sent.postId,
        target_url: sent.targetUrl,
        source_url: sent.sourceUrl,
        via: sent.via,
        endpoint: sent.endpoint,
        status: sent.status,
        detail: sent.detail.slice(0, DETAIL_MAX),
        sent_at: new Date(now).toISOString(),
      }),
    },
    label: LABEL,
  });

/** 본문에서 빠진 링크의 기록을 지운다. */
export const forgetSent = (
  postId: string,
  targetUrl: string,
): Promise<WriteResult> =>
  restWrite({
    table: TABLE,
    query: `?post_id=${eq(postId)}&target_url=${eq(targetUrl)}`,
    init: { method: 'DELETE' },
    label: LABEL,
  });

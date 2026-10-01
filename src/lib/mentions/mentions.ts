import 'server-only';

/**
 * 받은 멘션 — 읽기와 쓰기 (IDE-046)
 *
 * 댓글(`lib/comments/comments.ts`)의 형제 모듈이고 규약도 같다 — **읽기는 절대
 * 던지지 않고 쓰기는 실패를 감추지 않는다.** 화면에 서는 것은 승인된 것뿐이고,
 * 거르기는 SQL 에 맡긴다.
 *
 * ## 댓글과 다른 점: 같은 것이 다시 온다
 *
 * 댓글은 한 번 쓰면 끝이다. 멘션은 **보낸 쪽이 글을 고치면 같은 멘션을 다시
 * 보내는 것이 규약**이라, 이미 있는 줄을 찾아 고치거나(제목이 바뀌었다) 지우는
 * (링크를 뺐다) 길이 있어야 한다. 그래서 "이 출처 · 이 대상의 줄"을 묻는
 * 읽기가 하나 더 있고(`mentionFrom`), 그 읽기만은 **못 읽은 것과 없는 것을
 * 가른다** — 못 읽었는데 없는 줄 알고 새로 넣으면 같은 멘션이 겹친다.
 */
import {
  RENDER_REVALIDATE_S,
  restRead,
  restWrite,
  type WriteResult,
} from '@/lib/supabase/rest';
import type { MentionVia } from './discover';
import type { MentionKind, MentionTarget } from './target';

export type { WriteResult };

export type Mention = {
  id: string;
  kind: MentionKind;
  targetId: string;
  /** 우리를 가리킨 글. 앱이 직접 가서 링크를 확인한 주소다. */
  sourceUrl: string;
  sourceHost: string;
  /** 글자 그대로다 — 그리는 쪽이 서식을 해석하지 않는다. 비어 있을 수 있다. */
  title: string;
  excerpt: string;
  via: MentionVia;
  /** 사람이 승인한 시각(epoch ms). `null` 이면 대기 — 세상에 없는 멘션이다. */
  approvedAt: number | null;
  createdAt: number;
};

const TABLE = 'mentions';
const LABEL = 'mentions';

/** 대상 하나의 멘션 캐시 태그. 댓글의 `commentsTag` 와 같은 이유로 대상마다 따로다. */
export const mentionsTag = (kind: MentionKind, targetId: string): string =>
  `mentions:${kind}:${targetId}`;

export { RENDER_REVALIDATE_S };

/** 메뉴의 대기 숫자가 세는 한도. 댓글과 같은 값이라 메뉴가 한도를 하나만 안다. */
export const PENDING_COUNT_CAP = 99;

/**
 * 한 호스트가 대기 줄에 세워 둘 수 있는 개수.
 *
 * 승인제라 세상에 나가지는 않지만, 막지 않으면 한 곳이 표와 관리자 화면을
 * 채운다. 진짜 블로그가 우리 글 열 편을 한꺼번에 가리키는 일은 드물다.
 */
export const HOST_PENDING_LIMIT = 10;

/** 대기 줄 전체의 한도. 호스트를 바꿔 가며 보내는 것까지 여기서 멈춘다. */
export const PENDING_LIMIT = 200;

// ── 줄 읽기 ─────────────────────────────────────────────────────────

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const instant = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

const isKind = (value: unknown): value is MentionKind =>
  value === 'game' || value === 'post';

const isVia = (value: unknown): value is MentionVia =>
  value === 'webmention' || value === 'pingback';

/**
 * 한 줄을 `Mention` 으로. 못 읽으면 `null` 이고 부르는 쪽이 건너뛴다.
 *
 * 출처 주소는 **웹 주소여야 한다.** 화면이 이 값을 그대로 `href` 에 쓰는데,
 * React 는 `javascript:` 를 막아 주지 않는다. 담을 때 이미 걸렀지만(`receive.ts`)
 * 읽을 때 한 번 더 본다 — DB 에 손으로 넣은 줄까지 믿지는 않는다.
 */
export function toMention(row: unknown): Mention | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;

  const id = text(r.id);
  const targetId = text(r.target_id);
  const sourceUrl = text(r.source_url);
  if (!id || !isKind(r.target_kind) || !targetId || !isVia(r.via)) return null;
  if (!/^https?:\/\//i.test(sourceUrl)) return null;

  return {
    id,
    kind: r.target_kind,
    targetId,
    sourceUrl,
    sourceHost: text(r.source_host),
    title: text(r.title),
    excerpt: text(r.excerpt),
    via: r.via,
    approvedAt: instant(r.approved_at),
    createdAt: instant(r.created_at) ?? 0,
  };
}

export function toMentions(rows: unknown): Mention[] {
  if (!Array.isArray(rows)) return [];
  const mentions: Mention[] = [];
  for (const row of rows) {
    const mention = toMention(row);
    if (mention) mentions.push(mention);
    else console.warn('[mentions] 읽을 수 없는 줄을 건너뛴다:', row);
  }
  return mentions;
}

export const isApproved = (mention: Mention): boolean =>
  mention.approvedAt !== null;

const eq = (value: string): string => `eq.${encodeURIComponent(value)}`;

const targetFilter = (target: MentionTarget): string =>
  `target_kind=${eq(target.kind)}&target_id=${eq(target.targetId)}`;

// ── 렌더 경로 ───────────────────────────────────────────────────────

/**
 * 화면에 세울 멘션 — **승인된 것만, 오래된 순으로.** 못 읽으면 빈 목록이다.
 *
 * 댓글의 `approvedComments` 와 판박이다. 대기 중인 줄은 페이지를 그리는
 * 서버까지도 오지 않는다.
 */
export async function approvedMentions(
  kind: MentionKind,
  targetId: string,
): Promise<Mention[]> {
  return toMentions(
    await restRead({
      table: TABLE,
      query:
        `?select=*&${targetFilter({ kind, targetId })}` +
        '&approved_at=not.is.null&order=created_at.asc',
      init: {
        next: {
          revalidate: RENDER_REVALIDATE_S,
          tags: [mentionsTag(kind, targetId)],
        },
      },
      label: LABEL,
    }),
  );
}

// ── 관리자 경로 ─────────────────────────────────────────────────────

/** 관리자 목록이 한 번에 보여 주는 최대 줄 수. */
export const ADMIN_PAGE_SIZE = 200;

/** 대기와 승인을 한 번에, 최근 순으로. 화면이 가른다(댓글과 같은 이유다). */
export async function allMentions(): Promise<Mention[]> {
  return toMentions(
    await restRead({
      table: TABLE,
      query: `?select=*&order=created_at.desc&limit=${ADMIN_PAGE_SIZE}`,
      init: { cache: 'no-store' },
      label: LABEL,
    }),
  );
}

/** 검토를 기다리는 멘션 수 — 관리자 메뉴의 숫자다. 못 읽으면 `0`. */
export async function pendingMentionCount(): Promise<number> {
  const rows = await restRead({
    table: TABLE,
    query: `?select=id&approved_at=is.null&limit=${PENDING_COUNT_CAP + 1}`,
    init: { cache: 'no-store' },
    label: LABEL,
  });
  return rows?.length ?? 0;
}

// ── 받는 경로 ───────────────────────────────────────────────────────

/**
 * 이 출처가 이 대상에 이미 건 멘션.
 *
 * 돌려주는 것이 셋으로 갈린다 — 줄 · `null`(없다) · **`undefined`(못 읽었다).**
 * 다른 읽기처럼 실패를 "없다"로 삼키면, 저장소가 흔들리는 동안 온 멘션이 전부
 * 새 줄로 들어가려다 겹친다. 받는 쪽은 `undefined` 면 받지 않고 물러난다.
 */
export async function mentionFrom(
  sourceUrl: string,
  target: MentionTarget,
): Promise<Mention | null | undefined> {
  const rows = await restRead({
    table: TABLE,
    query: `?select=*&source_url=${eq(sourceUrl)}&${targetFilter(target)}&limit=1`,
    init: { cache: 'no-store' },
    label: LABEL,
  });
  if (rows === null) return undefined;
  return toMentions(rows)[0] ?? null;
}

/**
 * 대기 줄에 자리가 있나 — 이 호스트 몫과 전체 몫을 한 번에 본다.
 *
 * `select=id` 로 본문을 받지 않는다. 못 읽으면 **자리가 없는 것**으로 친다 —
 * 여기서 "있다"로 틀리면 한도가 없는 것과 같아진다.
 */
export async function hasPendingRoom(sourceHost: string): Promise<boolean> {
  const count = async (filter: string, limit: number) => {
    const rows = await restRead({
      table: TABLE,
      query: `?select=id&approved_at=is.null${filter}&limit=${limit}`,
      init: { cache: 'no-store' },
      label: LABEL,
    });
    return rows === null ? Infinity : rows.length;
  };

  const [fromHost, total] = await Promise.all([
    count(`&source_host=${eq(sourceHost)}`, HOST_PENDING_LIMIT),
    count('', PENDING_LIMIT),
  ]);
  return fromHost < HOST_PENDING_LIMIT && total < PENDING_LIMIT;
}

// ── 쓰기 ────────────────────────────────────────────────────────────

export type MentionDraft = MentionTarget & {
  sourceUrl: string;
  sourceHost: string;
  title: string;
  excerpt: string;
  via: MentionVia;
};

const write = (query: string, init: RequestInit): Promise<WriteResult> =>
  restWrite({ table: TABLE, query, init, label: LABEL });

/** 새 멘션. **`approved_at` 을 보내지 않는다** — 비어 있는 것이 대기다(댓글과 같다). */
export const createMention = (
  draft: MentionDraft,
  id: string = crypto.randomUUID(),
): Promise<WriteResult> =>
  write('', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id,
      target_kind: draft.kind,
      target_id: draft.targetId,
      source_url: draft.sourceUrl,
      source_host: draft.sourceHost,
      title: draft.title,
      excerpt: draft.excerpt,
      via: draft.via,
    }),
  });

/**
 * 다시 온 멘션으로 고친다 — **승인이 풀린다.**
 *
 * 승인은 "이 제목 · 이 발췌를 세워도 된다"였다. 내용이 바뀌었는데 승인을 그대로
 * 두면, 멀쩡한 글로 승인받은 뒤 광고로 바꿔 다시 보내는 길이 열린다.
 */
export const reviseMention = (
  id: string,
  next: Pick<MentionDraft, 'title' | 'excerpt' | 'via'>,
  now: number = Date.now(),
): Promise<WriteResult> =>
  write(`?id=${eq(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: next.title,
      excerpt: next.excerpt,
      via: next.via,
      approved_at: null,
      updated_at: new Date(now).toISOString(),
    }),
  });

/** 승인 · 승인 취소. 취소하면 대기로 돌아간다 — 내리는 스위치를 따로 두지 않는다. */
export const setMentionApproved = (
  id: string,
  approved: boolean,
  now: number = Date.now(),
): Promise<WriteResult> =>
  write(`?id=${eq(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      approved_at: approved ? new Date(now).toISOString() : null,
    }),
  });

/** 스팸이거나, 보낸 쪽이 링크를 거뒀다. 남겨서 배울 것이 없다. */
export const deleteMention = (id: string): Promise<WriteResult> =>
  write(`?id=${eq(id)}`, { method: 'DELETE' });

import 'server-only';

/**
 * 댓글 — 읽기와 쓰기 (IDE-029)
 *
 * 값은 `IDE-013` 이 세운 `daddys_craft` 스키마에 있고, 두드리는 방식은
 * `supabase/rest.ts` 가 맡는다. 공방 일지(`lib/blog/posts.ts`)와 형제 모듈이고,
 * 규약도 대부분 같다 — **읽기는 절대 던지지 않고 쓰기는 실패를 감추지 않는다.**
 *
 * ## 글과 다른 점 하나: 못 읽으면 "댓글이 없다"
 *
 * 글은 DB 가 유일한 원본이라 못 읽는 것이 곧 사고였다. 댓글은 **곁붙이**다 —
 * Supabase 가 꺼져 있어도 게임 화면과 글은 그대로 서야 하고, 그때 비는 것은
 * 댓글 칸뿐이다. 그래서 읽기 실패를 빈 목록으로 삼킨다.
 *
 * 다만 **쓰기 실패는 반드시 사람에게 보인다.** 댓글이 조용히 사라지면 쓴 사람은
 * 승인을 기다리는 줄 알고 며칠을 기다린다.
 *
 * ## 대상마다 따로 묻는다 (글 목록과 반대다)
 *
 * `posts.ts` 는 표를 통째로 받아 화면이 고른다 — 글이 수십 편 규모이고 캐시
 * 항목을 하나로 두는 값이 있었다. 댓글은 **대상 수 × 사람 수**로 늘어나므로
 * 통째로 받으면 게임 하나를 열 때 사이트 전체의 댓글이 따라온다. 그래서 대상별로
 * 묻고, 캐시 태그도 대상별로 둔다(`commentsTag`).
 */
import {
  RENDER_REVALIDATE_S,
  restRead,
  restWrite,
  type WriteResult,
} from '@/lib/supabase/rest';
import type { CommentKind } from './input';

export type { WriteResult };

/**
 * 댓글이 붙는 곳. 주인은 `input.ts` 다 — 브라우저도 이 타입을 쓴다.
 *
 * 여기서 다시 내보내는 것은 담는 코드를 읽는 사람이 타입을 찾아 두 파일을
 * 오가지 않게 하려는 것이다.
 */
export type { CommentKind } from './input';

export type Comment = {
  id: string;
  kind: CommentKind;
  targetId: string;
  nickname: string;
  /** 글자 그대로다. 마크다운도 HTML 도 아니다 — 그리는 쪽이 서식을 해석하지 않는다. */
  body: string;
  /** 사람이 승인한 시각(epoch ms). `null` 이면 대기 — 세상에 없는 댓글이다. */
  approvedAt: number | null;
  createdAt: number;
};

const TABLE = 'comments';
const LABEL = 'comments';

/**
 * 대상 하나의 댓글 캐시 태그.
 *
 * 관리자가 승인하면 서버 액션이 **그 대상만** 만료시킨다. 태그 하나로 뭉쳐 두면
 * 댓글 한 개를 승인할 때 사이트의 모든 게임·글 페이지가 함께 다시 그려진다.
 */
export const commentsTag = (kind: CommentKind, targetId: string): string =>
  `comments:${kind}:${targetId}`;

export { RENDER_REVALIDATE_S };

// ── 도배 제한 ───────────────────────────────────────────────────────

/** 개수를 세는 창. 이 시간 안에 쓴 것만 센다. */
export const RATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * 같은 브라우저가 쓸 수 있는 개수.
 *
 * 넉넉하게 잡는다 — 아이와 함께 앉아 번갈아 쓰는 것이 이 사이트에서 있을 법한
 * 일이고, 그때 한 집이 한 브라우저다. 승인제가 이미 문지기라 여기서 막는 것은
 * "표가 스팸으로 차오르는 것"뿐이다.
 */
export const RATE_LIMIT = 5;

// ── 줄 읽기 ─────────────────────────────────────────────────────────

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const instant = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

const isKind = (value: unknown): value is CommentKind =>
  value === 'game' || value === 'post';

/**
 * 한 줄을 `Comment` 로. 못 읽으면 `null` 이고 부르는 쪽이 건너뛴다.
 *
 * **필수는 `id` · `kind` · `targetId` · `body` 넷이다.** 앞의 셋이 없으면 어느
 * 댓글이 어디 달린 것인지 알 수 없고, 본문이 비면 화면에 세울 것이 없다. 이름은
 * 빠져도 괜찮다 — 이름 없이 쓸 수 있는 자리라 빈 값에 뜻이 있다(`input.ts`).
 */
export function toComment(row: unknown): Comment | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;

  const id = text(r.id);
  const targetId = text(r.target_id);
  const body = text(r.body);
  if (!id || !isKind(r.target_kind) || !targetId || !body) return null;

  return {
    id,
    kind: r.target_kind,
    targetId,
    nickname: text(r.nickname),
    body,
    approvedAt: instant(r.approved_at),
    createdAt: instant(r.created_at) ?? 0,
  };
}

export function toComments(rows: unknown): Comment[] {
  if (!Array.isArray(rows)) return [];
  const comments: Comment[] = [];
  for (const row of rows) {
    const comment = toComment(row);
    if (comment) comments.push(comment);
    else console.warn('[comments] 읽을 수 없는 줄을 건너뛴다:', row);
  }
  return comments;
}

/** 승인됐나. 판정이 한 곳에 있어야 화면과 문지기가 어긋나지 않는다. */
export const isApproved = (comment: Comment): boolean =>
  comment.approvedAt !== null;

/** 절대 던지지 않는다. 닿지 못하면 빈 목록 = 댓글이 없다. */
const fetchComments = async (
  init: RequestInit,
  query: string,
): Promise<Comment[]> =>
  toComments(await restRead({ table: TABLE, query, init, label: LABEL }));

const eq = (value: string): string => `eq.${encodeURIComponent(value)}`;

const targetFilter = (kind: CommentKind, targetId: string): string =>
  `target_kind=${eq(kind)}&target_id=${eq(targetId)}`;

// ── 렌더 경로 ───────────────────────────────────────────────────────

/**
 * 화면에 세울 댓글 — **승인된 것만, 오래된 순으로.**
 *
 * 거르기를 SQL 쪽(`approved_at=not.is.null`)에 맡긴다. 받아 놓고 앱에서 거르면
 * 대기 중인 댓글의 본문이 **페이지를 그리는 서버까지** 넘어오고, 그 값은 언젠가
 * 누군가 실수로 화면에 흘린다. 아예 안 받는 편이 단단하다.
 *
 * 오래된 순인 것은 댓글이 대화라서다 — 위에서 아래로 읽으면 주고받은 순서가
 * 그대로 남는다.
 *
 * `next.revalidate` 를 달아 **페이지가 정적인 채로** 60초마다 다시 그려진다
 * (`posts.ts` 와 같다). 승인하면 서버 액션이 태그로 곧장 깨운다.
 */
export const approvedComments = (
  kind: CommentKind,
  targetId: string,
): Promise<Comment[]> =>
  fetchComments(
    {
      next: {
        revalidate: RENDER_REVALIDATE_S,
        tags: [commentsTag(kind, targetId)],
      },
    },
    `?select=*&${targetFilter(kind, targetId)}` +
      '&approved_at=not.is.null&order=created_at.asc',
  );

// ── 관리자 경로 ─────────────────────────────────────────────────────
// 방금 승인한 값이 보여야 하는 화면이라 캐시를 타지 않는다.

/** 관리자 목록이 한 번에 보여 주는 최대 줄 수. */
export const ADMIN_PAGE_SIZE = 200;

/**
 * 대기 중인 것부터, 그다음 승인된 것.
 *
 * 한 번에 읽고 화면이 가른다 — 두 번 물으면 "대기 0개, 승인 200개"처럼 한쪽만
 * 잘린 목록이 나오고 그 사실이 화면에 안 보인다.
 *
 * 최근 순이다. 관리자가 여는 이유는 **방금 들어온 것을 처분하는 것**이라
 * 화면(오래된 순)과 순서를 일부러 반대로 둔다.
 */
export const allComments = (): Promise<Comment[]> =>
  fetchComments(
    { cache: 'no-store' },
    `?select=*&order=created_at.desc&limit=${ADMIN_PAGE_SIZE}`,
  );

// ── 도배 제한 ───────────────────────────────────────────────────────

/**
 * 이 브라우저가 최근 창 안에 쓴 개수.
 *
 * 해시가 없으면(비밀값이 없는 환경) **제한하지 않는다** — `0` 을 돌려준다.
 * 로컬과 CI 가 키 없이 돌아야 한다는 약속을 여기서도 지킨다.
 *
 * 못 읽었을 때도 `0` 이다. 읽기가 실패했다고 댓글 쓰기를 막으면, Supabase 가
 * 잠깐 흔들릴 때 아무도 댓글을 못 쓰게 된다 — 막아서 얻는 것(표가 덜 더러워짐)
 * 보다 잃는 것이 크다.
 *
 * `select=id` 로 **본문을 받지 않는다.** 세는 데 필요한 것은 줄의 존재뿐이고,
 * 남이 쓴 본문을 세기 위해 서버로 끌어올 이유가 없다.
 */
export async function recentCommentCount(
  visitorHash: string | null,
  now: number = Date.now(),
): Promise<number> {
  if (!visitorHash) return 0;

  const since = new Date(now - RATE_WINDOW_MS).toISOString();
  const rows = await restRead({
    table: TABLE,
    query:
      `?select=id&visitor_hash=${eq(visitorHash)}` +
      `&created_at=gte.${encodeURIComponent(since)}&limit=${RATE_LIMIT + 1}`,
    init: { cache: 'no-store' },
    label: LABEL,
  });
  return rows?.length ?? 0;
}

// ── 쓰기 ────────────────────────────────────────────────────────────
// 읽기와 달리 실패를 감추지 않는다 — 조용히 사라진 댓글은 쓴 사람이 승인을
// 기다리는 것으로 오해한다.

export type CommentDraft = {
  kind: CommentKind;
  targetId: string;
  nickname: string;
  body: string;
  /** 도배 제한에만 쓴다. 비밀값이 없는 환경에서는 `null`. */
  visitorHash: string | null;
};

const write = (query: string, init: RequestInit): Promise<WriteResult> =>
  restWrite({ table: TABLE, query, init, label: LABEL });

/**
 * 새 댓글. **`approved_at` 을 보내지 않는다** — 비어 있는 것이 대기다.
 *
 * 보내지 않는 것이 `null` 을 보내는 것보다 낫다. 언젠가 표의 기본값이 바뀌어도
 * 이 코드가 그것을 덮어쓰지 않고, 무엇보다 **여기 승인 칸이 아예 없다**는 것이
 * 읽는 사람에게 분명하다.
 */
export const createComment = (
  draft: CommentDraft,
  id: string = crypto.randomUUID(),
): Promise<WriteResult> =>
  write('', {
    method: 'POST',
    body: JSON.stringify({
      id,
      target_kind: draft.kind,
      target_id: draft.targetId,
      nickname: draft.nickname,
      body: draft.body,
      visitor_hash: draft.visitorHash,
    }),
  });

/**
 * 승인 · 승인 취소.
 *
 * 취소는 `approved_at` 을 비우는 것이고, 그러면 **대기로 돌아간다.** 내리는
 * 스위치를 따로 두지 않은 이유는 009 에 적었다 — 뜻이 겹치는 스위치가 둘이면
 * 급할 때 어느 것을 눌러야 하는지 헷갈린다.
 */
export const setCommentApproved = (
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

/** 스팸은 지운다. 승인제라 세상에 나가지 않았고, 남겨서 배울 것이 없다. */
export const deleteComment = (id: string): Promise<WriteResult> =>
  write(`?id=${eq(id)}`, { method: 'DELETE' });

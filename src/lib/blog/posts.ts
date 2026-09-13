import 'server-only';

/**
 * 공방 일지 글 — 읽기와 쓰기 (IDE-023)
 *
 * 값은 `IDE-013` 이 세운 `daddys_craft` 스키마에 있고, 두드리는 방식은
 * `supabase/rest.ts` 가, 시각 판정은 `lib/kst.ts` 가 맡는다. 예약 게시는
 * `IDE-022` 의 예약 공개와 같은 문제라 규약을 나눠 쓴다.
 *
 * ## 없을 때의 뜻이 예약 공개와 반대다
 *
 * 게임은 도안이 코드에 있어서 `game_release` 가 비어도 다섯 개가 그대로
 * 나온다 — 그래서 "줄이 없으면 열려 있다"였다. **글은 여기가 유일한 원본이라
 * 그 규칙을 그대로 옮기면 안 된다.** 닿지 못하면 **글이 하나도 없는 것**으로
 * 읽는다. 그래야 Supabase 를 꺼도 사이트가 그대로 뜨고(글 자리만 빈다),
 * 무엇보다 사고 한 번에 안 낸 글이 세상에 나가지 않는다.
 *
 * 같은 이유로 `publish_at` 이 비어 있으면 **초안**이다. 게임에서는 그것이
 * "예약 없음 = 지금 공개"였다.
 */
import {
  REQUEST_TTL_MS,
  RENDER_REVALIDATE_S,
  restRead,
  restWrite,
  type WriteResult,
} from '@/lib/supabase/rest';
import { toDoc, type Doc } from './doc';
import { markdownToDoc } from './fromMarkdown';

export type { WriteResult };

export type Post = {
  id: string;
  /** `/blog/<slug>`. DB 가 겹침을 막는다. */
  slug: string;
  title: string;
  /** 목록 발췌이자 OG 설명. 비어 있으면 본문 앞머리로 대신한다. */
  summary: string;
  /**
   * 본문 문서 (IDE-028). 편집기가 만들고 `DocView` 가 그린다.
   *
   * 담긴 것이 없으면 `body` 의 마크다운을 옮겨서 채운다 — `IDE-023` 때 쓴 글이
   * 그대로 열려야 한다.
   */
  doc: Doc;
  /**
   * 마크다운 원문 (IDE-023).
   *
   * 편집기가 붙은 뒤로는 **읽기만 한다.** 지우지 않는 것은 옮기기가 잘못됐을 때
   * 돌아갈 데를 남겨 두기 위해서다.
   */
  body: string;
  coverUrl: string | null;
  /** 이 순간부터 열린다(epoch ms). `null` 이면 아직 안 낸 글이다. */
  publishAt: number | null;
  /** 켜져 있으면 **게시 시각과 무관하게** 안 보인다. */
  hidden: boolean;
  createdAt: number;
  updatedAt: number;
};

const TABLE = 'posts';
const LABEL = 'blog';

/** 목록·글 화면이 쓰는 캐시 태그. 관리자가 저장하면 서버 액션이 만료시킨다. */
export const POSTS_TAG = 'blog-posts';

export { RENDER_REVALIDATE_S };

// ── 줄 읽기 ─────────────────────────────────────────────────────────

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const instant = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * 한 줄을 `Post` 로. 못 읽으면 `null` 이고 부르는 쪽이 건너뛴다.
 *
 * `id` 와 `slug` 만 필수다 — 그 둘이 없으면 어느 글인지도 어디로 여는지도
 * 알 수 없어 화면에 세울 수가 없다. 나머지는 빈 값으로 떨어뜨린다.
 */
export function toPost(row: unknown): Post | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;

  const id = text(r.id);
  const slug = text(r.slug);
  if (!id || !slug) return null;

  const body = text(r.body);

  return {
    id,
    slug,
    title: text(r.title) || '(제목 없음)',
    summary: text(r.summary),
    // 문서 칸이 비어 있으면 마크다운을 옮겨서 읽는다. 한 번 저장하면 채워진다.
    doc: r.doc == null ? markdownToDoc(body) : toDoc(r.doc),
    body,
    coverUrl: text(r.cover_url) || null,
    publishAt: instant(r.publish_at),
    hidden: r.hidden === true,
    createdAt: instant(r.created_at) ?? 0,
    updatedAt: instant(r.updated_at) ?? 0,
  };
}

export function toPosts(rows: unknown): Post[] {
  if (!Array.isArray(rows)) return [];
  const posts: Post[] = [];
  for (const row of rows) {
    const post = toPost(row);
    if (post) posts.push(post);
    else console.warn('[blog] 읽을 수 없는 줄을 건너뛴다:', row);
  }
  return posts;
}

/** 낸 글을 최근 순으로. 게시 시각이 같으면 나중에 만든 것이 위다. */
const byNewest = (a: Post, b: Post): number =>
  (b.publishAt ?? b.createdAt) - (a.publishAt ?? a.createdAt);

/** 절대 던지지 않는다. 닿지 못하면 빈 목록 = 글이 없다. */
const fetchPosts = async (init: RequestInit, query = ''): Promise<Post[]> =>
  toPosts(await restRead({ table: TABLE, query, init, label: LABEL }));

// ── 지금 열려 있나 ──────────────────────────────────────────────────

/**
 * 게시 판정에 필요한 두 칸.
 *
 * `Post` 전체를 요구하지 않는다 — **문지기는 본문도 제목도 안 읽는다.** 판정
 * 규칙은 한 곳(`isPublished`)에 있어야 하는데, 그 함수가 `Post` 를 요구하면
 * 문지기 쪽이 규칙을 베껴 쓰게 되고 언젠가 둘이 어긋난다.
 */
export type Publishable = Pick<Post, 'publishAt' | 'hidden'>;

/**
 * `IDE-022` 의 `isOpen` 과 같은 규칙이되 기본값이 반대다.
 *
 * - 내림 스위치가 **날짜를 이긴다** — 급히 내린 조작이 지난 시각에 지면 안 된다.
 * - 게시 시각은 **그 순간부터** 열린다(`<=`). `<` 로 두면 "0시에 낸다"가
 *   0시 0분 0초 001밀리초가 된다.
 * - 게시 시각이 **없으면 안 낸 글이다.** 게임과 다른 유일한 칸이다.
 */
export const isPublished = (
  post: Publishable,
  now: number = Date.now(),
): boolean => !post.hidden && post.publishAt !== null && post.publishAt <= now;

// ── 렌더 경로 ───────────────────────────────────────────────────────

/**
 * 목록과 글 화면이 함께 쓰는 한 번의 읽기.
 *
 * 글이 수십 편 규모라 통째로 받아 화면이 고른다. 슬러그마다 따로 물으면 캐시
 * 항목이 글 수만큼 늘고, 관리자가 한 편을 고칠 때 어느 것을 만료시킬지를 또
 * 관리해야 한다 — 태그 하나로 끝내는 편이 낫다.
 *
 * `next.revalidate` 를 달아 **페이지가 정적인 채로** 60초마다 다시 그려진다.
 * 옵션 없이 부르면 `no-store` 로 잡혀 목록이 매 요청 서버 렌더가 된다.
 */
const postsForRender = (): Promise<Post[]> =>
  fetchPosts(
    { next: { revalidate: RENDER_REVALIDATE_S, tags: [POSTS_TAG] } },
    '?select=*',
  );

/** 공개 목록. 안 낸 글과 내려 둔 글은 여기 없다. */
export async function publishedPosts(
  now: number = Date.now(),
): Promise<Post[]> {
  const posts = await postsForRender();
  return posts.filter((post) => isPublished(post, now)).sort(byNewest);
}

/**
 * 글 하나.
 *
 * **안 낸 글도 돌려준다** — 관리자 미리보기(`/admin/posts/<id>/preview`)와
 * 편집 화면이 그것을 쓴다. 대신 **공개 화면은 부른 쪽에서 한 번 더 거른다**
 * (`blog/[slug]/page.tsx` 의 `openPost`). 목록도 `sitemap` 도 홈의 최근 글도
 * `publishedPosts` 만 보므로, 안 낸 글의 주소는 관리자 화면 밖에 존재하지 않는다.
 */
export async function postBySlug(slug: string): Promise<Post | null> {
  const posts = await postsForRender();
  return posts.find((post) => post.slug === slug) ?? null;
}

// ── 요청 경로(문지기) ───────────────────────────────────────────────

/**
 * 문지기가 보는 값 — 슬러그와 열림 여부뿐이다.
 *
 * 프록시에서는 Next 의 캐시 옵션이 통하지 않아 인스턴스 메모리에 30초만 들고
 * 있는다. 본문까지 받아 오면 30초마다 글 전체가 프록시로 흘러 들어오므로
 * 여기서는 칸을 세 개만 고른다.
 */
let memo: { until: number; slugs: ReadonlySet<string> } | null = null;
let inFlight: Promise<ReadonlySet<string>> | null = null;

/** 문지기가 읽는 칸 세 개. `id` 도 제목도 없다. */
const GATE_COLUMNS = '?select=slug,publish_at,hidden';

/**
 * 문지기용 줄 파서. **`toPost` 를 쓰지 않는다.**
 *
 * 처음에는 `toPost` 를 재사용했는데, 그 함수가 `id` 를 필수로 보는 바람에
 * 위 질의로 받은 줄이 **한 줄도 남김없이 버려졌다** — 열린 슬러그 집합이 늘
 * 비어서 낸 글까지 전부 404 가 됐다(2026-09-09). 테스트의 fetch 대역이 질의
 * 문자열을 무시하고 `id` 가 든 줄을 돌려주고 있어 잡히지 않았다.
 *
 * 그래서 **읽는 칸과 파서를 짝지어 둔다.** 여기서 필요한 것은 슬러그와 판정에
 * 쓸 두 칸뿐이고, 판정 자체는 `isPublished` 하나가 계속 맡는다.
 */
function toGateRow(row: unknown): (Publishable & { slug: string }) | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const slug = text(r.slug);
  if (!slug) return null;
  return { slug, publishAt: instant(r.publish_at), hidden: r.hidden === true };
}

async function readOpenSlugs(now: number): Promise<ReadonlySet<string>> {
  const rows = await restRead({
    table: TABLE,
    query: GATE_COLUMNS,
    init: { cache: 'no-store' },
    label: LABEL,
  });

  const slugs = new Set<string>();
  if (!Array.isArray(rows)) return slugs;
  for (const row of rows) {
    const parsed = toGateRow(row);
    if (!parsed) console.warn('[blog] 읽을 수 없는 줄을 건너뛴다:', row);
    else if (isPublished(parsed, now)) slugs.add(parsed.slug);
  }
  return slugs;
}

export async function openSlugsForRequest(
  now: number = Date.now(),
): Promise<ReadonlySet<string>> {
  if (memo && memo.until > now) return memo.slugs;
  if (!inFlight) {
    inFlight = readOpenSlugs(now)
      .then((slugs) => {
        memo = { until: Date.now() + REQUEST_TTL_MS, slugs };
        return slugs;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** 방금 쓴 값을 이 인스턴스가 30초 동안 못 보는 일이 없게 한다. */
export const forgetPosts = (): void => {
  memo = null;
};

// ── 관리자 경로 ─────────────────────────────────────────────────────
// 방금 저장한 값이 보여야 하는 화면이라 캐시를 타지 않는다.

/** 안 낸 글까지 전부. 최근에 손댄 것이 위다. */
export async function allPosts(): Promise<Post[]> {
  const posts = await fetchPosts({ cache: 'no-store' }, '?select=*');
  return posts.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function postById(id: string): Promise<Post | null> {
  const posts = await fetchPosts(
    { cache: 'no-store' },
    `?select=*&id=eq.${encodeURIComponent(id)}`,
  );
  return posts[0] ?? null;
}

// ── 쓰기 ────────────────────────────────────────────────────────────
// 읽기와 달리 실패를 감추지 않는다 — 저장이 조용히 실패하면 쓴 글이 날아간다.

/** 저장할 때 사람이 정하는 칸. `id` 와 시각 칸은 여기가 아니라 아래가 채운다. */
export type PostDraft = {
  slug: string;
  title: string;
  summary: string;
  doc: Doc;
  coverUrl: string | null;
  publishAt: number | null;
  hidden: boolean;
};

const iso = (ms: number | null): string | null =>
  ms === null ? null : new Date(ms).toISOString();

const columns = (draft: PostDraft) => ({
  slug: draft.slug,
  title: draft.title,
  summary: draft.summary,
  // `body` 는 건드리지 않는다 — 마크다운 원문은 옮기기 전의 모습으로 남는다.
  doc: draft.doc,
  cover_url: draft.coverUrl,
  publish_at: iso(draft.publishAt),
  hidden: draft.hidden,
  updated_at: new Date().toISOString(),
});

/**
 * 슬러그가 겹쳤다는 것을 사람 말로 바꾼다.
 *
 * PostgREST 는 unique 위반을 `23505` 로 돌려준다. 그대로 두면 화면에
 * "저장하지 못했습니다 (409)" 가 떠서, **무엇을 고쳐야 하는지가 안 보인다.**
 */
const explainWrite = (status: number, body: string): string | undefined =>
  status === 409 || body.includes('23505')
    ? '같은 주소를 쓰는 글이 이미 있습니다. 주소를 바꾸세요.'
    : undefined;

const write = async (
  query: string,
  init: RequestInit,
): Promise<WriteResult> => {
  const result = await restWrite({
    table: TABLE,
    query,
    init,
    label: LABEL,
    explain: explainWrite,
  });
  // 성공했든 아니든 메모를 버린다 — 실패한 줄 알았는데 들어간 경우까지 30초
  // 동안 옛 값을 보여 주지 않는다.
  forgetPosts();
  return result;
};

/** 새 글. `id` 는 앱이 만든다(표에 DB 기본값을 걸지 않았다 — 007 참고). */
export const createPost = (
  draft: PostDraft,
  id: string = crypto.randomUUID(),
): Promise<WriteResult> =>
  write('', {
    method: 'POST',
    body: JSON.stringify({ ...columns(draft), id }),
  });

export const updatePost = (
  id: string,
  draft: PostDraft,
): Promise<WriteResult> =>
  write(`?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(columns(draft)),
  });

/**
 * 지금 당장 내리거나 다시 올린다.
 *
 * 잡아 둔 게시 시각은 그대로 둔다 — `IDE-022` 가 게임에서 정한 그대로다.
 * 한 칸만 보내면 되므로 여기서는 먼저 읽지 않는다(PATCH 는 적은 칸만 바꾼다).
 */
export const setPostHidden = (
  id: string,
  hidden: boolean,
): Promise<WriteResult> =>
  write(`?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ hidden, updated_at: new Date().toISOString() }),
  });

export const deletePost = (id: string): Promise<WriteResult> =>
  write(`?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });

/**
 * 모든 글이 담은 값을 **날것 그대로** 한 덩이 글자로 (IDE-028)
 *
 * 사진 파일을 지워도 되는지 볼 때 쓴다(`lib/blog/cleanup.ts`). 파일 이름이 임의
 * 문자열 32자로 시작해서, 이 덩이에 그 이름이 **한 번이라도** 나오면 누군가 쓰고
 * 있는 것으로 친다 — 문서·옛 마크다운 원문(`body`)·대표 사진 가운데 어디든.
 * 칸마다 따로 뒤지지 않는 것은, 나중에 사진 주소를 담는 칸이 늘어도 여기를 안
 * 고쳐서 **쓰고 있는 사진을 지우는 일**이 없게 하려는 것이다.
 *
 * **못 읽으면 `null` 이다.** 다른 읽기가 실패를 빈 목록으로 삼키는 것과 일부러
 * 다르게 둔다 — 여기서 실패를 "글이 없다"로 읽으면 "아무도 안 쓴다"가 되어, 쓰고
 * 있는 사진까지 지운다.
 */
export async function referencedText(): Promise<string | null> {
  const rows = await restRead({
    table: TABLE,
    query: '?select=doc,body,cover_url',
    init: { cache: 'no-store' },
    label: LABEL,
  });
  return rows === null ? null : JSON.stringify(rows);
}

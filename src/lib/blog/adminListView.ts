/**
 * 공방 일지 어드민 목록의 쪽 나눔 (2026-09-22 사용자 요청)
 *
 * 초안과 발행이 **따로** 쪽을 넘긴다 — 발행 3쪽을 보다가 초안을 넘겼다고
 * 발행이 1쪽으로 돌아가면 안 된다. 그래서 상태 넷이 모두 주소에 있다.
 *
 * 목록 화면과 목록에서 누르는 액션(내리기·지우기)이 같이 쓴다. 액션이 끝나고
 * 돌아올 때 보던 쪽을 잃지 않게.
 */

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export type ListView = {
  draftPage: number;
  draftSize: number;
  pubPage: number;
  pubSize: number;
};

const DEFAULT_VIEW: ListView = {
  draftPage: 1,
  draftSize: DEFAULT_PAGE_SIZE,
  pubPage: 1,
  pubSize: DEFAULT_PAGE_SIZE,
};

const KEYS = Object.keys(DEFAULT_VIEW) as (keyof ListView)[];

/** 1 이상의 정수가 아니면 1쪽. 끝을 넘는 쪽은 `paginate` 가 자른다. */
const readPage = (value: string | null | undefined): number => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

/** 고를 수 있는 크기가 아니면 기본값 — 주소를 고쳐 1000개씩 보게 두지 않는다. */
const readSize = (value: string | null | undefined): number => {
  const size = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(size)
    ? size
    : DEFAULT_PAGE_SIZE;
};

/** 쿼리든 폼이든 `get` 하나로 읽는다. 모르는 값은 기본값이 된다. */
export const readListView = (
  get: (key: keyof ListView) => string | null | undefined,
): ListView => ({
  draftPage: readPage(get('draftPage')),
  draftSize: readSize(get('draftSize')),
  pubPage: readPage(get('pubPage')),
  pubSize: readSize(get('pubSize')),
});

/** 기본값과 다른 칸만 — 처음 들어온 화면의 주소는 `/admin/posts` 그대로다. */
export const listViewParams = (view: ListView): Record<string, string> =>
  Object.fromEntries(
    KEYS.filter((key) => view[key] !== DEFAULT_VIEW[key]).map((key) => [
      key,
      String(view[key]),
    ]),
  );

export const listHref = (
  view: ListView,
  extra: Record<string, string> = {},
): string => {
  const query = new URLSearchParams({ ...listViewParams(view), ...extra });
  return query.size ? `/admin/posts?${query}` : '/admin/posts';
};

/** 쪽이 끝을 넘으면(마지막 글을 지운 뒤 등) 마지막 쪽을 보인다. */
export function paginate<T>(
  items: T[],
  page: number,
  size: number,
): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
  };
}

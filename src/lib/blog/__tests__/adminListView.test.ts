import { describe, expect, it } from 'vitest';
import { listHref, paginate, readListView } from '@/lib/blog/adminListView';

const view = (query: Record<string, string>) =>
  readListView((key) => query[key]);

describe('adminListView', () => {
  it('아무것도 없으면 둘 다 1쪽·10개씩이고 주소는 깨끗하다', () => {
    const initial = view({});
    expect(initial).toEqual({
      draftPage: 1,
      draftSize: 10,
      pubPage: 1,
      pubSize: 10,
    });
    expect(listHref(initial)).toBe('/admin/posts');
  });

  it('고를 수 없는 크기·이상한 쪽은 기본값으로 읽는다', () => {
    expect(
      view({ draftPage: '0', draftSize: '1000', pubPage: '1.5', pubSize: 'x' }),
    ).toEqual({ draftPage: 1, draftSize: 10, pubPage: 1, pubSize: 10 });
  });

  it('기본값이 아닌 칸만 주소에 싣는다', () => {
    expect(
      listHref(view({ pubPage: '2', pubSize: '50' }), { confirm: 'a' }),
    ).toBe('/admin/posts?pubPage=2&pubSize=50&confirm=a');
  });

  it('끝을 넘는 쪽은 마지막 쪽이 된다 — 빈 목록도 1쪽이다', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 9, 10)).toEqual({
      items: [20, 21, 22, 23, 24],
      page: 3,
      pages: 3,
    });
    expect(paginate([], 4, 10)).toEqual({ items: [], page: 1, pages: 1 });
  });
});

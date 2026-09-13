/**
 * 세지 않는 경로 (IDE-013)
 */
import { describe, expect, it } from 'vitest';
import { isExcludedPath } from '../excluded';

describe('isExcludedPath', () => {
  it('관리자 화면과 그 아래는 세지 않는다', () => {
    expect(isExcludedPath('/admin')).toBe(true);
    expect(isExcludedPath('/admin/analytics')).toBe(true);
    expect(isExcludedPath('/admin/login')).toBe(true);
  });

  it('접두어가 겹치는 남의 경로까지 삼키지 않는다', () => {
    expect(isExcludedPath('/administrators')).toBe(false);
    expect(isExcludedPath('/admin-guide')).toBe(false);
  });

  it('평소 경로는 그대로 센다', () => {
    expect(isExcludedPath('/')).toBe(false);
    expect(isExcludedPath('/games/soccer')).toBe(false);
  });

  it('공방 일지는 센다 — 관리자 화면과 달리 사람이 읽으라고 쓴 글이다 (IDE-023)', () => {
    expect(isExcludedPath('/blog')).toBe(false);
    expect(isExcludedPath('/blog/yut-stick-balance')).toBe(false);
    // 글을 쓰는 화면은 `/admin` 아래라 지금까지처럼 빠진다.
    expect(isExcludedPath('/admin/posts')).toBe(true);
  });
});

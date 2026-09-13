/**
 * 글 주소 조각 (IDE-023)
 *
 * 한 번 나가면 바꾸기 어려운 값이라, **같은 입력이 늘 같은 값**이 되는지와
 * **주소에 못 쓸 글자가 남지 않는지**를 지킨다.
 */
import { describe, expect, it } from 'vitest';
import { isValidSlug, toSlug } from '../slug';

describe('toSlug', () => {
  it('영문 제목을 주소로 접는다', () => {
    expect(toSlug('Yut Stick Balance!')).toBe('yut-stick-balance');
  });

  it('이미 슬러그인 값을 다시 넣어도 같다 — 저장할 때마다 주소가 흔들리면 안 된다', () => {
    const once = toSlug('Yut  Stick — Balance');
    expect(toSlug(once)).toBe(once);
  });

  it('한글만 있는 제목에서는 뽑을 것이 없다', () => {
    // 이때는 부르는 쪽이 날짜로 만든다(`admin/posts/actions.ts`).
    expect(toSlug('윷가락 무게중심')).toBe('');
  });

  it('발음 구별 기호를 떼어 낸다', () => {
    expect(toSlug('Café Crème')).toBe('cafe-creme');
  });

  it('앞뒤와 겹치는 붙임표를 정리한다', () => {
    expect(toSlug('--a///b--')).toBe('a-b');
  });

  it('80자에서 끊고 끝에 붙임표를 남기지 않는다', () => {
    const long = toSlug(`${'a'.repeat(79)} bcd`);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('-')).toBe(false);
  });
});

describe('isValidSlug', () => {
  it('접은 결과와 같은 값만 통과한다', () => {
    expect(isValidSlug('yut-stick-balance')).toBe(true);
    expect(isValidSlug('Yut Stick')).toBe(false);
    expect(isValidSlug('윷가락')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
});

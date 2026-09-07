import { describe, expect, it } from 'vitest';
import { issueSession, isValidSession, safeEqual } from '../session';

const PASSWORD = 'a-long-admin-password';
const NOW = new Date('2026-09-07T10:00:00Z');

describe('safeEqual', () => {
  it('같으면 참, 다르면 거짓', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('길이가 달라도 던지지 않는다 — 예외 자체가 길이를 흘린다', () => {
    expect(safeEqual('', PASSWORD)).toBe(false);
    expect(safeEqual('a', PASSWORD)).toBe(false);
    expect(safeEqual(PASSWORD + 'x', PASSWORD)).toBe(false);
  });
});

describe('세션 쿠키', () => {
  it('발급한 쿠키는 그 비밀번호로 통과한다', () => {
    expect(isValidSession(issueSession(PASSWORD, NOW), PASSWORD, NOW)).toBe(
      true,
    );
  });

  it('비밀번호가 바뀌면 이미 나간 쿠키가 전부 무효가 된다', () => {
    expect(
      isValidSession(issueSession(PASSWORD, NOW), '다른비밀번호', NOW),
    ).toBe(false);
  });

  it('만료되면 통과하지 못한다', () => {
    const token = issueSession(PASSWORD, NOW);
    const later = new Date(NOW.getTime() + 13 * 60 * 60 * 1000);
    expect(isValidSession(token, PASSWORD, later)).toBe(false);
  });

  it('서명을 고치거나 만료를 늘리면 걸린다', () => {
    const [expiresAt, signature] = issueSession(PASSWORD, NOW).split('.');
    const far = String(Number(expiresAt) + 86_400_000);
    expect(isValidSession(`${far}.${signature}`, PASSWORD, NOW)).toBe(false);
    expect(isValidSession(`${expiresAt}.deadbeef`, PASSWORD, NOW)).toBe(false);
  });

  it('쿠키가 없거나 모양이 아니면 거짓이다', () => {
    for (const bad of [undefined, null, '', '서명없음', '.', 'abc.def']) {
      expect(isValidSession(bad, PASSWORD, NOW), String(bad)).toBe(false);
    }
  });
});

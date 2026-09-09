import { describe, expect, it } from 'vitest';
import {
  ADMIN_COOKIE,
  LEGACY_NOCOUNT_COOKIE,
  OWNER_COOKIE,
  expiredCookie,
  isOwnerBrowser,
  issueSession,
  isValidSession,
  ownerCookie,
  safeEqual,
  sessionCookie,
} from '../session';

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
    const day = 24 * 60 * 60 * 1000;

    // TTL 은 90일이다(IDE-026 에서 12시간에서 늘렸다).
    expect(
      isValidSession(token, PASSWORD, new Date(NOW.getTime() + 89 * day)),
    ).toBe(true);
    expect(
      isValidSession(token, PASSWORD, new Date(NOW.getTime() + 91 * day)),
    ).toBe(false);
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

describe('주인 표시 쿠키 (IDE-026 · IDE-027)', () => {
  it('사이트 어디에나 실리도록 경로가 / 다', () => {
    // `/admin` 으로 잠그면 수집 API(`/api/...`)에 안 실려 아무 소용이 없다.
    expect(ownerCookie().path).toBe('/');
    expect(ownerCookie().name).toBe(OWNER_COOKIE);
  });

  it('브라우저가 읽을 수 있어야 한다 — 헤더의 관리자 링크가 이걸 본다', () => {
    // 서버가 읽으면 루트 레이아웃이 쿠키를 만져 정적 렌더링이 통째로 깨진다.
    expect(ownerCookie().httpOnly).toBe(false);
    expect(sessionCookie('x').httpOnly).toBe(true);
  });

  it('인증 쿠키는 사이트 전체에 실린다 — 예약 공개 미리보기 때문이다 (IDE-022)', () => {
    // `/admin` 안에만 두면 `/games/...` 와 `/api/games/...` 요청에 안 실려,
    // 관리자가 오픈 전 게임을 실물로 볼 방법이 없다. 자격을 하나 더 만드는
    // 대신 있는 것을 넓혔다 — 둘이 되면 로그아웃이 하나를 빠뜨린다.
    expect(sessionCookie('x').path).toBe('/');
    // 넓혔어도 브라우저가 읽지는 못한다. 그 성질까지 놓치면 안 된다.
    expect(sessionCookie('x').httpOnly).toBe(true);
  });

  it('쿠키가 있으면 세지 않는다', () => {
    expect(isOwnerBrowser(new Headers({ cookie: `${OWNER_COOKIE}=1` }))).toBe(
      true,
    );
  });

  it('옛 이름으로 심긴 브라우저도 계속 알아본다', () => {
    // IDE-026 이 잠깐 쓴 이름이다. 못 알아보면 그 브라우저가 다시 세어진다.
    expect(
      isOwnerBrowser(new Headers({ cookie: `${LEGACY_NOCOUNT_COOKIE}=1` })),
    ).toBe(true);
  });

  it('다른 쿠키에 섞여 있어도 찾는다', () => {
    const headers = new Headers({
      cookie: `theme=dark; ${OWNER_COOKIE}=1; other=2`,
    });
    expect(isOwnerBrowser(headers)).toBe(true);
  });

  it('이름이 겹치는 남의 쿠키에 걸리지 않는다', () => {
    for (const raw of [`x${OWNER_COOKIE}=1`, `${OWNER_COOKIE}x=1`]) {
      expect(isOwnerBrowser(new Headers({ cookie: raw }))).toBe(false);
    }
  });

  it('쿠키가 아예 없으면 센다', () => {
    expect(isOwnerBrowser(new Headers())).toBe(false);
    expect(isOwnerBrowser(new Headers({ cookie: 'theme=dark' }))).toBe(false);
  });
});

describe('지우는 쿠키', () => {
  it('심을 때 쓴 경로를 그대로 준다 — 안 그러면 안 지워진다', () => {
    expect(expiredCookie(ADMIN_COOKIE, '/admin')).toMatchObject({
      name: ADMIN_COOKIE,
      path: '/admin',
      maxAge: 0,
      value: '',
    });
    expect(expiredCookie(OWNER_COOKIE, '/').path).toBe('/');
  });
});

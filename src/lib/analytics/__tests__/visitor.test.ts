import { describe, expect, it } from 'vitest';
import { analyticsDay, clientIp, visitorId } from '../visitor';

const SECRET = 'test-salt-0123456789';
const VISITOR = {
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0 (Macintosh) Chrome/141',
  host: 'daddyscraft.example',
};

describe('analyticsDay', () => {
  it('KST 로 접는다 — UTC 로 어제여도 한국은 오늘이다', () => {
    // 2026-09-07 15:30 UTC = 2026-09-08 00:30 KST
    expect(analyticsDay(new Date('2026-09-07T15:30:00Z'))).toBe('2026-09-08');
    expect(analyticsDay(new Date('2026-09-07T14:30:00Z'))).toBe('2026-09-07');
  });
});

describe('visitorId', () => {
  it('같은 방문자·같은 날이면 같은 값이다 (하루 UV 는 1)', () => {
    expect(visitorId(VISITOR, SECRET, '2026-09-07')).toBe(
      visitorId(VISITOR, SECRET, '2026-09-07'),
    );
  });

  it('날이 바뀌면 같은 방문자라도 새 값이 나온다', () => {
    expect(visitorId(VISITOR, SECRET, '2026-09-07')).not.toBe(
      visitorId(VISITOR, SECRET, '2026-09-08'),
    );
  });

  it('IP·UA·도메인 중 하나만 달라도 다른 값이다', () => {
    const base = visitorId(VISITOR, SECRET, '2026-09-07');
    for (const changed of [
      { ...VISITOR, ip: '198.51.100.1' },
      { ...VISITOR, userAgent: 'Mozilla/5.0 (Windows) Firefox/140' },
      { ...VISITOR, host: 'preview.example' },
    ]) {
      expect(visitorId(changed, SECRET, '2026-09-07')).not.toBe(base);
    }
  });

  it('저장되는 값에 IP 도 UA 도 남아 있지 않다', () => {
    const id = visitorId(VISITOR, SECRET, '2026-09-07');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain('203.0.113.7');
    expect(id).not.toContain('Chrome');
  });

  it('salt 를 모르면 같은 값을 만들 수 없다', () => {
    expect(visitorId(VISITOR, 'other-secret', '2026-09-07')).not.toBe(
      visitorId(VISITOR, SECRET, '2026-09-07'),
    );
  });
});

describe('clientIp', () => {
  it('x-forwarded-for 의 맨 앞이 원래 클라이언트다', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178',
    });
    expect(clientIp(headers)).toBe('203.0.113.7');
  });

  it('헤더가 없어도 던지지 않는다', () => {
    expect(clientIp(new Headers())).toBe('');
  });
});

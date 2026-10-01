/**
 * 멘션 스위치 (IDE-046)
 *
 * 로컬과 미리보기 배포는 **운영과 같은 글**을 읽는다. 거기서 저장한 글이 남의
 * 블로그에 진짜 멘션을 쏘면 되돌릴 수 없다 — 그래서 기본이 "안 보낸다"인지를
 * 지킨다.
 */
import { describe, expect, it } from 'vitest';
import { mentionsLocalAllowed, mentionsSendEnabled } from '../config';

describe('mentionsSendEnabled', () => {
  it('운영 배포에서만 보낸다', () => {
    expect(mentionsSendEnabled({ VERCEL_ENV: 'production' })).toBe(true);
    expect(mentionsSendEnabled({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(mentionsSendEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(mentionsSendEnabled({})).toBe(false);
  });

  it('스위치로 운영에서도 끌 수 있다', () => {
    for (const value of ['off', 'OFF', '0', 'false']) {
      expect(
        mentionsSendEnabled({
          VERCEL_ENV: 'production',
          WEBMENTION_SEND: value,
        }),
        value,
      ).toBe(false);
    }
  });

  it('스위치로 다른 환경에서도 켤 수 있다 — 시험할 때', () => {
    expect(mentionsSendEnabled({ WEBMENTION_SEND: 'on' })).toBe(true);
  });

  it('빌드 중에는 스위치가 켜져 있어도 보내지 않는다', () => {
    expect(
      mentionsSendEnabled({
        VERCEL_ENV: 'production',
        WEBMENTION_SEND: 'on',
        NEXT_PHASE: 'phase-production-build',
      }),
    ).toBe(false);
  });
});

describe('mentionsLocalAllowed', () => {
  it('개발 서버에서 스위치를 켰을 때만 안쪽 주소를 허락한다', () => {
    expect(
      mentionsLocalAllowed({
        NODE_ENV: 'development',
        MENTIONS_ALLOW_LOCAL: '1',
      }),
    ).toBe(true);
    expect(mentionsLocalAllowed({ NODE_ENV: 'development' })).toBe(false);
  });

  it('운영 빌드에서는 스위치를 켜도 허락하지 않는다', () => {
    // 배포 설정 실수 하나가 방어를 통째로 끄면 안 된다.
    expect(
      mentionsLocalAllowed({
        NODE_ENV: 'production',
        MENTIONS_ALLOW_LOCAL: '1',
      }),
    ).toBe(false);
  });
});

/**
 * 공유 수단과 링크 (IDE-029)
 *
 * 지키는 것이 셋이다. **다섯 수단이 표에서 소셜 한 칸에 모이고 source 로 갈린다**
 * · **주소가 깨지지 않는다**(쿼리가 붙은 채로 감싸도) · **수단마다 다른 source**.
 */
import { describe, expect, it } from 'vitest';
import { channelOf } from '@/lib/analytics/shareLinks';
import {
  SHARE_TARGETS,
  facebookShareUrl,
  shareUrl,
  xIntentUrl,
} from '../targets';

const ORIGIN = 'https://example.com';

const urlFor = (source: string) =>
  shareUrl({ origin: ORIGIN, path: '/games/soccer', source });

describe('SHARE_TARGETS', () => {
  it('수단마다 source 가 다르다 — 같으면 표에서 두 수단이 한 줄로 뭉친다', () => {
    const sources = SHARE_TARGETS.map((target) => target.source);
    expect(new Set(sources).size).toBe(SHARE_TARGETS.length);
  });

  it('다섯 수단 모두 소셜로 잡힌다 — 수집 쪽과 같은 함수로 확인한다', () => {
    // 화면이 "공유"라고 적어 놓고 표의 다른 칸에 쌓이면, 그 거짓말은 몇 주 뒤에야
    // 드러난다. `channelOf` 는 `classifyChannel` 그대로다.
    for (const target of SHARE_TARGETS) {
      expect(channelOf(urlFor(target.source))).toBe('social');
    }
  });
});

describe('shareUrl', () => {
  it('경로와 utm 을 붙인다', () => {
    const url = new URL(urlFor('kakao'));
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe('/games/soccer');
    expect(url.searchParams.get('utm_source')).toBe('kakao');
    expect(url.searchParams.get('utm_medium')).toBe('social');
  });

  it('끝 슬래시가 있어도 경로가 겹치지 않는다', () => {
    const url = shareUrl({
      origin: `${ORIGIN}/`,
      path: '/blog/어떤-글',
      source: 'copy',
    });
    expect(new URL(url).pathname).toBe(encodeURI('/blog/어떤-글'));
  });
});

describe('바깥 서비스로 나가는 주소', () => {
  it('X 는 제목과 주소를 따로 싣는다 — 이어 붙이면 카드가 안 펼쳐진다', () => {
    const target = urlFor('x');
    const url = new URL(xIntentUrl(target, '축구 게임판'));
    expect(url.host).toBe('x.com');
    expect(url.searchParams.get('url')).toBe(target);
    expect(url.searchParams.get('text')).toBe('축구 게임판');
  });

  it('utm 이 붙은 주소를 감싸도 쿼리가 잘리지 않는다', () => {
    // `?` 와 `&` 를 그냥 이어 붙이면 우리 utm 이 남의 파라미터가 된다.
    const target = urlFor('facebook');
    const wrapped = new URL(facebookShareUrl(target));
    expect(wrapped.host).toBe('www.facebook.com');
    expect(wrapped.searchParams.get('u')).toBe(target);
    expect(
      new URL(wrapped.searchParams.get('u')!).searchParams.get('utm_medium'),
    ).toBe('social');
  });
});

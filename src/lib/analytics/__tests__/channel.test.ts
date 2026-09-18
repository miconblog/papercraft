import { describe, expect, it } from 'vitest';
import {
  classifyChannel,
  inAppOf,
  readUtm,
  referrerHost,
  sourceLabel,
} from '../channel';

const utm = (query: string) => readUtm(new URLSearchParams(query));
const NONE = utm('');
const SELF = 'daddyscraft.example';

describe('referrerHost', () => {
  it('호스트만 남긴다 — 남의 사이트 경로는 가져오지 않는다', () => {
    expect(referrerHost('https://www.google.com/search?q=종이+보드게임')).toBe(
      'www.google.com',
    );
  });

  it('빈 값·망가진 값은 null 이다', () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost('')).toBeNull();
    expect(referrerHost('없는주소')).toBeNull();
  });
});

describe('classifyChannel', () => {
  it('utm 이 붙은 링크와 안 붙은 링크는 서로 다른 채널이다', () => {
    const tagged = classifyChannel(
      utm('utm_source=newsletter&utm_medium=email'),
      null,
      SELF,
    );
    const plain = classifyChannel(NONE, null, SELF);
    expect(plain).toBe('direct');
    expect(tagged).toBe('campaign');
    expect(tagged).not.toBe(plain);
  });

  it('utm 이 referrer 보다 우선한다', () => {
    expect(
      classifyChannel(utm('utm_medium=social'), 'www.google.com', SELF),
    ).toBe('social');
  });

  it('referrer 만으로 네 갈래를 가른다', () => {
    expect(classifyChannel(NONE, null, SELF)).toBe('direct');
    expect(classifyChannel(NONE, 'www.google.com', SELF)).toBe('organic');
    expect(classifyChannel(NONE, 'search.naver.com', SELF)).toBe('organic');
    expect(classifyChannel(NONE, 'www.instagram.com', SELF)).toBe('social');
    expect(classifyChannel(NONE, 'blog.naver.com', SELF)).toBe('social');
    expect(classifyChannel(NONE, 'some-blog.example', SELF)).toBe('referral');
  });

  it('사이트 안에서 넘어온 것은 유입이 아니다', () => {
    expect(classifyChannel(NONE, SELF, SELF)).toBe('direct');
  });

  it('utm_source 가 검색·소셜이면 medium 없이도 알아본다', () => {
    expect(classifyChannel(utm('utm_source=google'), null, SELF)).toBe(
      'organic',
    );
    expect(classifyChannel(utm('utm_source=kakao.com'), null, SELF)).toBe(
      'social',
    );
  });

  it('광고는 검색·소셜로 접지 않는다 — 돈 주고 산 방문이 자연 유입이 되면 안 된다', () => {
    expect(
      classifyChannel(utm('utm_source=google&utm_medium=cpc'), null, SELF),
    ).toBe('campaign');
  });

  it('카페·블로그 utm 은 검색이 아니라 소셜이다 — `naver_cafe` 가 `naver.` 에 걸리면 안 된다', () => {
    expect(
      classifyChannel(
        utm('utm_source=naver_cafe&utm_medium=community'),
        null,
        SELF,
      ),
    ).toBe('social');
    expect(classifyChannel(utm('utm_source=naver_cafe'), null, SELF)).toBe(
      'social',
    );
    expect(classifyChannel(utm('utm_source=naver_blog'), null, SELF)).toBe(
      'social',
    );
    // 네이버 자체는 여전히 검색이다.
    expect(classifyChannel(utm('utm_source=naver'), null, SELF)).toBe(
      'organic',
    );
  });

  it('referrer 없이 온 인앱 브라우저는 앱으로 채널을 가른다', () => {
    expect(classifyChannel(NONE, null, SELF, 'kakaotalk')).toBe('social');
    expect(classifyChannel(NONE, null, SELF, 'instagram')).toBe('social');
    // 네이버 앱 안에서는 검색인지 카페인지 알 수 없다.
    expect(classifyChannel(NONE, null, SELF, 'naver')).toBe('direct');
  });

  it('앱보다 utm 과 referrer 가 먼저다', () => {
    expect(
      classifyChannel(
        utm('utm_source=newsletter&utm_medium=email'),
        null,
        SELF,
        'kakaotalk',
      ),
    ).toBe('campaign');
    expect(classifyChannel(NONE, 'www.google.com', SELF, 'kakaotalk')).toBe(
      'organic',
    );
  });
});

describe('readUtm', () => {
  it('content 와 term 도 꺼낸다 — 분류에는 안 쓰지만 원본에 남긴다', () => {
    expect(
      utm('utm_source=kakao&utm_content=%EB%B2%84%ED%8A%BC&utm_term=Paper'),
    ).toMatchObject({ source: 'kakao', content: '버튼', term: 'paper' });
  });
});

describe('inAppOf', () => {
  it('UA 에 박힌 앱 이름을 찾는다', () => {
    const cases: [string, string | null][] = [
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0',
        'kakaotalk',
      ],
      [
        'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
        'instagram',
      ],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0]',
        'facebook',
      ],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 350.0.0 (iPhone16,2; iOS 18_0; ko_KR; ko)',
        'threads',
      ],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.10.1)',
        'naver',
      ],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        null,
      ],
      [
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Whale/4.0 Mobile Safari/537.36',
        null,
      ],
    ];
    for (const [ua, app] of cases) expect(inAppOf(ua), ua).toBe(app);
    expect(inAppOf(null)).toBeNull();
  });
});

describe('sourceLabel', () => {
  it('앱 표식은 사람이 읽는 이름으로, 빈 값은 모른다고 적는다', () => {
    expect(sourceLabel('app:kakaotalk')).toBe('카카오톡 앱');
    expect(sourceLabel('app:unknown')).toBe('unknown 앱');
    expect(sourceLabel('facebook')).toBe('facebook');
    expect(sourceLabel('')).toBe('(알 수 없음)');
  });
});

import { describe, expect, it } from 'vitest';
import { classifyChannel, readUtm, referrerHost } from '../channel';

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
});

import { describe, expect, it } from 'vitest';
import {
  countryOf,
  gameIdFromPath,
  isBot,
  normalizePath,
  summarizeUa,
} from '../request';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('isBot', () => {
  it('크롤러·프리렌더·도구를 걸러낸다', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 HeadlessChrome/141.0.0.0',
      'curl/8.7.1',
      'facebookexternalhit/1.1',
      'Chrome-Lighthouse',
    ]) {
      expect(isBot(ua), ua).toBe(true);
    }
  });

  it('UA 가 없으면 사람으로 치지 않는다', () => {
    expect(isBot(null)).toBe(true);
    expect(isBot('')).toBe(true);
  });

  it('평범한 브라우저는 통과시킨다', () => {
    expect(isBot(CHROME_MAC)).toBe(false);
    expect(isBot(SAFARI_IPHONE)).toBe(false);
  });
});

describe('summarizeUa', () => {
  it('브라우저·OS·기기 세 칸으로 줄인다', () => {
    expect(summarizeUa(CHROME_MAC)).toEqual({
      browser: 'Chrome',
      os: 'macOS',
      device: 'desktop',
    });
    expect(summarizeUa(SAFARI_IPHONE)).toEqual({
      browser: 'Safari',
      os: 'iOS',
      device: 'mobile',
    });
  });

  it('Edge 를 Chrome 으로 읽지 않는다 (UA 에 둘 다 들어 있다)', () => {
    expect(
      summarizeUa(`${CHROME_MAC.replace('Safari/537.36', 'Edg/141.0.0.0')}`)
        .browser,
    ).toBe('Edge');
  });

  it('요약에는 원본 UA 조각이 남지 않는다', () => {
    const summary = summarizeUa(CHROME_MAC);
    expect(Object.values(summary).join(' ')).not.toContain('AppleWebKit');
    expect(Object.values(summary).join(' ')).not.toContain('141.0.0.0');
  });
});

describe('gameIdFromPath', () => {
  it('게임 경로 세 가지에서 id 를 꺼낸다', () => {
    for (const path of [
      '/games/soccer',
      '/games/soccer/edit',
      '/games/soccer/print',
    ]) {
      expect(gameIdFromPath(path), path).toBe('soccer');
    }
  });

  it('등록소에 없는 id 는 받지 않는다 — 경로는 누구나 만들어 부른다', () => {
    expect(gameIdFromPath('/games/지어낸것')).toBeNull();
    expect(gameIdFromPath('/games')).toBeNull();
    expect(gameIdFromPath('/')).toBeNull();
  });
});

describe('normalizePath', () => {
  it('쿼리와 프래그먼트를 버린다', () => {
    expect(normalizePath('/games/soccer?utm_source=x&token=secret')).toBe(
      '/games/soccer',
    );
    expect(normalizePath('/games/soccer#rules')).toBe('/games/soccer');
  });

  it('뒤 슬래시를 하나로 본다', () => {
    expect(normalizePath('/games/')).toBe('/games');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('countryOf', () => {
  it('두 글자 국가 코드만 받는다', () => {
    expect(countryOf(new Headers({ 'x-vercel-ip-country': 'KR' }))).toBe('KR');
    expect(countryOf(new Headers({ 'cf-ipcountry': 'JP' }))).toBe('JP');
    expect(countryOf(new Headers({ 'x-vercel-ip-country': 'XX1' }))).toBeNull();
    expect(countryOf(new Headers())).toBeNull();
  });
});

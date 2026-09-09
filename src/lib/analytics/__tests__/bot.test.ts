/**
 * 봇 신호 (IDE-024)
 *
 * 여기서 가장 중요한 것은 **진짜 사람이 걸리지 않는 것**이다. 숫자가 조금
 * 부푸는 것보다 사람이 통계에서 사라지는 쪽이 나쁘다.
 */
import { describe, expect, it } from 'vitest';
import { BOT_THRESHOLD, botVerdict, primaryLanguage } from '../bot';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1';

/** 진짜 크롬이 페이지뷰를 보낼 때 붙는 헤더 묶음. */
const realChrome = (extra: Record<string, string> = {}) =>
  new Headers({
    'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'sec-ch-ua': '"Chromium";v="141", "Not?A_Brand";v="24"',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    ...extra,
  });

const verdict = (headers: Headers, userAgent = CHROME, fetchLike = true) =>
  botVerdict({ headers, userAgent, fromBrowserFetch: fetchLike });

describe('botVerdict', () => {
  it('평범한 크롬 방문은 0점이다', () => {
    expect(verdict(realChrome())).toEqual({ score: 0, reason: null });
  });

  it('힌트를 안 보내는 브라우저를 벌하지 않는다', () => {
    const headers = realChrome();
    headers.delete('sec-ch-ua');

    // Safari 와 iOS 의 크롬 껍데기는 원래 sec-ch-ua 가 없다.
    for (const ua of [SAFARI, CHROME_IOS]) {
      expect(verdict(headers, ua).score).toBe(0);
    }
  });

  it('Accept-Language 가 없으면 문턱을 넘는다', () => {
    const headers = realChrome();
    headers.delete('accept-language');

    const result = verdict(headers);
    expect(result.score).toBeGreaterThanOrEqual(BOT_THRESHOLD);
    expect(result.reason).toContain('no-accept-language');
  });

  it('힌트가 빠진 것만으로는 봇이 되지 않는다', () => {
    const headers = realChrome();
    headers.delete('sec-ch-ua');

    // 실물 확인 전이라 혼자서는 문턱을 못 넘게 뒀다.
    const result = verdict(headers);
    expect(result.reason).toBe('no-client-hints');
    expect(result.score).toBeLessThan(BOT_THRESHOLD);
  });

  it('수집 API 를 직접 두드리면 문턱을 넘는다', () => {
    const result = verdict(
      realChrome({ 'sec-fetch-site': 'none', 'sec-fetch-mode': 'no-cors' }),
    );

    expect(result.score).toBeGreaterThanOrEqual(BOT_THRESHOLD);
    expect(result.reason).toContain('bad-fetch-metadata:none/no-cors');
  });

  it('sec-fetch 헤더가 아예 없으면 그것으로 벌하지 않는다', () => {
    const headers = realChrome();
    headers.delete('sec-fetch-site');
    headers.delete('sec-fetch-mode');

    // 안 보내는 옛 브라우저가 있다. 없는 것과 어긋난 것은 다르다.
    expect(verdict(headers).score).toBe(0);
  });

  it('다운로드에는 fetch 잣대를 대지 않는다', () => {
    // 링크를 눌러 넘어온 이동이라 same-origin/cors 가 아니다.
    const headers = realChrome({
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
    });

    expect(verdict(headers, CHROME, false).score).toBe(0);
  });

  it('신호가 겹치면 근거가 함께 남는다', () => {
    const headers = new Headers({
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'no-cors',
    });

    const result = verdict(headers);
    expect(result.score).toBe(6);
    expect(result.reason).toBe(
      'no-accept-language,no-client-hints,bad-fetch-metadata:cross-site/no-cors',
    );
  });
});

describe('primaryLanguage', () => {
  it('첫 태그의 언어 코드만 남긴다', () => {
    const cases: [string, string | null][] = [
      ['de-AT,de;q=0.9,en;q=0.8', 'de'],
      ['ko-KR,ko;q=0.9', 'ko'],
      ['en', 'en'],
      ['  ja-JP  ', 'ja'],
    ];

    for (const [raw, expected] of cases) {
      expect(primaryLanguage(new Headers({ 'accept-language': raw }))).toBe(
        expected,
      );
    }
  });

  it('없거나 알아볼 수 없으면 null 이다', () => {
    expect(primaryLanguage(new Headers())).toBeNull();
    expect(primaryLanguage(new Headers({ 'accept-language': '*' }))).toBeNull();
    expect(primaryLanguage(new Headers({ 'accept-language': ' ' }))).toBeNull();
  });
});

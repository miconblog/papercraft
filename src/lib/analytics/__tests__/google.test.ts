/**
 * Google Analytics 4 (IDE-038)
 *
 * 지키는 것: **운영 배포에서만 싣는다** · **관리자는 세지 않는다** — 그리고 그
 * 판정이 브라우저에 싣는 초기화 문자열과 TypeScript 쪽에서 **같은 답**을 낸다 ·
 * **광고 신호를 끈다**.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  GA_MEASUREMENT_ID,
  disableKey,
  gaInitScript,
  gaMeasurementId,
  gaSuppressed,
} from '../google';

describe('gaMeasurementId', () => {
  it('운영 배포에서만 기본 ID 를 싣는다', () => {
    expect(gaMeasurementId({ VERCEL_ENV: 'production' })).toBe(
      GA_MEASUREMENT_ID,
    );
    expect(gaMeasurementId({ VERCEL_ENV: 'preview' })).toBeNull();
    expect(gaMeasurementId({})).toBeNull();
  });

  it('환경변수가 이기고, off 면 운영에서도 끈다', () => {
    expect(
      gaMeasurementId({
        NEXT_PUBLIC_GA_ID: 'G-TEST1234',
        VERCEL_ENV: 'preview',
      }),
    ).toBe('G-TEST1234');
    expect(
      gaMeasurementId({ NEXT_PUBLIC_GA_ID: 'off', VERCEL_ENV: 'production' }),
    ).toBeNull();
  });

  it('모양이 틀린 값은 버린다 — 인라인 스크립트에 그대로 들어가는 값이다', () => {
    expect(
      gaMeasurementId({ NEXT_PUBLIC_GA_ID: "G-1');alert(1)//" }),
    ).toBeNull();
    expect(gaMeasurementId({ NEXT_PUBLIC_GA_ID: 'UA-12345-1' })).toBeNull();
  });
});

describe('gaSuppressed', () => {
  it('관리자 쿠키가 있거나 관리자 경로면 보내지 않는다', () => {
    expect(gaSuppressed('/games/soccer', '')).toBe(false);
    expect(gaSuppressed('/admin/analytics', '')).toBe(true);
    expect(gaSuppressed('/games/soccer', 'theme=dark; dc_owner=1')).toBe(true);
  });

  it('이름이 비슷한 남의 쿠키 · 경로에 걸리지 않는다', () => {
    expect(gaSuppressed('/administrators', 'xdc_owner=1')).toBe(false);
  });
});

describe('gaInitScript', () => {
  const id = GA_MEASUREMENT_ID;
  const w = window as unknown as Record<string, unknown> & {
    dataLayer?: unknown[];
  };

  /** 브라우저에서처럼 돌려 본다. */
  const run = (path: string, cookie: string) => {
    window.history.replaceState(null, '', path);
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim();
      if (name)
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    if (cookie) document.cookie = cookie;
    delete w.dataLayer;
    delete w[disableKey(id)];
    new Function(gaInitScript(id))();
  };

  afterEach(() => window.history.replaceState(null, '', '/'));

  it('설정에 광고 신호 둘을 끄고 싣는다', () => {
    run('/', '');
    const config = (w.dataLayer ?? []).find(
      (entry) => (entry as IArguments)[0] === 'config',
    ) as IArguments;
    expect(config[1]).toBe(id);
    expect(config[2]).toEqual({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  });

  it('끄기 판정이 TypeScript 쪽과 같다', () => {
    for (const [path, cookie] of [
      ['/', ''],
      ['/games/soccer', ''],
      ['/admin', ''],
      ['/admin/posts/1', ''],
      ['/administrators', ''],
      ['/blog/a', 'dc_owner=1'],
      ['/blog/a', 'xdc_owner=1'],
    ] as const) {
      run(path, cookie);
      expect(w[disableKey(id)], `${path} ${cookie}`).toBe(
        gaSuppressed(path, document.cookie),
      );
    }
  });

  it('끄기 스위치를 config 보다 먼저 세운다 — 늦으면 첫 페이지뷰가 이미 나간다', () => {
    const script = gaInitScript(id);
    expect(script.indexOf(disableKey(id))).toBeLessThan(
      script.indexOf("gtag('config'"),
    );
  });
});

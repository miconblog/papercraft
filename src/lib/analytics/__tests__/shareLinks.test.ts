/**
 * 공유 링크 (IDE-013)
 *
 * 여기서 만든 링크가 **수집 쪽 판정과 어긋나면** 화면이 거짓말을 한다 —
 * "소셜로 잡힙니다"라고 적어 놓고 다른 칸에 쌓이는 것은 몇 주 뒤 숫자를 볼
 * 때까지 드러나지 않는다. 그래서 둘을 같이 본다.
 */
import { describe, expect, it } from 'vitest';
import { classifyChannel, readUtm } from '../channel';
import {
  buildShareUrl,
  channelOf,
  normalizeTag,
  SHARE_PRESETS,
} from '../shareLinks';

const ORIGIN = 'https://daddyscraft.example';

describe('normalizeTag', () => {
  it('대소문자·공백을 눌러 준다 — 한 채널이 표에서 둘로 쪼개지면 안 된다', () => {
    expect(normalizeTag('Facebook')).toBe('facebook');
    expect(normalizeTag('  LinkedIn  ')).toBe('linkedin');
    expect(normalizeTag('summer break')).toBe('summer-break');
  });

  it('한글을 지우지 않는다 — 한국어 사이트에서 캠페인 이름이 사라지면 안 된다', () => {
    expect(normalizeTag('여름방학')).toBe('여름방학');
    expect(normalizeTag('여름 방학 캠페인')).toBe('여름-방학-캠페인');
  });

  it('링크를 깨뜨리는 글자만 버린다', () => {
    expect(normalizeTag('a&b=c?d#e')).toBe('abcde');
    expect(normalizeTag('news_letter-1.0')).toBe('news_letter-1.0');
    expect(normalizeTag('a/b?c=d')).toBe('abcd');
  });

  it('버린 자리에 `-`가 겹쳐 남지 않는다', () => {
    expect(normalizeTag('-- 여름 -- 방학 --')).toBe('여름-방학');
  });
});

describe('buildShareUrl', () => {
  it('기본 채널 셋을 붙인다', () => {
    expect(
      buildShareUrl({
        origin: ORIGIN,
        path: '/games/soccer',
        source: 'facebook',
        medium: 'social',
      }),
    ).toBe(
      'https://daddyscraft.example/games/soccer?utm_source=facebook&utm_medium=social',
    );
  });

  it('캠페인은 있을 때만 붙는다', () => {
    const withCampaign = buildShareUrl({
      origin: ORIGIN,
      path: '/',
      source: 'instagram',
      medium: 'social',
      campaign: '여름방학',
    });
    // 링크에는 퍼센트 인코딩으로 실리고, 읽을 때 되돌아온다.
    expect(withCampaign).toContain('utm_campaign=');
    expect(new URL(withCampaign).searchParams.get('utm_campaign')).toBe(
      '여름방학',
    );

    expect(
      buildShareUrl({
        origin: ORIGIN,
        path: '/',
        source: 'instagram',
        medium: 'social',
        campaign: '   ',
      }),
    ).not.toContain('utm_campaign');
  });

  it('source 가 비면 utm 을 하나도 붙이지 않는다', () => {
    // 반쪽짜리 utm 은 채널을 `campaign` 으로 밀어 넣어 표를 흐린다.
    expect(
      buildShareUrl({
        origin: ORIGIN,
        path: '/',
        source: '',
        medium: 'social',
      }),
    ).toBe('https://daddyscraft.example/');
  });

  it('끝 슬래시와 앞 슬래시가 겹치거나 빠져도 주소가 성하다', () => {
    for (const [origin, path] of [
      [`${ORIGIN}/`, '/games/soccer'],
      [ORIGIN, 'games/soccer'],
      [`${ORIGIN}//`, 'games/soccer'],
    ]) {
      expect(
        buildShareUrl({ origin, path, source: 'facebook', medium: 'social' }),
        `${origin} + ${path}`,
      ).toContain('https://daddyscraft.example/games/soccer?');
    }
  });
});

describe('channelOf', () => {
  it('기본 채널 셋은 전부 소셜로 잡힌다', () => {
    for (const preset of SHARE_PRESETS) {
      const url = buildShareUrl({
        origin: ORIGIN,
        path: '/',
        source: preset.source,
        medium: preset.medium,
      });
      expect(channelOf(url), preset.label).toBe('social');
    }
  });

  it('화면이 말하는 채널과 수집이 매기는 채널이 같다', () => {
    const cases = [
      { source: 'facebook', medium: 'social' },
      { source: '뉴스레터', medium: 'email' },
      { source: 'threads', medium: 'social' },
      { source: 'qr', medium: 'print' },
      { source: 'google', medium: 'cpc' },
    ];

    for (const input of cases) {
      const url = buildShareUrl({ origin: ORIGIN, path: '/', ...input });
      // 수집 쪽이 실제로 하는 일: 들어온 URL 의 쿼리를 그대로 읽어 분류한다.
      const asCollected = classifyChannel(
        readUtm(new URL(url).searchParams),
        null,
        'daddyscraft.example',
      );
      expect(channelOf(url), `${input.source}/${input.medium}`).toBe(
        asCollected,
      );
    }
  });

  it('utm 이 없으면 직접 방문이다', () => {
    expect(channelOf(`${ORIGIN}/games/soccer`)).toBe('direct');
  });
});

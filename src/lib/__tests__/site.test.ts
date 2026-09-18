/**
 * 사이트 주소 (IDE-023)
 *
 * 2026-09-19 까지 라이브가 전부 `localhost` 였다 — 운영에 `NEXT_PUBLIC_SITE_URL`
 * 이 없어서 사이트맵·대표 주소·공유 버튼이 로컬을 가리켰다. 사람이 넣어야만
 * 맞는 값은 언젠가 빠지므로 운영 빌드는 운영 도메인으로 떨어진다.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCTION_SITE_URL, deployedSiteUrl, siteUrl } from '../site';

describe('siteUrl', () => {
  it('사람이 정한 주소가 먼저다', () => {
    expect(
      siteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://papercraft.example/',
        NODE_ENV: 'production',
      }),
    ).toBe('https://papercraft.example');
  });

  it('없으면 운영 빌드는 운영 도메인이다 — localhost 로 떨어지지 않는다', () => {
    expect(siteUrl({ NODE_ENV: 'production' })).toBe(
      'https://www.daddyscraft.com',
    );
  });

  it('운영 도메인은 리다이렉트되지 않는 쪽이다 — 대표 주소가 308 을 가리키면 안 된다', () => {
    expect(PRODUCTION_SITE_URL).toBe('https://www.daddyscraft.com');
  });

  it('빈칸만 있는 값은 없는 것으로 친다', () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: '  ', NODE_ENV: 'production' }),
    ).toBe(PRODUCTION_SITE_URL);
  });

  it('개발 서버에서 아무것도 없으면 로컬이다', () => {
    expect(siteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(deployedSiteUrl({ NODE_ENV: 'development' })).toBeNull();
  });
});

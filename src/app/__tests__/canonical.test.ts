/**
 * 대표 주소(canonical) — 페이지마다 자기 주소
 *
 * 2026-09-19 라이브에서 `/games/soccer` 가 대표 주소로 홈을 선언하고 있었다.
 * 루트 레이아웃의 `alternates.canonical: '/'` 를 자기 것이 없는 페이지가 전부
 * 물려받은 탓이다. 검색엔진은 그런 페이지를 홈의 사본으로 보고 따로 싣지 않는다.
 */
import { describe, expect, it, vi } from 'vitest';

// 루트 레이아웃이 불러오는 글꼴은 메타데이터와 무관하다.
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '', className: '' }),
  Geist_Mono: () => ({ variable: '', className: '' }),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('대표 주소', () => {
  it('루트 레이아웃은 대표 주소를 정하지 않는다 — 모든 페이지가 물려받는다', async () => {
    const { metadata } = await import('../layout');
    expect(metadata.alternates?.canonical).toBeUndefined();
  });

  it('홈은 스스로 `/` 를 적는다', async () => {
    const { metadata } = await import('../page');
    expect(metadata.alternates?.canonical).toBe('/');
  });

  it('게임 만들기 화면은 자기 주소다 — utm 이 붙은 공유 링크가 따로 실리지 않는다', async () => {
    const { generateMetadata } = await import('../games/[id]/page');
    const meta = await generateMetadata(params('soccer'));
    expect(meta.alternates?.canonical).toBe('/games/soccer');
    expect(meta.openGraph?.url).toBe('/games/soccer');
  });

  it('게임 방법 화면도 자기 주소다', async () => {
    const { generateMetadata } = await import('../games/[id]/rules/page');
    const meta = await generateMetadata(params('soccer'));
    expect(meta.alternates?.canonical).toBe('/games/soccer/rules');
    expect(meta.openGraph?.url).toBe('/games/soccer/rules');
  });
});

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PRIVACY_PAGE_OPEN, PrivacyContent } from '@/components/PrivacyContent';
import { SITE_TITLE } from '@/lib/site';

/**
 * 개인정보처리방침 (IDE-038)
 *
 * GA 를 붙이며 만들었다. GA 이용약관이 "GA 를 쓴다는 것과 어떻게 모으는지"를
 * 처리방침에 적도록 요구하고, 개인정보보호법도 쿠키 같은 자동 수집 장치와 그
 * 거부 방법을 적게 한다. 플랫폼 블로그는 플랫폼이 대신 적지만, 직접 운영하는
 * 사이트는 주인 몫이다.
 *
 * **코드가 실제로 하는 것만 적는다.** 고지는 약속이라, 부풀려도 줄여도 틀린다.
 * 수집 방식을 바꾸면 이 페이지도 같은 PR 에서 고친다.
 *
 * **지금은 닫혀 있다**(2026-09-19 사용자 결정) — 이유와 여는 법은
 * `components/PrivacyContent.tsx` 의 `PRIVACY_PAGE_OPEN` 에 적었다.
 */

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: `${SITE_TITLE}이 무엇을 모으고 어떻게 다루는지`,
  alternates: { canonical: '/privacy' },
  // 닫혀 있는 동안 검색엔진이 옛 사본을 들고 있지 않게.
  ...(PRIVACY_PAGE_OPEN ? {} : { robots: { index: false, follow: false } }),
};

export default function PrivacyPage() {
  if (!PRIVACY_PAGE_OPEN) notFound();
  return <PrivacyContent />;
}

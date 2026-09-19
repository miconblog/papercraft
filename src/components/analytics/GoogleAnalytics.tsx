'use client';

/**
 * Google Analytics 4 싣기 (IDE-038)
 *
 * 규칙은 `lib/analytics/google.ts` 가 정한다. 여기는 **싣고, 화면이 바뀔 때마다
 * 끄기 스위치를 다시 세운다.**
 *
 * 페이지뷰는 GA 가 스스로 보낸다(향상된 측정의 "브라우저 기록 기반 페이지
 * 변경"). 우리가 따로 보내면 두 번 센다. 대신 **스위치가 켜진 동안에는 GA 가
 * 아무것도 보내지 않으므로**, 관리자가 로그인해 쿠키가 생기거나 `/admin` 으로
 * 옮겨 가면 그 순간부터 빠진다.
 *
 * 쿠키를 서버에서 읽지 않는다 — 루트 레이아웃이 쿠키를 읽으면 사이트 전체가
 * 정적 렌더링에서 빠진다(`AdminLink` · `PageViews` 가 같은 이유로 브라우저에서
 * 본다).
 */
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { disableKey, gaInitScript, gaSuppressed } from '@/lib/analytics/google';

export function GoogleAnalytics({ id }: { id: string }) {
  const pathname = usePathname();

  useEffect(() => {
    (window as unknown as Record<string, unknown>)[disableKey(id)] =
      gaSuppressed(pathname, document.cookie);
  }, [id, pathname]);

  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {gaInitScript(id)}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
    </>
  );
}

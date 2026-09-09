'use client';

/**
 * 페이지뷰 보내기 (IDE-013)
 *
 * App Router 는 첫 로드 뒤로 문서를 새로 받지 않는다 — 카탈로그에서 상세로
 * 넘어가는 것도, 상세에서 에디터로 가는 것도 전부 클라이언트 전환이다.
 * `usePathname()` 을 보고 있어야 그 이동이 잡힌다.
 *
 * `useSearchParams()` 는 쓰지 않는다. 루트 레이아웃에서 그걸 읽으면 사이트
 * 전체가 정적 렌더링에서 빠진다 — 저장하는 경로에는 어차피 쿼리를 안 남기고,
 * utm 은 이펙트 안에서 `window.location.search` 로 읽으면 된다.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { isExcludedPath } from '@/lib/analytics/excluded';

export function PageViews() {
  const pathname = usePathname();
  // 첫 방문의 referrer 는 바깥 사이트지만, 두 번째 화면부터는 우리 페이지다.
  // 그대로 보내면 유입이 전부 self-referral 로 잡힌다.
  const firstView = useRef(true);

  useEffect(() => {
    // 관리자 화면은 보내지 않는다. 서버도 같은 판단을 다시 하지만, 여기서
    // 먼저 걸러 두면 셀 생각이 없는 요청이 애초에 나가지 않는다.
    if (isExcludedPath(pathname)) return;

    const url = pathname + window.location.search;
    const referrer = firstView.current ? document.referrer || null : null;
    firstView.current = false;

    // 실패해도 아무것도 하지 않는다. 차단기에 막히는 것이 정상 동작이다.
    void fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, referrer }),
      // 페이지를 떠나는 중에도 요청이 살아남게 한다.
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}

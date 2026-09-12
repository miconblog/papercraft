'use client';

import Link from 'next/link';

/**
 * 뒤로가기 (2026-09-12 사용자 요청)
 *
 * 게임 방법 화면의 좌상단은 늘 "목록으로"였는데, 만들기 화면에서 들어오는 길이
 * 생기면서 그 글자가 거짓이 됐다 — 돌아갈 곳은 왔던 곳이다.
 *
 * **버튼이 아니라 링크다.** 돌아갈 데가 없을 때(주소를 바로 치고 들어오거나 새
 * 탭으로 연 경우) 눌러도 아무 일이 없으면 안 되는데, 링크로 두면 그 경우가
 * `href`를 따라가는 기본 동작으로 저절로 풀린다. 가운데 클릭·새 탭 열기도 산다.
 *
 * 왔던 곳이 있으면 기본 동작을 막고 히스토리를 되민다. `useRouter().back()`이
 * 아니라 `window.history.back()`인 것은 앱 라우터가 `popstate`를 듣고 있어
 * 화면 전환이 똑같이 클라이언트에서 일어나고, 이 컴포넌트가 라우터 컨텍스트
 * 없이도 서기 때문이다.
 */
export function BackLink({
  fallbackHref = '/',
  children = '← 뒤로',
}: {
  fallbackHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={fallbackHref}
      onClick={(event) => {
        if (window.history.length <= 1) return;
        event.preventDefault();
        window.history.back();
      }}
      className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      {children}
    </Link>
  );
}

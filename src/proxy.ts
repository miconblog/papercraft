/**
 * `/admin` 문지기 (IDE-013)
 *
 * Next 16 부터 미들웨어는 `proxy` 다(`middleware.ts` 는 이름이 바뀐 채로
 * 남아 있는 예전 이름이다). 기본이 Node.js 런타임이라 `node:crypto` 를
 * 그대로 쓴다.
 *
 * **여기서 막는 것으로 끝내지 않는다.** matcher 를 잘못 건드리거나 경로를
 * 옮기면 이 검사가 조용히 사라지므로, `/admin/analytics` 페이지도 스스로 한 번
 * 더 확인한다(`src/app/admin/analytics/page.tsx`).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';

export const config = {
  matcher: ['/admin/:path*'],
};

export function proxy(request: NextRequest) {
  const password = adminPassword();

  // 비밀번호가 설정돼 있지 않으면 이 경로는 아예 없는 것으로 둔다 — 그 판정은
  // 페이지가 `notFound()` 로 내린다. 여기서 401 을 내면 "여기 관리자 화면이
  // 있다"는 것까지 알려 주는 셈이다.
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (isValidSession(token, password)) return NextResponse.next();

  const login = new URL('/admin/login', request.url);
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

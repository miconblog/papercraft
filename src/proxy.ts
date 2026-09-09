/**
 * 문지기 (IDE-013 · IDE-022)
 *
 * Next 16 부터 미들웨어는 `proxy` 다(`middleware.ts` 는 이름이 바뀐 채로
 * 남아 있는 예전 이름이다). 기본이 Node.js 런타임이라 `node:crypto` 를
 * 그대로 쓴다.
 *
 * 두 가지를 지킨다.
 *
 * 1. **`/admin`** — 비밀번호를 통과하지 않으면 로그인 화면으로 보낸다(IDE-013).
 *    여기서 막는 것으로 끝내지 않는다. matcher 를 잘못 건드리거나 경로를 옮기면
 *    이 검사가 조용히 사라지므로, `/admin/*` 페이지도 스스로 한 번 더 확인한다.
 *
 * 2. **`/games`** — 오픈 전 게임은 없는 것처럼 군다(IDE-022). 이 판정이 왜
 *    페이지가 아니라 여기 있는지는 아래 `releaseGate` 에 적었다.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminPassword } from '@/lib/analytics/config';
import {
  ADMIN_COOKIE,
  hasAdminSession,
  isValidSession,
} from '@/lib/analytics/session';
import { isOpen, releasesForRequest } from '@/lib/games/release';

export const config = {
  // `/games/:path*` 는 화면(`/games/<id>`·`/edit`·`/print`·OG 이미지)만이
  // 아니라 **`public/games/` 아래의 도안 SVG 까지** 같은 이름 아래 있다.
  // 한 줄로 둘 다 덮인다 — 화면만 막고 자산을 열어 두면 도안이 그대로 샌다.
  matcher: ['/admin/:path*', '/games/:path*'],
};

/**
 * 오픈 전 게임을 여기로 되돌린다.
 *
 * 등록소에 있을 수 없는 id 라 상세 페이지가 `notFound()` 를 내고, **사이트의
 * 404 화면이 그대로** 나온다. 미들웨어에서 맨 404 를 만들어 내면 없는 게임을
 * 친 것과 다른 화면이 나와서, 그 차이가 "여기 무언가 있다"는 신호가 된다.
 */
const CLOSED_PATH = '/games/__closed';

function adminGate(request: NextRequest, pathname: string): NextResponse {
  const password = adminPassword();

  // 비밀번호가 설정돼 있지 않으면 이 경로는 아예 없는 것으로 둔다 — 그 판정은
  // 페이지가 `notFound()` 로 내린다. 여기서 401 을 내면 "여기 관리자 화면이
  // 있다"는 것까지 알려 주는 셈이다.
  if (!password) return NextResponse.next();
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (isValidSession(token, password)) return NextResponse.next();

  const login = new URL('/admin/login', request.url);
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

/**
 * 오픈 전 게임 막기 (IDE-022)
 *
 * **왜 페이지가 아니라 여기인가.** 게임 화면 셋은 `generateStaticParams` 로 미리
 * 그려진다. 페이지가 스스로 판정하려면 쿠키를 읽어야 하고(관리자는 통과시켜야
 * 하므로), 쿠키를 읽는 순간 그 화면들이 통째로 정적 렌더링에서 빠진다 —
 * `AdminLink` 가 서버에서 쿠키를 안 읽는 것과 같은 이유다. 문지기는 요청마다
 * 도므로 **정적 페이지를 정적인 채로 두고도** 시각을 정확히 볼 수 있다.
 *
 * 닿지 못하면 전부 열어 준다(`releasesForRequest` 가 빈 표를 돌려준다).
 * Supabase 사고가 게임을 지우는 사고가 되어서는 안 된다.
 */
async function releaseGate(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse> {
  // `/games/<id>/...` — 화면이든 SVG 든 두 번째 조각이 게임 id 다.
  const gameId = pathname.split('/')[2] ?? '';
  if (!gameId) return NextResponse.next();

  if (isOpen(await releasesForRequest(), gameId)) return NextResponse.next();

  // 관리자는 오픈 전에도 봐야 한다 — 실물을 보고 날짜를 정한다.
  if (hasAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(CLOSED_PATH, request.url));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  return pathname === '/admin' || pathname.startsWith('/admin/')
    ? adminGate(request, pathname)
    : releaseGate(request, pathname);
}

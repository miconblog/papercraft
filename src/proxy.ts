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
 *
 * 3. **`/blog`** — 아직 안 낸 글도 없는 것처럼 군다(IDE-023). 2번과 같은
 *    문제라 같은 방식으로 푼다.
 */
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from 'next/server';
import { adminPassword } from '@/lib/analytics/config';
import {
  ADMIN_COOKIE,
  hasAdminSession,
  isValidSession,
  OWNER_COOKIE,
  ownerCookie,
  sessionCookie,
} from '@/lib/analytics/session';
import { recordCrawl } from '@/lib/analytics/crawlLog';
import { crawlerOf } from '@/lib/analytics/crawlers';
import { openSlugsForRequest } from '@/lib/blog/posts';
import { isOpen, releasesForRequest } from '@/lib/games/release';

export const config = {
  // `/games/:path*` 는 화면(`/games/<id>`·`/edit`·`/print`·OG 이미지)만이
  // 아니라 **`public/games/` 아래의 도안 SVG 까지** 같은 이름 아래 있다.
  // 한 줄로 둘 다 덮인다 — 화면만 막고 자산을 열어 두면 도안이 그대로 샌다.
  //
  // 나머지는 **크롤러를 세려고** 넣었다(IDE-040). AI 가 사이트를 알아 가는 문 —
  // 홈 · robots · 사이트맵 · llms.txt · RSS. 이 경로에는 막을 것이 없어서 그냥
  // 지나간다. 방문자에게는 문지기 한 번이 더 도는 것이 대가다.
  matcher: [
    '/admin/:path*',
    '/games/:path*',
    '/blog/:path*',
    '/',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/feed.xml',
  ],
};

/**
 * 오픈 전 게임을 여기로 되돌린다.
 *
 * 등록소에 있을 수 없는 id 라 상세 페이지가 `notFound()` 를 내고, **사이트의
 * 404 화면이 그대로** 나온다. 미들웨어에서 맨 404 를 만들어 내면 없는 게임을
 * 친 것과 다른 화면이 나와서, 그 차이가 "여기 무언가 있다"는 신호가 된다.
 */
const CLOSED_PATH = '/games/__closed';

/**
 * 안 낸 글을 여기로 되돌린다.
 *
 * 있을 수 없는 슬러그라 글 페이지가 `notFound()` 를 내고 사이트의 404 화면이
 * 그대로 나온다 — 위와 같은 이유다. 없는 주소와 **다른 화면**이 나오면 그
 * 차이가 "여기 안 낸 글이 있다"는 신호가 된다.
 */
const CLOSED_POST_PATH = '/blog/__closed';

/**
 * 옛 경로에 갇힌 세션을 넓혀 준다 (IDE-023)
 *
 * `IDE-022` 가 인증 쿠키 경로를 `/admin` → `/` 로 넓혔지만, 그것을 **로그인과
 * 로그아웃에서만** 했다. 그 전에 로그인한 브라우저는 다시 로그인하기 전까지
 * 옛 경로에 갇혀 있다.
 *
 * 증상이 고약하다. 관리자 화면은 멀쩡히 열리는데(`/admin` 요청에는 쿠키가
 * 실린다) **`/games/<id>` 와 `/blog/<슬러그>` 미리보기만 404 가 난다** — 그
 * 요청에는 안 실려서 문지기가 남으로 본다. 로그인은 돼 있으니 사람은 무엇이
 * 잘못됐는지 알 길이 없다(2026-09-09 사용자 신고).
 *
 * 그래서 **관리자 화면을 한 번 열면 저절로 낫게** 한다. 들어온 쿠키가 옛것인지
 * 새것인지는 알 수 없어서(브라우저는 경로를 안 보낸다) 그냥 같은 값을 `/` 에
 * 심는다. 이미 새것이면 같은 것을 덮어쓸 뿐이다.
 *
 * ## 옛 경로 것을 지우지 않는 이유
 *
 * 두 가지다. 첫째, **`NextResponse.cookies` 는 이름만 보고 덮어쓴다** — 심기와
 * 지우기를 나란히 두면 나가는 것은 뒤엣것 하나뿐이라, 지우기만 나가고 세션이
 * 통째로 날아간다. 둘째, 남겨 두어도 해가 없다. 로그인 액션이 걱정한 "같은
 * 이름의 쿠키가 둘"은 **값이 다를 때** 문제인데, 여기서는 둘 다 같은 토큰이라
 * 어느 쪽이 읽혀도 결과가 같다. 옛것은 다음 로그아웃·로그인 때 지워진다.
 */
function widenSessionPath(response: NextResponse, token: string): NextResponse {
  response.cookies.set(sessionCookie(token));
  return response;
}

/**
 * 주인 표시 쿠키를 되살린다 (2026-09-22 사용자 신고)
 *
 * "관리자 화면은 열리는데 헤더에 관리자 메뉴가 없다." 표시 쿠키(`dc_owner`)는
 * **로그인할 때만** 심겨서, 로그인은 살아 있는데 표시만 없는 브라우저가 생긴다
 * — 표시 쿠키가 생기기 전(IDE-026)에 로그인했거나, 브라우저가 이것만 지웠거나.
 * 그러면 헤더의 관리자 메뉴가 안 보이고, **이 브라우저의 방문이 통계에 다시
 * 잡힌다.**
 *
 * 로그아웃 말고는 이 쿠키를 지우지 않기로 했으니(2026-09-09 사용자 결정),
 * 로그인이 살아 있는 동안에는 늘 있어야 맞다. 위 `widenSessionPath` 처럼
 * 관리자 화면을 한 번 열면 저절로 낫게 한다. 이미 있으면 건드리지 않는다.
 */
function restoreOwnerMark(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!request.cookies.has(OWNER_COOKIE)) response.cookies.set(ownerCookie());
  return response;
}

function adminGate(request: NextRequest, pathname: string): NextResponse {
  const password = adminPassword();

  // 비밀번호가 설정돼 있지 않으면 이 경로는 아예 없는 것으로 둔다 — 그 판정은
  // 페이지가 `notFound()` 로 내린다. 여기서 401 을 내면 "여기 관리자 화면이
  // 있다"는 것까지 알려 주는 셈이다.
  if (!password) return NextResponse.next();
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token && isValidSession(token, password)) {
    return restoreOwnerMark(
      request,
      widenSessionPath(NextResponse.next(), token),
    );
  }

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

/**
 * 안 낸 글 막기 (IDE-023)
 *
 * `releaseGate` 와 판박이지만 다른 것이 둘이다.
 *
 * **없을 때의 뜻이 반대다.** 게임은 표에 줄이 없으면 열려 있고, 글은 목록에
 * 없으면 안 낸 것이다 — 글은 DB 가 유일한 원본이라 "닿지 못하면 전부 공개"가
 * 성립하지 않는다(`lib/blog/posts.ts`).
 *
 * **관리자 우회가 없다.** 게임은 오픈 전 실물을 이 주소에서 봐야 하지만, 글
 * 미리보기는 `/admin/posts/<id>/preview` 로 옮겼다(2026-09-09 사용자 제안).
 * 그래서 여기는 **누구에게나 같다** — 안 낸 글은 관리자에게도 없는 글이다.
 * 덕분에 글 화면이 스스로도 한 번 더 검사할 수 있게 됐다.
 *
 * 목록(`/blog`)은 막지 않는다. 조각이 하나뿐이라 슬러그가 비고, 그때는 그냥
 * 지나간다 — 안 낸 글은 목록 화면이 스스로 빼고 그린다.
 */
async function postGate(
  request: NextRequest,
  pathname: string,
): Promise<NextResponse> {
  const slug = pathname.split('/')[2] ?? '';
  if (!slug) return NextResponse.next();

  if ((await openSlugsForRequest()).has(decodeURIComponent(slug))) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(CLOSED_POST_PATH, request.url));
}

export async function proxy(
  request: NextRequest,
  event?: NextFetchEvent,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // AI · 검색 크롤러를 센다(IDE-040). 응답을 보낸 **뒤에** 적는다 — 세는 일이
  // 크롤러에게 나가는 응답을 늦추거나 깨뜨리면 안 된다. 관리자 경로는 세지 않는다.
  const crawler = crawlerOf(request.headers.get('user-agent'));
  if (crawler && !pathname.startsWith('/admin')) {
    event?.waitUntil(recordCrawl(crawler, pathname));
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return adminGate(request, pathname);
  }
  if (pathname === '/blog' || pathname.startsWith('/blog/')) {
    return postGate(request, pathname);
  }
  if (pathname === '/games' || pathname.startsWith('/games/')) {
    return releaseGate(request, pathname);
  }
  // 크롤러를 세려고 들어온 경로(홈 · robots · 사이트맵 …) — 막을 것이 없다.
  return NextResponse.next();
}

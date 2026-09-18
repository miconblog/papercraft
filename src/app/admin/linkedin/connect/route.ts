/**
 * 링크드인 연결 시작 (IDE-037)
 *
 * 관리자만 — 문지기(`proxy.ts`)가 `/admin/*` 를 막지만, 여기도 스스로 한 번 더
 * 본다(`/admin` 화면들이 지켜 온 규칙). `state` 를 쿠키에 심고 동의 화면으로
 * 보낸다. 돌아올 곳(`back`)도 함께 심어 두었다가 콜백이 그리로 보낸다.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/analytics/session';
import {
  LINKEDIN_CALLBACK_PATH,
  LINKEDIN_STATE_COOKIE,
  authorizeUrl,
  linkedinConfig,
  safeBackPath,
  withNotice,
} from '@/lib/share/linkedin';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  if (!hasAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return new NextResponse(null, { status: 404 });
  }

  const back = safeBackPath(request.nextUrl.searchParams.get('back'));
  const config = linkedinConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL(
        withNotice(back, {
          error:
            '링크드인 앱 키가 없습니다. LINKEDIN_CLIENT_ID · LINKEDIN_CLIENT_SECRET 을 넣어 주세요.',
        }),
        request.url,
      ),
    );
  }

  const state = crypto.randomUUID();
  // 콜백 주소는 **이 요청의 호스트**로 만든다 — 로컬과 운영이 각자 돌아오게.
  // 링크드인 앱의 "Authorized redirect URLs" 에 둘 다 적어 둔다.
  const redirectUri = new URL(LINKEDIN_CALLBACK_PATH, request.url).toString();
  const response = NextResponse.redirect(
    authorizeUrl({ clientId: config.clientId, redirectUri, state }),
  );
  response.cookies.set({
    name: LINKEDIN_STATE_COOKIE,
    value: JSON.stringify({ state, back }),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin/linkedin',
    // 동의 화면에서 머뭇거릴 시간. 넘으면 처음부터 다시 누른다.
    maxAge: 10 * 60,
  });
  return response;
}

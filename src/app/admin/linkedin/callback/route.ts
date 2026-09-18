/**
 * 링크드인 연결 마무리 (IDE-037)
 *
 * 동의 화면에서 돌아온다. `state` 가 심어 둔 쿠키와 같은지 보고(CSRF), 코드를
 * 토큰으로 바꾸고, 토큰의 주인(URN · 이름)을 읽어 담는다. 결과는 떠났던 화면에
 * 한 줄로 알린다(`saved` · `error`).
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  ADMIN_COOKIE,
  hasAdminSession,
  safeEqual,
} from '@/lib/analytics/session';
import {
  LINKEDIN_CALLBACK_PATH,
  LINKEDIN_STATE_COOKIE,
  linkedinConfig,
  safeBackPath,
  withNotice,
} from '@/lib/share/linkedin';
import {
  exchangeCode,
  fetchMember,
  saveLinkedInAccount,
} from '@/lib/share/linkedinServer';

export const dynamic = 'force-dynamic';

const readState = (raw: string | undefined) => {
  try {
    const value = JSON.parse(raw ?? '') as { state?: unknown; back?: unknown };
    return typeof value.state === 'string'
      ? { state: value.state, back: safeBackPath(String(value.back ?? '')) }
      : null;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return new NextResponse(null, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const saved = readState(request.cookies.get(LINKEDIN_STATE_COOKIE)?.value);
  const back = saved?.back ?? safeBackPath(null);

  const finish = (notice: { saved: string } | { error: string }) => {
    const response = NextResponse.redirect(
      new URL(withNotice(back, notice), request.url),
    );
    // 한 번 쓴 state 는 버린다 — 같은 콜백 주소를 다시 열어도 통하지 않게.
    response.cookies.set({
      name: LINKEDIN_STATE_COOKIE,
      value: '',
      path: '/admin/linkedin',
      maxAge: 0,
    });
    return response;
  };

  // 동의 화면에서 "취소"를 누르면 `error=user_cancelled_…` 로 온다.
  if (params.get('error')) {
    return finish({ error: '링크드인 연결을 취소했습니다.' });
  }

  const state = params.get('state') ?? '';
  if (!saved || !state || !safeEqual(state, saved.state)) {
    return finish({
      error:
        '링크드인 연결이 만료됐거나 다른 창에서 시작됐습니다. 다시 눌러 주세요.',
    });
  }

  const config = linkedinConfig();
  const code = params.get('code');
  if (!config || !code) {
    return finish({ error: '링크드인 연결에 필요한 값이 없습니다.' });
  }

  const redirectUri = new URL(LINKEDIN_CALLBACK_PATH, request.url).toString();
  const token = await exchangeCode(config, code, redirectUri);
  if (!token) {
    return finish({ error: '링크드인에서 토큰을 받지 못했습니다.' });
  }
  const member = await fetchMember(token.accessToken);
  if (!member) {
    return finish({
      error:
        '링크드인 계정 정보를 읽지 못했습니다. 앱에 "Sign In with LinkedIn using OpenID Connect" 제품이 있는지 확인해 주세요.',
    });
  }

  const result = await saveLinkedInAccount({ ...token, ...member });
  if (!result.ok) return finish({ error: result.message });

  return finish({
    saved: `링크드인 연결됨 — ${member.memberName || '내 계정'}`,
  });
}

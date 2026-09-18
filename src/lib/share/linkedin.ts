/**
 * 링크드인에 바로 올리기 — 순수한 몫 (IDE-037)
 *
 * `IDE-034` 의 "궁극적으로 B(API 자동 게시)" 첫 단추다. 넷 가운데 링크드인이
 * 가장 쉽다 — 개인 계정 게시 권한(`w_member_social`)이 **앱 심사 없이** 열린다.
 *
 * 여기에는 주소 · 본문 · 요청 몸통을 만드는 순수 함수만 둔다. 실제로 부르는
 * 것은 `linkedinServer.ts` 다.
 *
 * ## 규격 (2026-09-19 문서로 확인)
 *
 * - 글: `POST https://api.linkedin.com/rest/posts`. 머리에 `Linkedin-Version:
 *   YYYYMM` 과 `X-Restli-Protocol-Version: 2.0.0`. 만든 글의 URN 은 응답
 *   머리 `x-restli-id` 로 온다
 * - **링크 글의 썸네일을 링크드인이 긁어 오지 않는다.** 제목 · 설명 · 썸네일을
 *   우리가 실어야 한다. 썸네일은 이미지 API 로 먼저 올려 URN 을 받는다
 *   (JPG · PNG · GIF 만)
 * - 본문(`commentary`)은 "little" 형식이라 예약 문자를 `\` 로 풀어 줘야 한다 —
 *   안 풀면 글이 잘리거나 거절된다
 * - 셀프 서비스 앱의 토큰은 **60일**이고 새로 고침 토큰이 없다 — 만료되면 다시
 *   연결한다
 */

type Env = Record<string, string | undefined>;

/**
 * 부를 API 버전(`YYYYMM`). 버전은 약 1년 뒤 닫힌다 — 닫히면 이 값만 올린다.
 * 환경변수 `LINKEDIN_API_VERSION` 이 있으면 그것이 이긴다(배포 없이 올릴 수 있게).
 */
export const LINKEDIN_API_VERSION = '202609';

/** 요청하는 권한. `openid profile` 은 내가 누구인지(URN · 이름)를 읽는 몫이다. */
export const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social'];

/** 콜백 경로. 링크드인 개발자 앱의 "Authorized redirect URLs" 에 그대로 적는다. */
export const LINKEDIN_CALLBACK_PATH = '/admin/linkedin/callback';

/** 본문 한도. 넘으면 API 가 `FIELD_LENGTH_TOO_LONG` 으로 거절한다. */
export const LINKEDIN_COMMENTARY_MAX = 3000;

export type LinkedInConfig = {
  clientId: string;
  clientSecret: string;
  apiVersion: string;
};

const trimmed = (value: string | undefined): string => value?.trim() ?? '';

/** 앱 키가 둘 다 있으면 설정을, 아니면 `null`. 없으면 버튼 대신 안내가 선다. */
export function linkedinConfig(env: Env = process.env): LinkedInConfig | null {
  const clientId = trimmed(env.LINKEDIN_CLIENT_ID);
  const clientSecret = trimmed(env.LINKEDIN_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  const version = trimmed(env.LINKEDIN_API_VERSION);
  return {
    clientId,
    clientSecret,
    apiVersion: /^\d{6}$/.test(version) ? version : LINKEDIN_API_VERSION,
  };
}

/** 동의 화면 주소. `state` 는 콜백에서 쿠키와 견준다(CSRF). */
export function authorizeUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  return `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams(
    {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: LINKEDIN_SCOPES.join(' '),
    },
  )}`;
}

/** 예약 문자. 문서의 Text 문법에 적힌 그대로다. */
const RESERVED = /[\\|{}@[\]()<>#*_~]/g;

/**
 * 사람이 쓴 문구 → little 형식.
 *
 * 예약 문자는 전부 `\` 로 풀고, **해시태그만 템플릿으로 살린다** —
 * 그대로 `\#` 로 풀면 눌리지 않는 글자가 된다. 해시태그는 `#` 뒤에 글자·숫자·
 * 밑줄이 이어지는 낱말이다(한글 포함).
 */
export function littleText(text: string): string {
  const parts: string[] = [];
  let last = 0;
  for (const match of text.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const start = (match.index ?? 0) + match[1].length;
    parts.push(escape(text.slice(last, start)));
    parts.push(`{hashtag|\\#|${escape(match[2])}}`);
    last = start + 1 + match[2].length;
  }
  parts.push(escape(text.slice(last)));
  return parts.join('');
}

const escape = (value: string): string => value.replace(RESERVED, '\\$&');

export type ArticleInput = {
  /** 글 주소(utm 포함). */
  source: string;
  title: string;
  description: string;
  /** 이미지 API 로 올린 썸네일. 못 올렸으면 없이 간다. */
  thumbnail?: string | null;
};

/** 글 만들기 요청 몸통. */
export function postPayload({
  author,
  commentary,
  article,
}: {
  author: string;
  commentary: string;
  article: ArticleInput;
}) {
  return {
    author,
    commentary: littleText(commentary),
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      article: {
        source: article.source,
        title: article.title,
        description: article.description,
        ...(article.thumbnail ? { thumbnail: article.thumbnail } : {}),
      },
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

/** 만든 글을 보는 주소. `x-restli-id` 의 URN 을 그대로 넣는다. */
export const linkedinPostUrl = (urn: string): string =>
  `https://www.linkedin.com/feed/update/${urn}/`;

/** 썸네일로 올릴 수 있는 형식. 나머지(WebP · AVIF)는 썸네일 없이 간다. */
export const THUMBNAIL_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
]);

/** 연결 상태 — 화면이 버튼과 안내를 고른다. */
export type LinkedInStatus =
  | { kind: 'unconfigured' }
  | { kind: 'disconnected' }
  | { kind: 'expired'; name: string }
  | { kind: 'connected'; name: string; expiresAt: number };

/**
 * 만료를 하루 앞당겨 본다 — 올리는 도중에 끊기면 반쯤 된 상태(썸네일만 올라감)가
 * 남는다.
 */
export const EXPIRY_MARGIN_MS = 24 * 60 * 60 * 1000;

/** 연결 중에 들고 다니는 쿠키. 콜백 경로에서만 읽힌다. */
export const LINKEDIN_STATE_COOKIE = 'dc_li_state';

/**
 * 연결을 마치고 돌아갈 곳. **관리자 화면 안의 경로만** 받는다 — 밖의 주소를
 * 받으면 "링크드인 연결" 링크 하나로 남의 사이트로 튕기는 문이 된다.
 */
export function safeBackPath(value: string | null | undefined): string {
  const fallback = '/admin/posts';
  if (!value) return fallback;
  // `//evil.example` 과 `/\evil.example` 은 브라우저가 다른 호스트로 읽는다.
  if (!value.startsWith('/admin/') || /^\/[/\\]/.test(value)) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}

/** 돌아갈 경로에 결과 한 줄을 붙인다. 편집 화면이 `saved` · `error` 를 띄운다. */
export function withNotice(
  path: string,
  notice: { saved: string } | { error: string },
): string {
  const url = new URL(path, 'https://x.invalid');
  for (const key of ['saved', 'error']) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(notice)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

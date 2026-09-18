import 'server-only';

/**
 * 링크드인에 바로 올리기 — 부르는 몫 (IDE-037)
 *
 * 무엇을 보내는지는 `linkedin.ts` 가 정하고, 여기는 **보내고 담는다.** 토큰은
 * 서버 밖으로 나가지 않는다 — 화면에는 연결 상태(이름 · 만료)만 간다.
 *
 * 실패는 감추지 않는다(`rest.ts` 의 쓰기와 같은 태도). "올렸습니다"가 떴는데
 * 링크드인에 없으면 주인은 올린 줄 안다.
 */
import { restRead, restWrite, type WriteResult } from '@/lib/supabase/rest';
import {
  EXPIRY_MARGIN_MS,
  THUMBNAIL_TYPES,
  linkedinConfig,
  linkedinPostUrl,
  type LinkedInConfig,
  type LinkedInStatus,
} from './linkedin';

const LABEL = 'linkedin';
const ACCOUNTS = 'social_accounts';
const POSTS = 'social_posts';

type Account = {
  accessToken: string;
  expiresAt: number;
  memberUrn: string;
  memberName: string;
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** 담긴 계정. 못 읽으면 `null` — 연결 안 된 것과 같이 다룬다. */
export async function linkedinAccount(): Promise<Account | null> {
  const rows = await restRead({
    table: ACCOUNTS,
    query: '?provider=eq.linkedin&select=*',
    // 토큰은 캐시에 남기지 않는다 — 다시 연결한 뒤에도 옛 값을 쓰면 안 된다.
    init: { cache: 'no-store' },
    label: LABEL,
  });
  const row = rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const accessToken = text(row.access_token);
  const memberUrn = text(row.member_urn);
  const expiresAt = Date.parse(text(row.expires_at));
  if (!accessToken || !memberUrn || !Number.isFinite(expiresAt)) return null;
  return {
    accessToken,
    expiresAt,
    memberUrn,
    memberName: text(row.member_name),
  };
}

/** 화면이 버튼과 안내를 고르는 값. 토큰은 싣지 않는다. */
export async function linkedinStatus(
  now: number = Date.now(),
): Promise<LinkedInStatus> {
  if (!linkedinConfig()) return { kind: 'unconfigured' };
  const account = await linkedinAccount();
  if (!account) return { kind: 'disconnected' };
  if (account.expiresAt - EXPIRY_MARGIN_MS <= now) {
    return { kind: 'expired', name: account.memberName };
  }
  return {
    kind: 'connected',
    name: account.memberName,
    expiresAt: account.expiresAt,
  };
}

export const saveLinkedInAccount = (account: Account): Promise<WriteResult> =>
  restWrite({
    table: ACCOUNTS,
    query: '?on_conflict=provider',
    init: {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        provider: 'linkedin',
        access_token: account.accessToken,
        expires_at: new Date(account.expiresAt).toISOString(),
        member_urn: account.memberUrn,
        member_name: account.memberName,
        connected_at: new Date().toISOString(),
      }),
    },
    label: LABEL,
  });

export const forgetLinkedInAccount = (): Promise<WriteResult> =>
  restWrite({
    table: ACCOUNTS,
    query: '?provider=eq.linkedin',
    init: { method: 'DELETE' },
    label: LABEL,
  });

export type PostedRecord = { url: string; postedAt: number };

/** 이 글을 링크드인에 올린 기록. 최근 것이 앞이다. */
export async function linkedinPostsOf(postId: string): Promise<PostedRecord[]> {
  const rows = await restRead({
    table: POSTS,
    query: `?provider=eq.linkedin&post_id=eq.${encodeURIComponent(postId)}&select=url,posted_at&order=posted_at.desc`,
    init: { cache: 'no-store' },
    label: LABEL,
  });
  return (rows ?? []).flatMap((row) => {
    const r = row as Record<string, unknown>;
    const postedAt = Date.parse(text(r.posted_at));
    return text(r.url) && Number.isFinite(postedAt)
      ? [{ url: text(r.url), postedAt }]
      : [];
  });
}

export const recordLinkedInPost = (
  postId: string,
  urn: string,
): Promise<WriteResult> =>
  restWrite({
    table: POSTS,
    init: {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        provider: 'linkedin',
        external_id: urn,
        post_id: postId,
        url: linkedinPostUrl(urn),
      }),
    },
    label: LABEL,
  });

// ── 링크드인 API ────────────────────────────────────────────────────

const apiHeaders = (config: LinkedInConfig, token: string) => ({
  Authorization: `Bearer ${token}`,
  'Linkedin-Version': config.apiVersion,
  'X-Restli-Protocol-Version': '2.0.0',
  'Content-Type': 'application/json',
});

/** 링크드인이 돌려준 오류를 사람 말로. 모르면 상태 코드만 적는다. */
export function explainLinkedInError(status: number, body: string): string {
  if (status === 401) {
    return '링크드인 연결이 끊겼습니다. 다시 연결해 주세요.';
  }
  if (status === 403) {
    return '링크드인이 권한을 거절했습니다. 앱에 "Share on LinkedIn" 제품이 추가돼 있는지 확인해 주세요.';
  }
  if (status === 426 || /VERSION/i.test(body)) {
    return '링크드인 API 버전이 닫혔습니다. LINKEDIN_API_VERSION 을 올려 주세요.';
  }
  if (status === 429) {
    return '링크드인이 잠시 막았습니다(하루 한도). 나중에 다시 올려 주세요.';
  }
  if (/FIELD_LENGTH_TOO_LONG/.test(body)) {
    return '문구가 링크드인 한도(3,000자)를 넘습니다.';
  }
  return `링크드인에 올리지 못했습니다 (${status}).`;
}

/** 인가 코드 → 토큰. */
export async function exchangeCode(
  config: LinkedInConfig,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresAt: number } | null> {
  const response = await fetch(
    'https://www.linkedin.com/oauth/v2/accessToken',
    {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    },
  );
  if (!response.ok) {
    console.warn(`[${LABEL}] 토큰을 받지 못했다:`, response.status);
    return null;
  }
  const body = (await response.json()) as Record<string, unknown>;
  const accessToken = text(body.access_token);
  const expiresIn = Number(body.expires_in);
  if (!accessToken || !Number.isFinite(expiresIn)) return null;
  return { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

/** 토큰의 주인 — 글쓴이 URN 과 화면에 적을 이름. */
export async function fetchMember(
  token: string,
): Promise<{ memberUrn: string; memberName: string } | null> {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    console.warn(`[${LABEL}] 누구인지 읽지 못했다:`, response.status);
    return null;
  }
  const body = (await response.json()) as Record<string, unknown>;
  const sub = text(body.sub);
  if (!sub) return null;
  return { memberUrn: `urn:li:person:${sub}`, memberName: text(body.name) };
}

/**
 * 썸네일을 올리고 URN 을 돌려준다. **실패하면 `null`** — 썸네일 없이도 글은
 * 올라가야 한다. 썸네일 하나 때문에 글을 못 올리면 잃는 것이 더 크다.
 */
export async function uploadThumbnail(
  config: LinkedInConfig,
  token: string,
  owner: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const image = await fetch(imageUrl, { cache: 'no-store' });
    const type = image.headers.get('content-type')?.split(';')[0] ?? '';
    if (!image.ok || !THUMBNAIL_TYPES.has(type)) return null;
    const bytes = await image.arrayBuffer();

    const init = await fetch(
      'https://api.linkedin.com/rest/images?action=initializeUpload',
      {
        method: 'POST',
        cache: 'no-store',
        headers: apiHeaders(config, token),
        body: JSON.stringify({ initializeUploadRequest: { owner } }),
      },
    );
    if (!init.ok) return null;
    const value = ((await init.json()) as { value?: Record<string, unknown> })
      .value;
    const uploadUrl = text(value?.uploadUrl);
    const urn = text(value?.image);
    if (!uploadUrl || !urn) return null;

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
      body: bytes,
    });
    return put.ok ? urn : null;
  } catch (cause) {
    console.warn(`[${LABEL}] 썸네일을 올리지 못했다:`, cause);
    return null;
  }
}

/** 글을 만든다. 성공하면 글 URN 을 돌려준다. */
export async function createLinkedInPost(
  config: LinkedInConfig,
  token: string,
  payload: unknown,
): Promise<{ ok: true; urn: string } | { ok: false; message: string }> {
  try {
    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      cache: 'no-store',
      headers: apiHeaders(config, token),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`[${LABEL}] 글을 만들지 못했다:`, response.status, body);
      return {
        ok: false,
        message: explainLinkedInError(response.status, body),
      };
    }
    const urn = response.headers.get('x-restli-id') ?? '';
    if (!urn) {
      return {
        ok: false,
        message:
          '링크드인이 글 번호를 돌려주지 않았습니다. 링크드인에서 올라갔는지 확인해 주세요.',
      };
    }
    return { ok: true, urn };
  } catch (cause) {
    console.warn(`[${LABEL}] 글을 만들지 못했다:`, cause);
    return { ok: false, message: '링크드인에 닿지 못했습니다.' };
  }
}

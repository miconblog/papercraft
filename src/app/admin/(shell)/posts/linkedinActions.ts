'use server';

/**
 * 링크드인에 바로 올리기 · 연결 끊기 (IDE-037)
 *
 * 올리기는 **리다이렉트하지 않고 결과를 돌려준다.** 편집 화면을 다시 그리면
 * 내보내기 칸에서 고친 문구가 처음 모양으로 돌아간다 — 방금 올린 문구가 무엇이었는지
 * 화면에서 사라진다.
 *
 * 서버 액션은 URL 만 알면 밖에서 부를 수 있다. 그래서 관리자인지, 글이 열려
 * 있는지, 문구가 한도 안인지를 **여기서 다시 본다** — 화면의 버튼이 막아 둔 것은
 * 아무것도 지켜 주지 않는다.
 */
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/analytics/session';
import { isPublished, postById } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';
import { siteUrl } from '@/lib/site';
import {
  EXPIRY_MARGIN_MS,
  LINKEDIN_COMMENTARY_MAX,
  linkedinConfig,
  linkedinPostUrl,
  postPayload,
  safeBackPath,
  withNotice,
} from '@/lib/share/linkedin';
import {
  createLinkedInPost,
  forgetLinkedInAccount,
  linkedinAccount,
  recordLinkedInPost,
  uploadThumbnail,
} from '@/lib/share/linkedinServer';
import {
  EXPORT_TARGETS,
  charCount,
  exportUrl,
} from '@/lib/share/exportTargets';

export type LinkedInPostResult =
  | { ok: true; url: string; thumbnail: boolean; recorded: boolean }
  | { ok: false; message: string };

async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!hasAdminSession(token)) notFound();
}

const fail = (message: string): LinkedInPostResult => ({ ok: false, message });

export async function postToLinkedIn(
  postId: string,
  text: string,
): Promise<LinkedInPostResult> {
  await requireAdmin();

  const config = linkedinConfig();
  if (!config) return fail('링크드인 앱 키가 없습니다.');

  const account = await linkedinAccount();
  if (!account) return fail('링크드인이 연결돼 있지 않습니다.');
  if (account.expiresAt - EXPIRY_MARGIN_MS <= Date.now()) {
    return fail('링크드인 연결이 만료됐습니다. 다시 연결해 주세요.');
  }

  const post = await postById(String(postId));
  // 안 낸 글의 링크는 404 다 — 올려 두면 누른 사람이 전부 빈 화면을 본다.
  if (!post || !isPublished(post)) {
    return fail('공개 중인 글만 올릴 수 있습니다.');
  }

  const commentary = String(text ?? '').trim();
  if (!commentary) return fail('올릴 문구가 비어 있습니다.');
  if (charCount(commentary) > LINKEDIN_COMMENTARY_MAX) {
    return fail(
      `문구가 링크드인 한도(${LINKEDIN_COMMENTARY_MAX.toLocaleString()}자)를 넘습니다.`,
    );
  }

  const target = EXPORT_TARGETS.find((one) => one.id === 'linkedin');
  if (!target) return fail('링크드인 설정을 찾지 못했습니다.');
  const summary = postSummary(post);
  const source = exportUrl(target, {
    origin: siteUrl(),
    slug: post.slug,
    title: post.title,
    summary,
  });

  // 링크드인은 링크 글의 썸네일을 긁어 오지 않는다 — 대표 사진을 올려 싣는다.
  const thumbnail = post.coverUrl
    ? await uploadThumbnail(
        config,
        account.accessToken,
        account.memberUrn,
        post.coverUrl,
      )
    : null;

  const created = await createLinkedInPost(
    config,
    account.accessToken,
    postPayload({
      author: account.memberUrn,
      commentary,
      article: { source, title: post.title, description: summary, thumbnail },
    }),
  );
  if (!created.ok) return created;

  // 기록이 실패해도 글은 이미 올라갔다 — 실패로 돌려주면 주인이 한 번 더 올린다.
  const recorded = await recordLinkedInPost(post.id, created.urn);
  return {
    ok: true,
    url: linkedinPostUrl(created.urn),
    thumbnail: thumbnail !== null,
    recorded: recorded.ok,
  };
}

/** 연결을 끊는다. 담아 둔 토큰을 지운다(링크드인 쪽 앱 권한은 그대로다). */
export async function disconnectLinkedIn(form: FormData): Promise<void> {
  await requireAdmin();
  const back = safeBackPath(String(form.get('back') ?? ''));
  const result = await forgetLinkedInAccount();
  redirect(
    withNotice(
      back,
      result.ok
        ? { saved: '링크드인 연결을 끊었습니다' }
        : { error: result.message },
    ),
  );
}

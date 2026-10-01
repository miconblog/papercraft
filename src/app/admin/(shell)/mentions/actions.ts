'use server';

/**
 * 멘션 승인 · 삭제 · 다시 보내기 (IDE-046)
 *
 * 댓글 액션(`admin/comments/actions.ts`)과 같은 자리이고 같은 태도다 — 문지기를
 * 이미 지나온 요청이지만 여기서도 세션을 본다.
 *
 * **받는 쪽(`lib/mentions/receive.ts`)과 짝이다.** 그쪽은 아무도 확인하지 않고
 * 대신 아무것도 공개하지 않는다. 공개하는 일이 여기 모여 있다.
 */
import { revalidatePath, updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/analytics/session';
import { postById } from '@/lib/blog/posts';
import {
  deleteMention,
  mentionsTag,
  setMentionApproved,
  type WriteResult,
} from '@/lib/mentions/mentions';
import { dispatchMentions } from '@/lib/mentions/send';
import type { MentionKind } from '@/lib/mentions/target';

const LIST = '/admin/mentions';

async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!hasAdminSession(token)) notFound();
}

const str = (form: FormData, name: string): string =>
  String(form.get(name) ?? '').trim();

const isKind = (value: string): value is MentionKind =>
  value === 'game' || value === 'post';

/** 결과를 화면에 남기려고 쿼리로 돌아간다 — 새로고침해도 조작이 다시 안 일어난다. */
const back = (params: Record<string, string>): never =>
  redirect(`${LIST}?${new URLSearchParams(params)}`);

/**
 * 공개된 멘션이 붙는 페이지를 곧바로 다시 그리게 한다.
 *
 * 대상은 폼이 함께 보낸다. 틀린 값이 와도 잘못 깨워지는 것은 남의 페이지
 * 하나다 — 승인 자체는 id 로만 일어난다(댓글 액션에 적은 것과 같다).
 */
function refreshTarget(form: FormData): void {
  const kind = str(form, 'kind');
  const targetId = str(form, 'targetId');
  if (isKind(kind) && targetId) updateTag(mentionsTag(kind, targetId));
}

async function change(
  form: FormData,
  run: (id: string) => Promise<WriteResult>,
  done: string,
): Promise<never> {
  await requireAdmin();

  const id = str(form, 'id');
  if (!id) back({ error: '어느 멘션인지 알 수 없습니다.' });

  const result = await run(id);
  // 성공했든 아니든 깨운다 — 실패한 줄 알았는데 들어간 경우가 있다.
  refreshTarget(form);
  // 사이드 메뉴의 대기 숫자. 레이아웃은 `redirect` 로 돌아가는 이동에서 다시
  // 그려지지 않는다.
  revalidatePath('/admin', 'layout');

  if (!result.ok) back({ error: result.message });
  return back({ done });
}

export async function approveMention(form: FormData): Promise<never> {
  return change(form, (id) => setMentionApproved(id, true), '승인했습니다.');
}

/** 승인 취소 — 대기로 되돌린다. 내리는 스위치를 따로 두지 않았다(017). */
export async function unapproveMention(form: FormData): Promise<never> {
  return change(
    form,
    (id) => setMentionApproved(id, false),
    '대기로 돌렸습니다.',
  );
}

export async function removeMention(form: FormData): Promise<never> {
  return change(form, deleteMention, '삭제했습니다.');
}

/**
 * 글 하나의 멘션을 전부 다시 보낸다.
 *
 * 평소에는 한 번 보낸 링크를 다시 보내지 않는다(`lib/mentions/send.ts`). 받는
 * 쪽이 그때 꺼져 있었거나, 글을 크게 고쳐 다시 알리고 싶을 때 주인이 누른다.
 *
 * **끝날 때까지 기다린다.** 저장할 때는 응답 뒤로 미루지만 여기는 결과를 보려고
 * 누른 버튼이다 — "보내는 중"만 띄우고 돌아가면 됐는지 안 됐는지를 다시 물어야
 * 한다.
 */
export async function resendMentions(form: FormData): Promise<never> {
  await requireAdmin();

  const post = await postById(str(form, 'postId'));
  if (!post) return back({ error: '없는 글입니다.' });

  const summary = await dispatchMentions(post, 'force');
  if (!summary) {
    return back({
      error:
        '보내지 않았습니다. 공개 중인 글이 아니거나, 이 환경에서는 멘션을 보내지 않습니다.',
    });
  }

  const parts = [
    summary.sent > 0 && `${summary.sent}곳에 보냈습니다`,
    summary.failed > 0 && `${summary.failed}곳은 실패했습니다`,
    summary.none > 0 && `${summary.none}곳은 받는 주소가 없습니다`,
    summary.withdrawn > 0 && `뺀 링크 ${summary.withdrawn}곳을 정리했습니다`,
  ].filter(Boolean);
  return back({
    done:
      parts.length > 0
        ? `${post.title} — ${parts.join(' · ')}.`
        : `${post.title} — 보낼 바깥 링크가 없습니다.`,
  });
}

'use server';

/**
 * 댓글 승인·삭제 (IDE-029)
 *
 * 문지기(`proxy.ts`)를 이미 지나온 요청이지만 여기서도 세션을 본다 —
 * `admin/posts/actions.ts` 와 같은 이유다. 서버 액션은 URL 만 알면 밖에서 그대로
 * 부를 수 있고, matcher 한 줄이 바뀌면 문지기는 조용히 사라진다.
 *
 * **댓글을 담는 쪽(`lib/comments/actions.ts`)과 짝이다.** 그쪽은 아무도 확인하지
 * 않고 대신 아무것도 공개하지 않는다. 공개하는 일이 여기 모여 있고, 여기는
 * 확인부터 한다.
 */
import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/analytics/session';
import {
  commentsTag,
  deleteComment,
  setCommentApproved,
  type CommentKind,
  type WriteResult,
} from '@/lib/comments/comments';

const LIST = '/admin/comments';

async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!hasAdminSession(token)) notFound();
}

const str = (form: FormData, name: string): string =>
  String(form.get(name) ?? '').trim();

const isKind = (value: string): value is CommentKind =>
  value === 'game' || value === 'post';

/** 결과를 화면에 남기려고 쿼리로 돌아간다 — 새로고침해도 조작이 다시 안 일어난다. */
const back = (params: Record<string, string>): never =>
  redirect(`${LIST}?${new URLSearchParams(params)}`);

/**
 * 폼이 함께 보내는 대상.
 *
 * 댓글 id 만 받고 대상을 DB 에서 다시 읽어 올 수도 있지만, **깨울 캐시 태그를
 * 알아내려고 읽기를 한 번 더 하는 셈**이다. 목록 화면이 이미 그 값을 들고 있고,
 * 틀린 값이 와도 잘못 깨워지는 것은 남의 페이지 하나다 — 승인 자체는 id 로만
 * 일어나므로 값이 어긋나도 엉뚱한 댓글이 공개되지는 않는다.
 */
type Target = { kind: CommentKind; targetId: string } | null;

const readTarget = (form: FormData): Target => {
  const kind = str(form, 'kind');
  const targetId = str(form, 'targetId');
  return isKind(kind) && targetId ? { kind, targetId } : null;
};

/** 공개된 댓글이 붙는 페이지를 곧바로 다시 그리게 한다. */
function refreshTarget(target: Target): void {
  if (target) updateTag(commentsTag(target.kind, target.targetId));
}

async function change(
  form: FormData,
  run: (id: string) => Promise<WriteResult>,
  done: string,
): Promise<never> {
  await requireAdmin();

  const id = str(form, 'id');
  if (!id) back({ error: '어느 댓글인지 알 수 없습니다.' });

  const result = await run(id);
  // 성공했든 아니든 깨운다 — 실패한 줄 알았는데 들어간 경우까지 1분 동안 옛
  // 화면을 보여 주지 않는다(`lib/blog/posts.ts` 의 메모 버리기와 같은 태도다).
  refreshTarget(readTarget(form));

  if (!result.ok) back({ error: result.message });
  return back({ done });
}

/**
 * **화살표 함수로 두지 않는다.** `'use server'` 파일의 내보내기는 `async function`
 * 이어야 하고, `Promise` 를 돌려주는 화살표는 빌드가 거절한다 — 개발 서버에서는
 * 돌다가 배포 빌드에서만 터진다.
 */
export async function approveComment(form: FormData): Promise<never> {
  return change(form, (id) => setCommentApproved(id, true), '승인했습니다.');
}

/**
 * 승인 취소 — 대기로 되돌린다.
 *
 * 내리는 스위치를 따로 두지 않았다(009 참고). 되돌리면 대기 목록에 다시 올라오고,
 * 그것이 "내려 두었다"와 같은 상태다.
 */
export async function unapproveComment(form: FormData): Promise<never> {
  return change(
    form,
    (id) => setCommentApproved(id, false),
    '대기로 돌렸습니다.',
  );
}

export async function removeComment(form: FormData): Promise<never> {
  return change(form, deleteComment, '삭제했습니다.');
}

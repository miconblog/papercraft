/**
 * 댓글 승인·삭제 서버 액션 — 메뉴 숫자 (IDE-029)
 *
 * 사이드 메뉴의 대기 숫자는 레이아웃이 센다. 레이아웃은 `redirect` 로 돌아가는
 * 이동에서 다시 그려지지 않으므로, 숫자를 바꾸는 액션이 레이아웃을 직접
 * 무효화해야 승인한 댓글이 숫자에서 빠진다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
const notFound = vi.fn(() => {
  throw new Error('NOT_FOUND');
});
const updateTag = vi.fn();
const revalidatePath = vi.fn();
const setCommentApproved = vi.fn();
const deleteComment = vi.fn();

vi.mock('next/headers', () => ({ cookies: async () => ({ get }) }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/cache', () => ({ updateTag, revalidatePath }));
vi.mock('@/lib/comments/comments', () => ({
  commentsTag: (kind: string, id: string) => `comments:${kind}:${id}`,
  setCommentApproved,
  deleteComment,
}));

const { approveComment, removeComment, unapproveComment } =
  await import('../actions');
const { issueSession } = await import('@/lib/analytics/session');

const PASSWORD = 'admin-password-for-tests';

const form = () => {
  const data = new FormData();
  data.set('id', 'c-1');
  data.set('kind', 'game');
  data.set('targetId', 'soccer');
  return data;
};

const settle = async (run: Promise<unknown>) => run.catch(() => {});

beforeEach(() => {
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  get.mockReturnValue({ value: issueSession(PASSWORD) });
  setCommentApproved.mockResolvedValue({ ok: true });
  deleteComment.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('댓글 액션', () => {
  it.each([
    ['승인', approveComment],
    ['대기로 되돌리기', unapproveComment],
    ['삭제', removeComment],
  ])(
    '%s 하면 메뉴 숫자를 위해 관리자 레이아웃을 무효화한다',
    async (_, run) => {
      await settle(run(form()));

      expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
      // 무효화가 리다이렉트보다 먼저다 — 리다이렉트는 던져서 뒤 코드가 안 돈다.
      expect(revalidatePath.mock.invocationCallOrder[0]).toBeLessThan(
        redirect.mock.invocationCallOrder[0],
      );
    },
  );

  it('저장이 실패해도 무효화한다 — 실패한 줄 알았는데 들어간 경우가 있다', async () => {
    setCommentApproved.mockResolvedValue({ ok: false, message: '실패' });

    await settle(approveComment(form()));

    expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
  });

  it('관리자가 아니면 아무것도 안 한다', async () => {
    get.mockReturnValue(undefined);

    await settle(approveComment(form()));

    expect(setCommentApproved).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

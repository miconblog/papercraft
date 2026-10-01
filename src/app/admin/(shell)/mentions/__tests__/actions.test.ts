/**
 * 멘션 승인 · 삭제 · 다시 보내기 서버 액션 (IDE-046)
 *
 * 받는 쪽은 아무도 확인하지 않고 대신 아무것도 공개하지 않는다. 공개가 일어나는
 * 곳이 여기라 **관리자만** 인지를 먼저 보고, 승인한 것이 화면과 메뉴 숫자에
 * 곧바로 드러나는지를 본다.
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
const setMentionApproved = vi.fn();
const deleteMention = vi.fn();
const postById = vi.fn();
const dispatchMentions = vi.fn();

vi.mock('next/headers', () => ({ cookies: async () => ({ get }) }));
vi.mock('next/navigation', () => ({ redirect, notFound }));
vi.mock('next/cache', () => ({ updateTag, revalidatePath }));
vi.mock('@/lib/mentions/mentions', () => ({
  mentionsTag: (kind: string, id: string) => `mentions:${kind}:${id}`,
  setMentionApproved,
  deleteMention,
}));
vi.mock('@/lib/blog/posts', () => ({ postById }));
vi.mock('@/lib/mentions/send', () => ({ dispatchMentions }));

const { approveMention, removeMention, resendMentions, unapproveMention } =
  await import('../actions');
const { issueSession } = await import('@/lib/analytics/session');

const PASSWORD = 'admin-password-for-tests';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const mention = () => form({ id: 'm-1', kind: 'post', targetId: 'p-1' });

/** 액션은 늘 리다이렉트로 끝난다. 돌아간 주소를 디코드해서 돌려준다. */
const redirectedTo = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run;
  } catch (cause) {
    return decodeURIComponent(
      String((cause as Error).message).replace(/\+/g, ' '),
    );
  }
  throw new Error('리다이렉트하지 않았다');
};

beforeEach(() => {
  vi.stubEnv('ANALYTICS_ADMIN_PASSWORD', PASSWORD);
  get.mockReturnValue({ value: issueSession(PASSWORD) });
  setMentionApproved.mockResolvedValue({ ok: true });
  deleteMention.mockResolvedValue({ ok: true });
  postById.mockResolvedValue({ id: 'p-1', title: '윷가락 접기' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('승인 · 삭제', () => {
  it('승인하면 그 대상의 화면과 메뉴 숫자를 함께 깨운다', async () => {
    expect(await redirectedTo(approveMention(mention()))).toContain(
      '승인했습니다',
    );

    expect(setMentionApproved).toHaveBeenCalledWith('m-1', true);
    expect(updateTag).toHaveBeenCalledWith('mentions:post:p-1');
    expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
  });

  it('승인 취소는 대기로 돌린다', async () => {
    await redirectedTo(unapproveMention(mention()));

    expect(setMentionApproved).toHaveBeenCalledWith('m-1', false);
  });

  it('지운다', async () => {
    await redirectedTo(removeMention(mention()));

    expect(deleteMention).toHaveBeenCalledWith('m-1');
    expect(updateTag).toHaveBeenCalledWith('mentions:post:p-1');
  });

  it('저장이 실패하면 감추지 않는다', async () => {
    setMentionApproved.mockResolvedValue({ ok: false, message: '실패했다' });

    expect(await redirectedTo(approveMention(mention()))).toContain(
      'error=실패했다',
    );
  });

  it.each([
    ['승인', approveMention],
    ['대기로 돌리기', unapproveMention],
    ['삭제', removeMention],
  ])('관리자가 아니면 %s 하지 못한다', async (_, run) => {
    get.mockReturnValue(undefined);

    await expect(run(mention())).rejects.toThrow('NOT_FOUND');
    expect(setMentionApproved).not.toHaveBeenCalled();
    expect(deleteMention).not.toHaveBeenCalled();
  });
});

describe('다시 보내기', () => {
  it('그 글의 링크 전부에 다시 보내고 결과를 적어 돌아온다', async () => {
    dispatchMentions.mockResolvedValue({
      sent: 2,
      failed: 1,
      none: 0,
      withdrawn: 0,
    });

    const to = await redirectedTo(resendMentions(form({ postId: 'p-1' })));

    expect(dispatchMentions).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-1' }),
      'force',
    );
    expect(to).toContain('2곳에 보냈습니다');
    expect(to).toContain('1곳은 실패했습니다');
  });

  it('보내지 않았으면 그렇다고 말한다 — 보낸 줄 알면 안 된다', async () => {
    dispatchMentions.mockResolvedValue(null);

    expect(
      await redirectedTo(resendMentions(form({ postId: 'p-1' }))),
    ).toContain('error=보내지 않았습니다');
  });

  it('없는 글에는 보내지 않는다', async () => {
    postById.mockResolvedValue(null);

    expect(
      await redirectedTo(resendMentions(form({ postId: 'nope' }))),
    ).toContain('없는 글');
    expect(dispatchMentions).not.toHaveBeenCalled();
  });

  it('관리자가 아니면 남의 서버를 두드리지 않는다', async () => {
    get.mockReturnValue(undefined);

    await expect(resendMentions(form({ postId: 'p-1' }))).rejects.toThrow(
      'NOT_FOUND',
    );
    expect(dispatchMentions).not.toHaveBeenCalled();
  });
});

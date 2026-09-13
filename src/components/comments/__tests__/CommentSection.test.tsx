/**
 * 댓글 칸 (IDE-029)
 *
 * 지키는 것이 셋이다. **본문을 글자로만 그린다**(서식을 해석하지 않는다) ·
 * **못 읽어도 칸은 선다**(쓰는 칸까지 그대로 열린다) · **승인 안 된 것은 여기
 * 없다**(거르기는 질의가 한다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CommentSection } from '../CommentSection';

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const AT = Date.UTC(2026, 8, 13, 3, 0, 0);

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  target_kind: 'game',
  target_id: 'soccer',
  nickname: '아빠',
  body: '잘 만들었어요',
  approved_at: new Date(AT).toISOString(),
  created_at: new Date(AT).toISOString(),
  ...over,
});

const stubRows = (value: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(value), { status: 200 })),
  );

/** 서버 컴포넌트라 먼저 기다린 뒤에 그린다 — 페이지 테스트와 같은 방식이다. */
const show = async (kind: 'game' | 'post' = 'game', targetId = 'soccer') =>
  render(await CommentSection({ kind, targetId }));

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CommentSection', () => {
  it('댓글과 쓴 사람·날짜를 보여 준다', async () => {
    stubRows([row()]);
    await show();

    expect(screen.getByText('잘 만들었어요')).toBeInTheDocument();
    expect(screen.getByText('아빠')).toBeInTheDocument();
    // 날짜만 적는다 — 익명 댓글에 시각까지 붙이지 않는다.
    expect(screen.getByText('2026년 9월 13일')).toBeInTheDocument();
  });

  it('본문의 태그를 글자로 그린다 — 서식을 해석하지 않는다', async () => {
    stubRows([row({ body: '<img src=x onerror="alert(1)"> **굵게**' })]);
    await show();

    expect(
      screen.getByText('<img src=x onerror="alert(1)"> **굵게**'),
    ).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('strong')).toBeNull();
  });

  it('댓글이 없으면 첫 댓글을 청하고 쓰는 칸은 그대로 열린다', async () => {
    stubRows([]);
    await show();

    expect(screen.getByText(/첫 댓글/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /댓글 남기기/ })).toBeEnabled();
  });

  it('못 읽어도 칸이 선다 — 저장소 사고가 화면을 지우지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    await show();

    expect(screen.getByRole('heading', { name: /댓글/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /댓글 남기기/ })).toBeEnabled();
  });
});

describe('쓰는 칸', () => {
  beforeEach(() => stubRows([]));

  it('승인제라는 것을 미리 말해 준다 — 안 보이는 이유를 알게 한다', async () => {
    await show();
    expect(screen.getByText(/확인한 뒤에 올라갑니다/)).toBeInTheDocument();
  });

  it('어디 달리는 댓글인지를 폼이 함께 보낸다', async () => {
    await show('post', 'post-id-1');

    const form = document.querySelector('form')!;
    const value = (name: string) =>
      form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
    expect(value('kind')).toBe('post');
    expect(value('targetId')).toBe('post-id-1');
  });

  it('덫 칸은 탭 순서에서 빠져 있다', async () => {
    await show();

    const honeypot = document.querySelector<HTMLInputElement>(
      'input[name="website"]',
    )!;
    expect(honeypot.tabIndex).toBe(-1);
  });
});

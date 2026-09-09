'use server';

/**
 * 게임 예약 공개 — 저장·해제 (IDE-022)
 *
 * 문지기(`proxy.ts`)를 이미 지나온 요청이지만 여기서도 세션을 본다. 서버 액션은
 * URL 만 알면 밖에서 그대로 부를 수 있고, matcher 한 줄이 바뀌면 문지기는 조용히
 * 사라진다 — `/admin/analytics` 페이지가 스스로 한 번 더 확인하는 것과 같은
 * 이유다.
 */
import { revalidatePath, updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/analytics/session';
import { getGame } from '@/lib/games';
import {
  RELEASE_TAG,
  clearRelease,
  kstLocalToInstant,
  saveRelease,
  setReleaseHidden,
  type WriteResult,
} from '@/lib/games/release';

const PAGE = '/admin/games';

/** 결과를 화면에 남기려고 쿼리로 돌아간다 — 새로고침해도 폼이 다시 안 날아간다. */
const back = (params: Record<string, string>): never =>
  redirect(`${PAGE}?${new URLSearchParams(params)}`);

async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!hasAdminSession(token)) notFound();
}

/**
 * 바뀐 오픈일을 곧바로 보이게 한다.
 *
 * 홈 목록은 `fetch` 에 걸린 60초 재검증을 타는데, 관리자가 방금 누른 것을
 * 60초 뒤에 보게 두면 저장이 됐는지 안 됐는지 알 수 없다. `updateTag` 는
 * 서버 액션 전용이고 **stale 을 내주지 않는다** — 다음 요청이 새 값을 기다린다.
 */
function refreshLists(): void {
  updateTag(RELEASE_TAG);
  revalidatePath('/');
}

const finish = (result: WriteResult, gameId: string): never =>
  result.ok
    ? back({ saved: gameId })
    : back({ error: result.message, game: gameId });

/** 오픈 시각을 지정한다. 입력은 KST 벽시계다. */
export async function scheduleGame(form: FormData): Promise<void> {
  await requireAdmin();

  const gameId = String(form.get('gameId') ?? '');
  if (!getGame(gameId)) return back({ error: '등록되지 않은 게임입니다.' });

  const publishAt = kstLocalToInstant(String(form.get('publishAt') ?? ''));
  if (publishAt === null) {
    return back({ error: '오픈 날짜와 시각을 확인하세요.', game: gameId });
  }

  const result = await saveRelease(gameId, publishAt);
  refreshLists();
  return finish(result, gameId);
}

/**
 * 예약만 푼다.
 *
 * 내려 둔 게임은 내려 둔 채로 남는다 — 여기서 함께 올리면 "예약을 지우려다
 * 게임을 공개해 버리는" 일이 생긴다.
 */
export async function clearSchedule(form: FormData): Promise<void> {
  await requireAdmin();

  const gameId = String(form.get('gameId') ?? '');
  if (!getGame(gameId)) return back({ error: '등록되지 않은 게임입니다.' });

  const result = await clearRelease(gameId);
  refreshLists();
  return finish(result, gameId);
}

/**
 * 지금 당장 내리거나 다시 올린다 (사용자 요청 2026-09-09).
 *
 * 날짜를 잘못 넣어 게임이 열린 것을 뒤늦게 알았을 때, 미래 시각을 다시 계산해
 * 넣는 것보다 스위치 하나가 빠르고 실수가 적다. 잡아 둔 오픈 시각은 그대로
 * 두므로 올리면 예약이 이어진다.
 */
export async function setGameHidden(form: FormData): Promise<void> {
  await requireAdmin();

  const gameId = String(form.get('gameId') ?? '');
  if (!getGame(gameId)) return back({ error: '등록되지 않은 게임입니다.' });

  const result = await setReleaseHidden(gameId, form.get('hide') === '1');
  refreshLists();
  return finish(result, gameId);
}

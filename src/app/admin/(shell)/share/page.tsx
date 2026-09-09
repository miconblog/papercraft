import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  ShareLinkBuilder,
  type ShareTarget,
} from '@/components/analytics/ShareLinkBuilder';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { GAMES } from '@/lib/games';
import { isOpen, releasesForRequest } from '@/lib/games/release';

export const metadata: Metadata = {
  title: '공유 링크',
  robots: { index: false, follow: false },
};

/** 게임 목록도 공개 상태도 지금 것이어야 한다. */
export const dynamic = 'force-dynamic';

/**
 * 공유 링크의 앞부분.
 *
 * `NEXT_PUBLIC_SITE_URL` 을 먼저 본다 — 미리보기 배포에서 어드민을 열고 링크를
 * 만들면 **미리보기 주소를 세상에 뿌리게 된다.** 그 값이 없을 때만 지금 보고
 * 있는 호스트로 떨어진다(로컬에서 쓰라는 뜻이다).
 */
async function shareOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const incoming = await headers();
  const host = incoming.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

/**
 * 보낼 수 있는 곳.
 *
 * 게임이 늘면 여기도 는다 — 이름을 적어 두지 않는다.
 *
 * **오픈 전이거나 내려 둔 게임도 목록에 남긴다.** 공개에 맞춰 링크를 미리 만들어
 * 두는 것이 이 화면의 쓸모다. 다만 지금 누르면 방문자에게 404 라는 것을 이름
 * 옆에 적는다 — `IDE-022` 로 게임을 감출 수 있게 된 뒤로는, 아무 표시가 없으면
 * 죽은 링크를 세상에 뿌리게 된다.
 */
async function shareTargets(): Promise<ShareTarget[]> {
  const releases = await releasesForRequest();

  return [
    { path: '/', label: '랜딩' },
    ...GAMES.map((game) => ({
      path: `/games/${game.id}`,
      label: isOpen(releases, game.id)
        ? game.title
        : `${game.title} (아직 안 열림)`,
    })),
  ];
}

/**
 * 공유 링크 만들기 (IDE-013 · 화면 분리는 IDE-022)
 *
 * 통계 화면 아래에 붙어 있었다. 하는 일이 다르다 — 저쪽은 **지나간 것을 읽는**
 * 화면이고 이쪽은 **내보낼 것을 만드는** 화면이라, 한 화면에서 스크롤로 만나면
 * 둘 다 찾기 어려워진다. 사이드바가 생긴 김에 갈랐다(2026-09-09 사용자 요청).
 *
 * 문지기는 `proxy.ts` 가 이미 지나갔지만 여기서도 본다 — matcher 한 줄이 바뀌면
 * 그 검사가 조용히 사라진다.
 */
export default async function AdminSharePage() {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">공유 링크</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        어디에 올린 링크가 사람을 데려왔는지 보려면 utm 이 붙어 있어야 합니다.
        손으로 조립하면 어느 날은 <code>facebook</code>, 어느 날은{' '}
        <code>fb</code> 가 되어{' '}
        <strong>한 채널이 표에서 둘로 쪼개집니다.</strong>
      </p>

      <ShareLinkBuilder
        origin={await shareOrigin()}
        targets={await shareTargets()}
      />
    </div>
  );
}

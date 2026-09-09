import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { CalendarClockIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { GAMES } from '@/lib/games';
import {
  formatKst,
  instantToKstLocal,
  isOpen,
  releasesForRequest,
  todayKstMidnight,
} from '@/lib/games/release';
import { clearSchedule, scheduleGame, setGameHidden } from './actions';

export const metadata: Metadata = {
  title: '게임 공개',
  robots: { index: false, follow: false },
};

/** 방금 저장한 값이 보여야 하는 화면이다. 캐시할 것이 없다. */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; game?: string }>;
};

/**
 * 게임 예약 공개 — 오픈일 지정·해제 (IDE-022)
 *
 * **게임 목록은 등록소가 준다.** 여기 담기는 것은 "언제 열리는가" 한 칸뿐이라,
 * 게임을 늘려도 이 화면은 손대지 않는다.
 *
 * 오픈 시각은 **KST 벽시계**로 넣고 KST 로 보여 준다. 날짜만 정하고 시각을 비우면
 * 그날 0시다 — `analyticsDay` 와 같은 경계라 "오픈일의 방문 수"가 이틀에 걸쳐
 * 쪼개지지 않는다.
 *
 * 조작이 **서로 간섭하지 않게** 갈라 둔 것이 이 화면의 규칙이다. 「저장」은
 * 날짜만, 「내리기」는 내림만, 「예약 해제」는 날짜만 건드린다. 하나를 누르다
 * 다른 하나가 조용히 바뀌면 급할 때 믿을 수 없는 화면이 된다.
 */
export default async function AdminGamesPage({ searchParams }: Props) {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const { saved, error, game: erroredGame } = await searchParams;
  const releases = await releasesForRequest();
  // 빈 칸의 기본값은 오늘 0시(KST) 다 — 아무것도 안 고치고 저장하면 "지금 열기"에
  // 가깝게 동작해 놀랄 일이 없다.
  const todayKst = todayKstMidnight();

  // 바깥 틀과 메뉴는 `(shell)/layout.tsx` 가 그린다 — 여기는 게임 목록만.
  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">게임 공개</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        오픈 시각을 지정한 게임은 그때까지{' '}
        <strong>목록에도 없고 주소로 들어가도 404</strong>입니다. PDF 내보내기도
        막힙니다. 로그인한 이 브라우저에서는 오픈 전에도 열어 볼 수 있습니다.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        시각은 <strong>한국 시간(KST)</strong> 입니다. 오픈 시각이 지나면 사람이
        아무것도 하지 않아도 열립니다 — 주소로 들어오는 길은 30초 안에, 홈
        목록은 방문이 있고 나서 1분 안에 반영됩니다.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          저장했습니다 — {GAMES.find((g) => g.id === saved)?.title ?? saved}
        </p>
      )}

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {GAMES.map((game) => {
          const release = releases.get(game.id);
          const open = isOpen(releases, game.id);

          return (
            <li key={game.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{game.title}</h2>
                {release?.hidden ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-retro-brick">
                    <EyeOffIcon className="size-3.5" aria-hidden />
                    내려 둠
                    {release.publishAt !== null &&
                      ` · ${formatKst(release.publishAt)} 예약은 남아 있음`}
                  </span>
                ) : release?.publishAt != null && !open ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-retro-brick">
                    <CalendarClockIcon className="size-3.5" aria-hidden />
                    {formatKst(release.publishAt)} 공개 예정
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    공개 중
                    {release?.publishAt != null &&
                      ` · ${formatKst(release.publishAt)}에 열림`}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <form
                  action={scheduleGame}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="gameId" value={game.id} />
                  <label className="text-sm">
                    <span className="block text-xs text-muted-foreground">
                      오픈 시각 (KST)
                    </span>
                    <input
                      type="datetime-local"
                      name="publishAt"
                      required
                      defaultValue={
                        release?.publishAt == null
                          ? todayKst
                          : instantToKstLocal(release.publishAt)
                      }
                      aria-invalid={erroredGame === game.id || undefined}
                      className="mt-1 rounded-md border border-border-strong bg-popover px-2 py-1.5 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    저장
                  </button>
                </form>

                {/* 날짜를 다시 계산하는 것보다 빠른 길 (사용자 요청
                    2026-09-09). 잡아 둔 오픈 시각은 그대로 두므로, 올리면
                    예약이 이어진다. */}
                <form action={setGameHidden}>
                  <input type="hidden" name="gameId" value={game.id} />
                  <input
                    type="hidden"
                    name="hide"
                    value={release?.hidden ? '0' : '1'}
                  />
                  <button
                    type="submit"
                    className={
                      release?.hidden
                        ? 'rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
                        : 'rounded-full border border-retro-brick/50 px-4 py-2 text-xs font-medium text-retro-brick transition-colors outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
                    }
                  >
                    {release?.hidden ? '다시 올리기' : '지금 내리기'}
                  </button>
                </form>

                {release?.publishAt != null && (
                  <form action={clearSchedule}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-border px-4 py-2 text-xs transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    >
                      예약 해제
                    </button>
                  </form>
                )}

                {/* 공개 전에도 실물을 봐야 날짜를 정한다 — 로그인한 이
                    브라우저는 문지기를 통과한다. */}
                <Link
                  href={`/games/${game.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  <EyeIcon className="size-3.5" aria-hidden />
                  미리보기
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        저장소에 닿지 못하면 <strong>모든 게임이 공개</strong>로 읽힙니다.
        예약이 사라지는 편이 게임이 사라지는 편보다 낫기 때문입니다.
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { ShareLinkBuilder } from '@/components/analytics/ShareLinkBuilder';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { daysAgo, loadReport, type DailyTraffic } from '@/lib/analytics/report';
import { analyticsDay } from '@/lib/analytics/visitor';
import { GAMES, getGame } from '@/lib/games';

export const metadata: Metadata = {
  title: '방문 통계',
  robots: { index: false, follow: false },
};

/** 매번 새로 그린다. 캐시된 통계는 통계가 아니다. */
export const dynamic = 'force-dynamic';

const CHANNEL_LABEL: Record<string, string> = {
  direct: '직접 방문',
  organic: '검색',
  social: '소셜',
  referral: '다른 사이트',
  campaign: '캠페인(utm)',
};

const WINDOW_DAYS = 30;

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
 * 하루 한 칸짜리 막대. 라이브러리를 들이지 않는다 — 눈금 하나 없는 추이
 * 그래프를 위해 번들을 늘릴 이유가 없다.
 *
 * 이벤트가 없는 날은 집계에 줄이 아예 없다. 그대로 그리면 빈 날이 **접혀**
 * 사흘 만에 온 방문이 매일 온 것처럼 보인다 — 그래서 구간을 0 으로 채운다.
 */
function Sparkbars({ days }: { days: DailyTraffic[] }) {
  const today = analyticsDay();
  const byDay = new Map(days.map((day) => [day.day, day]));
  const span = Array.from({ length: WINDOW_DAYS }, (_, index) =>
    daysAgo(today, WINDOW_DAYS - 1 - index),
  );
  const peak = Math.max(1, ...days.map((d) => d.pageviews));

  return (
    <ol className="mt-4 flex h-32 items-end gap-px" aria-hidden>
      {span.map((day) => {
        const row = byDay.get(day);
        const pageviews = row?.pageviews ?? 0;
        return (
          <li
            key={day}
            title={`${day} · 순 PV ${pageviews} · 일간 UV ${row?.visitors ?? 0}`}
            // 0 인 날도 한 줄은 남긴다 — 아예 비면 그날이 있었는지도 안 보인다.
            className="min-h-px flex-1 rounded-t-xs bg-primary/70"
            style={{ height: `${Math.round((pageviews / peak) * 100)}%` }}
          />
        );
      })}
    </ol>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">
        {value.toLocaleString('ko-KR')}
      </dd>
    </div>
  );
}

export default async function AnalyticsPage() {
  // proxy 가 이미 막았지만 여기서 한 번 더 본다. matcher 를 잘못 건드리거나
  // 경로를 옮기면 그 검사가 **조용히** 사라진다.
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const report = await loadReport(WINDOW_DAYS);
  const origin = await shareOrigin();
  // 게임이 늘면 보낼 곳도 같이 는다 — 여기에 이름을 적어 두지 않는다.
  const shareTargets = [
    { path: '/', label: '랜딩' },
    ...GAMES.map((game) => ({
      path: `/games/${game.id}`,
      label: game.title,
    })),
  ];
  const sum = (pick: (d: DailyTraffic) => number) =>
    report.days.reduce((total, day) => total + pick(day), 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">방문 통계</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        최근 {WINDOW_DAYS}일 · 자체 수집 · 제3자에게 넘기지 않습니다.
      </p>

      {!report.available ? (
        <p className="mt-8 rounded-lg border border-border p-4 text-sm">
          수집이 꺼져 있거나 저장소에 닿지 못했습니다. 환경변수(
          <code>SUPABASE_URL</code> · <code>SUPABASE_SERVICE_ROLE_KEY</code> ·{' '}
          <code>ANALYTICS_HASH_SALT</code>)를 확인하세요.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="순 페이지뷰" value={sum((d) => d.pageviews)} />
            <Stat label="세션" value={sum((d) => d.sessions)} />
            <Stat label="PDF 다운로드" value={sum((d) => d.downloads)} />
            <Stat label="일간 UV 합" value={sum((d) => d.visitors)} />
          </dl>

          {/* 이 한 줄을 빼면 넉 달 뒤에 이 숫자를 재방문율로 읽게 된다. */}
          <p className="mt-2 text-xs text-muted-foreground">
            UV 는 <strong>일간</strong> 순방문자입니다. 쿠키를 심지 않고 그날치
            salt 로만 구분하므로, 같은 사람이 사흘 오면 3으로 셉니다 — 위
            &ldquo;일간 UV 합&rdquo;은 기간 순방문자가 아니라 대략치입니다.
          </p>

          {/* 이 한 줄을 빼면 다른 도구의 PV 와 견주다 낮다고 오해한다. */}
          <p className="mt-1 text-xs text-muted-foreground">
            PV 는 <strong>순</strong> 페이지뷰입니다. 한 세션에서 같은 경로는 몇
            번을 새로고침해도 1 로 셉니다 — 다른 화면으로 옮겨 간 것은 그대로
            더해지므로, 이 숫자는 &ldquo;얼마나 눌렀나&rdquo;가 아니라
            &ldquo;얼마나 둘러봤나&rdquo;에 가깝습니다.
          </p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">일자별 순 페이지뷰</h2>
            <Sparkbars days={report.days} />
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">
                일자별 순 페이지뷰·일간 UV·세션
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-1.5 font-medium">
                    날짜
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    PV
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    일간 UV
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    세션
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {report.days.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-muted-foreground">
                      아직 쌓인 이벤트가 없습니다.
                    </td>
                  </tr>
                ) : (
                  [...report.days].reverse().map((day) => (
                    <tr key={day.day} className="border-b border-border/50">
                      <td className="py-1.5">{day.day}</td>
                      <td className="py-1.5 text-right">{day.pageviews}</td>
                      <td className="py-1.5 text-right">{day.visitors}</td>
                      <td className="py-1.5 text-right">{day.sessions}</td>
                      <td className="py-1.5 text-right">{day.downloads}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">어디서 왔나</h2>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">채널별 유입</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-1.5 font-medium">
                    채널
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    PV
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    세션
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {report.channels.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-muted-foreground">
                      아직 없습니다.
                    </td>
                  </tr>
                ) : (
                  report.channels.map((row) => (
                    <tr key={row.channel} className="border-b border-border/50">
                      <td className="py-1.5">
                        {CHANNEL_LABEL[row.channel] ?? row.channel}
                      </td>
                      <td className="py-1.5 text-right">{row.pageviews}</td>
                      <td className="py-1.5 text-right">{row.sessions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">게임별 조회·다운로드</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              다음에 어떤 게임을 만들지는 이 표가 답합니다.
            </p>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">
                게임별 조회수와 PDF 다운로드수
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-1.5 font-medium">
                    게임
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    조회
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {report.games.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-muted-foreground">
                      아직 없습니다.
                    </td>
                  </tr>
                ) : (
                  report.games.map((row) => (
                    <tr key={row.game_id} className="border-b border-border/50">
                      <td className="py-1.5">
                        {getGame(row.game_id)?.title ?? row.game_id}
                      </td>
                      <td className="py-1.5 text-right">{row.views}</td>
                      <td className="py-1.5 text-right">{row.downloads}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* 집계와 무관하게 늘 보인다 — 수집이 아직 안 켜졌어도 링크는 미리
          만들어 둘 수 있어야 한다. */}
      <ShareLinkBuilder origin={origin} targets={shareTargets} />
    </div>
  );
}

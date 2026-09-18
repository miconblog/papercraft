import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { CountryMap } from '@/components/analytics/CountryMap';
import { RangeFilter } from '@/components/analytics/RangeFilter';
import { adminPassword, analyticsConfig } from '@/lib/analytics/config';
import { countryName } from '@/lib/analytics/countryScale';
import {
  bucketsOf,
  describeRange,
  parseRange,
  type Bucket,
} from '@/lib/analytics/range';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import {
  loadReport,
  type CountryTotal,
  type DailyTraffic,
} from '@/lib/analytics/report';
import { sourceLabel } from '@/lib/analytics/channel';
import { analyticsDay } from '@/lib/analytics/visitor';
import { getGame } from '@/lib/games';

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

/** 이 화면의 주소. 기간 필터가 여기로 돌아온다. */
const PATH = '/admin/analytics';

/** 나라 표에 먼저 보이는 줄 수. 나머지는 접어 둔다. */
const COUNTRY_ROWS = 10;

type BucketTotal = Bucket & Omit<DailyTraffic, 'day'>;

/**
 * 일자별 줄을 칸(`bucketsOf`)으로 접는다.
 *
 * 이벤트가 없는 날은 집계에 줄이 아예 없다. 그대로 그리면 빈 날이 **접혀**
 * 사흘 만에 온 방문이 매일 온 것처럼 보인다 — 그래서 칸을 먼저 만들고 0 으로
 * 채운 뒤 더한다.
 */
function foldDays(days: DailyTraffic[], buckets: Bucket[]): BucketTotal[] {
  return buckets.map((bucket) => {
    const inside = days.filter(
      (day) => day.day >= bucket.from && day.day <= bucket.to,
    );
    const sum = (pick: (d: DailyTraffic) => number) =>
      inside.reduce((total, day) => total + Number(pick(day) ?? 0), 0);
    return {
      ...bucket,
      pageviews: sum((d) => d.pageviews),
      visitors: sum((d) => d.visitors),
      sessions: sum((d) => d.sessions),
      downloads: sum((d) => d.downloads),
    };
  });
}

/**
 * 칸 하나짜리 막대. 라이브러리를 들이지 않는다 — 눈금 하나 없는 추이
 * 그래프를 위해 번들을 늘릴 이유가 없다.
 */
function Sparkbars({ buckets }: { buckets: BucketTotal[] }) {
  const peak = Math.max(1, ...buckets.map((b) => b.pageviews));

  return (
    <ol className="mt-4 flex h-32 items-end gap-px" aria-hidden>
      {buckets.map((bucket) => (
        <li
          key={bucket.from}
          title={`${bucket.label} · 순 PV ${bucket.pageviews} · 일간 UV ${bucket.visitors}`}
          // 0 인 칸도 한 줄은 남긴다 — 아예 비면 그 칸이 있었는지도 안 보인다.
          className="min-h-px flex-1 rounded-t-xs bg-primary/70"
          style={{
            height: `${Math.round((bucket.pageviews / peak) * 100)}%`,
          }}
        />
      ))}
    </ol>
  );
}

function CountryRow({ row, total }: { row: CountryTotal; total: number }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-1.5">{countryName(row.country)}</td>
      <td className="py-1.5 text-right">{row.sessions}</td>
      <td className="py-1.5 text-right text-muted-foreground">
        {total ? `${((row.sessions / total) * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="py-1.5 text-right">{row.pageviews}</td>
      <td className="py-1.5 text-right">{row.downloads}</td>
    </tr>
  );
}

/**
 * 나라 표 — 지도의 숫자를 전부 담는다(지도는 색 구간만 보여 준다).
 *
 * 코드를 모르는 줄("알 수 없음")은 순위에서 빼고 맨 아래에 둔다. 로컬 개발
 * 서버나 플랫폼 밖에서 온 요청이라 "어느 나라"의 답이 아니다.
 */
function CountryTable({ countries }: { countries: CountryTotal[] }) {
  const known = countries.filter((c) => c.country);
  const unknown = countries.find((c) => !c.country);
  const total = countries.reduce((sum, c) => sum + c.sessions, 0);
  const head = known.slice(0, COUNTRY_ROWS);
  const rest = known.slice(COUNTRY_ROWS);

  const header = (
    <thead>
      <tr className="border-b border-border text-left">
        <th scope="col" className="py-1.5 font-medium">
          나라
        </th>
        <th scope="col" className="py-1.5 text-right font-medium">
          세션
        </th>
        <th scope="col" className="py-1.5 text-right font-medium">
          비중
        </th>
        <th scope="col" className="py-1.5 text-right font-medium">
          PV
        </th>
        <th scope="col" className="py-1.5 text-right font-medium">
          PDF
        </th>
      </tr>
    </thead>
  );

  if (countries.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        이 기간에는 아직 없습니다.
      </p>
    );
  }

  return (
    <>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">
          나라별 세션·비중·페이지뷰·PDF 다운로드
        </caption>
        {header}
        <tbody className="tabular-nums">
          {head.map((row) => (
            <CountryRow key={row.country} row={row} total={total} />
          ))}
          {unknown && rest.length === 0 && (
            <CountryRow row={unknown} total={total} />
          )}
        </tbody>
      </table>
      {rest.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            나머지 {rest.length}개 나라{unknown ? '와 알 수 없음' : ''}
          </summary>
          <table className="mt-1 w-full">
            <caption className="sr-only">나머지 나라</caption>
            {header}
            <tbody className="tabular-nums">
              {rest.map((row) => (
                <CountryRow key={row.country} row={row} total={total} />
              ))}
              {unknown && <CountryRow row={unknown} total={total} />}
            </tbody>
          </table>
        </details>
      )}
    </>
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

export default async function AnalyticsPage({
  searchParams,
}: PageProps<'/admin/analytics'>) {
  // proxy 가 이미 막았지만 여기서 한 번 더 본다. matcher 를 잘못 건드리거나
  // 경로를 옮기면 그 검사가 **조용히** 사라진다.
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const today = analyticsDay();
  const range = parseRange(await searchParams, today);
  const report = await loadReport(range);
  const sum = (pick: (d: DailyTraffic) => number) =>
    report.days.reduce((total, day) => total + Number(pick(day) ?? 0), 0);
  const { unit, buckets } = bucketsOf(range);
  const trend = foldDays(report.days, buckets);

  // 바깥 틀과 메뉴·로그아웃은 `(shell)/layout.tsx` 가 그린다 — 여기는 통계만.
  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">방문 통계</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {describeRange(range)} · 자체 수집 · 제3자에게 넘기지 않습니다.
      </p>

      <RangeFilter range={range} today={today} action={PATH} />

      {/* 이 안내를 빼면 왜 내 방문이 안 잡히는지 나중에 스스로 헷갈린다. */}
      <p className="mt-2 text-sm text-muted-foreground">
        로그인한 이 브라우저는{' '}
        <strong>사이트 어디를 열어도 집계되지 않습니다.</strong> 다시 세려면
        왼쪽에서 로그아웃하세요.
      </p>

      {!report.available ? (
        <p className="mt-8 rounded-lg border border-border p-4 text-sm">
          저장소에 닿지 못했습니다. 환경변수(
          <code>SUPABASE_URL</code> · <code>SUPABASE_SERVICE_ROLE_KEY</code>)를
          확인하세요.
        </p>
      ) : (
        <>
          {/* 이 한 줄을 빼면 로컬에서 둘러본 뒤 왜 숫자가 안 느는지 헷갈린다. */}
          {!analyticsConfig() && (
            <p className="mt-6 rounded-lg border border-border p-3 text-sm text-muted-foreground">
              이 서버는 <strong>수집이 꺼져 있습니다</strong>(
              <code>ANALYTICS_ENABLED</code>). 아래는 이미 쌓인 숫자이고, 여기서
              둘러보는 것은 세지 않습니다.
            </p>
          )}
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
            <h2 className="text-lg font-semibold">{unit} 순 페이지뷰</h2>
            <Sparkbars buckets={trend} />
            {/* 칸이 많아지면(석 달 넘게 하루씩) 표가 화면을 다 먹는다 — 막대와
                같은 칸으로 묶어 적는다. */}
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  {unit} 순 페이지뷰·일간 UV·세션
                </caption>
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-1.5 font-medium">
                      {unit === '일자별' ? '날짜' : '기간'}
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
                        이 기간에는 쌓인 이벤트가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    [...trend].reverse().map((bucket) => (
                      <tr
                        key={bucket.from}
                        className="border-b border-border/50"
                      >
                        <td className="py-1.5">{bucket.label}</td>
                        <td className="py-1.5 text-right">
                          {bucket.pageviews}
                        </td>
                        <td className="py-1.5 text-right">{bucket.visitors}</td>
                        <td className="py-1.5 text-right">{bucket.sessions}</td>
                        <td className="py-1.5 text-right">
                          {bucket.downloads}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">어느 나라에서 왔나</h2>
            {/* 이 한 줄을 빼면 VPN 으로 들어온 내 방문을 해외 유입으로 읽는다. */}
            <p className="mt-1 text-xs text-muted-foreground">
              접속한 IP 로 배포 플랫폼(Vercel)이 알려 준 나라입니다. VPN 이나
              해외 로밍으로 들어오면 그 나라로 셉니다. 작은 나라는 점으로
              찍습니다.
            </p>
            {report.countries === null ? (
              <p className="mt-3 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                나라별 집계를 읽지 못했습니다. DB 에 마이그레이션{' '}
                <code>011-daily-country.sql</code> 이 적용됐는지 확인하세요.
              </p>
            ) : (
              <>
                <CountryMap countries={report.countries} />
                <CountryTable countries={report.countries} />
              </>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">어디서 왔나</h2>
            {/* 이 한 줄을 빼면 첫 화면만 캠페인이고 나머지는 직접 방문이라고 읽는다. */}
            <p className="mt-1 text-xs text-muted-foreground">
              세션 안에서 옮겨 다닌 화면과 받은 PDF 는{' '}
              <strong>그 세션이 들어온 곳</strong>으로 셉니다.
              카카오톡·인스타그램 안에서 연 링크는 utm 이 없어도 앱 이름으로
              건집니다.
            </p>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">채널별 유입</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-1.5 font-medium">
                    채널
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    세션
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    PV
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {report.channels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-muted-foreground">
                      아직 없습니다.
                    </td>
                  </tr>
                ) : (
                  report.channels.map((row) => (
                    <tr key={row.channel} className="border-b border-border/50">
                      <td className="py-1.5">
                        {CHANNEL_LABEL[row.channel] ?? row.channel}
                      </td>
                      <td className="py-1.5 text-right">{row.sessions}</td>
                      <td className="py-1.5 text-right">{row.pageviews}</td>
                      <td className="py-1.5 text-right">{row.downloads}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">소스 · 매체 · 캠페인</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              소스는 utm_source 가 있으면 그것, 없으면 들어온 사이트, 그것도
              없으면 앱 이름입니다. 한 세션이 도중에 다른 곳을 거쳐 다시
              들어오면 두 줄에 모두 셉니다.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  소스·매체·캠페인별 세션·페이지뷰·PDF 다운로드
                </caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      소스
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      매체
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      캠페인
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">
                      채널
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      세션
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      PV
                    </th>
                    <th scope="col" className="py-1.5 text-right font-medium">
                      PDF
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {report.sources.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-3 text-muted-foreground">
                        아직 없습니다.
                      </td>
                    </tr>
                  ) : (
                    report.sources.map((row) => (
                      <tr
                        key={JSON.stringify([
                          row.channel,
                          row.source,
                          row.medium,
                          row.campaign,
                        ])}
                        className="border-b border-border/50"
                      >
                        <td className="py-1.5 pr-3 break-all">
                          {sourceLabel(row.source)}
                        </td>
                        <td className="py-1.5 pr-3">{row.medium || '—'}</td>
                        <td className="py-1.5 pr-3">{row.campaign || '—'}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {CHANNEL_LABEL[row.channel] ?? row.channel}
                        </td>
                        <td className="py-1.5 text-right">{row.sessions}</td>
                        <td className="py-1.5 text-right">{row.pageviews}</td>
                        <td className="py-1.5 text-right">{row.downloads}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}

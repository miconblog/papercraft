import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { RangeFilter } from '@/components/analytics/RangeFilter';
import { adminPassword } from '@/lib/analytics/config';
import { CHANNEL_LABEL } from '@/lib/analytics/channel';
import {
  FUNNEL_STEPS,
  groupFunnel,
  rateOf,
  type FunnelDimension,
  type FunnelGroup,
  type FunnelRow,
} from '@/lib/analytics/funnel';
import { describeRange, parseRange } from '@/lib/analytics/range';
import { loadFunnel } from '@/lib/analytics/report';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { analyticsDay } from '@/lib/analytics/visitor';
import { getGame } from '@/lib/games';

/**
 * PDF 퍼널 (IDE-035)
 *
 * 방문 통계 화면에 섹션으로 붙어 있다가 따로 나왔다(2026-09-19 사용자 요청).
 * "얼마나 왔나"와 "받기까지 어디서 멈추나"는 묻는 것이 달라, 한 화면에 두면
 * 둘 다 스크롤 너머로 밀린다. 기간 필터는 방문 통계와 같은 것을 쓴다.
 */

export const metadata: Metadata = {
  title: 'PDF 퍼널',
  robots: { index: false, follow: false },
};

/** 매번 새로 그린다. 캐시된 통계는 통계가 아니다. */
export const dynamic = 'force-dynamic';

/** 이 화면의 주소. 기간 필터가 여기로 돌아온다. */
const PATH = '/admin/funnel';

const EMPTY_TOTAL: FunnelGroup = {
  key: '',
  sessions: 0,
  game_views: 0,
  edits: 0,
  print_opens: 0,
  downloads: 0,
  export_fails: 0,
};

const DEVICE_LABEL: Record<string, string> = {
  desktop: '데스크톱',
  mobile: '모바일',
  tablet: '태블릿',
  '': '알 수 없음',
};

/** 비율 한 칸. 첫 단계가 0 이면 잴 것이 없으므로 대시만. */
const Rate = ({ value, base }: { value: number; base: number }) => {
  const rate = rateOf(value, base);
  return (
    <span className="ml-1 text-xs text-muted-foreground">
      {rate === null ? '—' : `${rate}%`}
    </span>
  );
};

/**
 * 전체 퍼널. 단계마다 막대 하나 — 첫 단계(방문)에 대한 비율이다. 바로 앞
 * 단계 대비로 적으면 작은 숫자에서 100% 가 줄줄이 나와 어디서 새는지가 흐려진다.
 */
function FunnelBars({ total }: { total: FunnelGroup }) {
  const base = total.sessions;
  return (
    <ol className="mt-4 space-y-2">
      {FUNNEL_STEPS.map((step) => {
        const value = total[step.key];
        const width =
          base > 0 ? Math.max((value / base) * 100, value > 0 ? 1 : 0) : 0;
        return (
          <li
            key={step.key}
            className="grid grid-cols-[6rem_1fr_6rem] items-center gap-3 text-sm"
          >
            <span>{step.label}</span>
            <span className="h-3 rounded-sm bg-muted" aria-hidden>
              <span
                className="block h-full rounded-sm bg-primary"
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {value}
              <Rate value={value} base={base} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 기준 하나로 가른 퍼널 표. 게임별은 첫 단계가 "그 게임에 닿은 세션"이다. */
function FunnelTable({
  rows,
  by,
  title,
  labelOf,
}: {
  rows: readonly FunnelRow[];
  by: Exclude<FunnelDimension, 'total'>;
  title: string;
  labelOf: (key: string) => string;
}) {
  const groups = groupFunnel(rows, by);
  // 게임별 표의 첫 칸은 방문이 아니라 그 게임의 세션이다 — 게임 화면과 같아
  // 한 칸을 비운다.
  const steps =
    by === 'game'
      ? FUNNEL_STEPS.filter((s) => s.key !== 'sessions')
      : FUNNEL_STEPS;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-1 text-left text-sm font-medium">
          {title}
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              {title.replace(/별$/, '')}
            </th>
            {steps.map((step) => (
              <th
                key={step.key}
                scope="col"
                className="py-1.5 text-right font-medium whitespace-nowrap"
              >
                {step.label}
              </th>
            ))}
            <th
              scope="col"
              className="py-1.5 text-right font-medium whitespace-nowrap"
            >
              막힘
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {groups.length === 0 ? (
            <tr>
              <td
                colSpan={steps.length + 2}
                className="py-3 text-muted-foreground"
              >
                아직 없습니다.
              </td>
            </tr>
          ) : (
            groups.map((group) => {
              const base = group[steps[0].key];
              return (
                <tr key={group.key} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {labelOf(group.key)}
                  </td>
                  {steps.map((step, index) => (
                    <td
                      key={step.key}
                      className="py-1.5 text-right whitespace-nowrap"
                    >
                      {group[step.key]}
                      {index > 0 && (
                        <Rate value={group[step.key]} base={base} />
                      )}
                    </td>
                  ))}
                  <td className="py-1.5 text-right">{group.export_fails}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function FunnelPage({
  searchParams,
}: PageProps<'/admin/funnel'>) {
  // proxy 가 이미 막았지만 여기서 한 번 더 본다 — 방문 통계와 같은 이유.
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const today = analyticsDay();
  const range = parseRange(await searchParams, today);
  const rows = await loadFunnel(range);

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">PDF 퍼널</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {describeRange(range)} · 들어온 사람이 도안을 받기까지 어디서 멈추나.
      </p>

      <RangeFilter range={range} today={today} action={PATH} />

      {/* 이 한 줄을 빼면 편집·출력 창이 0 인 지난 날을 "아무도 안 만졌다"로 읽는다. */}
      <p className="mt-2 text-xs text-muted-foreground">
        단계마다 <strong>닿은 세션 수</strong>이고, 비율은 첫 칸 대비입니다.
        편집 시작·출력 창은 2026-09-19 이후부터 쌓입니다. 막힘은 내보내기가
        거절된(입력 오류) 세션입니다. 로그인한 이 브라우저는 세지 않습니다.
      </p>

      {rows === null ? (
        <p className="mt-8 rounded-lg border border-border p-4 text-sm">
          퍼널 집계를 읽지 못했습니다. 환경변수(<code>SUPABASE_URL</code> ·{' '}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>)와 마이그레이션{' '}
          <code>012-download-funnel.sql</code> 적용을 확인하세요.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">전체</h2>
            <FunnelBars total={groupFunnel(rows, 'total')[0] ?? EMPTY_TOTAL} />
          </section>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">나눠 보기</h2>
            <FunnelTable
              rows={rows}
              by="device"
              title="기기별"
              labelOf={(key) => DEVICE_LABEL[key] ?? key}
            />
            <FunnelTable
              rows={rows}
              by="channel"
              title="채널별"
              labelOf={(key) => CHANNEL_LABEL[key] ?? key}
            />
            <FunnelTable
              rows={rows}
              by="game"
              title="게임별"
              labelOf={(key) => getGame(key)?.title ?? key}
            />
          </section>
        </>
      )}
    </div>
  );
}

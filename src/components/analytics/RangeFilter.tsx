import Form from 'next/form';
import Link from 'next/link';
import { RANGE_PRESETS, type DayRange } from '@/lib/analytics/range';

/**
 * 방문 통계 기간 필터
 *
 * 화면 맨 위 한 줄이다 — 아래의 숫자·그래프·지도·표가 **전부** 이 기간을 따른다.
 * 표마다 기간을 따로 두면 같은 화면의 숫자끼리 맞지 않는다.
 *
 * 자주 쓰는 기간은 버튼 하나로 닿고, 날짜 직접 고르기는 그 뒤에 둔다. 둘 다
 * 주소의 검색 인자로만 움직인다 — 클라이언트 상태가 없어서 새로고침·뒤로가기·
 * 링크 공유가 그대로 된다. `next/form` 이라 제출해도 화면이 통째로 깜박이지
 * 않는다.
 */
export function RangeFilter({
  range,
  today,
  action,
}: {
  range: DayRange;
  today: string;
  /** 이 화면의 주소. */
  action: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
      <nav aria-label="기간" className="flex flex-wrap gap-1.5">
        {RANGE_PRESETS.map((preset) => {
          const active = range.preset === preset.id;
          return (
            <Link
              key={preset.id}
              href={`${action}?range=${preset.id}`}
              aria-current={active ? 'page' : undefined}
              scroll={false}
              className={
                active
                  ? 'rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground'
                  : 'rounded-full border border-border-strong px-3.5 py-1.5 text-sm transition-colors hover:border-primary hover:bg-accent'
              }
            >
              {preset.label}
            </Link>
          );
        })}
      </nav>

      {/* `key` 로 기간이 바뀌면 입력칸을 새로 그린다 — 프리셋을 누른 뒤에도
          칸에 옛 날짜가 남아 있으면 "지금 무엇을 보고 있나"가 헷갈린다. */}
      <Form
        key={`${range.from}~${range.to}`}
        action={action}
        scroll={false}
        className="flex flex-wrap items-center gap-1.5 text-sm"
      >
        <label className="sr-only" htmlFor="range-from">
          시작일
        </label>
        <input
          id="range-from"
          type="date"
          name="from"
          defaultValue={range.from}
          max={today}
          required
          className="rounded-md border border-border-strong bg-popover px-2 py-1 tabular-nums"
        />
        <span aria-hidden className="text-muted-foreground">
          ~
        </span>
        <label className="sr-only" htmlFor="range-to">
          종료일
        </label>
        <input
          id="range-to"
          type="date"
          name="to"
          defaultValue={range.to}
          max={today}
          required
          className="rounded-md border border-border-strong bg-popover px-2 py-1 tabular-nums"
        />
        <button
          type="submit"
          className={
            range.preset === null
              ? 'rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground'
              : 'rounded-full border border-border-strong px-3.5 py-1.5 transition-colors hover:border-primary hover:bg-accent'
          }
        >
          적용
        </button>
      </Form>
    </div>
  );
}

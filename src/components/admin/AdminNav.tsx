'use client';

/**
 * 관리자 사이드바 메뉴 (IDE-022)
 *
 * 화면이 둘이 되면서(통계·게임 공개) 서로 건너갈 자리가 필요해졌다. 그전에는
 * 통계 화면 헤더에 링크를 하나 붙여 뒀는데, 셋째 화면이 생기면 그 방식은 곧
 * 무너진다 — 메뉴는 한 곳에 두고 화면은 자기 내용만 그린다.
 *
 * **지금 어느 화면인지 보이려면 경로를 알아야 해서** 클라이언트 컴포넌트다.
 * 관리자 화면은 어차피 전부 `force-dynamic` 이라 여기서 잃는 것이 없다 —
 * 헤더의 `AdminLink` 가 쿠키를 서버에서 안 읽은 것과는 사정이 다르다. 그쪽은
 * 루트 레이아웃이라 사이트 전체가 정적 렌더링에서 빠졌다.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClockIcon, GaugeIcon, Link2Icon } from 'lucide-react';

/** 화면을 늘리면 여기 한 줄만 더한다. */
const ITEMS = [
  { href: '/admin/analytics', label: '방문 통계', icon: GaugeIcon },
  { href: '/admin/games', label: '게임 공개', icon: CalendarClockIcon },
  { href: '/admin/share', label: '공유 링크', icon: Link2Icon },
] as const;

const BASE =
  'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current md:rounded-md';

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="관리자 메뉴" className="flex flex-wrap gap-1 md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        // 하위 경로까지 켠다 — `/admin/games/무엇` 이 생겨도 메뉴가 꺼지지 않는다.
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            // 스크린리더에게는 색이 아니라 이것이 "지금 여기"를 말한다.
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? `${BASE} bg-secondary font-medium text-foreground`
                : `${BASE} text-muted-foreground hover:bg-secondary/60 hover:text-foreground`
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

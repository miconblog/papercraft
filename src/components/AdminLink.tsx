'use client';

/**
 * 헤더의 관리자 메뉴 (IDE-027)
 *
 * 로그인한 브라우저에만 보인다. 사용자가 지금까지 `/admin` 을 손으로 쳐서
 * 들어갔다(2026-09-09).
 *
 * **왜 서버가 아니라 여기서 판단하나.** 헤더는 루트 레이아웃에 있다. 거기서
 * 쿠키를 읽으면 **사이트 전체가 정적 렌더링에서 빠진다** — `PageViews` 가
 * `useSearchParams` 를 피한 것과 같은 이유다. 링크 하나를 보이자고 모든
 * 페이지를 매번 다시 그릴 수는 없다.
 *
 * 그래서 `dc_owner` 를 `httpOnly` 가 아닌 채로 두고 여기서 읽는다. 비밀이
 * 아니다 — 손으로 만들어 넣어도 링크 하나가 보일 뿐이고, 그 끝에는 비밀번호를
 * 묻는 화면이 있다.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { GaugeIcon } from 'lucide-react';
import { OWNER_COOKIE } from '@/lib/analytics/cookieNames';

/**
 * `document.cookie` 에 그 이름이 있나.
 *
 * `includes('dc_owner=')` 로 보면 `xdc_owner=` 같은 남의 쿠키에 걸린다.
 * 서버 쪽(`isOwnerBrowser`)과 같은 잣대다.
 */
const hasCookie = (name: string): boolean =>
  document.cookie.split(';').some((part) => part.trim().split('=')[0] === name);

/**
 * 쿠키는 바뀌었다고 알려 주지 않는다. 그래서 **다시 볼 때**를 둘 잡는다.
 *
 * 1. 화면을 옮길 때 — 아래 `usePathname` 이 다시 그리게 한다.
 * 2. 탭으로 돌아올 때 — 다른 탭에서 로그인·로그아웃했을 수 있다.
 *
 * 처음에는 1번이 없었다(2026-09-22 사용자 신고: "관리자 메뉴가 사라졌다").
 * 헤더는 루트 레이아웃에 있어 화면을 옮겨도 다시 그려지지 않는데, 로그인은
 * 페이지를 새로 불러오지 않고 끝난다 — 로그인 전에 읽은 "쿠키 없음"이
 * 새로고침할 때까지 남았다.
 */
const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  window.addEventListener('focus', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
    window.removeEventListener('focus', onChange);
  };
};

const readCookie = () => hasCookie(OWNER_COOKIE);

/**
 * 서버가 그리는 값은 **늘 `false`** 다.
 *
 * 서버에는 이 쿠키를 볼 방법이 없고(보면 정적 렌더링이 깨진다), 여기서 `true`
 * 를 내면 하이드레이션이 어긋난다. 관리자에게는 링크가 첫 프레임 뒤에 나타나고,
 * 그 편이 관리자가 아닌 사람의 화면에서 링크가 번쩍이는 것보다 낫다.
 */
const onServer = () => false;

export function AdminLink() {
  // 값은 안 쓴다. 주소가 바뀔 때마다 다시 그려져 쿠키를 새로 읽게 하는 것이
  // 전부다(위 `subscribe` 주석). `useSearchParams` 와 달리 정적 렌더링을
  // 깨지 않는다.
  usePathname();
  const isOwner = useSyncExternalStore(subscribe, readCookie, onServer);

  if (!isOwner) return null;

  return (
    <Link
      href="/admin/analytics"
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors outline-none hover:bg-popover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      <GaugeIcon className="size-3.5" aria-hidden />
      관리자
    </Link>
  );
}

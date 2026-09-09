import type { ReactNode } from 'react';
import { logout } from '@/app/admin/login/actions';
import { AdminNav } from '@/components/admin/AdminNav';

/**
 * 관리자 화면 껍데기 (IDE-022)
 *
 * **`(shell)` 이 라우트 그룹인 이유.** 이걸 `admin/layout.tsx` 로 두면
 * `/admin/login` 까지 감싸서, 아직 들어오지도 못한 사람에게 메뉴와 로그아웃
 * 버튼을 보여 준다. 그룹으로 묶으면 주소는 그대로(`/admin/analytics`)면서
 * 로그인 화면만 빠진다.
 *
 * 좁은 화면에서는 사이드바가 위로 올라가 가로줄이 된다 — 360px 에서 세로 메뉴가
 * 폭을 먹으면 정작 볼 표가 찌그러진다.
 */
export default function AdminShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:gap-10 md:py-10">
      <aside className="flex flex-wrap items-start gap-2 md:w-44 md:shrink-0 md:flex-col md:gap-6">
        <AdminNav />

        {/* 제외를 끄는 유일한 자리다 — 눌러야 이 브라우저가 다시 세어진다
            (IDE-026). 메뉴가 아니라서 `nav` 밖에 둔다. */}
        <form action={logout} className="md:w-full">
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current md:w-full md:rounded-md"
          >
            로그아웃
          </button>
        </form>
      </aside>

      {/* `min-w-0` 이 없으면 표가 넓을 때 사이드바를 밀어낸다. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

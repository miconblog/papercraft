import Link from 'next/link';

/** 모든 라우트에 붙는 헤더. 홈(게임 목록)으로 돌아가는 링크뿐이다 — 지금은
 * 섹션이 카탈로그 하나라 그 이상의 내비게이션이 필요 없다. */
export function SiteHeader() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          종이 보드게임
        </Link>
      </div>
    </header>
  );
}

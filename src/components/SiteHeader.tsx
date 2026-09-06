import Link from 'next/link';

/** 모든 라우트에 붙는 헤더. 홈(게임 목록)으로 돌아가는 링크뿐이다 — 지금은
 * 섹션이 카탈로그 하나라 그 이상의 내비게이션이 필요 없다. */
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-secondary/40">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        {/* 긴 제목이라 좁은 화면에서는 한 단계 작게 — 두 줄로 접히면 헤더
            높이가 들쭉날쭉해진다. */}
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-primary sm:text-lg"
        >
          아이와 함께 만드는 종이 보드게임
        </Link>
      </div>
    </header>
  );
}

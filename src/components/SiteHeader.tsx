import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';

/** 모든 라우트에 붙는 헤더. 홈(게임 목록)으로 돌아가는 링크뿐이다 — 지금은
 * 섹션이 카탈로그 하나라 그 이상의 내비게이션이 필요 없다.
 *
 * 스크롤해도 위에 남는다(2026-09-07 사용자 요청). `fixed`가 아니라 `sticky`인
 * 이유는 보이는 결과가 같으면서 자리를 그대로 차지하기 때문이다 — `fixed`는
 * 헤더가 흐름에서 빠져 본문 첫 줄이 그 아래로 숨고, 그걸 메우려고 본문에
 * 헤더 높이와 같은 여백을 손으로 넣어야 한다(높이가 바뀌면 함께 틀어진다).
 *
 * 배경은 반투명이 아니라 불투명 `bg-secondary`다. 아래를 지나가는 도안·글자가
 * 비치면 제목이 읽히지 않는다. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-secondary">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-base font-bold tracking-tight text-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:text-lg"
        >
          <BrandMark className="size-7 shrink-0" />
          아빠 뭐해?, 아빠 공방
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

import Link from 'next/link';
import { AdminLink } from '@/components/AdminLink';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';

/** 모든 라우트에 붙는 헤더. 홈(게임 목록)과 공방 일지로 가는 길이다 —
 * `IDE-023` 으로 섹션이 둘이 되면서 글로 건너갈 자리가 필요해졌다.
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
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 글은 게임 다음이다 — 처음 온 사람이 먼저 볼 것은 게임판이고,
              공방 일지는 그것을 만든 이야기다(IDE-023). 메뉴 이름은 누구나
              바로 아는 "블로그"로 적는다(2026-09-22 사용자 요청) — 글 목록의
              제목·탭 제목(`BLOG_TITLE`)은 그대로 "공방 일지"다. */}
          <Link
            href="/blog"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            블로그
          </Link>
          {/* 로그인한 브라우저에만 나온다. 서버는 이 판단을 하지 않는다 —
              헤더에서 쿠키를 읽으면 사이트 전체가 정적 렌더링에서 빠진다. */}
          <AdminLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

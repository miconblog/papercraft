/** 모든 라우트 하단에 붙는 푸터. 왼쪽은 저작권, 오른쪽은 만든 사람에게 닿는
 * 링크(문의)다. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© 2026 Daddy&apos;s Craft. All rights reserved</p>
        <nav className="flex items-center gap-4">
          <a
            href="mailto:miconblog@gmail.com"
            className="rounded-sm underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            문의하기
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** 모든 라우트 하단에 붙는 푸터. 프로젝트 한 줄 소개는 README·BOARD와 같은
 * 문구를 쓴다 — 여기서 새로 짓지 않는다. */
export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 dark:border-white/15">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-zinc-500 sm:px-6 dark:text-zinc-400">
        추억의 종이 보드게임을 되살려, 원하는 크기로 인쇄할 수 있는 사이트.
      </div>
    </footer>
  );
}

import Link from 'next/link';

/**
 * 공방 일지의 404 (IDE-023)
 *
 * 사이트의 404 는 "없는 게임일 수 있다 · 게임 목록으로"라고 말한다. 글을 찾다
 * 온 사람에게는 맞지 않는 안내다(2026-09-09 사용자 지적).
 *
 * **아직 안 낸 글도 여기로 온다.** 문지기가 `/blog/__closed` 로 되돌리고 그
 * 화면이 `notFound()` 를 내기 때문인데, 없는 주소와 **같은 화면**이어야 한다 —
 * 다르면 그 차이가 "여기 안 낸 글이 있다"는 신호가 된다.
 */
export default function BlogNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">글을 찾을 수 없다</h1>
      <p className="mt-2 text-muted-foreground">
        주소가 바뀌었거나 아직 내지 않은 글일 수 있다.
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
        <Link href="/blog" className="underline underline-offset-4">
          공방 일지 목록으로
        </Link>
        <Link
          href="/"
          className="text-muted-foreground underline underline-offset-4"
        >
          게임 목록으로
        </Link>
      </div>
    </div>
  );
}

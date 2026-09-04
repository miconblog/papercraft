import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">
        페이지를 찾을 수 없다
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        주소가 바뀌었거나 없는 게임일 수 있다.
      </p>
      <Link
        href="/"
        className="mt-4 text-sm font-medium underline underline-offset-4"
      >
        게임 목록으로
      </Link>
    </div>
  );
}

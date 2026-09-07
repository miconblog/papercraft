import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminPassword } from '@/lib/analytics/config';
import { LoginForm } from './LoginForm';

/** 관리자 화면은 검색에도 공유 카드에도 나오지 않게 한다. */
export const metadata: Metadata = {
  title: '관리자',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: PageProps<'/admin/login'>) {
  // 비밀번호가 없으면 이 경로는 존재하지 않는다.
  if (!adminPassword()) notFound();

  const { next } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">관리자</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        방문 통계를 보려면 비밀번호가 필요합니다.
      </p>
      <LoginForm next={typeof next === 'string' ? next : ''} />
    </div>
  );
}

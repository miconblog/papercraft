import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 헤더에 걸리는 이름과 같은 문구다 — 탭 제목·공유 카드·검색 결과가 사이트에서
// 보이는 이름과 어긋나지 않게 한 곳에서 정한다.
const SITE_TITLE = '아이와 함께 만드는 종이 보드게임';
const SITE_DESCRIPTION =
  '추억의 종이 보드게임을 아이와 함께 만든다. 팀 색과 배치를 원하는 대로 바꿔 집 프린터로 정확한 크기에 맞춰 뽑는다.';
const SITE_AUTHOR = "Daddy's Craft";

// 배포 도메인은 아직 정해지지 않았다(IDE-008, blocked). 정해지면
// NEXT_PUBLIC_SITE_URL로 넘긴다 — 그 전까지는 로컬 기준으로 절대경로를 만든다.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s · ${SITE_TITLE}`,
    default: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_TITLE,
  authors: [{ name: SITE_AUTHOR, url: 'https://buymeacoffee.com/miconblog' }],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
  keywords: [
    '종이 보드게임',
    '보드게임 만들기',
    '아이와 놀기',
    '인쇄 도안',
    '종이 공예',
    'A4 인쇄',
    '축구 게임판',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// themeColor·colorScheme은 Next 14부터 `metadata`가 아니라 이 export에서
// 정한다. 값은 globals.css의 `--background`(라이트/다크)와 같은 색이라
// 모바일 브라우저 크롬까지 크림 종이 색으로 이어진다.
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7efe0' },
    { media: '(prefers-color-scheme: dark)', color: '#261c14' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

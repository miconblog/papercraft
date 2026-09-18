import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PageViews } from '@/components/analytics/PageViews';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import {
  OPEN_GRAPH_BASE,
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  siteUrl,
} from '@/lib/site';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 값은 `lib/site.ts` 가 주인이다 — `sitemap`·`robots` 가 같은 주소를 봐야 한다.
const SITE_URL = siteUrl();

/**
 * 검색엔진 소유 확인 (SEO)
 *
 * 구글 서치 콘솔·네이버 서치어드바이저가 내주는 값을 배포 환경변수에 넣으면
 * `<meta>` 로 실린다. 코드에 적지 않는 것은 사이트를 옮기거나 다시 등록할 때
 * 값이 바뀌기 때문이다. 없으면 태그도 없다.
 */
const GOOGLE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const NAVER_VERIFICATION = process.env.NAVER_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s · ${SITE_TITLE}`,
    default: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_TITLE,
  authors: [{ name: SITE_AUTHOR, url: SITE_AUTHOR_URL }],
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
  // **대표 주소(canonical)는 여기 두지 않는다.** 레이아웃의 값은 자기 것을 안
  // 정한 모든 페이지가 물려받아서, `/games/soccer` 까지 "나는 홈과 같은
  // 페이지"라고 선언하게 된다(2026-09-19 라이브에서 확인) — 검색엔진은 그런
  // 페이지를 홈의 사본으로 보고 따로 싣지 않는다. 페이지마다 자기 주소를 적는다.
  //
  // `og:url` 도 같은 이유로 여기 없다 — 홈이 스스로 적는다.
  openGraph: {
    ...OPEN_GRAPH_BASE,
    type: 'website',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // 카드 모양만 정한다. 제목·설명·그림을 여기 적으면 `openGraph` 를 자기 것으로
  // 적은 페이지(게임·게임 방법·공방 일지)까지 트위터 카드만은 사이트 제목으로
  // 나간다 — 비워 두면 Next 가 페이지의 `openGraph` 에서 채운다.
  twitter: { card: 'summary_large_image' },
  ...((GOOGLE_VERIFICATION || NAVER_VERIFICATION) && {
    verification: {
      ...(GOOGLE_VERIFICATION && { google: GOOGLE_VERIFICATION }),
      ...(NAVER_VERIFICATION && {
        other: { 'naver-site-verification': NAVER_VERIFICATION },
      }),
    },
  }),
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
      // 테마 스크립트가 첫 페인트 전에 `class`를 바꾼다 — 서버가 그린 값과
      // 다른 것이 정상이라 이 노드의 불일치 경고만 끈다.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 리액트가 붙기 전에 동기로 돌아야 해서 next/script가 아니라 raw
            script다. 우리가 만든 고정 문자열이라 외부 입력이 섞이지 않는다. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <PageViews />
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

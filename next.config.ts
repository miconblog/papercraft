import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * PDF 생성기가 런타임에 파일로 읽는 것들 (IDE-007).
   *
   * 번들러가 추적하지 못한다 — 경로를 코드에서 문자열로 조립하기 때문이다.
   * 빠지면 개발 서버에서는 되고 **배포본에서만** 내보내기가 깨진다.
   *
   * - `assets/fonts` — 한글 글자를 윤곽선으로 그릴 때 읽는다(`src/lib/print/font.ts`)
   * - `public/games` — 도안 SVG(`src/app/api/games/[id]/export/route.ts`)
   */
  outputFileTracingIncludes: {
    '/api/games/[id]/export': ['assets/fonts/**', 'public/games/**'],
    '/api/print/probe': ['assets/fonts/**'],
  },
};

export default nextConfig;

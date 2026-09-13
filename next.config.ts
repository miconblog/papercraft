import type { NextConfig } from 'next';
import { ACTION_BODY_LIMIT } from './src/lib/blog/uploadLimit';

const nextConfig: NextConfig = {
  /**
   * 사진이 실린 폼을 받는다 (IDE-028).
   *
   * 서버 액션의 기본 본문 한도는 **1MB** 다. 공방 일지의 사진 넣기는 폰 사진과
   * **쓰던 글 전체**를 한 폼에 실어 보내므로 그 한도에 바로 걸린다 — 사진만
   * 못 넣는 것이 아니라 글까지 함께 못 넘어간다(2026-09-09 사용자 신고).
   *
   * 값은 `src/lib/blog/uploadLimit.ts` 가 주인이다. 업로드 검사와 이 한도가
   * 갈라져 있던 것이 사고의 원인이라, 두 곳이 같은 상수를 본다.
   */
  experimental: {
    serverActions: { bodySizeLimit: ACTION_BODY_LIMIT },
  },

  /**
   * 옛 만들기 주소 (2026-09-12).
   *
   * `/games/<id>` 가 만들기 화면이 되면서 `/games/<id>/edit` 는 없어졌다.
   * 밖에 나간 링크와 사람들의 북마크가 죽지 않게 새 주소로 넘긴다.
   */
  async redirects() {
    return [
      {
        source: '/games/:id/edit',
        destination: '/games/:id',
        permanent: true,
      },
    ];
  },

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

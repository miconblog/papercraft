import { ImageResponse } from 'next/og';
import { getGame } from '@/lib/games';

// 루트 공유 이미지(`src/app/opengraph-image.tsx`)와 같은 이유로 글자는 그리지
// 않는다 — 한글 폰트를 넣기엔 `next/og`의 500KB 번들 한도가 너무 작다.
// og:title·og:description(한글)은 `generateMetadata`가 이미 채운다.
export const alt = '게임 도안 미리보기';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** 게임 id로 고리 색을 고른다 — 게임이 늘어도 이름을 분기하지 않는다. */
const RING_COLORS = ['#2f7d32', '#1d4ed8', '#dc2626', '#a16207', '#7c3aed'];
const ringColorFor = (id: string): string => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return RING_COLORS[Math.abs(hash) % RING_COLORS.length];
};

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ring = ringColorFor(getGame(id)?.id ?? id);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#faf6ef',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 220,
          height: 220,
          borderRadius: 24,
          background: '#ffffff',
          border: '3px solid #1a1a1a',
          boxShadow: '14px 14px 0 #1a1a1a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: `6px solid ${ring}`,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}

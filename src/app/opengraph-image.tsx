import { ImageResponse } from 'next/og';
import { OG_BANDS, OG_COLORS } from '@/lib/og-theme';

/**
 * 공유용 이미지 (IDE-005 "페이지 메타태그와 공유용 이미지")
 *
 * 제목·소개는 그리지 않는다 — 사이트 문구가 전부 한글인데, `next/og`의 기본
 * 폰트는 한글 글리프가 없고 완전한 한글 폰트(Noto Sans KR)는 400% 최대
 * 번들 크기(500KB)를 훨씬 넘는다. 대신 카카오톡·트위터 등은 이 이미지와
 * 별개로 `og:title`·`og:description`(한글 텍스트) 메타를 그대로 보여주므로,
 * 이미지 쪽은 글자 없이 종이 공예를 떠올리게 하는 그림만 맡는다.
 *
 * 색은 사이트와 같은 레트로 팔레트를 쓴다(`OG_COLORS`).
 */
export const alt = '아이와 함께 만드는 종이 보드게임';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_COLORS.paperCream,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 220,
            height: 220,
            borderRadius: 24,
            background: OG_COLORS.paper,
            border: `3px solid ${OG_COLORS.ink}`,
            boxShadow: `14px 14px 0 ${OG_COLORS.brick}`,
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
              border: `6px solid ${OG_COLORS.teal}`,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 40,
            letterSpacing: 6,
            color: OG_COLORS.ink,
            textTransform: 'uppercase',
          }}
        >
          papercraft
        </div>
      </div>

      {/* 아래를 가로지르는 색 맞춤 막대 — 레트로 인쇄물의 표식이다. */}
      <div style={{ display: 'flex', position: 'absolute', bottom: 0 }}>
        {OG_BANDS.map((color) => (
          <div
            key={color}
            style={{ width: 400, height: 16, background: color }}
          />
        ))}
      </div>
    </div>,
    { ...size },
  );
}

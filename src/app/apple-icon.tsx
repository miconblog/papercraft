import { ImageResponse } from 'next/og';
import { OG_COLORS } from '@/lib/og-theme';

// iOS 홈 화면 아이콘. `icon.svg`와 같은 표식을 그린다 — apple-icon 규약은 SVG를
// 받지 않아(png/jpg만) 여기서 이미지로 만든다.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_COLORS.paperCream,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 108,
          height: 108,
          borderRadius: 20,
          background: OG_COLORS.paper,
          border: `5px solid ${OG_COLORS.ink}`,
          boxShadow: `10px 10px 0 ${OG_COLORS.brick}`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `8px solid ${OG_COLORS.teal}`,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}

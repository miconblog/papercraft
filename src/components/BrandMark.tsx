/**
 * 사이트 로고 마크 — 잉크 테두리를 두른 종이 한 장에 청록 고리.
 *
 * 파비콘(`src/app/icon.svg`)·iOS 아이콘(`src/app/apple-icon.tsx`)·공유용
 * 이미지와 **같은 표식**이다. 셋은 각각 정적 SVG·`next/og`·화면용이라 하나로
 * 합칠 수 없다 — 모양을 고칠 때 넷을 함께 고친다.
 *
 * 색은 CSS 변수를 그대로 읽어 라이트·다크를 따라간다. 종이 면만 예외로 늘
 * 흰색이다(`--paper`) — 인쇄되는 종이를 그린 것이라 테마를 따르지 않는다.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect
        x="7.5"
        y="8"
        width="20.5"
        height="20.5"
        rx="4"
        fill="var(--retro-brick)"
      />
      <rect
        x="4"
        y="4"
        width="20.5"
        height="20.5"
        rx="4"
        fill="var(--paper)"
        stroke="var(--foreground)"
        strokeWidth="1.6"
      />
      <circle
        cx="14.25"
        cy="14.25"
        r="6"
        stroke="var(--retro-teal)"
        strokeWidth="2.4"
      />
    </svg>
  );
}

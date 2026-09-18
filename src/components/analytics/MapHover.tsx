'use client';

/**
 * 나라별 지도의 툴팁 (방문 통계 지도)
 *
 * 지도 모양은 서버가 그린다(`CountryMap`) — 나라 경계가 80KB 라서 클라이언트
 * 번들에 실으면 관리자 화면 하나를 위해 그만큼을 내려받는다. 여기는 그 SVG 를
 * `children` 으로 받아 **포인터가 어느 나라 위에 있는지만** 본다. 나라마다
 * 리스너를 달지 않고 바깥 한 곳에서 `data-*` 를 읽는다.
 *
 * 툴팁은 거들 뿐이다 — 같은 숫자가 지도 아래 표에 전부 있다. 방문이 있는
 * 나라는 키보드로도 닿고(`tabIndex`), 초점이 가면 같은 툴팁이 뜬다.
 */
import { useRef, useState, type ReactNode } from 'react';

type Tip = { name: string; value: string; x: number; y: number };

/** 툴팁 폭의 절반쯤. 가운데를 이만큼 안쪽에 두면 양 끝이 틀 안에 남는다. */
const TIP_HALF = 72;

/** 이벤트가 난 요소에서 가장 가까운 나라. */
const countryOf = (target: EventTarget | null): SVGElement | null =>
  target instanceof Element
    ? (target.closest('[data-name]') as SVGElement | null)
    : null;

export function MapHover({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (el: SVGElement | null, x: number, y: number) => {
    if (!el) return setTip(null);
    setTip({
      name: el.dataset.name ?? '',
      value: el.dataset.value ?? '',
      x,
      y,
    });
  };

  /**
   * 화면 좌표 → 틀 안 좌표. 툴팁이 틀 밖으로 나가지 않게 가로를 가둔다 —
   * 렌더 중에는 ref 를 읽을 수 없어서 여기(이벤트 처리기)서 미리 계산한다.
   */
  const local = (clientX: number, clientY: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    const x = clientX - box.left;
    return {
      x: Math.min(Math.max(x, TIP_HALF), box.width - TIP_HALF),
      y: clientY - box.top,
    };
  };

  return (
    <div
      ref={frame}
      className="relative"
      onPointerMove={(event) => {
        const { x, y } = local(event.clientX, event.clientY);
        show(countryOf(event.target), x, y);
      }}
      onPointerLeave={() => setTip(null)}
      onFocus={(event) => {
        const el = countryOf(event.target);
        const box = el?.getBoundingClientRect();
        if (!box) return;
        const { x, y } = local(box.left + box.width / 2, box.top);
        show(el, x, y);
      }}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          role="presentation"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border-strong bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm"
          // 포인터 바로 위에 띄운다.
          style={{ left: tip.x, top: tip.y - 10 }}
        >
          {/* 값이 앞이고 이름이 뒤다 — 읽는 사람은 이미 나라를 가리키고 있다. */}
          <strong className="font-semibold text-foreground tabular-nums">
            {tip.value}
          </strong>{' '}
          <span className="text-muted-foreground">{tip.name}</span>
        </div>
      )}
    </div>
  );
}

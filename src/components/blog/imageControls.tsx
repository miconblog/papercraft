'use client';

/**
 * 사진 조절 조각 — 낱장과 줄이 함께 쓴다 (IDE-028)
 *
 * 사용자 요청(2026-09-10) — "2단이든 3단으로 한 라인에 묶었을 때 각 사진의
 * 너비를 각각 다시 조정할 수 있으면 좋겠고, 묶인 줄도 왼쪽·중앙·오른쪽으로
 * 정렬할 수 있으면 좋겠어."
 *
 * 낱장 사진(`ResizableImage`)에 있던 너비 손잡이와 정렬 단추를 줄
 * (`ImageRow`)에서도 쓰게 되면서 여기로 뺐다. **두 벌로 두면 손잡이의 감각이
 * 조금씩 어긋난다** — 끄는 비율, 키보드 한 칸의 크기, 100% 를 "값 없음"으로
 * 치는 규칙 같은 것들이다.
 *
 * ## 끄는 동안에는 문서를 건드리지 않는다
 *
 * 손을 놓을 때 한 번만 담는다. 움직일 때마다 쓰면 되돌리기 기록이 픽셀 수만큼
 * 쌓여서 **Ctrl+Z 한 번이 1% 를 되돌린다.**
 */
import { createContext, useCallback, useContext, useState } from 'react';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  StarIcon,
} from 'lucide-react';

/** 너비의 아래 끝(%). `lib/blog/doc.ts` 의 `MIN_IMAGE_WIDTH` 와 같은 값이다. */
export const MIN_WIDTH = 20;

export const clampWidth = (value: number): number =>
  Math.min(100, Math.max(MIN_WIDTH, Math.round(value)));

/** 담을 값. 100% 는 기본이라 **담지 않는다**(`null`). */
export const storedWidth = (value: number): number | null =>
  value >= 100 ? null : value;

export type Align = 'left' | 'center' | 'right';

/** 담긴 값 → 화면의 정렬. 모르는 값은 가운데다. */
export const viewAlign = (value: unknown): Align =>
  value === 'left' || value === 'right' ? value : 'center';

/**
 * 손이 간 거리에 곱할 값.
 *
 * **가운데 정렬이면 양쪽이 함께 벌어진다** — 한쪽 손잡이를 끌면 반대쪽도 같은
 * 만큼 움직여, 손이 간 거리의 두 배가 실제로 늘어나는 폭이다. 왼쪽·오른쪽
 * 정렬이면 한쪽 가장자리가 붙박여 있어 한 배다.
 *
 * 전에는 낱장 사진이 늘 두 배였다. 그래서 왼쪽 정렬 사진의 오른쪽 손잡이가 손보다
 * 두 배 빨리 도망갔다. 줄을 붙이면서 같이 바로잡았다.
 */
export const widthFactor = (align: Align): number =>
  align === 'center' ? 2 : 1;

/**
 * 너비 끌기.
 *
 * 누가 끄는지(`key`)를 함께 들고 있어서, 줄처럼 손잡이가 여럿인 곳에서도 **끄는
 * 칸 하나만** 미리 보여 준다.
 *
 * 자리는 **손잡이에서 거슬러 찾는다** — 손잡이의 부모가 사진 상자이고, 그
 * 부모가 100% 에 해당하는 폭이다. 바깥에서 ref 로 넘겨받으면 `NodeViewWrapper`
 * 의 ref 전달 방식이 바뀌는 날 조용히 안 먹는다.
 */
export function useWidthDrag<K>() {
  const [preview, setPreview] = useState<{ key: K; width: number } | null>(
    null,
  );

  const grab = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      key: K,
      side: 1 | -1,
      factor: number,
      commit: (width: number | null) => void,
    ) => {
      const frame = event.currentTarget.parentElement;
      const track = frame?.parentElement;
      if (!frame || !track) return;

      event.preventDefault();

      const full = track.clientWidth;
      if (full === 0) return;
      const startX = event.clientX;
      const startPx = frame.getBoundingClientRect().width;

      const widthAt = (clientX: number) =>
        clampWidth(
          ((startPx + (clientX - startX) * side * factor) / full) * 100,
        );

      const move = (e: PointerEvent) =>
        setPreview({ key, width: widthAt(e.clientX) });

      const done = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', done);
        window.removeEventListener('pointercancel', done);
        setPreview(null);
        commit(storedWidth(widthAt(e.clientX)));
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', done);
      window.addEventListener('pointercancel', done);
    },
    [],
  );

  return { preview, grab };
}

type HandleProps = {
  side: 1 | -1;
  /** 스크린리더가 읽을 이름. 없으면 방향만 말한다. */
  label?: string;
  /** 골라 두었거나 끄는 중이면 늘 보인다. */
  visible: boolean;
  /**
   * 마우스를 올렸을 때 드러내는 클래스. 낱장은 `group-hover:opacity-100`, 줄의
   * 칸은 `group-hover/cell:opacity-100` — Tailwind 가 찾을 수 있게 **글자 그대로**
   * 넘긴다.
   */
  reveal: string;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** 키보드 한 칸(± 5%). 손잡이는 버튼이라 포커스를 받는다. */
  onStep: (delta: number) => void;
};

export function WidthHandle({
  side,
  label,
  visible,
  reveal,
  onPointerDown,
  onStep,
}: HandleProps) {
  return (
    <button
      type="button"
      aria-label={
        label ?? (side === 1 ? '오른쪽에서 너비 조절' : '왼쪽에서 너비 조절')
      }
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        const delta =
          event.key === 'ArrowRight'
            ? 5 * side
            : event.key === 'ArrowLeft'
              ? -5 * side
              : 0;
        if (delta === 0) return;
        event.preventDefault();
        onStep(delta);
      }}
      // 손잡이를 누를 때 글 선택이 끌려가지 않게 한다.
      onMouseDown={(event) => event.preventDefault()}
      className={`absolute top-1/2 z-10 h-12 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-paper bg-retro-teal opacity-0 transition-opacity outline-none focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${reveal} ${
        side === 1 ? 'right-1' : 'left-1'
      } ${visible ? 'opacity-100' : ''}`}
    />
  );
}

/** 끄는 동안 뜨는 `45%` 표시. 자리는 부르는 쪽이 정한다. */
export function WidthBadge({
  width,
  className,
}: {
  width: number;
  className: string;
}) {
  return (
    <span
      className={`absolute z-10 rounded-full bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background tabular-nums ${className}`}
    >
      {width}%
    </span>
  );
}

/** 화면에 놓이는 차례. **왼쪽 → 가운데 → 오른쪽** 으로, 뜻하는 자리와 같게 둔다. */
const ALIGNS = [
  { value: 'left', label: '왼쪽', icon: AlignLeftIcon },
  { value: null, label: '가운데', icon: AlignCenterIcon },
  { value: 'right', label: '오른쪽', icon: AlignRightIcon },
] as const;

/** 정렬 단추 셋. 감싸는 틀(떠 있는 막대)은 부르는 쪽이 그린다. */
export function AlignButtons({
  align,
  onChange,
}: {
  align: Align;
  onChange: (value: 'left' | 'right' | null) => void;
}) {
  return (
    <>
      {ALIGNS.map(({ value, label, icon: Icon }) => {
        const on = (value ?? 'center') === align;
        return (
          <button
            key={label}
            type="button"
            aria-label={`${label} 정렬`}
            aria-pressed={on}
            title={`${label} 정렬`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(value)}
            className={`inline-flex size-7 items-center justify-center rounded outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
              on ? 'bg-secondary text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </>
  );
}

/**
 * 대표 사진 고르기 (2026-09-19 사용자 요청)
 *
 * "사진 마우스 호버하면 좌상단에 정렬 3가지 옵션이 있는데, 그 오른쪽에
 * 대표사진으로 지정 버튼을 넣어서 클릭하면 대표사진으로 지정해줘."
 *
 * 사진 마디는 TipTap 이 그리는 곳이라 폼과 액션을 직접 모른다. 편집기
 * (`Editor`)가 이 문맥으로 **지금 대표 사진이 무엇인지와 고르는 함수**만
 * 내려 준다 — 저장은 편집기가 폼으로 한다. 문맥이 없으면(편집기 밖) 단추도 없다.
 */
export type CoverPick = {
  /** 지금 대표 사진의 주소. 같은 사진이면 단추가 눌린 채로 선다. */
  current: string | null;
  pick: (src: string) => void;
};

export const CoverContext = createContext<CoverPick | null>(null);

/**
 * 대표 사진 단추.
 *
 * `compact` 는 줄의 칸에 붙는 동그란 단추다 — 칸이 좁아 글자가 들어갈 자리가 없다.
 */
export function CoverButton({
  src,
  compact = false,
  reveal = '',
}: {
  src: string;
  compact?: boolean;
  /** 줄의 칸에서 마우스를 올렸을 때 드러내는 클래스(`WidthHandle` 과 같다). */
  reveal?: string;
}) {
  const cover = useContext(CoverContext);
  if (!cover || !src) return null;

  const on = cover.current === src;
  const label = on ? '지금 대표 사진' : '대표 사진으로 지정';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={
        on
          ? '이 사진이 대표 사진입니다'
          : '이 사진을 대표 사진으로 (쓰던 글이 먼저 저장됩니다)'
      }
      // 이미 대표 사진이면 누를 것이 없다 — 눌러도 저장만 한 바퀴 돈다.
      disabled={on}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => cover.pick(src)}
      className={
        compact
          ? `inline-flex size-6 items-center justify-center rounded-full border border-border bg-popover/95 opacity-0 transition-opacity outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${reveal} ${
              on ? 'text-retro-teal opacity-100' : 'text-muted-foreground'
            }`
          : `inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:hover:bg-transparent ${
              on ? 'text-retro-teal' : 'text-muted-foreground'
            }`
      }
    >
      <StarIcon
        className={`size-3.5 ${on ? 'fill-current' : ''}`}
        aria-hidden
      />
      {!compact && (on ? '대표 사진' : '대표 사진으로')}
    </button>
  );
}

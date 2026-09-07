'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * 밝게·어둡게 스위치 (헤더 오른쪽)
 *
 * 지금 테마를 리액트 상태로 들고 있지 않다. 상태로 두면 서버가 그린 HTML(늘
 * 시스템 기준)과 브라우저의 실제 클래스가 어긋나 하이드레이션 경고가 나고,
 * 첫 프레임에 엉뚱한 아이콘이 보인다. 대신 두 아이콘을 모두 그려 놓고
 * `dark:` 유틸리티로 하나만 보이게 한다 — CSS가 `html.dark`를 직접 보므로
 * 자바스크립트가 붙기 전에도 맞는 아이콘이 나온다.
 *
 * 보이는 아이콘은 **바뀔 테마**다 — 밝을 때 달, 어두울 때 해.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = !root.classList.contains('dark');
    root.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // 저장이 막힌 브라우저에서도 이번 방문 동안은 바뀐 채로 둔다.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="밝은 테마와 어두운 테마 전환"
      title="밝게 / 어둡게"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-popover text-foreground transition-colors outline-none hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      <MoonIcon className="size-4 dark:hidden" aria-hidden />
      <SunIcon className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}

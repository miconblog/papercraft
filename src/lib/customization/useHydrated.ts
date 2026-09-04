'use client';

import { useSyncExternalStore } from 'react';

const neverNotifies = () => () => {};

/**
 * 서버 렌더링 이후 브라우저에서 하이드레이션이 끝났는지.
 *
 * `localStorage`처럼 서버에는 없는 값을 읽을 때 흔한 함정이 있다 —
 * `useEffect` 안에서 곧장 `setState`를 부르면 굳이 렌더 한 번을 더
 * 만드는 것과 같아 린트가 막는다(`react-hooks/set-state-in-effect`).
 * `useSyncExternalStore`로 "지금 서버 스냅샷을 쓰는지, 클라이언트
 * 스냅샷을 쓰는지"를 React가 직접 판단하게 하면 이 문제가 없다 —
 * 서버 스냅샷은 항상 `false`, 클라이언트 스냅샷은 항상 `true`이므로
 * 하이드레이션이 끝나는 순간 React가 알아서 다시 그린다.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    neverNotifies,
    () => true,
    () => false,
  );
}

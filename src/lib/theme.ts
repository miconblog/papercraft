/**
 * 테마 선택 (2026-09-07)
 *
 * 사이트는 기본적으로 시스템 설정을 따르되, 헤더 스위치로 사용자가 고르면 그
 * 선택이 이긴다. 고른 값은 이 브라우저에만 남는다 — 서버는 무엇을 고를지
 * 모르므로, 서버가 그린 HTML은 늘 "선택 없음(=시스템)" 상태다.
 */
export const THEME_STORAGE_KEY = 'papercraft:theme';

export type Theme = 'light' | 'dark';

/**
 * `<body>` 맨 앞에서 **동기로** 도는 스크립트. 저장된 선택을, 없으면 시스템
 * 설정을 읽어 `html`에 `dark`를 붙인다.
 *
 * 리액트가 붙기 전에 끝나야 한다 — 하이드레이션을 기다리면 밝은 화면이 한 번
 * 번쩍이고 나서 어두워진다. 그래서 컴포넌트가 아니라 인라인 문자열이다.
 * 실패해도 페이지는 서야 하므로 통째로 try/catch로 감싼다(사생활 보호 모드의
 * localStorage는 접근만 해도 던진다).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

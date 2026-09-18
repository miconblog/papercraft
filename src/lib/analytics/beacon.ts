/**
 * 퍼널 비콘 (IDE-035)
 *
 * 게임 화면과 PDF 사이의 단계 — 값을 처음 바꾼 것, "출력하기" 창을 연 것 — 는
 * 서버에 요청이 없어 브라우저가 알려 줘야 한다.
 *
 * **탭 하나에서 경로마다 한 번만 보낸다.** 드래그 한 번에 값이 수십 번 바뀐다.
 * 서버(`record_event`)도 세션마다 한 줄로 막지만, 셀 생각이 없는 요청을 애초에
 * 내보내지 않는다.
 *
 * 실패해도 아무것도 하지 않는다. 차단기에 막히는 것이 정상 동작이다 — 비율로
 * 읽는 숫자라 조금 빠지는 것은 감수한다.
 */
import { isExcludedPath } from './excluded';

export type FunnelStep = 'edit_start' | 'print_open';

const sentKey = (step: FunnelStep, path: string) =>
  `papercraft:funnel:${step}:${path}`;

/** `sessionStorage` 가 막힌 브라우저(사생활 모드 일부)에서도 한 번만 보내게 한다. */
const sentInMemory = new Set<string>();

const alreadySent = (key: string): boolean => {
  if (sentInMemory.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

const markSent = (key: string) => {
  sentInMemory.add(key);
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // 메모리 표시만으로 이 탭에서는 충분하다.
  }
};

export function sendFunnelStep(step: FunnelStep): void {
  const path = window.location.pathname;
  if (isExcludedPath(path)) return;

  const key = sentKey(step, path);
  if (alreadySent(key)) return;
  markSent(key);

  // referrer 는 싣지 않는다 — 출처는 같은 세션의 앞 줄에서 물려받는다(`010`).
  void fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: step, url: path }),
    keepalive: true,
  }).catch(() => {});
}

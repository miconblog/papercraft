/**
 * KST 벽시계 ↔ 절대 시각 (IDE-022 · IDE-023)
 *
 * 이 사이트의 날짜 경계는 전부 한국 시간이다. 세 곳이 같은 경계를 봐야 한다 —
 * 방문 집계의 하루(`analytics/visitor.ts`), 게임 오픈일(`games/release.ts`),
 * 글 게시 시각(`blog/posts.ts`). 어긋나면 "오픈일의 방문 수"가 이틀에 걸쳐
 * 쪼개지고, 글을 낸 날과 그 글이 처음 읽힌 날이 다른 날로 잡힌다.
 *
 * 원래 `release.ts` 와 `visitor.ts` 에 오프셋이 한 벌씩 있었다. `IDE-023` 이
 * 셋째 사용처가 되면서 여기로 모았다.
 *
 * **`import 'server-only'` 를 붙이지 않는다.** 순수 함수뿐이고, 관리자 화면의
 * 미리보기처럼 브라우저에서도 같은 계산이 필요하다.
 *
 * ## 왜 `Intl` 이 아닌가
 *
 * 한국은 1988년 이후 서머타임이 없어 오프셋이 +09:00 고정이다. 고정된 값을
 * 더하는 편이 시간대 데이터베이스를 끌고 오는 것보다 짧고, 무엇보다 **테스트가
 * 실행 환경의 `TZ` 에 흔들리지 않는다.**
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 로 접은 날짜(`2026-09-09`). 집계의 하루 경계다. */
export const kstDay = (now: Date = new Date()): string =>
  new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/** 절대 시각 → `datetime-local` 에 채워 넣을 KST 벽시계(`2026-09-10T00:00`). */
export const instantToKstLocal = (ms: number): string =>
  new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);

/** `<input type="datetime-local">` 이 보낸 KST 벽시계 → 절대 시각. 못 읽으면 `null`. */
export function kstLocalToInstant(value: string): number | null {
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(
    value.trim(),
  );
  if (!matched) return null;
  const ms = Date.parse(
    `${matched[1]}T${matched[2]}${matched[3] ?? ':00'}+09:00`,
  );
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 오늘 0시(KST) — 관리자 화면의 빈 칸 기본값이다.
 *
 * 화면에서 `Date.now()` 를 직접 부르지 않으려고 여기 둔다. 렌더 중에 부르면
 * 순수성 규칙(`react-hooks/purity`)에 걸리고, 그 규칙이 짚는 것도 맞다 —
 * "지금"은 데이터지 그리는 일이 아니다.
 */
export const todayKstMidnight = (now: number = Date.now()): string =>
  `${instantToKstLocal(now).slice(0, 10)}T00:00`;

/** 사람이 읽을 KST 표기. 시간대를 안 적으면 브라우저 시각으로 오해한다. */
export const formatKst = (ms: number): string =>
  `${instantToKstLocal(ms).replace('T', ' ')} KST`;

/** 목록에 적는 짧은 날짜(`2026년 9월 9일`). 시각까지는 필요 없는 자리에 쓴다. */
export function formatKstDate(ms: number): string {
  const [year, month, day] = kstDay(new Date(ms)).split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

/**
 * `2026-09-07` 에서 며칠 뒤로. 날짜 문자열끼리의 계산이라 시간대가 끼어들 틈이
 * 없다 — `analyticsDay` 가 이미 KST 로 접어 놓은 값을 받는다.
 *
 * `report.ts` 는 서버 전용이라 기간 계산(`range.ts`)이 이것만 따로 가져간다.
 */
export const daysAgo = (day: string, count: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) - count * 86_400_000)
    .toISOString()
    .slice(0, 10);

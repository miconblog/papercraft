/**
 * 세지 않는 경로 (IDE-013)
 *
 * 관리자가 자기 대시보드를 여는 것은 방문이 아니다. 그대로 두면 숫자를 보러
 * 들어갈 때마다 그 행동이 숫자를 늘려서, 볼수록 어긋난다.
 *
 * 브라우저와 서버가 같이 쓴다. 그래서 여기에는 **아무것도 import 하지 않는다**
 * — 게임 등록소처럼 무거운 것을 딸려 오게 하면 클라이언트 번들에 실린다.
 */

/** 이 접두어로 시작하는 경로는 기록하지 않는다. */
const EXCLUDED = ['/admin'];

/**
 * 기록에서 빼는 경로인가.
 *
 * `startsWith` 만으로 보면 `/administrators` 같은 남의 경로까지 삼킨다.
 * 접두어 자신이거나 그 아래(`/admin/...`)일 때만 참이다.
 */
export const isExcludedPath = (path: string): boolean =>
  EXCLUDED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * 수집 스위치 (IDE-013)
 *
 * 환경변수가 없으면 **조용히 끈다.** 로컬과 CI 는 키 없이 돌아야 하고,
 * 분석이 없다고 사이트가 안 뜨면 주객이 뒤바뀐다.
 *
 * 여기서만 `process.env` 를 읽는다 — "켜졌나?"를 판단하는 곳이 두 군데가 되면
 * 한쪽만 고쳐 놓고 왜 안 쌓이는지 찾게 된다.
 */

/** 이 스키마 하나만 쓴다. 환경변수로 두지 않는다 — 오타가 나면 조용히 남의 스키마에 쓴다. */
export const ANALYTICS_SCHEMA = 'daddys_craft';

export type AnalyticsConfig = {
  url: string;
  serviceRoleKey: string;
  hashSalt: string;
};

/** 우리가 읽는 것은 문자열 몇 개뿐이다 — `NodeJS.ProcessEnv` 로 좁힐 이유가 없다. */
type Env = Record<string, string | undefined>;

const trimmed = (value: string | undefined): string => value?.trim() ?? '';

/**
 * 켜져 있으면 설정을, 아니면 `null`.
 *
 * `ANALYTICS_ENABLED` 는 키가 다 있어도 끌 수 있는 스위치다. 비워 두면
 * "키가 다 있으면 켠다"로 읽는다 — 배포 환경에 키를 넣는 것만으로 켜진다.
 */
export function analyticsConfig(
  env: Env = process.env,
): AnalyticsConfig | null {
  const enabled = trimmed(env.ANALYTICS_ENABLED).toLowerCase();
  if (enabled === '0' || enabled === 'false' || enabled === 'off') return null;

  const url = trimmed(env.SUPABASE_URL);
  const serviceRoleKey = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  const hashSalt = trimmed(env.ANALYTICS_HASH_SALT);
  if (!url || !serviceRoleKey || !hashSalt) return null;

  return { url, serviceRoleKey, hashSalt };
}

/** `/admin/analytics` 비밀번호. 없으면 그 경로는 존재하지 않는다(404). */
export const adminPassword = (env: Env = process.env): string | null =>
  trimmed(env.ANALYTICS_ADMIN_PASSWORD) || null;

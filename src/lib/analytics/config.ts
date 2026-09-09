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

/** 같은 Supabase 를 쓰지만 수집과 무관한 것들이 읽는 몫. */
export type SupabaseConnection = Omit<AnalyticsConfig, 'hashSalt'>;

/**
 * Supabase 연결만. **`ANALYTICS_ENABLED` 를 보지 않는다** (IDE-022).
 *
 * 그 스위치는 "방문을 세지 않는다"는 뜻이지 "이 DB 를 안 쓴다"는 뜻이 아니다.
 * 예약 공개(`lib/games/release.ts`)가 그 스위치에 묶여 있으면, 수집을 끄는
 * 순간 **잡아 둔 오픈일이 전부 풀려 게임이 세상에 열린다.**
 */
export function supabaseConnection(
  env: Env = process.env,
): SupabaseConnection | null {
  const url = trimmed(env.SUPABASE_URL);
  const serviceRoleKey = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

/**
 * 수집이 켜져 있으면 설정을, 아니면 `null`.
 *
 * `ANALYTICS_ENABLED` 는 키가 다 있어도 끌 수 있는 스위치다. 비워 두면
 * "키가 다 있으면 켠다"로 읽는다 — 배포 환경에 키를 넣는 것만으로 켜진다.
 */
export function analyticsConfig(
  env: Env = process.env,
): AnalyticsConfig | null {
  const enabled = trimmed(env.ANALYTICS_ENABLED).toLowerCase();
  if (enabled === '0' || enabled === 'false' || enabled === 'off') return null;

  const connection = supabaseConnection(env);
  const hashSalt = trimmed(env.ANALYTICS_HASH_SALT);
  if (!connection || !hashSalt) return null;

  return { ...connection, hashSalt };
}

/** `/admin/analytics` 비밀번호. 없으면 그 경로는 존재하지 않는다(404). */
export const adminPassword = (env: Env = process.env): string | null =>
  trimmed(env.ANALYTICS_ADMIN_PASSWORD) || null;

/**
 * Supabase 클라이언트 — **서버 전용** (IDE-013)
 *
 * `import 'server-only'` 가 첫 줄인 이유: 서비스 롤 키는 RLS 를 통째로
 * 우회한다. 한 번 클라이언트 번들에 들어가면 DB 전체가 열린다 — 런타임에
 * 발견하기엔 늦으므로 **빌드가 깨지게** 한다.
 *
 * 클라이언트를 만드는 곳은 여기 하나뿐이다.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {
  ANALYTICS_SCHEMA,
  analyticsConfig,
  supabaseConnection,
  type SupabaseConnection,
} from './config';

const create = (config: SupabaseConnection) =>
  createClient(config.url, config.serviceRoleKey, {
    db: { schema: ANALYTICS_SCHEMA },
    // 서버끼리 쓰는 연결이다. 세션을 들고 있을 이유도 새로 고칠 이유도 없다.
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** 스키마를 `daddys_craft` 로 못박은 클라이언트. 제네릭을 손으로 적지 않는다. */
export type AnalyticsSupabase = ReturnType<typeof create>;

let cached: AnalyticsSupabase | null = null;

/**
 * 수집이 켜져 있으면 클라이언트를, 아니면 `null`.
 *
 * 부르는 쪽은 `null` 을 "분석 없이 그냥 진행"으로 다뤄야 한다 — 던지지 않는다.
 */
export function analyticsClient(): AnalyticsSupabase | null {
  if (cached) return cached;

  const config = analyticsConfig();
  if (!config) return null;

  cached = create(config);
  return cached;
}

let reportCached: AnalyticsSupabase | null = null;

/**
 * 대시보드가 읽는 클라이언트. **`ANALYTICS_ENABLED` 를 보지 않는다.**
 *
 * 그 스위치는 "방문을 세지 않는다"는 뜻이다(`supabaseConnection` 참고). 로컬에서
 * 개발하며 둘러본 것이 운영 숫자에 섞이지 않게 끄는 것인데, 거기에 조회까지
 * 묶여 있으면 **쌓인 통계를 보려고 수집을 켜야** 한다. 보는 순간 섞인다.
 *
 * 방문자 해시 salt 도 필요 없다 — 읽기만 한다.
 */
export function reportClient(): AnalyticsSupabase | null {
  if (reportCached) return reportCached;

  const config = supabaseConnection();
  if (!config) return null;

  reportCached = create(config);
  return reportCached;
}

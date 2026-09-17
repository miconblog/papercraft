/**
 * 수집 스위치와 조회 (IDE-033)
 *
 * `ANALYTICS_ENABLED=0` 은 "세지 않는다"는 뜻이다. 대시보드까지 꺼지면 쌓인
 * 통계를 보려고 수집을 켜야 하고, 그 순간 로컬의 둘러보기가 운영 숫자에 섞인다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANALYTICS_HASH_SALT: 'test-salt',
};

// 두 클라이언트가 모듈 안에 캐시를 들고 있어 경우마다 새로 불러온다.
const load = async () => {
  vi.resetModules();
  return import('../client');
};

beforeEach(() => {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
});

describe('reportClient', () => {
  it('수집을 꺼도 쌓인 통계는 읽는다', async () => {
    vi.stubEnv('ANALYTICS_ENABLED', '0');
    const { analyticsClient, reportClient } = await load();

    expect(analyticsClient()).toBeNull();
    expect(reportClient()).not.toBeNull();
  });

  it('salt 없이도 읽는다 — 읽기에는 방문자 해시가 필요 없다', async () => {
    vi.stubEnv('ANALYTICS_HASH_SALT', '');
    const { reportClient } = await load();

    expect(reportClient()).not.toBeNull();
  });

  it('연결 정보가 없으면 읽지도 않는다', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { reportClient } = await load();

    expect(reportClient()).toBeNull();
  });
});

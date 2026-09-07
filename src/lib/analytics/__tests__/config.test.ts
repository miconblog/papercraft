import { describe, expect, it } from 'vitest';
import { adminPassword, analyticsConfig } from '../config';

const FULL = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ANALYTICS_HASH_SALT: 'salt',
};

describe('analyticsConfig', () => {
  it('환경변수가 다 있으면 켜진다', () => {
    expect(analyticsConfig(FULL)).toEqual({
      url: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      hashSalt: 'salt',
    });
  });

  it('하나라도 없으면 조용히 꺼진다 — 로컬·CI 가 키 없이 돌아야 한다', () => {
    expect(analyticsConfig({})).toBeNull();
    for (const key of Object.keys(FULL)) {
      expect(analyticsConfig({ ...FULL, [key]: '' }), key).toBeNull();
    }
  });

  it('빈칸만 든 값은 없는 것으로 본다', () => {
    expect(analyticsConfig({ ...FULL, ANALYTICS_HASH_SALT: '   ' })).toBeNull();
  });

  it('키가 다 있어도 스위치로 끌 수 있다', () => {
    for (const off of ['0', 'false', 'off', 'FALSE']) {
      expect(
        analyticsConfig({ ...FULL, ANALYTICS_ENABLED: off }),
        off,
      ).toBeNull();
    }
    expect(analyticsConfig({ ...FULL, ANALYTICS_ENABLED: '1' })).not.toBeNull();
  });
});

describe('adminPassword', () => {
  it('없으면 null — 부르는 쪽이 404 를 낸다', () => {
    expect(adminPassword({})).toBeNull();
    expect(adminPassword({ ANALYTICS_ADMIN_PASSWORD: '  ' })).toBeNull();
  });

  it('있으면 그 값이다', () => {
    expect(adminPassword({ ANALYTICS_ADMIN_PASSWORD: 'hunter2' })).toBe(
      'hunter2',
    );
  });
});

/**
 * GA 싣기 — 화면이 바뀔 때마다 끄기 스위치를 다시 세운다 (IDE-038)
 *
 * 앱 안에서 옮겨 다니면 문서가 안 바뀐다. 처음 한 번만 판정하면 공개 화면에서
 * `/admin` 으로 옮겨 간 뒤에도 GA 가 계속 센다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/script', () => ({ default: () => null }));

const { GoogleAnalytics } = await import('../GoogleAnalytics');
const { disableKey } = await import('@/lib/analytics/google');

const ID = 'G-TEST1234';
const flag = () =>
  (window as unknown as Record<string, unknown>)[disableKey(ID)];

afterEach(() => {
  pathname = '/';
  document.cookie = 'dc_owner=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('GoogleAnalytics', () => {
  it('공개 화면은 보내고, /admin 으로 옮겨 가면 끈다', () => {
    pathname = '/games/soccer';
    const { rerender } = render(<GoogleAnalytics id={ID} />);
    expect(flag()).toBe(false);

    pathname = '/admin/analytics';
    rerender(<GoogleAnalytics id={ID} />);
    expect(flag()).toBe(true);
  });

  it('관리자 브라우저는 공개 화면에서도 끈다', () => {
    document.cookie = 'dc_owner=1';
    pathname = '/games/soccer';
    render(<GoogleAnalytics id={ID} />);
    expect(flag()).toBe(true);
  });
});

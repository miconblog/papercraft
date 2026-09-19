/**
 * 개인정보처리방침 (IDE-038)
 *
 * GA 약관이 요구하는 것 — GA 를 쓴다는 것과 거부하는 법 — 이 실제로 적혀 있고,
 * 묻는 곳이 있는지 본다.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPage from '../page';
import { PRIVACY_PAGE_OPEN, PrivacyContent } from '@/components/PrivacyContent';

describe('PrivacyPage', () => {
  it('GA 사용 · 쿠키 · 거부하는 법을 적는다', () => {
    render(<PrivacyContent />);
    expect(
      screen.getByRole('heading', { name: /Google Analytics/ }),
    ).toBeTruthy();
    expect(document.body.textContent).toContain('_ga');
    expect(
      screen
        .getByRole('link', { name: 'Google Analytics 차단 부가기능' })
        .getAttribute('href'),
    ).toContain('tools.google.com/dlpage/gaoptout');
  });

  it('자체 통계가 IP 원본을 남기지 않는다고 적는다', () => {
    render(<PrivacyContent />);
    expect(document.body.textContent).toContain('IP 주소 원본은 저장하지 않고');
  });

  it('묻고 지우기를 청할 곳이 있다', () => {
    render(<PrivacyContent />);
    expect(
      screen
        .getByRole('link', { name: 'miconblog@gmail.com' })
        .getAttribute('href'),
    ).toBe('mailto:miconblog@gmail.com');
  });
});

describe('숨겨 둔 동안 (2026-09-19 사용자 결정)', () => {
  it('주소가 닫혀 있다 — 404', () => {
    expect(PRIVACY_PAGE_OPEN).toBe(false);
    expect(() => PrivacyPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

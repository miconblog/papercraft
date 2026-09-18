/**
 * 링크드인에 바로 올리기 — 순수한 몫 (IDE-037)
 *
 * 링크드인은 틀린 값을 조용히 받아 이상하게 그리거나(탈출 안 한 `*` · `_`),
 * 거절한다. 그래서 보내기 전 모양을 여기서 못 박는다.
 */
import { describe, expect, it } from 'vitest';
import {
  LINKEDIN_API_VERSION,
  authorizeUrl,
  linkedinConfig,
  littleText,
  postPayload,
  safeBackPath,
  withNotice,
} from '../linkedin';

describe('littleText', () => {
  it('예약 문자를 전부 `\\` 로 푼다 — 안 풀면 글이 잘리거나 거절된다', () => {
    expect(littleText('a_b*c~d(e)[f]{g}<h>|i@j\\k')).toBe(
      'a\\_b\\*c\\~d\\(e\\)\\[f\\]\\{g\\}\\<h\\>\\|i\\@j\\\\k',
    );
  });

  it('주소의 밑줄도 푼다 — utm 이 붙은 링크가 기울임으로 깨지지 않게', () => {
    expect(littleText('https://x.com/?utm_source=linkedin')).toBe(
      'https://x.com/?utm\\_source=linkedin',
    );
  });

  it('해시태그는 템플릿으로 살린다 — 한글 태그도', () => {
    expect(littleText('#아빠공방 #종이보드게임')).toBe(
      '{hashtag|\\#|아빠공방} {hashtag|\\#|종이보드게임}',
    );
  });

  it('낱말 가운데의 `#` 은 해시태그가 아니다', () => {
    expect(littleText('C# 과 a#b')).toBe('C\\# 과 a\\#b');
  });

  it('줄바꿈과 한글은 그대로다', () => {
    expect(littleText('제목\n\n요약')).toBe('제목\n\n요약');
  });
});

describe('linkedinConfig', () => {
  it('키가 하나라도 없으면 없는 것이다', () => {
    expect(linkedinConfig({ LINKEDIN_CLIENT_ID: 'id' })).toBeNull();
  });

  it('버전은 YYYYMM 이 아니면 기본값이다', () => {
    const base = { LINKEDIN_CLIENT_ID: 'id', LINKEDIN_CLIENT_SECRET: 's' };
    expect(linkedinConfig(base)?.apiVersion).toBe(LINKEDIN_API_VERSION);
    expect(
      linkedinConfig({ ...base, LINKEDIN_API_VERSION: '202701' })?.apiVersion,
    ).toBe('202701');
    expect(
      linkedinConfig({ ...base, LINKEDIN_API_VERSION: '2027-01' })?.apiVersion,
    ).toBe(LINKEDIN_API_VERSION);
  });
});

describe('authorizeUrl', () => {
  it('글쓰기 권한과 내가 누구인지 읽는 권한을 함께 청한다', () => {
    const url = new URL(
      authorizeUrl({
        clientId: 'cid',
        redirectUri: 'https://example.com/admin/linkedin/callback',
        state: 'st',
      }),
    );
    expect(url.origin).toBe('https://www.linkedin.com');
    expect(url.searchParams.get('scope')).toBe(
      'openid profile w_member_social',
    );
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://example.com/admin/linkedin/callback',
    );
  });
});

describe('postPayload', () => {
  const payload = postPayload({
    author: 'urn:li:person:abc',
    commentary: '제목 #아빠공방',
    article: {
      source: 'https://example.com/blog/a?utm_source=linkedin',
      title: '제목',
      description: '요약',
      thumbnail: 'urn:li:image:1',
    },
  });

  it('공개 · 본 피드 · 링크 글이다', () => {
    expect(payload.visibility).toBe('PUBLIC');
    expect(payload.distribution.feedDistribution).toBe('MAIN_FEED');
    expect(payload.lifecycleState).toBe('PUBLISHED');
    expect(payload.content.article.source).toBe(
      'https://example.com/blog/a?utm_source=linkedin',
    );
  });

  it('본문은 little 형식으로 간다', () => {
    expect(payload.commentary).toBe('제목 {hashtag|\\#|아빠공방}');
  });

  it('썸네일이 없으면 칸째 뺀다 — 빈 값을 보내면 거절된다', () => {
    const bare = postPayload({
      author: 'urn:li:person:abc',
      commentary: 'x',
      article: { source: 's', title: 't', description: 'd', thumbnail: null },
    });
    expect('thumbnail' in bare.content.article).toBe(false);
  });
});

describe('safeBackPath', () => {
  it('관리자 화면 안의 경로만 받는다', () => {
    expect(safeBackPath('/admin/posts/abc')).toBe('/admin/posts/abc');
  });

  it('밖으로 튕기는 주소는 목록으로 돌린다', () => {
    for (const bad of [
      'https://evil.example/admin/',
      '//evil.example/admin/',
      '/\\evil.example',
      '/blog/a',
      '/admin/x\r\nSet-Cookie: a=b',
      '',
      null,
    ]) {
      expect(safeBackPath(bad), String(bad)).toBe('/admin/posts');
    }
  });
});

describe('withNotice', () => {
  it('옛 알림을 지우고 새 알림을 붙인다', () => {
    expect(withNotice('/admin/posts/a?error=옛것', { saved: '연결됨' })).toBe(
      `/admin/posts/a?saved=${encodeURIComponent('연결됨')}`,
    );
  });
});

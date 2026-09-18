/**
 * SNS 내보내기 (IDE-034)
 *
 * 지키는 것이 셋이다. **링크가 표의 소셜 칸에 플랫폼별로 잡힌다**(수집 쪽과 같은
 * 함수로) · **한도를 넘지 않는다** · **넘칠 때도 링크는 잘리지 않는다.**
 */
import { describe, expect, it } from 'vitest';
import { channelOf, SHARE_PRESETS } from '@/lib/analytics/shareLinks';
import { classifyChannel, readUtm } from '@/lib/analytics/channel';
import {
  EXPORT_TARGETS,
  charCount,
  composeExport,
  exportUrl,
  linkedInComposeUrl,
  naverShareUrl,
  type ExportInput,
  type ExportTargetId,
} from '../exportTargets';

const INPUT: ExportInput = {
  origin: 'https://example.com/',
  slug: 'yut-stick-balance',
  title: '윷가락이 한쪽으로만 눕는 이유',
  summary: '종이 윷을 접어 던져 보니 등이 더 자주 나왔다.',
};

const target = (id: ExportTargetId) => {
  const found = EXPORT_TARGETS.find((one) => one.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('EXPORT_TARGETS', () => {
  it('사용자가 고른 넷이다 — 주로 쓰는 둘이 앞이다', () => {
    expect(EXPORT_TARGETS.map((one) => one.id)).toEqual([
      'facebook',
      'linkedin',
      'instagram',
      'naver-blog',
    ]);
  });

  it('플랫폼마다 source 가 다르다 — 같으면 표에서 한 줄로 뭉친다', () => {
    const sources = EXPORT_TARGETS.map((one) => one.source);
    expect(new Set(sources).size).toBe(EXPORT_TARGETS.length);
  });

  it('`/admin/share` 의 프리셋과 같은 이름을 쓴다 — 다르면 한 채널이 둘로 쪼개진다', () => {
    for (const one of EXPORT_TARGETS) {
      const preset = SHARE_PRESETS.find((p) => p.id === one.id);
      expect(preset, one.id).toBeDefined();
      expect(one.source).toBe(preset?.source);
      expect(one.medium).toBe(preset?.medium);
    }
  });

  it('넷 모두 소셜로 잡힌다 — 수집 쪽과 같은 함수로 확인한다', () => {
    for (const one of EXPORT_TARGETS) {
      expect(channelOf(exportUrl(one, INPUT)), one.id).toBe('social');
    }
  });

  it('네이버 블로그 링크가 검색으로 새지 않는다 — `naver.` 를 품고 있다', () => {
    const utm = readUtm(
      new URL(exportUrl(target('naver-blog'), INPUT)).searchParams,
    );
    expect(utm.source).toBe('naver_blog');
    expect(classifyChannel(utm, null, 'example.com')).toBe('social');
  });

  it('인스타그램만 사진이 필수이고, 웹 글쓰기 창이 없다', () => {
    expect(
      EXPORT_TARGETS.filter((one) => one.needsImage).map((one) => one.id),
    ).toEqual(['instagram']);
    expect(target('instagram').compose).toBeUndefined();
  });
});

describe('exportUrl', () => {
  it('글 주소에 utm 과 캠페인을 붙인다', () => {
    const url = new URL(exportUrl(target('linkedin'), INPUT));
    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe('/blog/yut-stick-balance');
    expect(url.searchParams.get('utm_source')).toBe('linkedin');
    expect(url.searchParams.get('utm_medium')).toBe('social');
    // 방문자가 퍼 나른 링크(캠페인 없음)와 표에서 갈린다.
    expect(url.searchParams.get('utm_campaign')).toBe(
      'devlog-yut-stick-balance',
    );
  });
});

describe('composeExport', () => {
  it('제목 · 요약 · 링크 · 해시태그 순서다', () => {
    const text = composeExport(target('facebook'), INPUT);
    const parts = text.split('\n\n');
    expect(parts[0]).toBe(INPUT.title);
    expect(parts[1]).toBe(INPUT.summary);
    expect(parts[2]).toBe(exportUrl(target('facebook'), INPUT));
    expect(parts[3]).toMatch(/^#아빠공방 /);
  });

  it('인스타그램은 본문에 주소를 적지 않고 프로필 링크로 안내한다', () => {
    const text = composeExport(target('instagram'), INPUT);
    expect(text).not.toContain('https://');
    expect(text).toContain('프로필 링크');
  });

  it('해시태그의 `#` 과 빈칸을 정리한다', () => {
    const text = composeExport(target('facebook'), {
      ...INPUT,
      hashtags: ['#종이 놀이', '  ', '윷놀이'],
    });
    expect(text.endsWith('#종이놀이 #윷놀이')).toBe(true);
  });

  it('인스타그램 해시태그는 서른 개까지다 — 넘으면 게시가 막힌다', () => {
    const tags = Array.from({ length: 40 }, (_, i) => `태그${i}`);
    const text = composeExport(target('instagram'), {
      ...INPUT,
      hashtags: tags,
    });
    expect(text.match(/#/g)).toHaveLength(30);
  });

  it('넘치면 요약부터 줄인다 — 링크와 해시태그는 남는다', () => {
    const one = target('linkedin');
    const long = { ...INPUT, summary: '가'.repeat(5000) };
    const text = composeExport(one, long);
    expect(charCount(text)).toBeLessThanOrEqual(one.limit);
    expect(text).toContain(exportUrl(one, long));
    expect(text).toContain('#아빠공방');
    expect(text).toContain('…');
  });

  it('제목까지 길어도 링크는 자르지 않는다', () => {
    const one = target('instagram');
    const text = composeExport(one, {
      ...INPUT,
      title: '나'.repeat(3000),
      summary: '가'.repeat(3000),
    });
    expect(charCount(text)).toBeLessThanOrEqual(one.limit);
    expect(text).toContain('프로필 링크');
  });

  it('이모지를 한 글자로 센다', () => {
    expect(charCount('🎲윷')).toBe(2);
  });
});

describe('글쓰기 창', () => {
  it('링크드인 창은 문구를 채워서 연다', () => {
    const url = new URL(linkedInComposeUrl('안녕 https://a.b/?x=1&y=2'));
    expect(url.hostname).toBe('www.linkedin.com');
    expect(url.searchParams.get('shareActive')).toBe('true');
    expect(url.searchParams.get('text')).toBe('안녕 https://a.b/?x=1&y=2');
  });

  it('네이버 창은 utm 이 붙은 주소를 깨뜨리지 않는다', () => {
    const link = exportUrl(target('naver-blog'), INPUT);
    const url = new URL(naverShareUrl(link, INPUT.title));
    expect(url.searchParams.get('url')).toBe(link);
    expect(url.searchParams.get('title')).toBe(INPUT.title);
  });

  it('페이스북 창은 utm 이 붙은 주소를 싣는다', () => {
    const one = target('facebook');
    const link = exportUrl(one, INPUT);
    const url = new URL(one.compose?.(link, '', INPUT.title) ?? '');
    expect(url.searchParams.get('u')).toBe(link);
  });
});

/**
 * 공방 일지 글을 SNS 로 내보내기 (IDE-034)
 *
 * `targets.ts` 는 **방문자가** 누르는 공유 버튼이었다. 여기는 **주인이** 낸 글을
 * 자기 계정에 옮겨 올리는 꾸러미다 — 플랫폼마다 한도에 맞춘 문구와 utm 링크,
 * 그리고 글쓰기 창 주소를 만든다. 올리는 손은 주인의 것이다(API 자동 게시는
 * 뒤로 미뤘다 — 이슈의 결정 기록).
 *
 * `source`·`medium` 은 `SHARE_PRESETS` 에서 **읽어 온다.** `/admin/share` 에서
 * 손으로 만든 링크와 여기서 만든 링크가 다른 이름을 쓰면 같은 채널이 표에서
 * 두 줄로 쪼개진다 — 그 함수가 막으려던 일이다.
 *
 * 순수 함수만 둔다 — 화면과 테스트가 같은 것을 본다.
 */
import { buildShareUrl, SHARE_PRESETS } from '@/lib/analytics/shareLinks';
import { facebookShareUrl } from './targets';

export type ExportTargetId =
  'facebook' | 'linkedin' | 'instagram' | 'naver-blog';

export type ExportTarget = {
  id: ExportTargetId;
  label: string;
  source: string;
  medium: string;
  /** 본문 글자 수 한도(코드 포인트). */
  limit: number;
  /**
   * 본문에 적은 주소가 눌리는가.
   *
   * 인스타그램은 게시물 본문의 주소를 링크로 만들지 않는다. 그래서 주소 대신
   * "프로필 링크"로 안내하고, utm 링크는 프로필에 걸라고 따로 준다.
   */
  linkInText: boolean;
  /** 사진 없이는 올릴 수 없는가. */
  needsImage: boolean;
  /**
   * 글쓰기 창 주소. 없으면(인스타그램) 웹에서 열 창이 없다 — 앱에서 올린다.
   *
   * 페이스북은 주소만 받고 문구는 못 싣는다(대상 페이지의 OG 를 읽는다).
   * 그래서 화면이 **문구를 먼저 복사한 뒤** 창을 연다.
   */
  compose?: (url: string, text: string, title: string) => string;
  /** 창이 문구까지 받아 채우는가. 아니면 화면이 복사해 두고 연다. */
  composeTakesText: boolean;
};

const preset = (id: string) => {
  const found = SHARE_PRESETS.find((one) => one.id === id);
  if (!found) throw new Error(`SHARE_PRESETS 에 ${id} 가 없다`);
  return { source: found.source, medium: found.medium };
};

/**
 * 링크드인의 글쓰기 창. 문구를 채워서 연다.
 *
 * 공식 공유 주소(`/sharing/share-offsite/?url=`)는 주소만 받는다. `shareActive`
 * 는 문서화되지 않은 주소라 언젠가 막힐 수 있다 — 막혀도 화면이 문구를 복사해
 * 두므로 붙여 넣으면 된다.
 */
export const linkedInComposeUrl = (text: string): string =>
  `https://www.linkedin.com/feed/?${new URLSearchParams({ shareActive: 'true', text })}`;

/**
 * 네이버 공유 창. 여기서 블로그(또는 카페)를 고르면 그쪽 글쓰기로 넘어간다.
 *
 * 네이버 블로그는 글쓰기 API 를 닫았다 — 웹에서 열 수 있는 길은 이것뿐이다.
 * 창에 문구는 못 싣고 제목과 주소만 간다.
 */
export const naverShareUrl = (url: string, title: string): string =>
  `https://share.naver.com/web/shareView?${new URLSearchParams({ url, title })}`;

/**
 * 화면에 놓이는 순서다. 사용자가 주로 쓰는 둘(페이스북 · 링크드인)이 앞이다
 * (2026-09-19 사용자 답).
 */
export const EXPORT_TARGETS: readonly ExportTarget[] = [
  {
    id: 'facebook',
    label: '페이스북',
    ...preset('facebook'),
    // 실제 한도는 6만 자가 넘는다. 긴 글은 "더 보기"에 접히므로 넉넉히 둔다.
    limit: 5000,
    linkInText: true,
    needsImage: false,
    compose: (url) => facebookShareUrl(url),
    composeTakesText: false,
  },
  {
    id: 'linkedin',
    label: '링크드인',
    ...preset('linkedin'),
    limit: 3000,
    linkInText: true,
    needsImage: false,
    compose: (_url, text) => linkedInComposeUrl(text),
    composeTakesText: true,
  },
  {
    id: 'instagram',
    label: '인스타그램',
    ...preset('instagram'),
    limit: 2200,
    linkInText: false,
    needsImage: true,
    composeTakesText: false,
  },
  {
    id: 'naver-blog',
    label: '네이버 블로그',
    ...preset('naver-blog'),
    limit: 5000,
    linkInText: true,
    needsImage: false,
    compose: (url, _text, title) => naverShareUrl(url, title),
    composeTakesText: false,
  },
];

/**
 * 해시태그 기본값. 글에 태그 칸이 없어서 사이트 전체의 것을 쓴다 — 화면에서
 * 문구를 고칠 수 있으니 글마다 더하거나 뺀다.
 */
export const DEFAULT_HASHTAGS: readonly string[] = [
  '아빠공방',
  '종이보드게임',
  '아이와함께',
  '공방일지',
];

/** 인스타그램이 한 게시물에 받는 해시태그 수. 넘으면 게시가 막힌다. */
const INSTAGRAM_HASHTAG_MAX = 30;

/** 캠페인 이름. 방문자가 퍼 나른 링크(캠페인 없음)와 표에서 갈린다. */
export const exportCampaign = (slug: string): string => `devlog-${slug}`;

export type ExportInput = {
  origin: string;
  slug: string;
  title: string;
  /** 요약. 비었으면 본문 앞머리 — 서버가 `postSummary` 로 채워 준다. */
  summary: string;
  hashtags?: readonly string[];
};

/** 이 플랫폼에 올릴 링크. utm 과 캠페인이 붙는다. */
export const exportUrl = (target: ExportTarget, input: ExportInput): string =>
  buildShareUrl({
    origin: input.origin,
    path: `/blog/${input.slug}`,
    source: target.source,
    medium: target.medium,
    campaign: exportCampaign(input.slug),
  });

/** 글자 수. 한글·이모지 하나를 하나로 센다(`length` 는 이모지를 둘로 센다). */
export const charCount = (text: string): number => [...text].length;

const cut = (text: string, max: number): string => {
  const chars = [...text];
  if (chars.length <= max) return text;
  if (max <= 1) return '';
  return `${chars
    .slice(0, max - 1)
    .join('')
    .trimEnd()}…`;
};

const tagLine = (tags: readonly string[]): string =>
  tags
    .map((tag) => tag.trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(' ');

/**
 * 올릴 문구.
 *
 * 한도를 넘으면 **요약부터** 줄인다 — 그다음 해시태그를 빼고, 그래도 넘으면
 * 제목을 자른다. **링크는 자르지 않는다**: 잘린 주소는 404 로 가고, 그 사실은
 * 누가 눌러 보기 전까지 드러나지 않는다.
 */
export function composeExport(
  target: ExportTarget,
  input: ExportInput,
): string {
  const url = exportUrl(target, input);
  const title = input.title.trim();
  const summary = input.summary.trim();
  const tags = (input.hashtags ?? DEFAULT_HASHTAGS).slice(
    0,
    target.id === 'instagram' ? INSTAGRAM_HASHTAG_MAX : undefined,
  );
  // 인스타그램 본문의 주소는 눌리지 않는다 — 적어 두면 오히려 지저분하다.
  const linkLine = target.linkInText ? url : '전체 글은 프로필 링크에서 🔗';

  const assemble = (t: string, s: string, withTags: boolean): string =>
    [t, s, linkLine, withTags ? tagLine(tags) : '']
      .filter(Boolean)
      .join('\n\n');

  let text = assemble(title, summary, true);
  if (charCount(text) <= target.limit) return text;

  // 요약을 남은 자리만큼 줄인다. 요약 앞뒤의 빈 줄 두 개(`\n\n`)도 자리를 먹는다.
  const withoutSummary = charCount(assemble(title, '', true));
  const room = target.limit - withoutSummary - 2;
  if (room > 0) {
    text = assemble(title, cut(summary, room), true);
    if (charCount(text) <= target.limit) return text;
  }

  text = assemble(title, '', false);
  if (charCount(text) <= target.limit) return text;

  const titleRoom = target.limit - charCount(assemble('', '', false)) - 2;
  return assemble(cut(title, Math.max(titleRoom, 0)), '', false);
}

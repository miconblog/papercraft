/**
 * 채널 분류 (IDE-013)
 *
 * "어디서 왔나"를 여섯 갈래로 줄인다. utm 이 붙어 있으면 그것을 믿고,
 * 없으면 referrer 로 판정한다 — 링크를 만든 사람이 스스로 밝힌 것이 추측보다
 * 정확하다.
 */

export type Channel =
  'direct' | 'organic' | 'social' | 'referral' | 'campaign' | 'ai';

export type Utm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  /** 같은 캠페인 안에서 어느 글·버튼인지. 분류에는 안 쓴다. */
  content: string | null;
  /** 검색 광고의 키워드. 분류에는 안 쓴다. */
  term: string | null;
};

/**
 * AI 검색 · 대화 서비스 (IDE-039)
 *
 * 사용자 요청(2026-09-19) — "요즘은 AI를 이용해 검색을 많이해서 AI 로 검색
 * 최적화도 하고 싶어." 재야 고칠 수 있다. 전에는 이 방문들이 **다른 사이트**에
 * 섞였고, Gemini(`gemini.google.com`)는 `google.` 을 품어 **검색**으로 샜다.
 *
 * 조각이 아니라 **그 도메인이거나 그 하위 도메인**일 때만 맞춘다(`isAiHost`) —
 * `meta.ai` 를 조각으로 보면 `xmeta.ai` 까지 걸린다.
 *
 * 한국에서 쓰는 것(뤼튼 · 라이너)도 넣었다. 빙 코파일럿의 채팅은 `bing.com` 으로
 * 와서 검색과 가를 수 없다 — 검색으로 둔다.
 *
 * SQL 에도 같은 목록이 한 번 있다(`db/migrations/014-ai-channel.sql` 의 소급).
 * 새로 들어오는 줄은 앱이 매기므로 거기는 과거만 본다.
 */
export const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'claude.ai',
  'gemini.google.com',
  'bard.google.com',
  'copilot.microsoft.com',
  'chat.deepseek.com',
  'grok.com',
  'meta.ai',
  'chat.mistral.ai',
  'you.com',
  'phind.com',
  'poe.com',
  'wrtn.ai',
  'liner.com',
] as const;

/**
 * AI 서비스가 스스로 붙이는 `utm_source`. ChatGPT 는 링크마다
 * `utm_source=chatgpt.com` 을 붙인다 — referrer 가 비어도 이것으로 잡힌다.
 */
const AI_SOURCES =
  /^(chatgpt(\.com)?|openai|perplexity(\.ai)?|claude(\.ai)?|gemini|copilot|deepseek|grok|meta\.ai|mistral|you\.com|phind|poe|wrtn|liner)$/;

/** 이 호스트가 AI 서비스인가. 그 도메인이거나 하위 도메인일 때만 참이다. */
export const isAiHost = (host: string): boolean =>
  AI_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));

const isAiSource = (source: string): boolean =>
  AI_SOURCES.test(source) || isAiHost(source);

/** 호스트 이름에 이 조각이 들어 있으면 검색이다. */
const SEARCH_HOSTS = [
  'google.',
  'naver.',
  'daum.',
  'bing.',
  'duckduckgo.',
  'yahoo.',
  'baidu.',
  'yandex.',
  'ecosia.',
  'brave.',
];

const SOCIAL_HOSTS = [
  'facebook.',
  'instagram.',
  'threads.',
  'twitter.',
  'x.com',
  't.co',
  'youtube.',
  'youtu.be',
  'tiktok.',
  'reddit.',
  'pinterest.',
  'linkedin.',
  'kakao.',
  'band.us',
  'blog.naver.',
  'cafe.naver.',
  'brunch.co.kr',
  'tistory.',
];

/**
 * 호스트 목록으로는 못 잡는 utm_source 이름들.
 *
 * `naver_cafe` 는 `cafe.naver.` 를 품지 않고 `naver.` 는 품는다 — 그대로 두면
 * 카페에 올린 글로 온 방문이 **검색**으로 잡힌다(2026-09-17 실제로 그랬다).
 */
const SOCIAL_SOURCES = /cafe|blog|community/;

/** utm_medium 이 이렇게 시작하면 소셜이다. 카페·블로그·메신저도 여기 모은다. */
const SOCIAL_MEDIUM = /^(social|sns|sm$|community|cafe|blog|messenger)/;

/**
 * 인앱 브라우저 표식.
 *
 * 카카오톡·인스타그램 안에서 링크를 누르면 **referrer 가 비어서 온다.** utm 이
 * 없으면 그 방문은 직접 방문과 구별되지 않는데, 한국에서 링크가 도는 길의
 * 대부분이 거기다. UA 에 앱 이름이 박혀 있으니 그것으로 건진다.
 *
 * 순서가 중요하다 — 스레드는 인스타그램 표식을 함께 달고 올 수 있다.
 */
const IN_APPS: [RegExp, string][] = [
  [/KAKAOTALK/i, 'kakaotalk'],
  [/Barcelona/, 'threads'],
  [/Instagram/, 'instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/, 'facebook'],
  [/\bLine\//, 'line'],
  [/BAND\//, 'band'],
  [/NAVER\(inapp|NAVER\//, 'naver'],
  [/DaumApps/, 'daum'],
];

/**
 * 앱 안에서 열렸다는 것만으로 소셜이라 부를 수 있는 앱.
 *
 * 네이버·다음 앱은 빠진다 — 그 안에서는 검색 결과를 눌렀는지 카페 글을
 * 눌렀는지 UA 로 알 수 없다. 표에는 앱 이름으로 남아 따로 읽힌다.
 */
const SOCIAL_APPS = new Set([
  'kakaotalk',
  'threads',
  'instagram',
  'facebook',
  'line',
  'band',
]);

/** 관리자 화면의 채널 이름. 방문 통계와 퍼널 분석이 같은 말을 쓴다. */
export const CHANNEL_LABEL: Record<string, string> = {
  direct: '직접 방문',
  organic: '검색',
  social: '소셜',
  referral: '다른 사이트',
  campaign: '캠페인(utm)',
  ai: 'AI 검색·대화',
};

export const IN_APP_LABEL: Record<string, string> = {
  kakaotalk: '카카오톡',
  threads: '스레드',
  instagram: '인스타그램',
  facebook: '페이스북',
  line: '라인',
  band: '밴드',
  naver: '네이버',
  daum: '다음',
};

/** UA 에서 인앱 브라우저의 앱 이름을 꺼낸다. 일반 브라우저면 `null`. */
export function inAppOf(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return IN_APPS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/**
 * 집계 표의 `source` 칸을 사람이 읽는 이름으로.
 *
 * 그 칸은 `utm_source` → referrer 호스트 → `app:<앱>` 순서로 채워진다
 * (`rollup_daily`). 셋 다 없으면 빈 문자열이다.
 */
export function sourceLabel(source: string): string {
  if (!source) return '(알 수 없음)';
  if (source.startsWith('app:')) {
    const app = source.slice(4);
    return `${IN_APP_LABEL[app] ?? app} 앱`;
  }
  return source;
}

const matches = (host: string, needles: string[]): boolean =>
  needles.some((needle) => host.includes(needle));

/**
 * utm_source 는 호스트가 아니라 사람이 손으로 적은 이름이다 — `naver.com` 일
 * 수도 그냥 `naver` 일 수도 있다. 목록의 점을 떼고 본다.
 */
const matchesSource = (source: string, needles: string[]): boolean =>
  needles.some((needle) => source.includes(needle.replace(/\.$/, '')));

/** `?utm_source=…` 를 꺼낸다. 빈 값은 `null` 로 눕힌다. */
export function readUtm(params: URLSearchParams): Utm {
  const get = (key: string) => params.get(key)?.trim().toLowerCase() || null;
  return {
    source: get('utm_source'),
    medium: get('utm_medium'),
    campaign: get('utm_campaign'),
    content: get('utm_content'),
    term: get('utm_term'),
  };
}

/**
 * referrer URL 에서 호스트만 남긴다.
 *
 * 전체 URL 을 저장하면 남의 사이트 경로까지 우리 DB 로 끌고 온다 — 검색어가
 * 붙은 주소도 그렇다. 필요한 것은 "어느 사이트에서 왔나"뿐이다.
 */
export function referrerHost(
  referrer: string | null | undefined,
): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * 채널 판정.
 *
 * @param selfHost 우리 도메인. 사이트 안에서 넘어온 것은 유입이 아니라 `direct` 다.
 * @param inApp `inAppOf` 가 찾은 앱. referrer 도 utm 도 없을 때만 본다.
 */
export function classifyChannel(
  utm: Pick<Utm, 'source' | 'medium'>,
  host: string | null,
  selfHost: string | null,
  inApp: string | null = null,
): Channel {
  // utm 이 하나라도 있으면 그쪽을 믿는다.
  if (utm.source || utm.medium) {
    const medium = utm.medium ?? '';
    const source = utm.source ?? '';
    // 광고는 검색·소셜·AI 로 접지 않는다. `utm_source=google` 하나만 보고
    // organic 이라 적으면 돈 주고 산 방문이 자연 유입으로 둔갑한다. AI 서비스
    // 안의 광고도 같다.
    if (/^(cpc|ppc|paid|display|banner|retargeting)/.test(medium)) {
      return 'campaign';
    }
    // AI 가 붙인 표식은 매체(`medium`)보다 앞선다 — ChatGPT 는 source 만 붙이고,
    // 다른 서비스가 `referral` 을 함께 붙여도 AI 에서 온 것은 그대로다.
    if (isAiSource(source)) return 'ai';
    if (medium === 'organic' || medium === 'search') return 'organic';
    if (SOCIAL_MEDIUM.test(medium)) return 'social';
    if (medium === 'referral') return 'referral';
    // 소셜을 먼저 본다 — `blog.naver.com` 은 `naver.` 를 품고 있어서 검색을
    // 먼저 보면 블로그 유입이 검색으로 잡힌다.
    if (SOCIAL_SOURCES.test(source) || matchesSource(source, SOCIAL_HOSTS)) {
      return 'social';
    }
    if (matchesSource(source, SEARCH_HOSTS)) return 'organic';
    // 뉴스레터·QR·오프라인 인쇄물처럼 위 넷 중 어디도 아닌 것들이 여기 모인다.
    return 'campaign';
  }

  if (!host) return inApp && SOCIAL_APPS.has(inApp) ? 'social' : 'direct';
  if (selfHost && host === selfHost.toLowerCase()) return 'direct';
  // AI 가 검색보다 먼저다 — `gemini.google.com` 은 `google.` 을 품는다.
  if (isAiHost(host)) return 'ai';
  // 여기서도 소셜이 먼저다(위와 같은 이유).
  if (matches(host, SOCIAL_HOSTS)) return 'social';
  if (matches(host, SEARCH_HOSTS)) return 'organic';
  return 'referral';
}

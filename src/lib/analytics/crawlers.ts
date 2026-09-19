/**
 * 누가 읽어 가나 — AI · 검색 크롤러 (IDE-040)
 *
 * AI 검색에 인용되려면 **먼저 읽혀야 한다.** 그런데 크롤러는 자바스크립트를
 * 돌리지 않아서 방문 통계(`PageViews` 비콘)에는 한 줄도 안 남는다. 그래서 문지기
 * (`proxy.ts`)가 요청의 UA 를 보고 여기 목록에 있으면 센다.
 *
 * 일반 검색 크롤러(구글 · 빙 · 네이버 · 다음)도 **견줄 기준으로** 함께 센다 —
 * "GPTBot 이 한 달에 3번"은 Googlebot 이 몇 번 오는지 옆에 있어야 읽힌다.
 *
 * ## 종류
 *
 * - `ai-search` — AI 검색의 색인(OAI-SearchBot · Claude-SearchBot · PerplexityBot).
 *   **AI 답변에 이 사이트가 인용되려면 이쪽이 읽어야 한다**
 * - `ai-user` — 사람이 AI 에게 "이 링크 읽어 줘"라고 해서 그 자리에서 가져간 것
 *   (ChatGPT-User · Claude-User · Perplexity-User)
 * - `ai-training` — 모델 학습용 수집(GPTBot · ClaudeBot · CCBot …)
 * - `search` — 일반 검색엔진
 *
 * ## UA 는 누구나 적을 수 있다
 *
 * `GPTBot` 이라고 적고 오는 것이 진짜 OpenAI 인지는 IP 대역을 봐야 안다. 여기는
 * **이름만** 본다 — 추세를 보는 데는 충분하고, IP 는 남기지 않는다는 원칙
 * (`IDE-013`)을 지킨다. 정확한 판별이 필요해지면 그때 대역 확인을 더한다.
 *
 * 브라우저 번들에 실리지 않는다 — 문지기와 관리자 화면만 쓴다.
 */

export type CrawlerKind = 'ai-search' | 'ai-user' | 'ai-training' | 'search';

export type Crawler = {
  /** 저장하는 이름. 바꾸면 표에서 한 크롤러가 둘로 쪼개진다. */
  id: string;
  vendor: string;
  kind: CrawlerKind;
  /** UA 에서 찾을 이름. 대소문자를 가리지 않고 **낱말 경계**로 본다. */
  token: string;
};

/**
 * 순서가 중요하다 — **더 구체적인 이름이 먼저다.** `Claude-SearchBot` 과
 * `ClaudeBot`, `Perplexity-User` 와 `PerplexityBot` 은 앞의 것이 뒤의 것을
 * 품지는 않지만, 한 UA 에 여러 이름이 섞여 오는 경우 앞선 것을 고른다.
 */
export const CRAWLERS: readonly Crawler[] = [
  // ── AI 검색 색인 ──
  {
    id: 'oai-searchbot',
    vendor: 'OpenAI',
    kind: 'ai-search',
    token: 'OAI-SearchBot',
  },
  {
    id: 'claude-searchbot',
    vendor: 'Anthropic',
    kind: 'ai-search',
    token: 'Claude-SearchBot',
  },
  {
    id: 'perplexitybot',
    vendor: 'Perplexity',
    kind: 'ai-search',
    token: 'PerplexityBot',
  },
  {
    id: 'duckassistbot',
    vendor: 'DuckDuckGo',
    kind: 'ai-search',
    token: 'DuckAssistBot',
  },
  { id: 'youbot', vendor: 'You.com', kind: 'ai-search', token: 'YouBot' },
  // ── 사람이 시켜서 가져간 것 ──
  {
    id: 'chatgpt-user',
    vendor: 'OpenAI',
    kind: 'ai-user',
    token: 'ChatGPT-User',
  },
  {
    id: 'claude-user',
    vendor: 'Anthropic',
    kind: 'ai-user',
    token: 'Claude-User',
  },
  {
    id: 'perplexity-user',
    vendor: 'Perplexity',
    kind: 'ai-user',
    token: 'Perplexity-User',
  },
  {
    id: 'mistralai-user',
    vendor: 'Mistral',
    kind: 'ai-user',
    token: 'MistralAI-User',
  },
  {
    id: 'meta-externalfetcher',
    vendor: 'Meta',
    kind: 'ai-user',
    token: 'Meta-ExternalFetcher',
  },
  // ── 학습용 수집 ──
  { id: 'gptbot', vendor: 'OpenAI', kind: 'ai-training', token: 'GPTBot' },
  {
    id: 'claudebot',
    vendor: 'Anthropic',
    kind: 'ai-training',
    token: 'ClaudeBot',
  },
  {
    id: 'meta-externalagent',
    vendor: 'Meta',
    kind: 'ai-training',
    token: 'meta-externalagent',
  },
  {
    id: 'google-cloudvertexbot',
    vendor: 'Google',
    kind: 'ai-training',
    token: 'Google-CloudVertexBot',
  },
  {
    id: 'applebot-extended',
    vendor: 'Apple',
    kind: 'ai-training',
    token: 'Applebot-Extended',
  },
  {
    id: 'amazonbot',
    vendor: 'Amazon',
    kind: 'ai-training',
    token: 'Amazonbot',
  },
  {
    id: 'bytespider',
    vendor: 'ByteDance',
    kind: 'ai-training',
    token: 'Bytespider',
  },
  { id: 'ccbot', vendor: 'Common Crawl', kind: 'ai-training', token: 'CCBot' },
  {
    id: 'cohere-ai',
    vendor: 'Cohere',
    kind: 'ai-training',
    token: 'cohere-ai',
  },
  // ── 일반 검색(견줄 기준) ──
  { id: 'googlebot', vendor: 'Google', kind: 'search', token: 'Googlebot' },
  { id: 'bingbot', vendor: 'Microsoft', kind: 'search', token: 'bingbot' },
  { id: 'yeti', vendor: 'Naver', kind: 'search', token: 'Yeti' },
  { id: 'daumoa', vendor: 'Kakao', kind: 'search', token: 'Daumoa' },
  { id: 'applebot', vendor: 'Apple', kind: 'search', token: 'Applebot' },
];

export const CRAWLER_KIND_LABEL: Record<CrawlerKind, string> = {
  'ai-search': 'AI 검색 색인',
  'ai-user': 'AI 가 사용자 대신 읽음',
  'ai-training': 'AI 학습용 수집',
  search: '일반 검색',
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 낱말 경계로 찾는다 — `Yeti` 가 `Yetisports` 에, `Applebot` 이
 * `Applebot-Extended` 에 걸리지 않게. `-` 는 경계가 아니라 이름의 일부로 본다.
 */
const PATTERNS = CRAWLERS.map(
  (crawler) =>
    [
      crawler,
      new RegExp(`(?<![\\w-])${escapeRegExp(crawler.token)}(?![\\w-])`, 'i'),
    ] as const,
);

/** UA 의 크롤러. 목록에 없으면 `null` — 사람이거나 모르는 봇이다. */
export function crawlerOf(
  userAgent: string | null | undefined,
): Crawler | null {
  if (!userAgent) return null;
  return PATTERNS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

export const crawlerById = (id: string): Crawler | undefined =>
  CRAWLERS.find((crawler) => crawler.id === id);

/** 저장하는 경로의 길이 상한. 쿼리는 버린다 — 크롤러가 붙이는 값이 제각각이다. */
const PATH_MAX = 200;

/** 셀 경로. 쿼리를 떼고 너무 긴 것은 자른다. */
export const crawlPath = (pathname: string): string =>
  (pathname || '/').slice(0, PATH_MAX);

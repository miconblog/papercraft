/**
 * 채널 분류 (IDE-013)
 *
 * "어디서 왔나"를 다섯 갈래로 줄인다. utm 이 붙어 있으면 그것을 믿고,
 * 없으면 referrer 로 판정한다 — 링크를 만든 사람이 스스로 밝힌 것이 추측보다
 * 정확하다.
 */

export type Channel = 'direct' | 'organic' | 'social' | 'referral' | 'campaign';

export type Utm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

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
 */
export function classifyChannel(
  utm: Utm,
  host: string | null,
  selfHost: string | null,
): Channel {
  // utm 이 하나라도 있으면 그쪽을 믿는다.
  if (utm.source || utm.medium) {
    const medium = utm.medium ?? '';
    const source = utm.source ?? '';
    if (medium === 'organic' || medium === 'search') return 'organic';
    if (medium.startsWith('social') || medium === 'sm') return 'social';
    if (medium === 'referral') return 'referral';
    // 광고는 검색·소셜로 접지 않는다. `utm_source=google` 하나만 보고 organic
    // 이라 적으면 돈 주고 산 방문이 자연 유입으로 둔갑한다.
    if (/^(cpc|ppc|paid|display|banner|retargeting)/.test(medium)) {
      return 'campaign';
    }
    // 소셜을 먼저 본다 — `blog.naver.com` 은 `naver.` 를 품고 있어서 검색을
    // 먼저 보면 블로그 유입이 검색으로 잡힌다.
    if (matchesSource(source, SOCIAL_HOSTS)) return 'social';
    if (matchesSource(source, SEARCH_HOSTS)) return 'organic';
    // 뉴스레터·QR·오프라인 인쇄물처럼 위 넷 중 어디도 아닌 것들이 여기 모인다.
    return 'campaign';
  }

  if (!host) return 'direct';
  if (selfHost && host === selfHost.toLowerCase()) return 'direct';
  // 여기서도 소셜이 먼저다(위와 같은 이유).
  if (matches(host, SOCIAL_HOSTS)) return 'social';
  if (matches(host, SEARCH_HOSTS)) return 'organic';
  return 'referral';
}

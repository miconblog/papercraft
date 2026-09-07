/**
 * 공유 링크 만들기 (IDE-013)
 *
 * 어디에 올린 링크가 실제로 사람을 데려왔는지는 utm 이 붙어 있어야 안다.
 * 손으로 `?utm_source=…` 를 조립하면 어느 날은 `facebook`, 어느 날은 `fb` 가
 * 되어 **한 채널이 표에서 둘로 쪼개진다.** 그래서 만드는 곳을 하나로 둔다.
 *
 * 여기는 순수 함수만 둔다 — 화면과 테스트가 같은 것을 쓴다.
 */
import { classifyChannel, readUtm, type Channel } from './channel';

export type SharePreset = {
  id: string;
  /** 화면에 보이는 이름 */
  label: string;
  source: string;
  medium: string;
};

/**
 * 기본 채널.
 *
 * `medium` 이 전부 `social` 인 것은 우연이 아니다 — 채널 분류가
 * `medium.startsWith('social')` 을 먼저 보므로(`channel.ts`), 이 셋은 표에서
 * **소셜** 한 칸에 모이고 `source` 로 갈린다.
 */
export const SHARE_PRESETS: readonly SharePreset[] = [
  { id: 'facebook', label: '페이스북', source: 'facebook', medium: 'social' },
  {
    id: 'instagram',
    label: '인스타그램',
    source: 'instagram',
    medium: 'social',
  },
  { id: 'linkedin', label: '링크드인', source: 'linkedin', medium: 'social' },
];

export type ShareInput = {
  /** 사이트 주소. 끝 슬래시는 있어도 없어도 된다. */
  origin: string;
  /** 보낼 경로 — `/` · `/games/soccer` */
  path: string;
  source: string;
  medium: string;
  campaign?: string;
};

/**
 * 사람이 손으로 적는 칸이라 눌러 준다 — `Facebook` 과 `facebook` 은 같은 곳이다.
 *
 * **글자를 고르는 방식이 아니라 버리는 방식이다.** 처음엔 `[a-z0-9._-]` 만
 * 남겼는데, 그러면 `여름방학` 같은 캠페인 이름이 **통째로 사라진다** — 한국어
 * 사이트에서 조용히 빈 값이 되는 쪽이 훨씬 나쁘다. 주소를 실제로 깨뜨리는
 * 글자(`&` · `=` · `?` · `#` · `/` · 빈칸)만 버리고 나머지는 살린다.
 *
 * 한글은 링크에 퍼센트 인코딩으로 실리지만, 저장될 때 되돌아와 대시보드에는
 * `여름방학` 그대로 보인다.
 */
export const normalizeTag = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    // 빈칸은 `-`로. utm 값에 빈칸이 들어가면 링크가 거기서 잘려 붙는다.
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]/gu, '')
    // 위에서 버린 글자 자리에 `-`가 겹쳐 남는 것을 정리한다.
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * 붙일 링크.
 *
 * `source` 가 비어 있으면 utm 을 하나도 붙이지 않는다 — 반쪽짜리 utm 은
 * 채널을 `campaign` 으로 밀어 넣어 표를 흐린다.
 */
export function buildShareUrl(input: ShareInput): string {
  const origin = input.origin.replace(/\/+$/, '');
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const url = new URL(`${origin}${path}`);

  const source = normalizeTag(input.source);
  if (!source) return url.toString();

  url.searchParams.set('utm_source', source);
  const medium = normalizeTag(input.medium);
  if (medium) url.searchParams.set('utm_medium', medium);
  const campaign = normalizeTag(input.campaign ?? '');
  if (campaign) url.searchParams.set('utm_campaign', campaign);

  return url.toString();
}

/**
 * 이 링크로 온 방문이 표의 어느 칸에 들어갈지.
 *
 * 만든 링크를 **수집 쪽과 같은 함수**로 판정한다. 화면이 "소셜로 잡힙니다"라고
 * 적어 놓고 실제로는 다른 칸에 쌓이면, 그 거짓말은 몇 주 뒤 숫자를 볼 때까지
 * 드러나지 않는다.
 */
export function channelOf(shareUrl: string): Channel {
  const url = new URL(shareUrl);
  return classifyChannel(readUtm(url.searchParams), null, url.hostname);
}

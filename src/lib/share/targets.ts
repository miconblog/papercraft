/**
 * 공유 수단과 그 링크 (IDE-029)
 *
 * `analytics/shareLinks.ts` 는 **주인이 손으로 만드는** 공유 링크였다(`/admin/share`).
 * 여기는 **방문자가 버튼을 눌러 나가는** 링크다. 붙는 utm 을 조립하는 일은 같아서
 * 그 모듈의 `buildShareUrl` 을 그대로 쓴다 — 한 채널이 어느 날은 `x`, 어느 날은
 * `twitter` 가 되어 표에서 둘로 쪼개지는 것이 그 함수가 막으려던 일이고, 방문자
 * 버튼이 그 규칙 밖에 있으면 막다가 만 셈이 된다.
 *
 * 순수 함수만 둔다 — 화면과 테스트가 같은 것을 본다.
 */
import { buildShareUrl } from '@/lib/analytics/shareLinks';

export type ShareTargetId = 'kakao' | 'x' | 'facebook' | 'system' | 'copy';

export type ShareTarget = {
  id: ShareTargetId;
  /** 버튼에 붙는 이름 */
  label: string;
  /** 링크에 실리는 `utm_source` */
  source: string;
};

/**
 * 다섯 수단 전부 `utm_medium=social` 이다.
 *
 * 채널 분류가 `medium.startsWith('social')` 을 먼저 보므로(`analytics/channel.ts`)
 * 다섯이 표에서 **소셜** 한 칸에 모이고 `source` 로 갈린다 — `SHARE_PRESETS` 가
 * 같은 이유로 같은 선택을 했다.
 *
 * **`copy` 와 `system` 까지 소셜로 적는 것이 맞나.** 이 둘은 나가는 곳을 알 수
 * 없다. 붙여 넣는 곳이 카카오톡 대화창일 수도, 메모장일 수도 있다. 그래도
 * `direct` 로 흘려보내는 것보다 낫다고 봤다 — 한국에서 링크를 나누는 길은
 * 대부분 메신저이고(그래서 시스템 공유 시트가 이 사이트의 주된 공유 수단이다),
 * 무엇보다 **`direct` 로 섞이면 그 방문이 공유에서 왔다는 사실 자체가 사라진다.**
 * `source` 로 갈려 있으니 표에서 둘을 따로 읽어 낼 수 있다.
 */
const MEDIUM = 'social';

/**
 * 화면에 놓이는 순서다.
 *
 * 카카오톡이 맨 앞인 것은 한국에서 링크를 나누는 첫 수단이라서다. 그다음이
 * 시스템 공유 — 폰에서 이 버튼 하나가 나머지 전부를 대신한다. 링크 복사가
 * 맨 뒤인 것은 **언제나 되는 수단**이라 마지막 기댈 곳이기 때문이다.
 */
export const SHARE_TARGETS: readonly ShareTarget[] = [
  { id: 'kakao', label: '카카오톡', source: 'kakao' },
  { id: 'system', label: '공유', source: 'web-share' },
  { id: 'x', label: 'X', source: 'x' },
  { id: 'facebook', label: '페이스북', source: 'facebook' },
  { id: 'copy', label: '링크 복사', source: 'copy' },
];

export type ShareUrlInput = {
  /** 사이트 주소(`https://…`). 끝 슬래시는 있어도 없어도 된다. */
  origin: string;
  /** 공유할 경로 — `/games/soccer` · `/blog/어떤-글` */
  path: string;
  source: string;
};

/** 방문자가 실제로 나누게 되는 주소. utm 이 붙어 있다. */
export const shareUrl = ({ origin, path, source }: ShareUrlInput): string =>
  buildShareUrl({ origin, path, source, medium: MEDIUM });

/**
 * X 의 글쓰기 창.
 *
 * `text` 와 `url` 을 따로 준다 — 제목을 `text` 에 이어 붙이면 X 가 그 안의 주소를
 * 카드로 펼치지 않는다.
 */
export const xIntentUrl = (url: string, text: string): string =>
  `https://x.com/intent/post?${new URLSearchParams({ text, url })}`;

/** 페이스북의 공유 창. 제목은 못 싣는다 — 페이스북이 대상 페이지의 OG 를 읽는다. */
export const facebookShareUrl = (url: string): string =>
  `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`;

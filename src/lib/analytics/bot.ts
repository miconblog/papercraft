/**
 * 봇 신호 (IDE-024)
 *
 * `request.ts` 의 `isBot` 은 **줄을 아예 안 만든다.** UA 에 `bot` 이라 적어 둔
 * 크롤러에는 맞는 처분이다. 여기서 보는 것은 그 정규식을 통과한 요청 —
 * 사람인 척하는 자동화다.
 *
 * 그런 판정은 확률적이라 같은 방식으로 다루면 안 된다. **점수를 매겨 두고
 * 집계에서만 뺀다**(`rollup_daily`). 진짜 사람을 잘못 걸러도 원본에 남아 있어
 * 무엇이 걸렸는지 보이고, 기준을 고쳐 다시 집계하면 지난 날짜까지 따라온다.
 */

/** 이 값 이상이면 봇으로 본다. SQL 쪽 기본값(`rollup_daily`)과 같아야 한다. */
export const BOT_THRESHOLD = 2;

export type BotVerdict = {
  score: number;
  /** 점수의 근거. 비어 있으면 `null` — 대부분의 줄이 그렇다. */
  reason: string | null;
};

/**
 * 힌트를 보내는 브라우저인가.
 *
 * Chromium 만 `sec-ch-ua` 를 보낸다. Safari·Firefox 는 아예 안 보내므로 그쪽에
 * 이 신호를 대면 **진짜 사람이 전부 봇이 된다.**
 *
 * iOS 는 껍데기가 무엇이든 속이 WebKit 이라 Chrome 을 자칭해도(`CriOS`) 힌트가
 * 없다. 그래서 iOS 표식을 먼저 걸러 낸다.
 */
const sendsClientHints = (userAgent: string): boolean =>
  !/CriOS|EdgiOS|FxiOS|OPiOS/.test(userAgent) &&
  /Chrome\/|Edg\//.test(userAgent);

export type BotInput = {
  headers: Headers;
  userAgent: string;
  /** 페이지뷰는 브라우저의 `fetch` 로 들어온다 — 다운로드와 기대 헤더가 다르다. */
  fromBrowserFetch: boolean;
};

/**
 * 신호를 모아 점수를 낸다.
 *
 * 가중치는 **틀렸을 때의 대가**로 정했다. 진짜 사람을 봇으로 만드는 신호일수록
 * 낮게 준다 — 숫자가 조금 부푸는 것보다 사람이 통계에서 사라지는 쪽이 나쁘다.
 */
export function botVerdict(input: BotInput): BotVerdict {
  const reasons: string[] = [];
  let score = 0;

  // 진짜 브라우저는 늘 보낸다. 없으면 HTTP 클라이언트를 손으로 짠 것이다.
  if (!input.headers.get('accept-language')?.trim()) {
    score += 2;
    reasons.push('no-accept-language');
  }

  // UA 는 Chrome 이라는데 Chromium 이 늘 붙이는 힌트가 없다 — 위장 신호다.
  //
  // **1점만 준다.** 이 헤더가 브라우저의 `fetch` 요청에도 실리는지 실물로 아직
  // 확인하지 않았다. 가정이 틀렸다면 이 신호 하나로 Chrome 사용자 전부가 봇이
  // 되므로, 혼자서는 문턱을 못 넘게 둔다.
  if (
    input.fromBrowserFetch &&
    sendsClientHints(input.userAgent) &&
    !input.headers.get('sec-ch-ua')
  ) {
    score += 1;
    reasons.push('no-client-hints');
  }

  // 우리 페이지가 부른 `fetch` 라면 같은 출처의 cors 요청이어야 한다. 다르면
  // 브라우저를 거치지 않고 수집 API 를 직접 두드린 것이다.
  if (input.fromBrowserFetch) {
    const site = input.headers.get('sec-fetch-site');
    const mode = input.headers.get('sec-fetch-mode');
    if (site && mode && (site !== 'same-origin' || mode !== 'cors')) {
      score += 3;
      reasons.push(`bad-fetch-metadata:${site}/${mode}`);
    }
  }

  return { score, reason: reasons.length > 0 ? reasons.join(',') : null };
}

/**
 * `Accept-Language` 의 첫 태그에서 언어 코드만.
 *
 * `de-AT,de;q=0.9,en;q=0.8` → `de`. 지역과 뒤따르는 목록은 버린다 — 전체
 * 문자열은 언어 목록과 가중치까지 실려 오는 지문이라, UA 원본을 안 남기기로
 * 한 것과 같은 이유로 남기지 않는다.
 */
export function primaryLanguage(headers: Headers): string | null {
  const raw = headers.get('accept-language')?.trim();
  if (!raw) return null;

  const tag = raw
    .split(',')[0]
    .split(';')[0]
    .trim()
    .split('-')[0]
    .toLowerCase();
  return /^[a-z]{2,3}$/.test(tag) ? tag : null;
}

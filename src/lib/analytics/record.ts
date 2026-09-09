/**
 * 이벤트 기록 (IDE-013)
 *
 * **절대 던지지 않는다.** 이 함수를 부르는 곳은 페이지 응답과 PDF 응답이다 —
 * 분석이 죽어서 도안이 안 나오면 순서가 거꾸로다. Supabase 가 통째로 꺼져
 * 있어도, 키가 없어도, 스키마가 어긋나도 조용히 `false` 를 돌려준다.
 */
import 'server-only';
import { analyticsClient } from './client';
import { analyticsConfig } from './config';
import {
  classifyChannel,
  readUtm,
  referrerHost,
  type Channel,
} from './channel';
import {
  countryOf,
  gameIdFromPath,
  isBot,
  normalizePath,
  summarizeUa,
} from './request';
import { botVerdict, primaryLanguage } from './bot';
import { isExcludedPath } from './excluded';
import { hasNoCountCookie } from './session';
import { analyticsDay, clientIp, visitorId } from './visitor';

export type EventType = 'pageview' | 'download';

export type RecordInput = {
  type: EventType;
  /** 방문한 경로. 쿼리가 붙어 있어도 된다 — utm 만 뽑고 나머지는 버린다. */
  url: string;
  /** 브라우저의 `document.referrer`. 서버에서 부를 땐 `Referer` 헤더. */
  referrer?: string | null;
  headers: Headers;
  /** 경로로 알 수 없는 게임(내보내기 API 가 그렇다)은 여기로 넘긴다. */
  gameId?: string | null;
  now?: Date;
};

/** 상대 경로도 절대 URL 도 받는다 — 부르는 쪽마다 가진 것이 다르다. */
const parseUrl = (url: string, host: string): URL => {
  try {
    return new URL(url, `https://${host || 'localhost'}`);
  } catch {
    return new URL('/', `https://${host || 'localhost'}`);
  }
};

export type RecordResult =
  | { recorded: true; channel: Channel }
  | {
      recorded: false;
      reason: 'disabled' | 'bot' | 'excluded' | 'opted-out' | 'error';
    };

export async function recordEvent(input: RecordInput): Promise<RecordResult> {
  try {
    const config = analyticsConfig();
    const supabase = analyticsClient();
    if (!config || !supabase) return { recorded: false, reason: 'disabled' };

    const userAgent = input.headers.get('user-agent');
    if (isBot(userAgent)) return { recorded: false, reason: 'bot' };

    // 관리자로 로그인한 브라우저는 사이트 어디를 열어도 세지 않는다 (IDE-026).
    // 경로보다 먼저 본다 — 이 판단에는 경로가 필요 없다.
    if (hasNoCountCookie(input.headers))
      return { recorded: false, reason: 'opted-out' };

    const host = input.headers.get('host') ?? '';
    // referrer URL 의 hostname 에는 포트가 없다. `host` 헤더에는 있을 수 있어서
    // 그대로 견주면 **사이트 안에서 넘어온 것이 전부 외부 유입으로 잡힌다.**
    const selfHost = host.split(':')[0].toLowerCase();
    const url = parseUrl(input.url, host);
    const path = normalizePath(url.pathname);
    // 관리자 화면은 세지 않는다. 설정보다 앞이 아니라 **경로를 알아낸 직후**에
    // 판단한다 — 클라이언트가 보낸 원본 문자열이 아니라 정규화된 경로로 봐야
    // `/admin/` 이나 `/admin?x=1` 같은 변형이 새어 나가지 않는다.
    if (isExcludedPath(path)) return { recorded: false, reason: 'excluded' };
    const utm = readUtm(url.searchParams);
    const fromHost = referrerHost(input.referrer);
    const channel = classifyChannel(utm, fromHost, selfHost);
    const ua = summarizeUa(userAgent);
    const day = analyticsDay(input.now);
    // 페이지뷰만 브라우저의 `fetch` 로 들어온다. 다운로드는 링크를 누른 이동이라
    // `sec-fetch-*` 기대값이 달라서, 같은 잣대를 대면 전부 봇이 된다.
    const bot = botVerdict({
      headers: input.headers,
      userAgent: userAgent ?? '',
      fromBrowserFetch: input.type === 'pageview',
    });

    const { error } = await supabase.rpc('record_event', {
      p_day: day,
      p_type: input.type,
      p_visitor_id: visitorId(
        { ip: clientIp(input.headers), userAgent: userAgent ?? '', host },
        config.hashSalt,
        day,
      ),
      p_path: path,
      p_channel: channel,
      p_game_id: input.gameId ?? gameIdFromPath(path),
      // 사이트 안에서 넘어온 것은 유입이 아니다 — 우리 호스트는 안 남긴다.
      p_referrer_host: fromHost && fromHost !== selfHost ? fromHost : null,
      p_utm_source: utm.source,
      p_utm_medium: utm.medium,
      p_utm_campaign: utm.campaign,
      p_ua_browser: ua.browser,
      p_ua_os: ua.os,
      p_ua_device: ua.device,
      p_country: countryOf(input.headers),
      p_lang: primaryLanguage(input.headers),
      p_bot_score: bot.score,
      p_bot_reason: bot.reason,
    });

    if (error) {
      console.warn('[analytics] 이벤트 기록 실패:', error.message);
      return { recorded: false, reason: 'error' };
    }
    return { recorded: true, channel };
  } catch (cause) {
    console.warn('[analytics] 이벤트 기록 실패:', cause);
    return { recorded: false, reason: 'error' };
  }
}

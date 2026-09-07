/**
 * 요청에서 건질 것 · 버릴 것 (IDE-013)
 *
 * UA 는 원본을 저장하지 않는다 — 브라우저·OS·기기 세 칸으로 줄인다. 원본
 * 문자열은 확장 목록·글꼴 목록까지 실려 오는 지문이라, 그대로 두면 IP 없이도
 * 사람을 특정할 수 있다.
 */
import { gameIds } from '@/lib/games';

export type UaSummary = {
  browser: string | null;
  os: string | null;
  device: 'desktop' | 'mobile' | 'tablet' | null;
};

/**
 * 봇·프리렌더 요청.
 *
 * 넉넉하게 잡는다 — 사람 하나를 놓치는 것보다 크롤러 하나가 섞이는 편이
 * 수치를 더 크게 망친다. 숫자를 보려고 만든 것이지 사람을 세는 대회가 아니다.
 */
const BOT =
  /bot|crawl|spider|slurp|headless|preview|prerender|lighthouse|pagespeed|monitor|curl|wget|python-requests|node-fetch|axios|okhttp|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|vercel-screenshot/i;

export const isBot = (userAgent: string | null | undefined): boolean =>
  !userAgent || BOT.test(userAgent);

/** 순서가 중요하다 — Edge 는 Chrome 을, Chrome 은 Safari 를 UA 에 달고 다닌다. */
const BROWSERS: [RegExp, string][] = [
  [/Edg[eA]?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Whale/, 'Whale'],
  [/FxiOS|Firefox/, 'Firefox'],
  [/CriOS|Chrome/, 'Chrome'],
  [/Safari/, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

const first = (userAgent: string, table: [RegExp, string][]): string | null =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

export function summarizeUa(userAgent: string | null | undefined): UaSummary {
  if (!userAgent) return { browser: null, os: null, device: null };

  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/.test(
    userAgent,
  );
  const mobile = /Mobi|iPhone|iPod|Android|Windows Phone/.test(userAgent);

  return {
    browser: first(userAgent, BROWSERS),
    os: first(userAgent, SYSTEMS),
    device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
  };
}

/**
 * 경로에서 게임 id 를 꺼낸다 — `/games/<id>` · `/games/<id>/edit` · `/games/<id>/print`.
 *
 * **등록소에 있는 id 만 인정한다.** 경로는 누구나 만들어 부를 수 있어서,
 * 그대로 받으면 `game_id` 칸이 남이 지어낸 문자열로 채워진다.
 */
export function gameIdFromPath(path: string): string | null {
  const id = /^\/games\/([^/]+)/.exec(path)?.[1];
  if (!id) return null;
  const decoded = decodeURIComponent(id);
  return gameIds().includes(decoded) ? decoded : null;
}

/**
 * 저장할 경로 — 물음표 뒤를 버리고 앞부분만 남긴다.
 *
 * 쿼리에는 utm 말고도 무엇이든 실려 올 수 있다. utm 은 따로 칸을 두고 뽑아
 * 놓았으니 원본을 통째로 들고 있을 이유가 없다.
 */
export function normalizePath(rawPath: string): string {
  const path = rawPath.split('?')[0].split('#')[0];
  if (!path.startsWith('/')) return '/';
  // 뒤 슬래시는 하나로 본다 — `/games/` 와 `/games` 가 다른 줄이 되면 안 된다.
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : '/';
}

/** 배포 플랫폼이 붙여 주는 국가 코드. 없으면 그냥 비운다. */
export function countryOf(headers: Headers): string | null {
  const code =
    headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? null;
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

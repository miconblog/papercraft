import 'server-only';

/**
 * 게임 예약 공개 — 오픈 시각과 내림 스위치 (IDE-022)
 *
 * 담는 것은 **"언제 열리는가"와 "지금 내려 뒀나" 두 칸**뿐이다. 도안·규격·
 * 아트워크는 여전히 등록소(코드)에 있고, 여기 줄이 없는 게임은 지금까지처럼
 * 열려 있다.
 *
 * **두 칸은 서로 간섭하지 않는다.** 내려도 잡아 둔 오픈 시각은 남고, 다시
 * 올리면 그 예약이 이어진다 — 급히 내리는 일과 날을 잡는 일은 다른 일이라
 * 한쪽을 만지다 다른 쪽을 지우면 안 된다.
 *
 * **닿지 못하면 전부 공개다.** 키가 없어도, Supabase 가 꺼져 있어도, 값이
 * 망가져 있어도 던지지 않고 빈 표를 돌려준다 — 그러면 게임 다섯이 그대로
 * 나온다. 반대로 두면 DB 사고 한 번에 사이트가 텅 빈다(`IDE-013` 이 수집을
 * 조용히 끄는 것과 같은 방향이다).
 *
 * ## 왜 supabase-js 를 쓰지 않나
 *
 * 이 파일은 **`proxy.ts` 가 요청마다 부른다.** 두 가지가 걸린다.
 *
 * 1. 렌더 경로(홈 목록)는 Next 의 시간 기반 재검증에 얹어야 하는데, 그 옵션은
 *    `fetch` 한 번에 하나씩 붙는다 — supabase-js 로는 넘길 길이 없고, 옵션 없는
 *    `fetch` 는 `no-store` 라 **홈 전체가 정적 렌더링에서 빠진다.**
 * 2. 프록시 번들에 클라이언트 라이브러리를 끌고 들어갈 이유가 없다.
 *
 * 읽는 것이 표 하나에 두 칸이라 PostgREST 를 그대로 부른다. 서비스 롤 키는
 * `analytics/config.ts` 가 주인이다 — 여기서 `process.env` 를 다시 읽지 않는다.
 *
 * 다만 **수집 스위치(`ANALYTICS_ENABLED`)는 보지 않는다.** 방문을 안 세기로 한
 * 것과 게임을 언제 열지는 다른 이야기다 — 묶어 두면 수집을 끄는 순간 잡아 둔
 * 오픈일이 전부 풀린다.
 */
import { ANALYTICS_SCHEMA, supabaseConnection } from '@/lib/analytics/config';
import {
  ADMIN_COOKIE,
  cookieValue,
  hasAdminSession,
} from '@/lib/analytics/session';

export type Release = {
  /** 이 순간부터 열린다(epoch ms). `null` 이면 잡아 둔 날이 없다. */
  publishAt: number | null;
  /** 켜져 있으면 **오픈 시각과 무관하게** 안 보인다. */
  hidden: boolean;
};

/** 게임 id → 그 게임의 줄. 줄이 없으면 열려 있다. */
export type ReleaseMap = ReadonlyMap<string, Release>;

export const NO_RELEASES: ReleaseMap = new Map();

/**
 * 홈 목록이 쓰는 캐시 태그. 관리자가 날짜를 바꾸면 서버 액션이 이걸 만료시켜
 * 60초를 기다리지 않고 바로 반영한다.
 */
export const RELEASE_TAG = 'game-release';

/** 렌더 경로의 재검증 주기(초). 아래 `설계` 주석과 이슈 결정 기록이 같은 값을 말한다. */
export const RENDER_REVALIDATE_S = 60;

/** 프록시가 들고 있는 메모리 캐시의 수명(ms). */
const REQUEST_TTL_MS = 30_000;

const TABLE = 'game_release';

const restUrl = (base: string, query = ''): string =>
  `${base.replace(/\/+$/, '')}/rest/v1/${TABLE}${query}`;

const keyHeaders = (key: string): Record<string, string> => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
});

/**
 * 못 읽는 날짜는 **없는 것으로 친다**. 줄을 통째로 버리지 않는 것이 중요하다 —
 * 그 줄의 `hidden` 까지 함께 버리면 급히 내려 둔 게임이 날짜 한 칸 때문에 도로
 * 열린다. 날짜가 망가진 쪽은 "예약 없음"으로 읽히니 방향도 안전하다.
 */
function parseInstant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function parseRow(row: unknown): [string, Release] | null {
  if (typeof row !== 'object' || row === null) return null;
  const {
    game_id: id,
    publish_at: at,
    hidden,
  } = row as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0) return null;

  const publishAt = parseInstant(at);
  if (at != null && publishAt === null) {
    console.warn('[release] 읽을 수 없는 오픈 시각을 무시한다:', id, at);
  }
  // 칸이 아직 없는 DB(006 적용 전)에서는 `undefined` 다 — 그때는 안 내린 것으로
  // 읽는다. 스위치가 조용히 안 먹을 뿐, 예약은 그대로 돈다.
  return [id, { publishAt, hidden: hidden === true }];
}

export function toReleaseMap(rows: unknown): ReleaseMap {
  if (!Array.isArray(rows)) return NO_RELEASES;
  const map = new Map<string, Release>();
  for (const row of rows) {
    const entry = parseRow(row);
    if (entry) map.set(entry[0], entry[1]);
    else console.warn('[release] 읽을 수 없는 줄을 건너뛴다:', row);
  }
  return map;
}

/** 절대 던지지 않는다. 닿지 못하면 빈 표 = 전부 공개. */
async function fetchReleases(init: RequestInit): Promise<ReleaseMap> {
  const config = supabaseConnection();
  if (!config) return NO_RELEASES;

  try {
    // 칸 이름을 적지 않고 통째로 받는다. 적어 두면 `hidden` 칸이 아직 없는
    // DB(006 적용 전)에서 **읽기 전체가 400 으로 실패**하고, 그러면 잡아 둔
    // 오픈일까지 한꺼번에 풀린다. 통째로 받으면 없는 칸이 그냥 빠질 뿐이다.
    const response = await fetch(restUrl(config.url, '?select=*'), {
      ...init,
      headers: {
        ...keyHeaders(config.serviceRoleKey),
        'Accept-Profile': ANALYTICS_SCHEMA,
      },
    });
    if (!response.ok) {
      console.warn('[release] 오픈일을 읽지 못했다:', response.status);
      return NO_RELEASES;
    }
    return toReleaseMap(await response.json());
  } catch (cause) {
    console.warn('[release] 오픈일을 읽지 못했다:', cause);
    return NO_RELEASES;
  }
}

/**
 * 렌더용 — 홈 목록이 부른다.
 *
 * `next.revalidate` 를 달아 **페이지가 정적인 채로** 60초마다 다시 그려지게
 * 한다. 옵션 없이 부르면 `no-store` 로 잡혀 홈이 매 요청 서버 렌더가 된다.
 */
export const releasesForRender = (): Promise<ReleaseMap> =>
  fetchReleases({
    next: { revalidate: RENDER_REVALIDATE_S, tags: [RELEASE_TAG] },
  });

/**
 * 요청용 — 프록시와 API 라우트가 부른다.
 *
 * 프록시에서는 Next 의 캐시 옵션이 통하지 않는다(문서에 그렇게 적혀 있다).
 * 그래서 인스턴스 메모리에 30초만 들고 있는다 — 게임이 열리는 시각이 최대
 * 30초 밀리는 대신, 방문마다 DB 를 두드리지 않는다.
 *
 * 같은 순간에 여러 요청이 들어와도 왕복은 하나다.
 */
let memo: { until: number; releases: ReleaseMap } | null = null;
let inFlight: Promise<ReleaseMap> | null = null;

export async function releasesForRequest(
  now: number = Date.now(),
): Promise<ReleaseMap> {
  if (memo && memo.until > now) return memo.releases;
  if (!inFlight) {
    inFlight = fetchReleases({ cache: 'no-store' })
      .then((releases) => {
        memo = { until: Date.now() + REQUEST_TTL_MS, releases };
        return releases;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** 방금 쓴 값을 이 인스턴스가 30초 동안 못 보는 일이 없게 한다. */
export const forgetReleases = (): void => {
  memo = null;
};

/**
 * 지금 이 게임이 열려 있나.
 *
 * 내림 스위치가 **날짜를 이긴다** — 급히 내리는 조작이 이미 지난 오픈 시각에
 * 지지면 스위치를 끈 뜻이 없다.
 *
 * 오픈 시각은 **그 순간부터** 열린다(`<=`). 경계를 `<` 로 두면 "0시에 열린다"가
 * 0시 0분 0초 001밀리초가 된다.
 */
export const isOpen = (
  releases: ReleaseMap,
  gameId: string,
  now: number = Date.now(),
): boolean => {
  const release = releases.get(gameId);
  if (!release) return true;
  if (release.hidden) return false;
  return release.publishAt === null || release.publishAt <= now;
};

/**
 * 이 요청에 이 게임을 내줘도 되나 (IDE-022)
 *
 * API 라우트가 쓴다. 화면은 `proxy.ts` 가 막지만 **API 는 스스로 한 번 더
 * 본다** — 여기가 도안 바이트가 실제로 나가는 자리라, matcher 한 줄에 전부를
 * 걸어 두지 않는다.
 */
export async function isGameVisible(
  gameId: string,
  headers: Headers,
): Promise<boolean> {
  if (isOpen(await releasesForRequest(), gameId)) return true;
  return hasAdminSession(cookieValue(headers, ADMIN_COOKIE));
}

// ── KST 벽시계 ↔ 절대 시각 ──────────────────────────────────────────
// 날짜 경계는 KST 다. `analyticsDay` 가 이미 같은 경계를 쓴다 — 어긋나면
// "오픈일의 방문 수"가 이틀에 걸쳐 쪼개진다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `<input type="datetime-local">` 이 보낸 KST 벽시계 → 절대 시각. 못 읽으면 `null`. */
export function kstLocalToInstant(value: string): number | null {
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(
    value.trim(),
  );
  if (!matched) return null;
  const ms = Date.parse(
    `${matched[1]}T${matched[2]}${matched[3] ?? ':00'}+09:00`,
  );
  return Number.isNaN(ms) ? null : ms;
}

/** 절대 시각 → `datetime-local` 에 다시 채워 넣을 KST 벽시계(`2026-09-10T00:00`). */
export const instantToKstLocal = (ms: number): string =>
  new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);

/**
 * 오늘 0시(KST) — 관리자 화면의 빈 칸 기본값이다.
 *
 * 화면에서 `Date.now()` 를 직접 부르지 않으려고 여기 둔다. 렌더 중에 부르면
 * 순수성 규칙(`react-hooks/purity`)에 걸리고, 그 규칙이 짚는 것도 맞다 —
 * "지금"은 데이터지 그리는 일이 아니다.
 */
export const todayKstMidnight = (now: number = Date.now()): string =>
  `${instantToKstLocal(now).slice(0, 10)}T00:00`;

/** 사람이 읽을 KST 표기. 시간대를 안 적으면 브라우저 시각으로 오해한다. */
export const formatKst = (ms: number): string =>
  `${instantToKstLocal(ms).replace('T', ' ')} KST`;

// ── 쓰기 ────────────────────────────────────────────────────────────
// 관리자 화면에서만 부른다. 읽기와 달리 실패를 감추지 않는다 — 저장이 조용히
// 실패하면 관리자는 날을 잡아 뒀다고 믿는다.

export type WriteResult = { ok: true } | { ok: false; message: string };

const DISABLED: WriteResult = {
  ok: false,
  message:
    '저장소에 닿지 못했습니다. 환경변수(SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY)를 확인하세요.',
};

async function write(path: string, init: RequestInit): Promise<WriteResult> {
  const config = supabaseConnection();
  if (!config) return DISABLED;

  try {
    const response = await fetch(restUrl(config.url, path), {
      ...init,
      cache: 'no-store',
      headers: {
        ...keyHeaders(config.serviceRoleKey),
        'Content-Profile': ANALYTICS_SCHEMA,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[release] 오픈일을 쓰지 못했다:', response.status, body);
      return {
        ok: false,
        message: `저장하지 못했습니다 (${response.status}).`,
      };
    }
    forgetReleases();
    return { ok: true };
  } catch (cause) {
    console.warn('[release] 오픈일을 쓰지 못했다:', cause);
    return { ok: false, message: '저장하지 못했습니다.' };
  }
}

/**
 * 한 줄을 통째로 쓴다.
 *
 * **부분 갱신을 하지 않는 이유.** 오픈 시각과 내림 스위치는 서로 간섭하면 안
 * 되는데, 한쪽 칸만 담아 보내면 나머지 칸이 어떻게 되는지가 PostgREST 의
 * upsert 규칙에 달린다. 지금 값을 먼저 읽어 두 칸을 다 적어 보내면 그 규칙을
 * 알 필요가 없다 — 관리자 조작이라 왕복 한 번이 더 드는 것은 문제가 아니다.
 */
const upsert = (gameId: string, release: Release): Promise<WriteResult> =>
  write('', {
    method: 'POST',
    // 같은 게임을 두 번 지정하면 덮어쓴다 — 표에 줄이 둘 생기면 어느 쪽이
    // 진짜인지 알 수 없다.
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      game_id: gameId,
      publish_at:
        release.publishAt === null
          ? null
          : new Date(release.publishAt).toISOString(),
      hidden: release.hidden,
      updated_at: new Date().toISOString(),
    }),
  });

/** 지금 DB 에 있는 그 게임의 줄. 캐시를 타지 않는다 — 쓰기 직전에 읽는다. */
const currentRelease = async (gameId: string): Promise<Release> =>
  (await fetchReleases({ cache: 'no-store' })).get(gameId) ?? {
    publishAt: null,
    hidden: false,
  };

/** 오픈 시각을 지정하거나 바꾼다. 내림 스위치는 건드리지 않는다. */
export async function saveRelease(
  gameId: string,
  publishAt: number,
): Promise<WriteResult> {
  const current = await currentRelease(gameId);
  return upsert(gameId, { ...current, publishAt });
}

/**
 * 지금 당장 내리거나 다시 올린다 (사용자 요청 2026-09-09).
 *
 * 잡아 둔 오픈 시각은 그대로 둔다 — 잘못 열린 것을 급히 내리는 일과, 언제 열지
 * 정하는 일은 다른 일이다. 올리면 그 예약이 이어진다.
 */
export async function setReleaseHidden(
  gameId: string,
  hidden: boolean,
): Promise<WriteResult> {
  const current = await currentRelease(gameId);
  return upsert(gameId, { ...current, hidden });
}

/**
 * 예약만 푼다.
 *
 * 내려 둔 게임이면 줄을 남기고 날짜만 비운다 — 통째로 지우면 **내림까지 함께
 * 풀려** 게임이 도로 열린다. 남길 이유가 없는 줄(안 내렸고 날짜도 없다)은
 * 지운다.
 */
export async function clearRelease(gameId: string): Promise<WriteResult> {
  const current = await currentRelease(gameId);
  if (current.hidden) return upsert(gameId, { publishAt: null, hidden: true });

  return write(`?game_id=eq.${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
  });
}

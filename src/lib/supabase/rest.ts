import 'server-only';

/**
 * PostgREST 를 직접 부르는 자리 (IDE-022 · IDE-023)
 *
 * 예약 공개(`lib/games/release.ts`)와 공방 일지(`lib/blog/posts.ts`)가 같은
 * Supabase 를 같은 방식으로 두드린다. 두 벌로 두면 스키마 헤더를 한쪽에만
 * 붙이거나 실패를 한쪽만 삼키는 어긋남이 생긴다 — `analytics/config.ts` 가
 * "켜졌나"를 한 곳에서 정하는 것과 같은 이유로 여기 모은다.
 *
 * ## 왜 supabase-js 를 쓰지 않나
 *
 * `release.ts` 에 적힌 이유가 그대로다. 렌더 경로는 Next 의 시간 기반 재검증에
 * 얹어야 하는데 그 옵션은 `fetch` 한 번에 하나씩 붙고, 프록시 번들에 클라이언트
 * 라이브러리를 끌고 들어갈 이유도 없다.
 *
 * ## 읽기와 쓰기의 태도가 다르다
 *
 * **읽기는 절대 던지지 않는다.** 못 읽으면 `null` 이고, 부르는 쪽이 "없을 때"를
 * 정한다 — 게임은 전부 공개, 글은 하나도 없음. 반대로 **쓰기는 실패를 감추지
 * 않는다.** 저장이 조용히 실패하면 사람은 저장됐다고 믿는다.
 */
import { ANALYTICS_SCHEMA, supabaseConnection } from '@/lib/analytics/config';

export type WriteResult = { ok: true } | { ok: false; message: string };

/**
 * 렌더 경로가 이 DB 를 읽을 때의 재검증 주기(초).
 *
 * 예약 공개도 공방 일지도 같은 약속을 한다 — **시각이 지나면 사람 손 없이
 * 열린다.** 그 "얼마나 빨리"가 두 값으로 갈리면 화면에 적어 둔 안내가 한쪽만
 * 맞게 된다.
 */
export const RENDER_REVALIDATE_S = 60;

/** 프록시가 값을 메모리에 들고 있는 시간(ms). 프록시에는 Next 캐시가 안 통한다. */
export const REQUEST_TTL_MS = 30_000;

/** 키가 없을 때. 쓰기만 이걸 본다 — 읽기는 조용히 `null` 이다. */
export const REST_DISABLED: WriteResult = {
  ok: false,
  message:
    '저장소에 닿지 못했습니다. 환경변수(SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY)를 확인하세요.',
};

const restUrl = (base: string, table: string, query: string): string =>
  `${base.replace(/\/+$/, '')}/rest/v1/${table}${query}`;

const keyHeaders = (key: string): Record<string, string> => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
});

type ReadOptions = {
  table: string;
  /** `?select=*` 처럼 물음표부터. 비우면 표 전체다. */
  query?: string;
  init: RequestInit;
  /** 경고에 찍히는 이름 — 어느 기능이 못 읽었는지 로그만 보고 알게 한다. */
  label: string;
};

/**
 * 줄을 읽어 온다. **절대 던지지 않는다** — 키가 없어도, 꺼져 있어도, 값이
 * 망가져 있어도 `null` 이다.
 *
 * 배열이 아니면 `null` 로 친다. PostgREST 가 오류를 객체로 돌려주는 경우가
 * 있는데, 그걸 그대로 흘려보내면 부르는 쪽이 줄인 줄 알고 파싱한다.
 */
export async function restRead({
  table,
  query = '',
  init,
  label,
}: ReadOptions): Promise<unknown[] | null> {
  const config = supabaseConnection();
  if (!config) return null;

  try {
    const response = await fetch(restUrl(config.url, table, query), {
      ...init,
      headers: {
        ...keyHeaders(config.serviceRoleKey),
        'Accept-Profile': ANALYTICS_SCHEMA,
        ...init.headers,
      },
    });
    if (!response.ok) {
      console.warn(`[${label}] 읽지 못했다:`, response.status);
      return null;
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      console.warn(`[${label}] 줄 목록이 아닌 응답을 무시한다:`, rows);
      return null;
    }
    return rows;
  } catch (cause) {
    console.warn(`[${label}] 읽지 못했다:`, cause);
    return null;
  }
}

type WriteOptions = {
  table: string;
  /** `?id=eq.…` 처럼 물음표부터. 비우면 표 전체다(insert·upsert 가 그렇다). */
  query?: string;
  init: RequestInit;
  label: string;
  /** 상태 코드를 사람 말로 바꾼다. 돌려주지 않으면 기본 문구를 쓴다. */
  explain?: (status: number, body: string) => string | undefined;
};

/**
 * 한 번 쓴다. 실패를 감추지 않는다.
 *
 * `Content-Profile` 이 `Accept-Profile` 과 짝이다 — 쓰기에는 이쪽을 줘야 우리
 * 스키마로 들어간다. 한쪽만 붙이면 조용히 남의 스키마를 찾는다.
 */
export async function restWrite({
  table,
  query = '',
  init,
  label,
  explain,
}: WriteOptions): Promise<WriteResult> {
  const config = supabaseConnection();
  if (!config) return REST_DISABLED;

  try {
    const response = await fetch(restUrl(config.url, table, query), {
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
      console.warn(`[${label}] 쓰지 못했다:`, response.status, body);
      return {
        ok: false,
        message:
          explain?.(response.status, body) ??
          `저장하지 못했습니다 (${response.status}).`,
      };
    }
    return { ok: true };
  } catch (cause) {
    console.warn(`[${label}] 쓰지 못했다:`, cause);
    return { ok: false, message: '저장하지 못했습니다.' };
  }
}

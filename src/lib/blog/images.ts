import 'server-only';

/**
 * 공방 일지 사진 (IDE-023)
 *
 * **2026-09-09 사용자 결정.** 사진은 Supabase 의 파일 보관소에 둔다. 저장소
 * `public/` 에 커밋하는 길도 있었지만 그러면 사진을 넣을 때마다 컴퓨터 앞으로
 * 돌아가야 해서, 이 이슈가 관리자 화면을 고른 이유("폰으로도 쓰고 고친다")가
 * 반쪽이 된다.
 *
 * ## 주소를 모르면 못 연다
 *
 * 같은 날 사용자가 **아이 얼굴이 나온 사진도 올린다**고 정했다. 그래서 파일
 * 이름 앞에 **임의 문자열 32자**를 붙인다 — 목록을 볼 수 없는 버킷에서 이름을
 * 맞혀 내는 길이 사라진다. 열려 있는 것은 여전히 공개 주소라, 글에 실은 사진은
 * 링크를 아는 사람이면 누구나 본다. 글에 안 실은 사진이 이름 추측으로 새지
 * 않게 하는 것이 여기서 지키는 선이다.
 *
 * ## 버킷을 마이그레이션으로 만들지 않는다
 *
 * 만들 수가 없다. 마이그레이션 러너(`scripts/db-migrate.mts`)는 우리 것이 아닌
 * 스키마 이름을 **언급하기만 해도** 적용을 거부하고, 파일 보관소의 표가 그
 * 목록에 있다. 공유 DB 에서 실수 한 번의 대가가 우리 쪽에만 그치지 않아서
 * 세워 둔 규칙이라 여기서 예외를 내지 않는다.
 *
 * 대신 **첫 업로드 때 REST 로 만든다.** 이미 있으면 그대로 쓴다. 설정할 것이
 * 없어야 폰에서 글을 쓰다 막히지 않는다.
 */
import { supabaseConnection } from '@/lib/analytics/config';
import { PHOTO_MAX_BYTES } from './uploadLimit';

export const BUCKET = 'blog';

/** 받는 형식. 브라우저가 그릴 수 있고 스크립트가 될 수 없는 것만 둔다. */
const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

/**
 * 8MB. 폰 원본 사진 한 장이 넉넉히 들어간다.
 *
 * 값은 `uploadLimit.ts` 가 주인이다 — `next.config.ts` 의 서버 액션 본문 한도와
 * 같은 값을 봐야 한다. 갈라져 있어서 사진을 넣을 때마다 저장이 터졌다.
 */
const MAX_BYTES = PHOTO_MAX_BYTES;

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export type UploadResult =
  { ok: true; url: string } | { ok: false; message: string };

/**
 * 보관소 안의 경로.
 *
 * 앞의 32자가 임의 문자열이라 이름을 맞혀 볼 수 없다. 뒤에 원래 이름을 조금
 * 남기는 것은 보관소를 직접 열어 봤을 때 무엇인지 알아보려는 것이다.
 */
export function storagePath(fileName: string, contentType: string): string {
  const random = crypto.randomUUID().replace(/-/g, '');
  const stem = fileName
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .toLowerCase();
  const ext = EXTENSION[contentType] ?? 'bin';
  return stem ? `${random}-${stem}.${ext}` : `${random}.${ext}`;
}

const apiBase = (url: string): string =>
  `${url.replace(/\/+$/, '')}/storage/v1`;

const keyHeaders = (key: string): Record<string, string> => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
});

/**
 * 버킷이 있는지 확인하고 없으면 만든다.
 *
 * 이미 있으면 409 가 오는데 그것도 성공으로 친다 — 두 사람이 동시에 첫 사진을
 * 올리는 일은 없지만, 있는 것을 못 만들었다고 실패로 돌리면 정상 상태가
 * 오류가 된다.
 */
async function ensureBucket(url: string, key: string): Promise<void> {
  const response = await fetch(`${apiBase(url)}/bucket`, {
    method: 'POST',
    cache: 'no-store',
    headers: { ...keyHeaders(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      // 글에 실린 사진은 누구나 봐야 한다. 감추는 몫은 위에 적은 대로
      // **추측할 수 없는 이름**이 맡는다.
      public: true,
      file_size_limit: MAX_BYTES,
      allowed_mime_types: [...ALLOWED],
    }),
  });
  if (!response.ok && response.status !== 409) {
    console.warn('[blog] 사진 보관소를 만들지 못했다:', response.status);
  }
}

/** 브라우저가 열 수 있는 주소. 본문 마크다운에 이 값이 그대로 들어간다. */
export const publicUrl = (url: string, path: string): string =>
  `${apiBase(url)}/object/public/${BUCKET}/${path}`;

/**
 * 우리가 붙인 파일 이름의 꼴 — `storagePath` 가 만드는 그대로다.
 *
 * 임의 문자열 32자(소문자 16진수), 원래 이름에서 남긴 조각(있으면), 확장자.
 * 지우는 쪽이 **이 꼴이 아니면 절대 손대지 않는다.** 올리는 규칙이 바뀌면 이것도
 * 함께 바꿔야 한다 — 시험(`images.test.ts`)이 둘을 맞물려 본다.
 */
const OUR_NAME = /^[0-9a-f]{32}(-[a-z0-9-]+)?\.(jpg|png|webp|gif|avif|bin)$/;

/**
 * 우리 공개 주소 → 버킷 안 파일 경로. 우리 것이 아니면 `null` (IDE-028)
 *
 * 사진 파일을 지울 후보를 고를 때 쓴다(2026-09-10 사용자 요청). **다른 호스트,
 * 다른 버킷, 우리가 붙이지 않은 이름**은 모두 `null` 이다 — 글에 밖에서 가져온
 * 사진 주소를 붙여 넣었을 때 그것을 지우려 들면 안 된다.
 */
export function pathFromPublicUrl(
  url: string,
  supabaseUrl: string,
): string | null {
  const prefix = publicUrl(supabaseUrl, '');
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return OUR_NAME.test(path) ? path : null;
}

/**
 * 사진 파일들을 지운다 — **되돌릴 수 없다** (IDE-028)
 *
 * 지워도 되는지(어느 글도 안 쓰는지)는 부르는 쪽이 이미 가렸다
 * (`lib/blog/cleanup.ts`). 여기서는 **우리 이름 꼴인지만 한 번 더** 본다 — 이
 * 함수가 다른 곳에서 불려도 남의 파일을 지우는 일이 없게.
 *
 * 스토리지의 여러 파일 지우기(`DELETE /object/{버킷}` · `{ prefixes }`)를 쓴다.
 * supabase-js 의 `remove()` 가 보내는 것과 같은 요청이다.
 *
 * **절대 던지지 않는다.** 실제로 지운 경로를 돌려주고, 못 지웠으면 빈 목록이다.
 */
export async function deleteStoredImages(
  paths: readonly string[],
): Promise<string[]> {
  const safe = [...new Set(paths)].filter((path) => OUR_NAME.test(path));
  if (safe.length === 0) return [];

  const config = supabaseConnection();
  if (!config) return [];

  try {
    const response = await fetch(`${apiBase(config.url)}/object/${BUCKET}`, {
      method: 'DELETE',
      cache: 'no-store',
      headers: {
        ...keyHeaders(config.serviceRoleKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: safe }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[blog] 사진 파일을 지우지 못했다:', response.status, body);
      return [];
    }

    // 스토리지는 **실제로 지운 것만** 돌려준다 — 이미 없던 파일은 빠진다.
    const rows: unknown = await response.json().catch(() => null);
    if (!Array.isArray(rows)) return safe;
    return rows.flatMap((row) =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as { name?: unknown }).name === 'string'
        ? [(row as { name: string }).name]
        : [],
    );
  } catch (cause) {
    console.warn('[blog] 사진 파일을 지우지 못했다:', cause);
    return [];
  }
}

/** 받아도 되는 파일인가. 받기 전에 본다. */
export function rejectReason(file: File): string | null {
  if (file.size === 0) return '빈 파일입니다.';
  if (file.size > MAX_BYTES) {
    return `사진이 너무 큽니다 (최대 ${MAX_BYTES / 1024 / 1024}MB).`;
  }
  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    return 'JPG · PNG · WebP · GIF · AVIF 만 올릴 수 있습니다.';
  }
  return null;
}

/** 사진 한 장을 올리고 공개 주소를 돌려준다. */
export async function uploadImage(file: File): Promise<UploadResult> {
  const rejected = rejectReason(file);
  if (rejected) return { ok: false, message: rejected };

  const config = supabaseConnection();
  if (!config) {
    return {
      ok: false,
      message:
        '저장소에 닿지 못했습니다. 환경변수(SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY)를 확인하세요.',
    };
  }

  const path = storagePath(file.name, file.type);

  try {
    await ensureBucket(config.url, config.serviceRoleKey);

    const response = await fetch(
      `${apiBase(config.url)}/object/${BUCKET}/${path}`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...keyHeaders(config.serviceRoleKey),
          'Content-Type': file.type,
          // 이름이 임의 문자열이라 겹칠 일이 없다. 겹치면 덮어쓰지 않고 실패해야
          // 앞서 올린 사진이 조용히 사라지지 않는다.
          'x-upsert': 'false',
        },
        body: file,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[blog] 사진을 올리지 못했다:', response.status, body);
      return {
        ok: false,
        message: `사진을 올리지 못했습니다 (${response.status}).`,
      };
    }

    return { ok: true, url: publicUrl(config.url, path) };
  } catch (cause) {
    console.warn('[blog] 사진을 올리지 못했다:', cause);
    return { ok: false, message: '사진을 올리지 못했습니다.' };
  }
}

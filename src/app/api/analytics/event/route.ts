/**
 * 페이지뷰 수집 (IDE-013) · 퍼널 비콘 (IDE-035)
 *
 * 브라우저가 보내는 것은 **경로와 referrer, 그리고 허용된 타입 하나뿐**이다.
 * 방문자 해시·채널·국가는 전부 서버가 헤더에서 만든다 — 클라이언트가 보낸 값을
 * 그대로 믿으면 누구나 원하는 숫자를 만들어 넣을 수 있다.
 *
 * 같은 이유로 **다운로드와 내보내기 실패는 여기서 받지 않는다.** 그 둘은 PDF 를
 * 만드는 라우트가 직접 적는다. 여기로 `download` 를 보내면 조용히 버린다.
 */
import { z } from 'zod';
import { recordEvent } from '@/lib/analytics/record';

export const runtime = 'nodejs';

/** 브라우저가 보낼 수 있는 타입. 없으면 페이지뷰다(옛 `PageViews`). */
const CLIENT_TYPES = ['pageview', 'edit_start', 'print_open'] as const;

const body = z.object({
  type: z.enum(CLIENT_TYPES).default('pageview'),
  // 상대 경로만 받는다. `//evil.com` 같은 스킴 없는 절대 URL 을 막는다.
  url: z
    .string()
    .max(2048)
    .startsWith('/')
    .refine((v) => !v.startsWith('//')),
  referrer: z.string().max(2048).nullish(),
});

/** 언제나 204 다. 브라우저는 결과로 할 일이 없고, 실패를 알려 줄 이유도 없다. */
const noContent = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noContent();

  await recordEvent({
    type: parsed.data.type,
    url: parsed.data.url,
    referrer: parsed.data.referrer ?? null,
    headers: request.headers,
  });

  return noContent();
}

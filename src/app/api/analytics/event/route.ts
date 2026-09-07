/**
 * 페이지뷰 수집 (IDE-013)
 *
 * 브라우저가 보내는 것은 **경로와 referrer 뿐**이다. 방문자 해시·채널·국가는
 * 전부 서버가 헤더에서 만든다 — 클라이언트가 보낸 값을 그대로 믿으면 누구나
 * 원하는 숫자를 만들어 넣을 수 있다.
 */
import { z } from 'zod';
import { recordEvent } from '@/lib/analytics/record';

export const runtime = 'nodejs';

const body = z.object({
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
    type: 'pageview',
    url: parsed.data.url,
    referrer: parsed.data.referrer ?? null,
    headers: request.headers,
  });

  return noContent();
}

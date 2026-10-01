import { receiveMention } from '@/lib/mentions/receive';
import { replyFor } from '@/lib/mentions/replies';

/**
 * 웹멘션을 받는 주소 (IDE-046)
 *
 * 남의 블로그가 우리 글 · 게임을 가리키면 여기로 알려 온다(W3C Webmention).
 * 몸통은 폼이고 칸은 둘이다 — `source`(가리킨 글)와 `target`(가리켜진 우리 주소).
 *
 * 이 주소는 글 · 게임 화면이 응답 헤더와 `<link>` 로 알린다
 * (`lib/mentions/endpoints.ts`). 보내는 쪽은 그것을 보고 찾아온다.
 *
 * **봉투만 뜯는다.** 검사 · 확인 · 담기는 전부 `receiveMention` 의 일이고, 핑백
 * (`../pingback`)도 같은 함수로 간다.
 *
 * ## 그 자리에서 확인하고 답한다
 *
 * 규약은 받아만 두고 나중에 확인해도 된다고 하지만(202), 그러려면 "나중"을 돌릴
 * 일꾼이 따로 있어야 한다. 여기는 요청 안에서 출처에 가 보고 답한다 — 보낸 쪽이
 * **왜 안 됐는지를 바로 안다.**
 */

/** 주소 둘이 들어갈 자리로는 넉넉하다. 이보다 크면 읽지 않는다. */
const MAX_BODY_BYTES = 8_192;

const plain = (status: number, message: string): Response =>
  new Response(`${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/x-www-form-urlencoded\b/i.test(type.trim())) {
    return plain(415, 'Send source and target as a form-encoded body.');
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return plain(413, 'The request body is too large.');
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return plain(400, 'The request body could not be read.');
  }
  // 길이 헤더는 보낸 쪽이 적는 값이다. 읽은 뒤에 한 번 더 본다.
  if (body.length > MAX_BODY_BYTES) {
    return plain(413, 'The request body is too large.');
  }

  const form = new URLSearchParams(body);
  const source = form.get('source') ?? '';
  const target = form.get('target') ?? '';
  if (!source || !target) {
    return plain(400, 'Both source and target are required.');
  }

  const reply = replyFor(
    await receiveMention({ source, target, via: 'webmention' }),
  );
  return plain(reply.http, reply.message);
}

/**
 * 브라우저로 열어 본 사람에게 여기가 무엇인지 말해 준다.
 *
 * 글 화면마다 이 주소가 `<link>` 로 적혀 있어 크롤러도 따라온다. 안내문 한 줄이
 * 검색 결과에 실리지 않게 한다.
 */
export function GET(): Response {
  return new Response(
    'This is a Webmention endpoint. POST source and target as a form-encoded body. See https://www.w3.org/TR/webmention/\n',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}

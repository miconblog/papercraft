import { receiveMention } from '@/lib/mentions/receive';
import { replyFor } from '@/lib/mentions/replies';
import {
  MAX_CALL_BYTES,
  PINGBACK_FAULT,
  parsePingbackCall,
  pingbackFaultXml,
  pingbackOkXml,
} from '@/lib/mentions/xmlrpc';

/**
 * 핑백을 받는 주소 (IDE-046)
 *
 * 웹멘션(`../webmention`)의 옛 형님이다. 워드프레스가 아직 이것으로 보내서,
 * 한국의 설치형 블로그 대부분이 우리를 가리킬 때 여기로 온다. 몸통은 XML-RPC
 * 이고 부르는 메서드는 `pingback.ping(source, target)` 하나다.
 *
 * **답은 늘 200 이다.** XML-RPC 는 실패도 200 에 실어 보낸다 — 몸통의 `<fault>`
 * 가 실패를 말한다. 상태 코드로 답하면 보낸 쪽 구현이 몸통을 읽지 않고 버려서,
 * 왜 안 됐는지가 전해지지 않는다.
 *
 * 받은 주소 둘은 웹멘션과 **같은 길**(`receiveMention`)로 간다.
 */

const xml = (body: string): Response =>
  new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });

const fault = (code: number, message: string): Response =>
  xml(pingbackFaultXml(code, message));

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_CALL_BYTES) {
    return fault(PINGBACK_FAULT.parseError, 'The request body is too large.');
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return fault(PINGBACK_FAULT.parseError, 'The request could not be read.');
  }

  const call = parsePingbackCall(body);
  if (call === 'not-xml') {
    return fault(
      PINGBACK_FAULT.parseError,
      'Expected pingback.ping(source, target).',
    );
  }
  // 같은 주소로 다른 XML-RPC 메서드를 찔러 보는 봇이 흔하다. 여기 있는 것은
  // 핑백 하나뿐이다.
  if (call === 'unknown-method') {
    return fault(
      PINGBACK_FAULT.methodNotFound,
      'Only pingback.ping is supported.',
    );
  }

  const reply = replyFor(await receiveMention({ ...call, via: 'pingback' }));
  return reply.ok
    ? xml(pingbackOkXml(reply.message))
    : fault(reply.fault, reply.message);
}

/** 브라우저로 열어 본 사람에게 여기가 무엇인지 말해 준다. 검색에는 싣지 않는다. */
export function GET(): Response {
  return new Response(
    'This is a Pingback (XML-RPC) endpoint. It accepts pingback.ping only.\n',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}

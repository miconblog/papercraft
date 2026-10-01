/**
 * 핑백의 XML-RPC — 부르기 하나와 답 둘 (IDE-046)
 *
 * 핑백은 XML-RPC 로 `pingback.ping(source, target)` 하나를 부르는 규약이다.
 * 워드프레스가 아직 이것으로 보낸다. 필요한 것이 **문자열 두 개를 읽고 쓰는
 * 것**뿐이라 XML 파서를 들이지 않았다.
 *
 * 파서가 없는 것이 여기서는 방어이기도 하다. XML 을 진짜로 해석하면 DTD 의
 * 엔티티 선언까지 따라가게 되는데, 그것이 XML 을 받는 서버의 오래된 구멍이다
 * (XXE · 엔티티 폭탄). 여기는 태그 사이의 글자를 꺼낼 뿐이라 선언이 있어도
 * 아무 일도 하지 않는다.
 *
 * 순수 함수만 둔다.
 */
import { decodeEntities } from './html';

/** 받는 몸통의 한도. 주소 둘이 들어갈 자리로는 넉넉하다. */
export const MAX_CALL_BYTES = 16_384;

/**
 * 핑백 규약이 정한 오류 번호.
 *
 * 보낸 쪽 소프트웨어가 이 번호를 보고 다시 보낼지를 정한다 — 그래서 사람 말만
 * 돌려주면 안 되고 번호가 맞아야 한다.
 */
export const PINGBACK_FAULT = {
  generic: 0,
  /** 보낸 쪽 글에 닿지 못했다. */
  sourceMissing: 16,
  /** 그 글에 우리로 오는 링크가 없다. */
  noLink: 17,
  /** 우리 쪽에 그런 글이 없다. */
  targetMissing: 32,
  /** 있지만 멘션을 받는 화면이 아니다. */
  targetInvalid: 33,
  alreadyRegistered: 48,
  accessDenied: 49,
  /** XML-RPC 가 정한 번호 — 모르는 메서드. */
  methodNotFound: -32601,
  /** XML-RPC 가 정한 번호 — 읽을 수 없는 몸통. */
  parseError: -32700,
} as const;

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>';

const stringParam = (value: string): string =>
  `<param><value><string>${escapeXml(value)}</string></value></param>`;

/** 보낼 때의 몸통. */
export const pingbackCallXml = (source: string, target: string): string =>
  `${HEAD}<methodCall><methodName>pingback.ping</methodName>` +
  `<params>${stringParam(source)}${stringParam(target)}</params></methodCall>`;

/** 받았다는 답. */
export const pingbackOkXml = (message: string): string =>
  `${HEAD}<methodResponse><params>${stringParam(message)}</params></methodResponse>`;

/** 못 받았다는 답. */
export const pingbackFaultXml = (code: number, message: string): string =>
  `${HEAD}<methodResponse><fault><value><struct>` +
  `<member><name>faultCode</name><value><int>${code}</int></value></member>` +
  `<member><name>faultString</name><value><string>${escapeXml(message)}</string></value></member>` +
  `</struct></value></fault></methodResponse>`;

export type PingbackCall = { source: string; target: string };

/** `<![CDATA[…]]>` 로 감싸 보내는 구현이 있다. 벗기고, 아니면 엔티티를 푼다. */
const unwrap = (value: string): string => {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value);
  return (cdata ? cdata[1] : decodeEntities(value)).trim();
};

const PARAM =
  /<param>\s*<value>\s*(?:<string>([\s\S]*?)<\/string>|([^<]*))\s*<\/value>\s*<\/param>/g;

/**
 * 받은 몸통을 읽는다.
 *
 * - `not-xml` — 메서드 부르기로 읽을 수 없다
 * - `unknown-method` — `pingback.ping` 이 아니다. 같은 주소로 다른 XML-RPC
 *   메서드를 찔러 보는 요청이 흔하다(워드프레스의 `xmlrpc.php` 를 찾는 봇)
 */
export function parsePingbackCall(
  xml: string,
): PingbackCall | 'not-xml' | 'unknown-method' {
  if (xml.length > MAX_CALL_BYTES) return 'not-xml';

  const method = /<methodName>\s*([^<\s]{1,100})\s*<\/methodName>/.exec(xml);
  if (!method) return 'not-xml';
  if (method[1] !== 'pingback.ping') return 'unknown-method';

  const values = [...xml.matchAll(PARAM)].map((match) =>
    unwrap(match[1] ?? match[2] ?? ''),
  );
  const [source, target] = values;
  return values.length === 2 && source && target
    ? { source, target }
    : 'not-xml';
}

export type PingbackReply =
  { ok: true } | { ok: false; code: number; message: string };

/** 보낸 뒤 돌아온 답을 읽는다. 읽을 수 없으면 실패로 친다. */
export function parsePingbackReply(xml: string): PingbackReply {
  const body = xml.slice(0, MAX_CALL_BYTES);

  if (/<fault>/.test(body)) {
    const code =
      /<name>\s*faultCode\s*<\/name>\s*<value>\s*(?:<(?:int|i4)>)?\s*(-?\d+)/.exec(
        body,
      );
    const message =
      /<name>\s*faultString\s*<\/name>\s*<value>\s*(?:<string>)?([^<]*)/.exec(
        body,
      );
    return {
      ok: false,
      code: code ? Number(code[1]) : PINGBACK_FAULT.generic,
      message: message ? unwrap(message[1]) : '',
    };
  }

  return /<methodResponse>[\s\S]*<params>/.test(body)
    ? { ok: true }
    : { ok: false, code: PINGBACK_FAULT.generic, message: '읽을 수 없는 답' };
}

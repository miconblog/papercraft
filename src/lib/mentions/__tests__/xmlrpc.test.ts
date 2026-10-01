/**
 * 핑백의 XML-RPC (IDE-046)
 *
 * 문자열 둘을 읽고 쓰는 것이 전부다. 지키는 것은 **우리가 쓴 것을 우리가 다시
 * 읽을 수 있다**(보내기와 받기가 같은 모양을 본다)와 **주소 속의 `&` 가 XML 을
 * 깨뜨리지 않는다**다.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_CALL_BYTES,
  PINGBACK_FAULT,
  parsePingbackCall,
  parsePingbackReply,
  pingbackCallXml,
  pingbackFaultXml,
  pingbackOkXml,
} from '../xmlrpc';

const SOURCE = 'https://blog.example/post?a=1&b=2';
const TARGET = 'https://www.daddyscraft.com/blog/yut-sticks';

describe('parsePingbackCall', () => {
  it('우리가 만든 부르기를 그대로 읽는다 — 주소의 & 까지', () => {
    expect(parsePingbackCall(pingbackCallXml(SOURCE, TARGET))).toEqual({
      source: SOURCE,
      target: TARGET,
    });
  });

  it('워드프레스가 보내는 모양(줄바꿈 · 들여쓰기)을 읽는다', () => {
    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>pingback.ping</methodName>
  <params>
    <param>
      <value><string>https://blog.example/post</string></value>
    </param>
    <param>
      <value><string>${TARGET}</string></value>
    </param>
  </params>
</methodCall>`;

    expect(parsePingbackCall(xml)).toEqual({
      source: 'https://blog.example/post',
      target: TARGET,
    });
  });

  it('<string> 없이 값만 적은 것과 CDATA 로 감싼 것도 읽는다', () => {
    const xml =
      '<methodCall><methodName>pingback.ping</methodName><params>' +
      '<param><value>https://blog.example/post</value></param>' +
      `<param><value><string><![CDATA[${TARGET}]]></string></value></param>` +
      '</params></methodCall>';

    expect(parsePingbackCall(xml)).toEqual({
      source: 'https://blog.example/post',
      target: TARGET,
    });
  });

  it('다른 메서드는 모르는 메서드다 — 여기 있는 것은 핑백 하나뿐이다', () => {
    expect(
      parsePingbackCall(
        '<methodCall><methodName>system.listMethods</methodName><params/></methodCall>',
      ),
    ).toBe('unknown-method');
  });

  it('읽을 수 없으면 XML 이 아니다', () => {
    expect(parsePingbackCall('{"source":"x"}')).toBe('not-xml');
    expect(
      parsePingbackCall(
        '<methodCall><methodName>pingback.ping</methodName><params>' +
          '<param><value><string>하나뿐</string></value></param>' +
          '</params></methodCall>',
      ),
    ).toBe('not-xml');
  });

  it('너무 큰 몸통은 읽지 않는다', () => {
    expect(parsePingbackCall('x'.repeat(MAX_CALL_BYTES + 1))).toBe('not-xml');
  });

  it('엔티티 선언을 따라가지 않는다 — 풀어 넣을 파서가 없다', () => {
    const xml =
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' +
      '<methodCall><methodName>pingback.ping</methodName><params>' +
      '<param><value><string>&secret;</string></value></param>' +
      `<param><value><string>${TARGET}</string></value></param>` +
      '</params></methodCall>';

    // 선언된 엔티티는 글자 그대로 남는다. 파일을 읽지 않는다.
    expect(parsePingbackCall(xml)).toEqual({
      source: '&secret;',
      target: TARGET,
    });
  });
});

describe('답', () => {
  it('받았다는 답을 만들고 다시 읽는다', () => {
    expect(parsePingbackReply(pingbackOkXml('Accepted.'))).toEqual({
      ok: true,
    });
  });

  it('못 받았다는 답은 번호와 이유를 싣는다', () => {
    const xml = pingbackFaultXml(PINGBACK_FAULT.noLink, 'no <link> & such');

    expect(parsePingbackReply(xml)).toEqual({
      ok: false,
      code: 17,
      message: 'no <link> & such',
    });
    // 이유 속의 꺾쇠가 XML 을 깨뜨리지 않는다.
    expect(xml).toContain('no &lt;link&gt; &amp; such');
  });

  it('음수 번호(XML-RPC 의 번호)도 읽는다', () => {
    expect(
      parsePingbackReply(pingbackFaultXml(PINGBACK_FAULT.methodNotFound, 'x')),
    ).toMatchObject({ ok: false, code: -32601 });
  });

  it('읽을 수 없는 답은 실패다 — 보낸 줄 알면 안 된다', () => {
    expect(parsePingbackReply('<html>오류 화면</html>')).toMatchObject({
      ok: false,
    });
  });
});

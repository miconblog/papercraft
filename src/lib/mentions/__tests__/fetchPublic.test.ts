// @vitest-environment node

/**
 * 바깥으로 나가는 요청 (IDE-046)
 *
 * 지키는 것이 넷이다. **안쪽 주소로 가지 않는다**(처음부터든 넘겨 받아서든) ·
 * **크기와 시간에 끝이 있다** · **보내기는 방식이 바뀌는 넘겨 주기를 따라가지
 * 않는다** · **무슨 일이 있어도 던지지 않는다.**
 *
 * 진짜 서버를 띄워 본다. 이 모듈의 요점이 "연결이 쓰는 이름 풀이에 검사를
 * 끼운다"라, `fetch` 를 가짜로 바꿔서는 볼 수 있는 것이 없다.
 */
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchPublic, type FetchGuard } from '../fetchPublic';

/** 시험의 상대는 `127.0.0.1` 의 아무 포트다. 그것만 열어 주는 가드다. */
const OPEN: FetchGuard = { address: () => true, anyPort: true };

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const routes = new Map<string, Handler>();
let server: http.Server;
let origin: string;

const bodyOf = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
  });

beforeAll(async () => {
  server = http.createServer((request, response) => {
    const handler = routes.get(request.url ?? '');
    if (handler) handler(request, response);
    else response.writeHead(404).end('없다');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  routes.set('/page', (_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      Link: '<https://example.com/wm>; rel="webmention"',
    });
    response.end('<p>안녕</p>');
  });
  routes.set('/hop', (_request, response) => {
    response.writeHead(302, { Location: '/page' }).end();
  });
  routes.set('/loop', (_request, response) => {
    response.writeHead(302, { Location: '/loop' }).end();
  });
  routes.set('/to-ftp', (_request, response) => {
    response.writeHead(302, { Location: 'ftp://example.com/x' }).end();
  });
  routes.set('/to-v6', (_request, response) => {
    response.writeHead(302, { Location: 'http://[::1]:9/inside' }).end();
  });
  routes.set('/big', (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('가'.repeat(10_000));
  });
  routes.set('/silent', () => {
    // 아무 답도 하지 않는다.
  });
  routes.set('/gzip', (_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Encoding': 'gzip',
    });
    response.end(zlib.gzipSync('<p>눌러 보낸 글</p>'));
  });
  routes.set('/euc-kr', (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=euc-kr' });
    // EUC-KR 로 적은 "한글".
    response.end(Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]));
  });
  routes.set('/echo', async (request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end(`${request.method} ${await bodyOf(request)}`);
  });
  routes.set('/moved-302', (_request, response) => {
    response.writeHead(302, { Location: '/echo' }).end();
  });
  routes.set('/moved-307', (_request, response) => {
    response.writeHead(307, { Location: '/echo' }).end();
  });
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

describe('기본 가드 — 안쪽으로 가지 않는다', () => {
  it('숫자로 적은 안쪽 주소는 연결하기 전에 막는다', async () => {
    expect(await fetchPublic('http://127.0.0.1/')).toEqual({
      reached: false,
      reason: 'blocked',
    });
    expect(await fetchPublic('http://[::1]/')).toMatchObject({
      reason: 'blocked',
    });
    // 주소를 다른 진법으로 적어도 같은 곳이다.
    expect(await fetchPublic('http://2130706433/')).toMatchObject({
      reason: 'blocked',
    });
  });

  it('이름이 안쪽 주소로 풀리면 막는다', async () => {
    expect(await fetchPublic('http://localhost/')).toEqual({
      reached: false,
      reason: 'blocked',
    });
  });

  it('기본 포트가 아니면 가지 않는다', async () => {
    expect(await fetchPublic(`${origin}/page`)).toEqual({
      reached: false,
      reason: 'bad-url',
    });
  });

  it('웹 주소가 아니거나 계정이 실린 주소는 가지 않는다', async () => {
    for (const url of [
      'ftp://example.com/',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'https://user:pw@example.com/',
      '주소가 아니다',
    ]) {
      expect(await fetchPublic(url), url).toEqual({
        reached: false,
        reason: 'bad-url',
      });
    }
  });
});

describe('읽기', () => {
  it('본문 · 상태 · 헤더를 돌려준다', async () => {
    const result = await fetchPublic(`${origin}/page`, { guard: OPEN });

    expect(result).toMatchObject({ reached: true, status: 200 });
    if (!result.reached) return;
    expect(result.text).toBe('<p>안녕</p>');
    expect(result.headers.get('link')).toContain('rel="webmention"');
  });

  it('없는 글도 "닿았다"다 — 404 인지는 부르는 쪽이 본다', async () => {
    expect(await fetchPublic(`${origin}/nope`, { guard: OPEN })).toMatchObject({
      reached: true,
      status: 404,
    });
  });

  it('넘겨 주기를 따라가고 마지막 주소를 알려 준다', async () => {
    const result = await fetchPublic(`${origin}/hop`, { guard: OPEN });

    // 상대 주소는 마지막 주소에 대고 풀어야 한다.
    expect(result).toMatchObject({ reached: true, url: `${origin}/page` });
  });

  it('넘겨 받은 주소도 처음부터 다시 본다', async () => {
    // 웹 주소가 아닌 곳으로 넘기면 따라가지 않는다.
    expect(await fetchPublic(`${origin}/to-ftp`, { guard: OPEN })).toEqual({
      reached: false,
      reason: 'blocked',
    });
    // 열린 주소가 안쪽 주소로 넘기는 것이 가장 흔한 우회다.
    const onlyV4: FetchGuard = {
      address: (address) => address === '127.0.0.1',
      anyPort: true,
    };
    expect(await fetchPublic(`${origin}/to-v6`, { guard: onlyV4 })).toEqual({
      reached: false,
      reason: 'blocked',
    });
  });

  it('끝없이 넘기면 그만둔다', async () => {
    expect(
      await fetchPublic(`${origin}/loop`, { guard: OPEN, maxRedirects: 3 }),
    ).toEqual({ reached: false, reason: 'redirects' });
  });

  it('한도까지만 읽는다', async () => {
    const result = await fetchPublic(`${origin}/big`, {
      guard: OPEN,
      maxBytes: 300,
    });

    expect(result.reached).toBe(true);
    if (!result.reached) return;
    // "가" 는 UTF-8 로 3바이트다.
    expect(result.text).toBe('가'.repeat(100));
  });

  it('답이 없으면 기다리다 그만둔다', async () => {
    expect(
      await fetchPublic(`${origin}/silent`, { guard: OPEN, timeoutMs: 80 }),
    ).toEqual({ reached: false, reason: 'timeout' });
  });

  it('눌러 보낸 응답을 푼다', async () => {
    expect(await fetchPublic(`${origin}/gzip`, { guard: OPEN })).toMatchObject({
      text: '<p>눌러 보낸 글</p>',
    });
  });

  it('EUC-KR 로 적은 글을 읽는다', async () => {
    expect(
      await fetchPublic(`${origin}/euc-kr`, { guard: OPEN }),
    ).toMatchObject({ text: '한글' });
  });

  it('연결할 수 없으면 던지지 않고 이유를 돌려준다', async () => {
    // 1번 포트에는 아무도 없다.
    expect(await fetchPublic('http://127.0.0.1:1/', { guard: OPEN })).toEqual({
      reached: false,
      reason: 'unreachable',
    });
  });
});

describe('보내기', () => {
  const post = (path: string) =>
    fetchPublic(`${origin}${path}`, {
      guard: OPEN,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'source=a&target=b',
    });

  it('몸통을 실어 보낸다', async () => {
    expect(await post('/echo')).toMatchObject({
      status: 200,
      text: 'POST source=a&target=b',
    });
  });

  it('방식을 지키는 넘겨 주기(307)는 몸통째 따라간다', async () => {
    expect(await post('/moved-307')).toMatchObject({
      status: 200,
      text: 'POST source=a&target=b',
    });
  });

  it('방식이 바뀌는 넘겨 주기(302)는 따라가지 않는다', async () => {
    // 따라가면 GET 이 되어 아무것도 전하지 못한 채 200 을 받는다 — 보낸 줄 안다.
    expect(await post('/moved-302')).toEqual({
      reached: false,
      reason: 'redirects',
    });
  });
});

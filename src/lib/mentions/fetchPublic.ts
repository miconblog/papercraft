import 'server-only';

/**
 * 바깥으로 나가는 요청 — 멘션이 거는 것은 전부 여기를 지난다 (IDE-046)
 *
 * 멘션은 **남이 적어 준 주소로 우리 서버가 요청을 거는** 기능이다. 받을 때는
 * 보낸 쪽이 댄 글 주소로, 보낼 때는 남의 글이 알려 준 받는 주소로 간다. 어느
 * 쪽이든 주소를 고른 것이 우리가 아니다. 그래서 `fetch` 를 그대로 쓰지 않는다.
 *
 * ## 지키는 것
 *
 * 1. **세상에 열린 주소로만 간다**(`address.ts`). 이름을 풀어 본 뒤 요청을
 *    걸면 그 사이에 이름이 다른 곳을 가리키게 바꿀 수 있다 — 그래서 **연결이
 *    쓰는 바로 그 이름 풀이**(`lookup`)에 검사를 끼운다. 확인한 주소와 연결하는
 *    주소가 같은 것이 된다. `fetch` 로는 그 자리에 손이 닿지 않아 `node:http`
 *    를 쓴다.
 * 2. **`http` · `https` 의 기본 포트만.** 주소에 계정이 실려 있어도 안 간다.
 * 3. **넘겨 주기(3xx)를 따라갈 때마다 처음부터 다시 본다.** 열린 주소가 안쪽
 *    주소로 넘기는 것이 가장 흔한 우회다. 다섯 번까지만 따라간다.
 * 4. **크기와 시간에 끝이 있다.** 끝없이 흘려보내는 응답에 묶이지 않는다.
 *
 * ## 절대 던지지 않는다
 *
 * 닿지 못한 것도 결과다(`reached: false`). 부르는 쪽이 "없는 글"과 "잠깐 안
 * 닿는 글"을 다르게 다뤄야 해서 이유를 함께 돌려준다.
 */
import { lookup as dnsLookup } from 'node:dns';
import http, { type IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { isPublicAddress } from './address';
import { mentionsLocalAllowed } from './config';
import { MENTION_USER_AGENT } from './endpoints';

export type PublicResponse = {
  reached: true;
  status: number;
  /** 넘겨 주기를 다 따라간 **마지막 주소**. 상대 주소는 이것에 대고 푼다. */
  url: string;
  headers: Headers;
  /** 한도까지만 읽은 본문. 넘치면 거기서 끊긴다. */
  text: string;
};

export type FetchFailure =
  /** 주소 모양이 틀렸다 — 스킴 · 포트 · 계정. */
  | 'bad-url'
  /** 안쪽 주소다. 처음부터였든 넘겨 받은 것이든. */
  | 'blocked'
  | 'timeout'
  /** 넘겨 주기가 너무 많거나 따라갈 수 없는 종류다. */
  | 'redirects'
  /** 이름이 안 풀리거나 연결이 끊겼다. */
  | 'unreachable';

export type PublicResult =
  PublicResponse | { reached: false; reason: FetchFailure };

/**
 * 무엇을 통과시키나. 기본은 "열린 주소 · 기본 포트"다.
 *
 * 밖에서 갈아 끼울 수 있게 둔 것은 시험 때문이다 — 시험의 상대 서버는
 * `127.0.0.1` 의 아무 포트에 뜬다.
 */
export type FetchGuard = {
  address: (address: string) => boolean;
  anyPort: boolean;
};

export type PublicFetchOptions = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** 넘겨 주기까지 합친 전체 시간. */
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  guard?: FetchGuard;
};

/** 멘션 코드가 요청을 거는 모양. 시험은 이 자리에 가짜를 끼운다. */
export type PublicFetch = (
  url: string,
  options?: PublicFetchOptions,
) => Promise<PublicResult>;

const TIMEOUT_MS = 8_000;
/** 글 한 편의 HTML 로는 넉넉하고, 서버 메모리로는 아무것도 아닌 크기다. */
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;

const defaultGuard = (): FetchGuard =>
  mentionsLocalAllowed()
    ? { address: () => true, anyPort: true }
    : { address: isPublicAddress, anyPort: false };

class Blocked extends Error {}
class TimedOut extends Error {}

const failure = (reason: FetchFailure): PublicResult => ({
  reached: false,
  reason,
});

/** 갈 수 있는 모양의 주소인가. 아니면 `null`. */
function checkedUrl(raw: string, guard: FetchGuard): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // `https://user:pass@host` — 계정을 실어 보낼 이유가 없고, 사람 눈을 속이는
  // 데 쓰이는 모양이다(`https://daddyscraft.com@evil.example`).
  if (url.username || url.password) return null;
  // 기본 포트는 `URL` 이 빈 값으로 접는다. 남아 있으면 다른 포트다.
  if (url.port && !guard.anyPort) return null;
  return url;
}

/** `[::1]` 의 대괄호를 뗀다. `URL` 은 IPv6 를 감싼 채로 돌려준다. */
const bareHost = (url: URL): string => url.hostname.replace(/^\[|\]$/g, '');

/**
 * 연결이 쓰는 이름 풀이에 검사를 끼운다.
 *
 * 풀려 나온 주소가 **하나라도** 안쪽이면 통째로 거절한다. 열린 주소와 안쪽
 * 주소를 섞어 돌려주는 이름은 정상적인 블로그가 아니다.
 *
 * Node 는 여러 주소를 한꺼번에 받아 가기도 한다(`all: true`) — 두 모양을 다
 * 읽는다.
 */
const guardedLookup =
  (allowed: FetchGuard['address']): LookupFunction =>
  (hostname, options, callback) => {
    dnsLookup(hostname, options, (cause, address, family) => {
      if (cause) return callback(cause, address, family);
      const found = Array.isArray(address)
        ? address.map((one) => one.address)
        : [address];
      if (found.length === 0 || !found.every(allowed)) {
        return callback(new Blocked(`안쪽 주소: ${hostname}`), address, family);
      }
      callback(null, address, family);
    });
  };

/** 눌러 보낸 응답을 푼다. 눌러 달라고 하지 않았는데도 눌러 보내는 서버가 있다. */
function inflate(
  stream: Readable,
  encoding: string,
): { body: Readable; unzip: Readable | null } {
  const unzip =
    encoding === 'gzip' || encoding === 'x-gzip'
      ? zlib.createGunzip()
      : encoding === 'deflate'
        ? zlib.createInflate()
        : encoding === 'br'
          ? zlib.createBrotliDecompress()
          : null;
  return unzip ? { body: stream.pipe(unzip), unzip } : { body: stream, unzip };
}

type Raw = { status: number; headers: IncomingHttpHeaders; body: Buffer };

/** 요청 한 번. 넘겨 주기는 따라가지 않는다 — 그건 부르는 쪽이 다시 검사하며 한다. */
function once(
  url: URL,
  options: Required<Pick<PublicFetchOptions, 'method' | 'maxBytes'>> &
    Pick<PublicFetchOptions, 'headers' | 'body'>,
  guard: FetchGuard,
  remainingMs: number,
): Promise<Raw> {
  return new Promise((resolve, reject) => {
    // 숫자로 적힌 주소는 이름 풀이를 지나지 않는다 — 여기서 직접 본다.
    const host = bareHost(url);
    if (isIP(host) !== 0 && !guard.address(host)) {
      reject(new Blocked(`안쪽 주소: ${host}`));
      return;
    }

    let settled = false;
    const settle = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };

    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method: options.method,
        headers: {
          'User-Agent': MENTION_USER_AGENT,
          'Accept-Encoding': 'gzip, deflate, br',
          ...options.headers,
          ...(options.body === undefined
            ? {}
            : { 'Content-Length': String(Buffer.byteLength(options.body)) }),
        },
        lookup: guardedLookup(guard.address),
        // 연결을 다시 쓰지 않는다. 다시 쓰면 이름 풀이를 건너뛰는데, 검사가
        // 거기 걸려 있다.
        agent: false,
      },
      (response) => {
        const { body, unzip } = inflate(
          response,
          String(response.headers['content-encoding'] ?? '').toLowerCase(),
        );
        const chunks: Buffer[] = [];
        let size = 0;

        const done = () =>
          settle(() =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );

        body.on('data', (chunk: Buffer) => {
          const room = options.maxBytes - size;
          if (chunk.length >= room) {
            // 한도까지만 담고 끊는다. 남은 것을 받아 줄 이유가 없다.
            chunks.push(chunk.subarray(0, room));
            size = options.maxBytes;
            done();
            request.destroy();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        body.on('end', done);
        // 받던 중에 끊기면 받은 데까지를 쓴다 — 링크는 대개 앞쪽에 있다.
        const broken = (cause: Error) =>
          size > 0 ? done() : settle(() => reject(cause));
        body.on('error', broken);
        if (unzip) response.on('error', broken);
      },
    );

    const timer = setTimeout(
      () => {
        settle(() => reject(new TimedOut()));
        request.destroy();
      },
      Math.max(1, remainingMs),
    );

    request.on('error', (cause) => settle(() => reject(cause)));
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}

const reasonOf = (cause: unknown): FetchFailure =>
  cause instanceof Blocked
    ? 'blocked'
    : cause instanceof TimedOut
      ? 'timeout'
      : 'unreachable';

function toHeaders(raw: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    for (const one of Array.isArray(value) ? value : [value]) {
      if (one === undefined) continue;
      try {
        headers.append(name, one);
      } catch {
        // 헤더로 쓸 수 없는 글자가 섞인 값은 버린다 — 그것 때문에 던지지 않는다.
      }
    }
  }
  return headers;
}

/**
 * 본문을 글자로. 한국 블로그에는 아직 EUC-KR 이 있다.
 *
 * 헤더가 말해 주지 않으면 본문 앞머리의 `<meta charset>` 을 본다. 모르는
 * 이름이면 UTF-8 로 읽는다 — 주소는 어차피 ASCII 라 링크 확인은 그대로 되고,
 * 깨지는 것은 제목과 발췌뿐이다.
 */
function decode(body: Buffer, contentType: string): string {
  const CHARSET = /charset\s*=\s*["']?([\w-]+)/i;
  const label =
    CHARSET.exec(contentType)?.[1] ??
    CHARSET.exec(body.subarray(0, 2048).toString('latin1'))?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(label).decode(body);
  } catch {
    return new TextDecoder().decode(body);
  }
}

export const fetchPublic: PublicFetch = async (raw, options = {}) => {
  const {
    method = 'GET',
    timeoutMs = TIMEOUT_MS,
    maxBytes = MAX_BYTES,
    maxRedirects = MAX_REDIRECTS,
    guard = defaultGuard(),
  } = options;

  const deadline = Date.now() + timeoutMs;
  let current = raw;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = checkedUrl(current, guard);
    // 처음 주소가 틀렸으면 부른 쪽의 잘못이고, 넘겨 받은 주소가 틀렸으면 막은
    // 것이다.
    if (!url) return failure(hop === 0 ? 'bad-url' : 'blocked');

    const remaining = deadline - Date.now();
    if (remaining <= 0) return failure('timeout');

    let response: Raw;
    try {
      response = await once(
        url,
        { method, maxBytes, headers: options.headers, body: options.body },
        guard,
        remaining,
      );
    } catch (cause) {
      return failure(reasonOf(cause));
    }

    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      // 보내기(POST)는 **방식을 지키는 넘겨 주기**(307 · 308)만 따라간다.
      // 301 · 302 를 따라가면 GET 으로 바뀌어 아무것도 전하지 못한 채 성공한
      // 것처럼 보인다.
      if (
        method !== 'GET' &&
        response.status !== 307 &&
        response.status !== 308
      ) {
        return failure('redirects');
      }
      try {
        current = new URL(location, url).href;
      } catch {
        return failure('redirects');
      }
      continue;
    }

    return {
      reached: true,
      status: response.status,
      url: url.href,
      headers: toHeaders(response.headers),
      text: decode(response.body, response.headers['content-type'] ?? ''),
    };
  }

  return failure('redirects');
};

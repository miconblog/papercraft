// 최소 CDP 클라이언트 — 의존성 없이(Node 24 전역 WebSocket) 헤드리스 Chrome을 몬다.
// 인쇄 대화상자를 거치지 않고 용지 크기·배율을 명시해 PDF를 받는 경로를 시험하기 위한 것.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launchChrome() {
  const dir = mkdtempSync(join(tmpdir(), 'pc-chrome-'));
  const proc = spawn(
    CHROME,
    [
      '--headless',
      '--remote-debugging-port=0',
      `--user-data-dir=${dir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
  const portFile = join(dir, 'DevToolsActivePort');
  const deadline = Date.now() + 20000;
  let port = null;
  while (Date.now() < deadline) {
    if (existsSync(portFile)) {
      const t = readFileSync(portFile, 'utf8').split('\n');
      if (t[0]?.trim()) {
        port = +t[0].trim();
        break;
      }
    }
    await sleep(80);
  }
  if (!port) throw new Error('Chrome 디버깅 포트를 못 읽었습니다');
  return {
    port,
    close: () => {
      try {
        proc.kill('SIGKILL');
      } catch {}
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    },
  };
}

class Session {
  #ws;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();
  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.#pending.has(msg.id)) {
        const { resolve, reject } = this.#pending.get(msg.id);
        this.#pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.#listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.#listeners.has(method)) this.#listeners.set(method, []);
    this.#listeners.get(method).push(fn);
  }
  once(method) {
    return new Promise((resolve) => this.on(method, resolve));
  }
  close() {
    this.#ws.close();
  }
}

export async function openPage(port, url) {
  const list = await (
    await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
      {
        method: 'PUT',
      },
    )
  ).json();
  const ws = new WebSocket(list.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const s = new Session(ws);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  const loaded = s.once('Page.loadEventFired');
  await s.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(15000)]);
  await s.send('Runtime.evaluate', {
    expression: 'document.fonts.ready.then(()=>1)',
    awaitPromise: true,
  });
  return { session: s, targetId: list.id };
}

/** 용지 크기·배율·여백을 명시해 PDF를 받는다. mm 입력. */
export async function printToPdf(
  session,
  { widthMm, heightMm, scale = 1, marginMm = 0, preferCSSPageSize = true },
) {
  const inch = (mm) => mm / 25.4;
  const r = await session.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize,
    paperWidth: inch(widthMm),
    paperHeight: inch(heightMm),
    marginTop: inch(marginMm),
    marginBottom: inch(marginMm),
    marginLeft: inch(marginMm),
    marginRight: inch(marginMm),
    scale,
    transferMode: 'ReturnAsBase64',
  });
  return Buffer.from(r.data, 'base64');
}

/** 페이지 안에서 PDF를 만들어(jsPDF 등) base64로 돌려받는다. */
export async function evalToBuffer(session, expression, timeoutMs = 180000) {
  const r = await Promise.race([
    session.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }),
    sleep(timeoutMs).then(() => {
      throw new Error(
        `${Math.round(timeoutMs / 1000)}초 안에 끝나지 않음(시간 초과)`,
      );
    }),
  ]);
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description ?? 'eval 실패');
  return Buffer.from(r.result.value, 'base64');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

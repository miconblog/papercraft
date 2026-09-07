/**
 * 방문자 식별 — 쿠키 없이 (IDE-013)
 *
 * `visitor_id = hash(그날의 salt + IP + UA + 도메인)`. 저장되는 것은 해시뿐이고
 * IP 원본도 전체 UA 도 어디에도 남지 않는다(Plausible·Fathom 과 같은 방식).
 *
 * **날짜 경계는 KST 다.** 이 사이트를 쓰는 사람이 한국에 있고, 집계 표의 `day`
 * 도 같은 경계를 쓴다 — 둘이 어긋나면 "하루 UV" 가 이틀에 걸쳐 쪼개진다.
 */
import { createHash, createHmac } from 'node:crypto';

/** KST 는 서머타임이 없어서 고정 오프셋으로 충분하다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `2026-09-07` — KST 기준 날짜. 이벤트의 `day` 이자 salt 회전 주기다. */
export function analyticsDay(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 그날치 salt.
 *
 * 진짜 난수를 자정마다 새로 뽑아 메모리에 들고 있는 것이 원형이지만,
 * 서버리스에는 인스턴스끼리 나눠 가질 메모리가 없다. 대신 **오래 사는 비밀 +
 * 그날 날짜**로 유도한다 — 회전 성질(날이 바뀌면 다른 값)은 그대로고, 지켜야
 * 할 비밀은 환경변수 하나로 좁아진다.
 */
const dailySalt = (secret: string, day: string): string =>
  createHash('sha256').update(`${secret}|${day}`).digest('hex');

export type VisitorInput = {
  /** 프록시가 넘긴 클라이언트 IP. 없으면 빈 문자열이어도 된다. */
  ip: string;
  userAgent: string;
  /** 요청 호스트. 미리보기 배포와 운영 방문자를 섞지 않는다. */
  host: string;
};

/**
 * 되돌릴 수 없는 방문자 해시.
 *
 * salt 를 키로 쓰는 HMAC 이다. 단순 해시면 IP·UA 후보를 넣어 보는 것만으로
 * 맞춰볼 수 있는데, salt 를 모르면 그 대입이 통하지 않는다.
 */
export function visitorId(
  input: VisitorInput,
  secret: string,
  day: string,
): string {
  return createHmac('sha256', dailySalt(secret, day))
    .update(`${input.ip}|${input.userAgent}|${input.host}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * 프록시 헤더에서 클라이언트 IP 를 꺼낸다.
 *
 * `x-forwarded-for` 는 쉼표로 이어 붙은 사슬이라 **맨 앞**이 원래 클라이언트다.
 * 값이 없어도 그냥 빈 문자열로 둔다 — 해시의 재료 하나가 비는 것뿐이고,
 * 그것 때문에 수집이 멈출 이유는 없다.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() ?? '';
}

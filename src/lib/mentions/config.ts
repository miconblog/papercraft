/**
 * 멘션 스위치 (IDE-046)
 *
 * `analytics/config.ts` 와 같은 태도다 — **여기서만 `process.env` 를 읽는다.**
 * "보내나?"를 판단하는 곳이 두 군데면 한쪽만 고쳐 놓고 왜 안 나가는지 찾게 된다.
 */

type Env = Record<string, string | undefined>;

const flag = (value: string | undefined): string =>
  value?.trim().toLowerCase() ?? '';

/**
 * 바깥으로 멘션을 보내나.
 *
 * - `WEBMENTION_SEND` 가 `off` 면 끈다. `on` 이면 어디서든 켠다(시험할 때)
 * - 비어 있으면 **운영 배포(`VERCEL_ENV=production`)에서만** 보낸다
 *
 * GA(`analytics/google.ts`)와 같은 규칙이고 이유는 더 무겁다. 로컬과 미리보기
 * 배포는 **같은 DB 의 같은 글**을 읽는다 — 거기서 글을 저장하면 남의 블로그에
 * 진짜 멘션이 나간다. 받는 쪽이 확인하러 올 주소도 로컬이라 실패로 끝나지만,
 * 남의 서버를 두드린 것은 되돌릴 수 없다.
 *
 * 빌드 중에는 늘 꺼져 있다. 글 화면이 언젠가 미리 그려지게 되더라도
 * (`generateStaticParams`) 빌드가 멘션을 쏘는 일은 없다.
 */
export function mentionsSendEnabled(env: Env = process.env): boolean {
  if (env.NEXT_PHASE === 'phase-production-build') return false;

  const configured = flag(env.WEBMENTION_SEND);
  if (['off', '0', 'false'].includes(configured)) return false;
  if (['on', '1', 'true'].includes(configured)) return true;
  return env.VERCEL_ENV === 'production';
}

/**
 * 사설 주소와 임의 포트로 나가는 것을 허락하나 — **개발 서버에서만.**
 *
 * 밖으로 나가는 요청은 사설 주소를 막는다(`address.ts`). 그런데 로컬에서 받기와
 * 보내기를 시험하려면 상대가 `127.0.0.1` 의 어느 포트다. 그 한 가지를 위한
 * 문이다.
 *
 * `NODE_ENV` 를 **먼저** 본다. Next 는 이 값을 빌드 때 박아 넣으므로 운영
 * 번들에서 이 함수는 환경변수를 무엇으로 주든 `false` 다 — 배포 설정 실수
 * 하나가 방어를 통째로 끄는 일이 없다.
 */
export const mentionsLocalAllowed = (env: Env = process.env): boolean =>
  env.NODE_ENV !== 'production' && flag(env.MENTIONS_ALLOW_LOCAL) === '1';

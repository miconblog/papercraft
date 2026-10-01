/**
 * 받은 결과를 보낸 쪽에게 돌려줄 말로 (IDE-046)
 *
 * 받는 길은 하나인데(`receive.ts`) 답하는 봉투가 둘이다 — 웹멘션은 HTTP 상태
 * 코드로, 핑백은 XML-RPC 의 오류 번호로 말한다. 같은 결과가 두 봉투에서 다른
 * 뜻이 되지 않게 표를 한 곳에 둔다.
 *
 * ## 문구가 영어다
 *
 * 이 저장소의 문구는 전부 한국어지만 여기만 예외다. 읽는 사람이 **우리 방문자가
 * 아니라 남의 블로그 소프트웨어와 그 주인**이라서다. 워드프레스 관리자 화면의
 * 핑백 로그에 한국어 한 줄이 뜨면 무엇이 잘못됐는지 알 길이 없다.
 *
 * ## 닫힌 글과 없는 글이 같은 답이다
 *
 * `target-not-found` 하나뿐이다. 갈라서 답하면 이 주소가 "여기 안 낸 글이
 * 있다"를 알려 주는 창구가 된다(`target.ts`).
 */
import type { ReceiveOutcome, RejectReason } from './receive';
import { PINGBACK_FAULT } from './xmlrpc';

type Reply = {
  /** 웹멘션이 돌려주는 HTTP 상태. */
  http: number;
  /** 핑백이 돌려주는 오류 번호. */
  fault: number;
  message: string;
};

const REJECTED: Record<RejectReason, Reply> = {
  'bad-request': {
    http: 400,
    fault: PINGBACK_FAULT.generic,
    message: 'source and target must be http(s) URLs.',
  },
  'own-source': {
    http: 400,
    fault: PINGBACK_FAULT.generic,
    message: 'source is on this site.',
  },
  'target-not-found': {
    http: 400,
    fault: PINGBACK_FAULT.targetInvalid,
    message: 'target is not a page that accepts mentions.',
  },
  'source-unreachable': {
    http: 400,
    fault: PINGBACK_FAULT.sourceMissing,
    message: 'source could not be fetched.',
  },
  'no-link': {
    http: 400,
    fault: PINGBACK_FAULT.noLink,
    message: 'source does not link to target.',
  },
  // 아래 둘은 보낸 쪽 잘못이 아니다. 나중에 다시 보내면 되는 상태라 "고쳐서
  // 보내라"(400)가 아니라 "조금 뒤에 다시"(429 · 503)로 답한다.
  'too-many': {
    http: 429,
    fault: PINGBACK_FAULT.accessDenied,
    message: 'too many mentions are waiting for review. Try again later.',
  },
  'store-failed': {
    http: 503,
    fault: PINGBACK_FAULT.generic,
    message: 'the mention could not be stored. Try again later.',
  },
};

const ACCEPTED: Record<
  Exclude<ReceiveOutcome['status'], 'rejected'>,
  { http: number; message: string }
> = {
  // 확인은 끝났지만 **세우는 것은 사람이 승인한 뒤**다. 그래서 200 이 아니라
  // 202(받았고, 아직 다 된 것은 아니다)다.
  accepted: { http: 202, message: 'Accepted. It will appear after review.' },
  updated: { http: 202, message: 'Updated. It will appear after review.' },
  unchanged: { http: 200, message: 'Already registered.' },
  removed: { http: 200, message: 'Removed.' },
};

export type MentionReply =
  { ok: true; http: number; message: string } | ({ ok: false } & Reply);

export const replyFor = (outcome: ReceiveOutcome): MentionReply =>
  outcome.status === 'rejected'
    ? { ok: false, ...REJECTED[outcome.reason] }
    : { ok: true, ...ACCEPTED[outcome.status] };

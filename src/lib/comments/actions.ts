'use server';

/**
 * 댓글 쓰기 — 누구나 부를 수 있는 유일한 서버 액션 (IDE-029)
 *
 * ## 왜 `app/` 이 아니라 `lib/` 에 있나
 *
 * 이 저장소의 서버 액션은 지금까지 전부 화면 옆(`app/admin/.../actions.ts`)에
 * 있었다. 그것들은 **한 화면의 것**이라 그 자리가 맞다. 이 액션은 게임 화면과
 * 공방 일지 글 화면이 함께 쓴다 — 한쪽 화면 폴더에 두면 다른 쪽이 남의 화면
 * 폴더를 import 하게 되고, 그 화면이 옮겨지거나 지워질 때 조용히 끌려간다.
 * 담는 코드(`comments.ts`) 옆에 두는 편이 낫다.
 *
 * ## 관리자 액션과 태도가 정반대다
 *
 * 다른 액션들은 첫 줄에서 세션을 확인한다. 여기는 **아무도 확인하지 않는다** —
 * 그것이 이 기능의 요점이다. 대신 그 대가로 다음 넷을 여기서 전부 막는다.
 *
 * 1. **대상이 실제로 열려 있나.** 액션은 URL 만 알면 밖에서 그대로 부를 수
 *    있어서, 화면에 폼이 안 보이는 것은 아무것도 막아 주지 않는다. 오픈 전
 *    게임과 안 낸 글에는 댓글이 달리지 않는다.
 * 2. **길이와 보이지 않는 글자** (`input.ts`).
 * 3. **도배** — 같은 브라우저가 10분에 다섯 개까지.
 * 4. **덫 칸** — 사람 눈에 안 보이는 칸을 채워 보낸 요청은 거절한다.
 *
 * 그리고 무엇보다 **승인 전에는 어디에도 보이지 않는다**(2026-09-13 사용자
 * 결정). 위 넷이 다 뚫려도 마지막 문지기는 사람이다.
 */
import { headers } from 'next/headers';
import { hashSalt } from '@/lib/analytics/config';
import { isBot } from '@/lib/analytics/request';
import { analyticsDay, clientIp, visitorId } from '@/lib/analytics/visitor';
import { isPublished, postById } from '@/lib/blog/posts';
import { getGame } from '@/lib/games';
import { isOpen, releasesForRequest } from '@/lib/games/release';
import {
  RATE_LIMIT,
  createComment,
  recentCommentCount,
  type CommentKind,
} from './comments';
import { parseCommentInput, type CommentFormState } from './input';

// 결과의 모양과 첫 값은 `input.ts` 가 들고 있다 — 이 파일은 `'use server'` 라
// 상수를 내보낼 수 없다.

const fail = (message: string): CommentFormState => ({ ok: false, message });

/** 이름과 본문 말고 폼이 함께 보내는 것들. */
const str = (form: FormData, name: string): string =>
  String(form.get(name) ?? '');

const isKind = (value: string): value is CommentKind =>
  value === 'game' || value === 'post';

/**
 * 이 대상에 지금 댓글을 달 수 있나.
 *
 * 게임은 등록소에 있고 **오픈됐어야** 한다(`IDE-022`). 글은 표에 있고
 * **게시됐어야** 한다(`IDE-023`). 둘 다 그 판정을 각자의 주인 모듈에게 묻는다 —
 * 규칙을 여기 베껴 쓰면 오픈 규칙이 바뀔 때 이곳만 옛 규칙으로 남는다.
 *
 * 관리자 우회를 두지 않는다. 미리보기에서 댓글을 달 이유가 없고, 우회가 있으면
 * "오픈 전에는 댓글이 없다"가 조건부 참이 된다.
 */
async function targetIsOpen(
  kind: CommentKind,
  targetId: string,
): Promise<boolean> {
  if (kind === 'game') {
    if (!getGame(targetId)) return false;
    return isOpen(await releasesForRequest(), targetId);
  }
  const post = await postById(targetId);
  return post !== null && isPublished(post);
}

export async function submitComment(
  _state: CommentFormState,
  form: FormData,
): Promise<CommentFormState> {
  const kind = str(form, 'kind');
  const targetId = str(form, 'targetId');
  if (!isKind(kind) || !targetId) {
    return fail('댓글을 달 곳을 찾지 못했습니다. 새로고침하고 다시 써 주세요.');
  }

  // 사람 눈에 없는 칸이다. 채워져 있으면 폼을 읽고 채운 것이 아니다.
  // **조용히 성공한 척하지 않는다** — 진짜 사람이 자동 완성 때문에 걸릴 수 있고,
  // 그때 "보냈습니다"만 뜨면 영영 이유를 모른다.
  if (str(form, 'website').trim()) {
    return fail('댓글을 보내지 못했습니다. 새로고침하고 다시 써 주세요.');
  }

  const parsed = parseCommentInput({
    nickname: str(form, 'nickname'),
    body: str(form, 'body'),
  });
  if (!parsed.ok) return fail(parsed.message);

  if (!(await targetIsOpen(kind, targetId))) {
    return fail('지금은 이곳에 댓글을 달 수 없습니다.');
  }

  const jar = await headers();
  const userAgent = jar.get('user-agent');
  // 수집과 같은 잣대다(`analytics/request.ts`). 스스로 봇이라 밝힌 것에게 댓글
  // 창을 열어 둘 이유가 없다.
  if (isBot(userAgent)) {
    return fail('댓글을 보내지 못했습니다. 새로고침하고 다시 써 주세요.');
  }

  // 하루마다 도는 salt 를 키로 쓴 HMAC 이다 — IP 도 UA 원본도 담기지 않는다.
  // 비밀값이 없는 환경(로컬·CI)에서는 `null` 이고 도배 제한이 없다.
  const salt = hashSalt();
  const visitorHash = salt
    ? visitorId(
        {
          ip: clientIp(jar),
          userAgent: userAgent ?? '',
          host: jar.get('host') ?? '',
        },
        salt,
        analyticsDay(),
      )
    : null;

  if ((await recentCommentCount(visitorHash)) >= RATE_LIMIT) {
    return fail('잠시 뒤에 다시 써 주세요. 한꺼번에 너무 많이 보냈습니다.');
  }

  const written = await createComment({
    ...parsed.value,
    kind,
    targetId,
    visitorHash,
  });
  if (!written.ok) return fail(written.message);

  // **캐시를 깨우지 않는다.** 방금 담긴 댓글은 대기 상태라 화면에 나올 것이
  // 없다 — 여기서 태그를 만료시키면 아무것도 안 바뀐 페이지를 다시 그리게 된다.
  // 깨우는 것은 승인하는 쪽의 일이다(`admin/comments/actions.ts`).
  return {
    ok: true,
    message: '고맙습니다! 확인한 뒤에 올려 둘게요.',
  };
}

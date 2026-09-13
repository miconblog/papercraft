/**
 * 댓글 입력 다듬기와 검사 (IDE-029)
 *
 * **`import 'server-only'` 를 붙이지 않는다.** 길이 한도를 브라우저의 폼이
 * 그대로 써야 한다(`maxLength`). 한도가 두 곳에 따로 적혀 있으면 언젠가 한쪽만
 * 고쳐져서, 다 쓴 댓글이 보내는 순간에 거절당한다 — `uploadLimit.ts` 가 서버
 * 액션 한도와 업로드 검사를 한 상수로 묶은 것과 같은 이유다.
 *
 * 순수 함수만 둔다. "누가 썼나"도 "너무 자주 쓰나"도 여기서 보지 않는다 —
 * 그것들은 요청이 있어야 알 수 있는 것이라 서버 액션의 일이다.
 */

/**
 * 댓글이 붙는 곳 — `game` 은 등록소의 게임 id(`soccer`), `post` 는 **글의 `id`**.
 *
 * `comments.ts` 가 아니라 여기 두는 것은 **브라우저가 이 타입을 쓰기 때문**이다
 * (`CommentForm` 의 숨은 칸). 저쪽은 `import 'server-only'` 가 붙어 있어서,
 * 타입만 가져가는 import 라도 그 파일을 클라이언트 코드가 가리키게 된다.
 *
 * 슬러그가 아니라 `id` 로 글을 가리키는 이유는 009 마이그레이션에 적어 두었다.
 */
export type CommentKind = 'game' | 'post';

/** 이름 칸. 짧다 — 이름 자리에 문장을 적어 목록을 밀어내는 것을 막는다. */
export const NICKNAME_MAX = 20;

/** 본문 칸. 한글 1,000자면 긴 감상도 들어가고 목록이 벽이 되지도 않는다. */
export const BODY_MAX = 1000;

/** 이름을 비워도 된다. 그때 이 이름으로 들어간다. */
export const ANONYMOUS_NICKNAME = '이름 없음';

export type CommentInput = { nickname: string; body: string };

export type CommentInputResult =
  { ok: true; value: CommentInput } | { ok: false; message: string };

/**
 * 보이지 않는 글자들.
 *
 * 앞쪽은 제어 문자다 — 줄바꿈(`U+000A`)과 탭(`U+0009`)만 남기고 버린다. 남겨
 * 두면 오른쪽에서 왼쪽으로 쓰는 표식(`U+202E`)으로 뒷글자를 뒤집어 놓거나,
 * 목록에서 자리를 차지하지 않는 글자로 배치를 밀 수 있다.
 *
 * 뒤쪽은 폭이 없는 글자다. 그것만으로 채운 댓글은 사람 눈에 빈칸인데 길이
 * 검사는 통과한다.
 *
 * **정규식 리터럴로 적지 않는다.** 제어 문자를 소스에 직접 넣으면 편집기에서도
 * diff 에서도 보이지 않아, 나중에 이 줄을 고치는 사람이 무엇을 지우는지 알 수
 * 없다. `\u202E` 처럼 이름이 글자로 보이는 편이 낫다.
 */
const INVISIBLE = new RegExp(
  '[\\u0000-\\u0008\\u000B-\\u001F\\u007F' +
    '\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]',
  'g',
);

const stripInvisible = (value: string): string => value.replace(INVISIBLE, '');

/** 이름을 한 줄로 눕힌다. 줄바꿈이 들어오면 목록의 한 줄 배치가 깨진다. */
const oneLine = (value: string): string =>
  stripInvisible(value).replace(/\s+/g, ' ').trim();

/**
 * 본문을 다듬는다.
 *
 * 빈 줄이 셋 이상 이어지면 둘로 접는다 — 엔터만 눌러 만든 긴 공백으로 다음
 * 댓글을 화면 밖으로 밀어내는 것을 막는다. 줄 끝의 공백도 뗀다.
 */
const tidyBody = (value: string): string =>
  stripInvisible(value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * 폼에서 온 값 → 담을 값. 거절할 때는 **무엇을 고쳐야 하는지**를 돌려준다.
 *
 * 길이는 다듬은 **뒤에** 본다. 앞뒤 공백까지 세어 거절하면, 사람이 보는 글자
 * 수는 한도 안인데 거절당해서 이유를 알 수 없다.
 *
 * 이름이 비면 막지 않고 `이름 없음` 으로 채운다 — 익명으로 쓰는 자리에서
 * 이름을 강제하면 쓰려던 사람이 그냥 떠난다.
 */
export function parseCommentInput(raw: CommentInput): CommentInputResult {
  const body = tidyBody(raw.body);
  if (!body) return { ok: false, message: '댓글 내용을 적어 주세요.' };
  if (body.length > BODY_MAX) {
    return { ok: false, message: `댓글은 ${BODY_MAX}자까지 쓸 수 있습니다.` };
  }

  const nickname = oneLine(raw.nickname);
  if (nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      message: `이름은 ${NICKNAME_MAX}자까지 쓸 수 있습니다.`,
    };
  }

  return {
    ok: true,
    value: { nickname: nickname || ANONYMOUS_NICKNAME, body },
  };
}

/**
 * 댓글 폼이 주고받는 결과 (IDE-029)
 *
 * **`actions.ts` 에 두지 않는다.** `'use server'` 파일은 내보내기가 전부
 * `async function` 이어야 해서, 상수 하나가 섞이면 빌드가 거절한다. 폼이 읽는
 * 값이니 한도와 같은 자리에 두는 편이 자연스럽기도 하다.
 *
 * `ok` 가 참이면 폼을 비우고 "기다려 주세요"를 띄운다 — 승인제라 **화면에 새
 * 댓글이 붙지 않는다는 것**을 그 문구가 말해 줘야 한다. 모르면 사람은 자기
 * 댓글이 사라졌다고 생각한다.
 */
export type CommentFormState = { ok: boolean; message: string };

export const COMMENT_FORM_INITIAL: CommentFormState = {
  ok: false,
  message: '',
};

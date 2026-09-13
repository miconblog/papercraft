'use client';

/**
 * 댓글 쓰는 칸 (IDE-029)
 *
 * `LoginForm` 과 같은 모양이다 — `useActionState` 하나로 결과와 대기 상태를 받는다.
 *
 * ## 보내고 나면 폼을 비운다
 *
 * 승인제라 **보낸 댓글이 화면에 나타나지 않는다**(2026-09-13 사용자 결정). 폼에
 * 쓴 글이 그대로 남아 있으면 사람은 "안 보내졌나" 하고 한 번 더 누른다. 그래서
 * 성공하면 비우고, 그 자리에 기다려 달라는 말을 놓는다.
 *
 * `key` 를 바꿔 비운다. 칸마다 `value` 를 들고 있으면 글자마다 다시 그려야 하고
 * — 긴 글을 폰에서 쓰는 자리다 — 폼이 하는 일은 결국 "보내고 비우기" 하나다.
 */
import { useActionState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { submitComment } from '@/lib/comments/actions';
import {
  BODY_MAX,
  COMMENT_FORM_INITIAL,
  NICKNAME_MAX,
  type CommentFormState,
  type CommentKind,
} from '@/lib/comments/input';

export type CommentFormProps = { kind: CommentKind; targetId: string };

const FIELD =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function CommentForm({ kind, targetId }: CommentFormProps) {
  const [state, action, pending] = useActionState<CommentFormState, FormData>(
    submitComment,
    COMMENT_FORM_INITIAL,
  );
  // 같은 페이지에 폼이 둘 이상 설 수 있으므로 id 를 박아 두지 않는다.
  const uid = useId();
  const nameId = `${uid}-nickname`;
  const bodyId = `${uid}-body`;
  const noteId = `${uid}-note`;

  return (
    <form
      // 성공하면 새 폼으로 갈린다 — 그것이 칸을 비우는 방법이다.
      key={state.ok ? 'sent' : 'writing'}
      action={action}
      className="mt-6 space-y-3"
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="targetId" value={targetId} />

      {/* 덫 칸. 사람에게는 없는 칸이라 라벨도 화면 밖에 둔다. `display:none` 을
          쓰지 않는 것은, 그것만 보고 건너뛰는 자동 입력기가 많아서다.
          `tabIndex={-1}` 로 탭 순서에서도 뺀다 — 키보드로 다니는 사람이 보이지
          않는 칸에 갇히면 안 된다. */}
      <div
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <label htmlFor={`${uid}-website`}>홈페이지</label>
        <input
          id={`${uid}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor={nameId} className="text-sm font-medium sm:w-20">
          이름
        </label>
        <input
          id={nameId}
          name="nickname"
          type="text"
          maxLength={NICKNAME_MAX}
          placeholder="비워 두면 «이름 없음»"
          autoComplete="nickname"
          className={`${FIELD} sm:max-w-56`}
        />
      </div>

      <div>
        <label htmlFor={bodyId} className="sr-only">
          댓글
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={4}
          required
          maxLength={BODY_MAX}
          placeholder="만들어 본 이야기를 남겨 주세요."
          aria-describedby={noteId}
          className={`${FIELD} resize-y`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id={noteId}
          // 결과 문구가 이 자리에 들어온다. 붙어 있는 칸의 설명이라
          // `aria-describedby` 로 이어 두면, 거절당한 이유가 칸을 다시 짚을 때
          // 함께 읽힌다.
          role={state.message ? 'status' : undefined}
          aria-live="polite"
          className={
            state.message
              ? state.ok
                ? 'text-sm text-foreground'
                : 'text-sm text-destructive'
              : 'text-xs text-muted-foreground'
          }
        >
          {state.message || '남긴 댓글은 확인한 뒤에 올라갑니다.'}
        </p>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? '보내는 중…' : '댓글 남기기'}
        </Button>
      </div>
    </form>
  );
}

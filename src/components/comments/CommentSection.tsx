/**
 * 댓글 칸 (IDE-029)
 *
 * 게임 화면과 공방 일지 글 아래에 같은 것이 붙는다. 목록은 서버가 그리고, 쓰는
 * 칸만 클라이언트다(`CommentForm`).
 *
 * ## 본문을 글자로만 그린다
 *
 * 남이 써서 보낸 값이라 **서식을 해석하지 않는다.** 마크다운도 HTML 도 아니고,
 * 줄바꿈만 CSS(`whitespace-pre-wrap`)로 살린다 — `<script>` 든 `onerror` 든
 * 글자로 나온다. 공방 일지 본문이 `DocView` 로 아는 마디만 그리는 것보다 한 걸음
 * 더 좁은데, 쓰는 사람이 주인이 아니므로 그것이 맞다.
 *
 * ## 못 읽어도 칸은 선다
 *
 * `approvedComments` 는 실패를 빈 목록으로 삼킨다(`lib/comments/comments.ts`).
 * Supabase 가 꺼져 있으면 "아직 댓글이 없습니다"가 보이고 쓰는 칸도 그대로
 * 열린다 — 보낼 때는 실패가 사람에게 보이므로, 여기서 미리 겁줄 필요가 없다.
 */
import { approvedComments, type CommentKind } from '@/lib/comments/comments';
import { formatKstDate } from '@/lib/kst';
import { CommentForm } from './CommentForm';

export type CommentSectionProps = {
  kind: CommentKind;
  /** 게임 id 또는 글 id. 슬러그가 아니다. */
  targetId: string;
};

export async function CommentSection({ kind, targetId }: CommentSectionProps) {
  const comments = await approvedComments(kind, targetId);

  return (
    <section aria-labelledby={`comments-${kind}-${targetId}`}>
      <h2
        id={`comments-${kind}-${targetId}`}
        className="text-lg font-bold tracking-tight"
      >
        댓글
        {comments.length > 0 && (
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            {comments.length}
          </span>
        )}
      </h2>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {comments.map((comment) => (
            <li key={comment.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{comment.nickname}</span>
                {/* 날짜만 적는다. 시각까지 적으면 익명 댓글에서 "누가 언제
                    무엇을 했나"가 필요 이상으로 촘촘해진다. */}
                <time
                  dateTime={new Date(comment.createdAt).toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatKstDate(comment.createdAt)}
                </time>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <CommentForm kind={kind} targetId={targetId} />
    </section>
  );
}

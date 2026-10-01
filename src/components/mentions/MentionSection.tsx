/**
 * 이 글 · 게임을 이야기한 곳 (IDE-046)
 *
 * 남의 블로그가 보내 온 웹멘션 · 핑백 가운데 **주인이 승인한 것**을 세운다.
 * 댓글 칸(`CommentSection`) 아래에 붙고 생김새도 맞췄다.
 *
 * ## 없으면 칸도 없다
 *
 * 댓글 칸은 비어 있어도 선다 — "첫 댓글을 남겨 주세요"가 초대다. 여기는 다르다.
 * 방문자가 이 자리에서 할 수 있는 일이 없어서, 빈 칸은 "아무도 이야기하지
 * 않았다"는 말만 남긴다.
 *
 * ## 글자로만 그린다
 *
 * 제목과 발췌는 **남의 서버가 준 값**이다. 댓글과 같은 잣대로 서식을 해석하지
 * 않는다 — `<script>` 든 `onerror` 든 글자로 나온다. 링크의 주소는 담을 때와
 * 읽을 때 두 번 웹 주소인지 본 값이다(`lib/mentions/mentions.ts`).
 *
 * 링크에는 `nofollow ugc` 를 붙인다. 승인을 거쳤어도 우리가 쓴 글이 아니고,
 * 이 표시가 없으면 멘션이 "검색 순위를 얻는 길"이 되어 스팸이 몰린다.
 */
import { approvedMentions } from '@/lib/mentions/mentions';
import type { MentionKind } from '@/lib/mentions/target';
import { formatKstDate } from '@/lib/kst';

export type MentionSectionProps = {
  kind: MentionKind;
  /** 게임 id 또는 글 id. 슬러그가 아니다. */
  targetId: string;
};

const TITLE: Record<MentionKind, string> = {
  post: '이 글을 이야기한 곳',
  game: '이 게임을 이야기한 곳',
};

export async function MentionSection({ kind, targetId }: MentionSectionProps) {
  const mentions = await approvedMentions(kind, targetId);
  if (mentions.length === 0) return null;

  const headingId = `mentions-${kind}-${targetId}`;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-bold tracking-tight">
        {TITLE[kind]}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
          {mentions.length}
        </span>
      </h2>

      <ul className="mt-3 divide-y divide-border">
        {mentions.map((mention) => (
          <li key={mention.id} className="py-3">
            <a
              href={mention.sourceUrl}
              target="_blank"
              rel="nofollow ugc noopener noreferrer"
              className="text-sm font-medium break-words underline underline-offset-4 outline-none hover:text-retro-brick focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {mention.title || mention.sourceHost || mention.sourceUrl}
            </a>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              <span className="break-all">{mention.sourceHost}</span>
              <time dateTime={new Date(mention.createdAt).toISOString()}>
                {formatKstDate(mention.createdAt)}
              </time>
            </div>
            {mention.excerpt && (
              <p className="mt-1 text-sm break-words text-muted-foreground">
                {mention.excerpt}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

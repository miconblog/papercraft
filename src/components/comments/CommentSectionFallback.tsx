/**
 * 댓글이 오기 전의 자리 (IDE-029)
 *
 * 댓글은 DB 를 한 번 읽어야 나오고, 그동안 **게임 화면과 글이 기다릴 이유가
 * 없다.** 경계를 두면 본문이 먼저 서고 댓글만 뒤늦게 채워진다 — 만들러 온
 * 사람에게 저장소 응답 시간을 물릴 일이 아니다.
 *
 * 높이를 대충 맞춰 둔다. 비어 있다가 갑자기 들어오면 읽던 자리가 밀린다.
 */
export function CommentSectionFallback() {
  return (
    <section aria-busy="true" className="min-h-40">
      <h2 className="text-lg font-bold tracking-tight">댓글</h2>
      <p className="mt-3 text-sm text-muted-foreground">불러오는 중…</p>
    </section>
  );
}

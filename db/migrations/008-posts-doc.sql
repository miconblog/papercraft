-- 008 · 글을 문서로 담는다 (IDE-028)
--
-- 007 은 본문을 마크다운 원문 한 칸(`body`)으로 담았다. 보이는 대로 쓰는
-- 편집기를 붙이면서 담기는 것이 **구조를 가진 문서**로 바뀐다 — 문단·제목·
-- 목록·사진이 마디로 서 있는 트리다.
--
-- **`body` 를 지우지 않는다.** 마크다운으로 쓴 글이 이미 있고, 그 글은 읽을
-- 때 문서로 옮겨서 연다(`lib/blog/fromMarkdown.ts`). 편집기에서 한 번
-- 저장하면 `doc` 이 채워지고 그 뒤로는 옮기는 길을 지나지 않는다. 원문을
-- 남겨 두면 옮기기가 잘못됐을 때 돌아갈 데가 있다.
--
-- 재실행 가능하다.

alter table daddys_craft.posts
  add column if not exists doc jsonb;

comment on column daddys_craft.posts.doc is
  '본문 문서. 비어 있으면 body 의 마크다운을 옮겨서 읽는다 (IDE-028)';

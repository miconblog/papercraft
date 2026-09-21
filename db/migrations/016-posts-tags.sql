-- 016 · 글에 태그를 단다 (사용자 요청 2026-09-22)
--
-- 글 하나에 짧은 낱말 몇 개. 따로 표를 두지 않고 글 줄에 배열로 담는다 —
-- 지금은 글 화면에 적어 두는 것이 전부라, 태그 이름을 고치거나 태그별로
-- 모아 보는 일이 생기기 전까지는 표를 나눌 까닭이 없다.
--
-- 비어 있으면 빈 배열이다(`null` 이 아니다). 앱은 둘 다 "태그 없음"으로
-- 읽지만, 기본값을 두면 이 칸을 모르는 옛 앱이 새 글을 넣어도 칸이 찬다.
--
-- 재실행 가능하다.

alter table daddys_craft.posts
  add column if not exists tags text[] not null default '{}';

comment on column daddys_craft.posts.tags is
  '태그. 앱이 다듬어 넣는다 — 앞뒤 공백·# 을 떼고 겹침을 없앤다';

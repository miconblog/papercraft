-- 013 · 링크드인에 바로 올리기 (IDE-037)
--
-- IDE-034 가 "궁극적으로 API 자동 게시, 먼저 꾸러미"로 정했고, 그 첫 단추가
-- 링크드인이다. 표가 둘이다 — **연결한 계정**과 **올린 글**.
--
-- ## 계정: 토큰을 여기 담는다
--
-- 링크드인 셀프 서비스 앱의 토큰은 60일짜리이고 새로 고침 토큰이 없다. 만료되면
-- 관리자가 다시 연결한다. 한 사이트에 주인이 한 명이라 **공급자당 한 줄**이다.
--
-- 토큰은 그 계정으로 글을 쓸 수 있는 값이다. 그래서 다른 표와 똑같이 RLS 를
-- 켜고 anon · authenticated 에게서 모든 권한을 걷는다 — 서비스 롤만 닿는다.
-- 앱에서 암호화하지 않은 것은 서비스 롤 키가 새면 어차피 이 표도 함께 열리기
-- 때문이다(키가 곧 열쇠다).
--
-- ## 올린 글: 두 번 올리기를 막으려고 남긴다
--
-- 편집 화면이 "9월 19일에 올림 · 보기"를 보여 주고, 다시 올리려면 한 번 더 묻는다.
-- 막지는 않는다 — 고쳐서 다시 올리는 것은 주인이 정할 일이다.
--
-- 재실행 가능하다.

create table if not exists daddys_craft.social_accounts (
  -- `linkedin` 하나. 다른 곳이 붙으면 check 를 넓힌다 — 오타로 아무도 못 읽는
  -- 줄이 쌓이지 않게 DB 가 막는다.
  provider     text        primary key check (provider in ('linkedin')),
  access_token text        not null,
  -- 이 시각이 지나면 못 쓴다. 앱은 하루 앞당겨 본다.
  expires_at   timestamptz not null,
  -- 글쓴이로 싣는 값(`urn:li:person:…`). 연결할 때 userinfo 로 읽어 둔다.
  member_urn   text        not null,
  -- 화면에 "○○ 계정으로 연결됨"을 적는 몫이다.
  member_name  text        not null default '',
  connected_at timestamptz not null default now()
);

alter table daddys_craft.social_accounts enable row level security;
revoke all on daddys_craft.social_accounts from anon, authenticated;
grant select, insert, update, delete on daddys_craft.social_accounts to service_role;

create table if not exists daddys_craft.social_posts (
  provider    text        not null check (provider in ('linkedin')),
  -- 링크드인이 돌려준 글 URN(`urn:li:share:…`).
  external_id text        not null,
  -- 글을 지우면 기록도 함께 간다 — 남겨서 가리킬 것이 없다.
  post_id     uuid        not null references daddys_craft.posts (id) on delete cascade,
  url         text        not null,
  posted_at   timestamptz not null default now(),
  primary key (provider, external_id)
);

create index if not exists social_posts_post_idx
  on daddys_craft.social_posts (post_id, posted_at desc);

alter table daddys_craft.social_posts enable row level security;
revoke all on daddys_craft.social_posts from anon, authenticated;
grant select, insert, update, delete on daddys_craft.social_posts to service_role;

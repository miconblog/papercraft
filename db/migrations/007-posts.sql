-- 007 · 공방 일지 글 (IDE-023)
--
-- 005·006 이 게임 오픈일을 담은 것과 같은 자리에, 이번에는 **글 자체**를 담는다.
-- 차이가 하나 있고 그것이 이 표의 성격을 정한다 — 게임은 도안이 코드에 있어서
-- 이 표가 비어도 사이트가 멀쩡하지만, **글은 여기가 유일한 원본이다.**
--
-- 그래서 없을 때의 뜻이 반대다. `game_release` 는 "줄이 없으면 열려 있다"였고
-- 여기는 **`publish_at` 이 비어 있으면 아직 안 낸 글**이다. 닿지 못하면 글이
-- 하나도 없는 것으로 읽히고, 게임은 지금까지처럼 나온다.
--
-- 재실행 가능하다.

create table if not exists daddys_craft.posts (
  -- 앱이 만들어 넣는다(`crypto.randomUUID()`). 기본값을 DB 함수에 걸지 않는
  -- 것은, 그 함수가 없는 인스턴스에서 `create table` 자체가 실패하기 때문이다.
  id         uuid        primary key,
  -- 주소에 그대로 실린다(`/blog/<슬러그>`). 겹치면 어느 글인지 알 수 없으므로
  -- **DB 가 막는다** — 앱의 검사만 믿으면 두 창에서 동시에 저장할 때 뚫린다.
  slug       text        not null unique,
  title      text        not null,
  -- 목록의 발췌이자 OG 설명이다. 비면 본문 앞머리로 대신한다.
  summary    text        not null default '',
  -- 마크다운 원문. **HTML 로 바꿔 두지 않는다** — 그리는 방식을 고칠 때
  -- 이미 낸 글을 전부 다시 만들지 않아도 되고, 저장된 값에 실행될 수 있는
  -- 마크업이 아예 섞이지 않는다.
  body       text        not null default '',
  -- 목록 카드와 공유 카드에 세우는 그림. 이미지 보관소의 주소다.
  cover_url  text,
  -- 이 순간부터 열린다. 비어 있으면 아직 안 낸 글(초안)이다.
  publish_at timestamptz,
  -- 낸 글을 급히 내리는 스위치. 006 이 게임에 둔 것과 같은 뜻이고, 마찬가지로
  -- 잡아 둔 게시 시각을 지우지 않는다.
  hidden     boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 목록은 늘 "낸 글을 최근 순으로"다.
create index if not exists posts_publish_at_idx
  on daddys_craft.posts (publish_at desc);

-- ── 잠금 ─────────────────────────────────────────────────────────────
-- 001·005 와 같다. 이 스키마는 PostgREST 에 노출되므로 RLS 가 본선이다 —
-- 켜고 정책을 하나도 만들지 않는다.
alter table daddys_craft.posts enable row level security;

revoke all on daddys_craft.posts from anon, authenticated;

-- 서버에게만 열어 준다. 005 와 같은 이유로 함수 뒤에 숨기지 않는다 — 감출
-- 비밀이 아니라 **세상에 내려고 쓰는 글**이다.
grant select, insert, update, delete on daddys_craft.posts to service_role;

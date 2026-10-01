-- 017 · 웹멘션과 핑백 (IDE-046)
--
-- 블로그끼리 "내가 네 글을 이야기했다"를 주고받는 두 규약이다. 웹멘션이 요즘
-- 것이고 핑백은 워드프레스가 아직 쓰는 옛것이라 둘 다 받고 둘 다 보낸다.
-- 표가 둘이다 — **받은 것**과 **보낸 것**.
--
-- ## 받은 것: 댓글과 같은 문지기를 세운다
--
-- 009 의 댓글과 성격이 같다. **남이 보낸 값을 담아서 남에게 보여 준다.** 그래서
-- 규약도 그대로다 — `approved_at` 이 비어 있으면 대기이고, 사람이 눌러 준
-- 순간이 찍힌다. 핑백은 이십 년 묵은 스팸 통로라 승인 없이 세우면 글 아래가
-- 광고판이 된다.
--
-- 댓글과 다른 점이 하나다. **같은 곳에서 같은 대상으로는 한 줄뿐이다.** 멘션은
-- "그 글이 이 글을 가리킨다"는 사실이라 두 번 있을 수 없고, 보낸 쪽이 글을
-- 고치면 같은 멘션을 다시 보내는 것이 규약이다. 그때 새 줄이 생기면 안 된다.
--
-- 대상을 두 칸으로 적는 것도, 글을 슬러그가 아니라 `id` 로 가리키는 것도 009 와
-- 같은 이유다.
--
-- ## 보낸 것: 두 번 보내지 않으려고 남긴다
--
-- 글을 저장할 때마다 본문의 바깥 링크를 훑는다. 무엇을 이미 보냈는지 모르면
-- 오타 하나 고칠 때마다 같은 곳에 다시 보내게 된다. 받는 곳이 없던 링크
-- (`none`)도 적어 둔다 — 안 적으면 글이 다시 그려질 때마다 그 주소를 다시
-- 두드린다.
--
-- 재실행 가능하다.

create table if not exists daddys_craft.mentions (
  -- 앱이 만들어 넣는다(`crypto.randomUUID()`). 007 · 009 와 같은 이유다.
  id           uuid        primary key,
  -- `game` · `post`. 009 와 같은 값이고 같은 이유로 DB 가 막는다.
  target_kind  text        not null check (target_kind in ('game', 'post')),
  -- 게임은 등록소의 id, 글은 posts.id. 외래 키를 걸지 않는 이유도 009 에 있다.
  target_id    text        not null,
  -- 우리를 가리킨 글의 주소. **앱이 직접 가서 링크를 확인한 것만** 들어온다.
  source_url   text        not null,
  -- 그 주소의 호스트. 한 곳이 대기 줄을 채우지 못하게 세는 칸이다.
  source_host  text        not null,
  -- 그 글의 제목과 링크 둘레의 글자. **글자 그대로 담는다** — 009 의 body 와
  -- 같다. 남의 서버가 준 값이라 그리는 쪽에 해석할 여지를 주지 않는다.
  title        text        not null default '',
  excerpt      text        not null default '',
  -- 어느 규약으로 왔나.
  via          text        not null check (via in ('webmention', 'pingback')),
  -- 이 시각에 사람이 승인했다. 비어 있으면 대기 — 세상에 없는 멘션이다.
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  -- 보낸 쪽이 글을 고쳐 다시 보내면 제목 · 발췌가 바뀌고 이 시각이 움직인다.
  -- 그때 승인은 풀린다 — 승인받은 뒤에 내용을 바꿔치는 길을 막는다.
  updated_at   timestamptz not null default now(),
  unique (source_url, target_kind, target_id)
);

-- 화면이 늘 묻는 것 — "이 대상의 승인된 멘션을 오래된 순으로".
create index if not exists mentions_target_idx
  on daddys_craft.mentions (target_kind, target_id, created_at);

-- 관리자 화면과 한도 검사가 묻는 것 — "대기 중인 것". 부분 인덱스라 승인된
-- 줄이 쌓여도 대기 줄만큼만 커진다.
create index if not exists mentions_pending_idx
  on daddys_craft.mentions (source_host, created_at desc)
  where approved_at is null;

-- ── 잠금 ─────────────────────────────────────────────────────────────
-- 001 · 007 · 009 와 같다. RLS 를 켜고 정책을 하나도 만들지 않는다. 바깥에서
-- 오는 멘션도 익명 역할이 직접 쓰지 않는다 — 받는 주소(서버)가 확인한 뒤 대신
-- 쓴다.
alter table daddys_craft.mentions enable row level security;

revoke all on daddys_craft.mentions from anon, authenticated;

grant select, insert, update, delete on daddys_craft.mentions to service_role;

create table if not exists daddys_craft.mentions_sent (
  -- 글을 지우면 기록도 함께 간다 — 남겨서 가리킬 것이 없다(013 과 같다).
  post_id     uuid        not null references daddys_craft.posts (id) on delete cascade,
  -- 본문에 건 링크. 문서에 적힌 글자 그대로다.
  target_url  text        not null,
  -- 그때 우리 글의 주소. 슬러그를 고치면 달라지고, 달라졌으면 다시 보낸다.
  source_url  text        not null,
  -- 어느 규약으로 보냈나. 받는 곳이 없었으면 비어 있다.
  via         text        check (via in ('webmention', 'pingback')),
  -- 찾아낸 받는 주소.
  endpoint    text,
  -- `sent` 받았다 · `failed` 다음 저장 때 다시 해 본다 · `none` 받는 곳이 없다.
  status      text        not null check (status in ('sent', 'failed', 'none')),
  -- 실패한 이유. 관리자 화면에 그대로 선다.
  detail      text        not null default '',
  sent_at     timestamptz not null default now(),
  primary key (post_id, target_url)
);

-- 관리자 화면이 묻는 것 — "최근에 보낸 것".
create index if not exists mentions_sent_recent_idx
  on daddys_craft.mentions_sent (sent_at desc);

alter table daddys_craft.mentions_sent enable row level security;

revoke all on daddys_craft.mentions_sent from anon, authenticated;

grant select, insert, update, delete on daddys_craft.mentions_sent to service_role;

-- 009 · 댓글 (IDE-029)
--
-- 게임 화면과 공방 일지 글 아래에 달리는 댓글이다. 007 이 글을 담은 것과 같은
-- 자리에 담지만, 성격이 정반대인 표다 — **글은 주인 한 사람이 쓰고 댓글은
-- 누구나 쓴다.** 그 차이가 이 표의 칸을 거의 다 정했다.
--
-- ## 승인 전에는 세상에 없다
--
-- `approved_at` 이 비어 있으면 **대기**다(2026-09-13 사용자 결정). 007 의
-- `publish_at` 과 모양은 같지만 뜻이 다르다 — 저쪽은 "그 시각부터 열린다"는
-- 예약이고, 여기는 **사람이 눌러 준 순간**이 찍힌다. 미래 시각이 들어갈 일이
-- 없어서 읽기는 `is not null` 하나로 끝난다.
--
-- 승인 뒤에 내리는 별도 스위치(007 의 `hidden`)는 **두지 않았다.** 승인을
-- 되돌리면 대기로 돌아가고, 그것이 내리는 것과 같은 효과다. 뜻이 겹치는
-- 스위치가 둘이면 급할 때 어느 것을 눌러야 하는지 헷갈린다.
--
-- ## 무엇에 달렸나를 두 칸으로 적는다
--
-- 댓글이 붙는 곳이 두 종류다(게임 · 공방 일지 글). 한 칸에 `game:soccer` 처럼
-- 이어 붙이면 질의할 때마다 문자열을 쪼개야 하고, 표를 두 개로 가르면 목록·
-- 승인·스팸 제한이 두 벌이 된다. 그래서 종류와 대상을 따로 적는다.
--
-- **글은 슬러그가 아니라 `id` 로 가리킨다.** 슬러그는 주인이 고칠 수 있는
-- 값이라(관리자 편집 화면에 그 칸이 있다) 한 번 고치면 달린 댓글이 전부 미아가
-- 된다. 게임은 반대로 `id` 가 코드에 박힌 등록소의 값이라 그것이 가장 안전하다.
--
-- ## 지우기 대신 남기지 않는다
--
-- 스팸은 **삭제**다. 승인제라 어차피 세상에 나가지 않았고, 지우지 않으면 표가
-- 스팸으로 차오른다. 남겨서 배울 것이 있는 값이 아니다.
--
-- 재실행 가능하다.

create table if not exists daddys_craft.comments (
  -- 앱이 만들어 넣는다(`crypto.randomUUID()`). 007 과 같은 이유로 DB 함수를
  -- 기본값에 걸지 않는다 — 그 함수가 없는 인스턴스에서 create table 이 깨진다.
  id           uuid        primary key,
  -- `game` · `post`. 값을 DB 가 막는다 — 앱의 검사만 믿으면 오타 하나로 아무도
  -- 못 읽는 댓글이 조용히 쌓인다.
  target_kind  text        not null check (target_kind in ('game', 'post')),
  -- 게임은 등록소의 id(`soccer`), 글은 posts.id(uuid 글자)다.
  --
  -- **외래 키를 걸지 않는다.** 한 칸이 두 표를 가리키므로 걸 상대가 없고, 게임
  -- 쪽은 아예 DB 에 표가 없다(도안이 코드에 있다). 대신 읽을 때 대상을 먼저
  -- 찾으므로, 없는 대상에 달린 줄은 화면에 서지 못하고 관리자 목록에만 보인다.
  target_id    text        not null,
  -- 쓴 사람이 적은 이름. 로그인이 없으니 이것이 신원의 전부다 — 같은 이름을
  -- 남이 또 쓸 수 있고, 그래도 괜찮다. 승인이 문지기다.
  nickname     text        not null,
  -- 본문. **글자 그대로 담는다** — 마크다운도 HTML 도 아니다. 007 의 body 가
  -- 원문을 담아 둔 것과 이유가 같고 한 걸음 더 간다. 남이 써서 보내는 값이라
  -- 그리는 쪽에 서식을 해석할 여지를 아예 주지 않는다.
  body         text        not null,
  -- 이 시각에 사람이 승인했다. 비어 있으면 대기 — 세상에 없는 댓글이다.
  approved_at  timestamptz,
  -- 같은 브라우저가 몇 분 사이에 몇 개를 쓰는지만 본다(도배 제한).
  --
  -- IDE-013 의 방문자 해시 그대로다 — 날마다 바뀌는 salt 를 키로 쓴 HMAC 이라
  -- IP 도 UA 원본도 여기 남지 않고, 하루가 지나면 같은 사람도 다른 값이 된다.
  -- 그 성질이 제한의 창(10분)보다 훨씬 길어서 제한에는 넉넉하다.
  --
  -- 해시 비밀값이 없는 환경에서는 비어 있고, 그때는 제한이 없다 — 로컬과 CI 가
  -- 키 없이 돌아야 한다는 약속(`analytics/config.ts`)을 여기서도 지킨다.
  visitor_hash text,
  created_at   timestamptz not null default now()
);

-- 화면이 늘 묻는 것 — "이 대상의 승인된 댓글을 오래된 순으로".
create index if not exists comments_target_idx
  on daddys_craft.comments (target_kind, target_id, created_at);

-- 관리자 화면이 늘 묻는 것 — "대기 중인 것을 최근 순으로". 부분 인덱스라
-- 승인된 줄이 쌓여도 이 인덱스는 대기 줄만큼만 커진다.
create index if not exists comments_pending_idx
  on daddys_craft.comments (created_at desc)
  where approved_at is null;

-- 도배 제한이 묻는 것 — "이 브라우저가 방금 쓴 것".
create index if not exists comments_visitor_idx
  on daddys_craft.comments (visitor_hash, created_at desc)
  where visitor_hash is not null;

-- ── 잠금 ─────────────────────────────────────────────────────────────
-- 001·005·007 과 같다. 이 스키마는 PostgREST 에 노출되므로 RLS 가 본선이다 —
-- 켜고 정책을 하나도 만들지 않는다.
--
-- **누구나 쓰는 표인데도 익명 역할에 쓰기를 열지 않는다.** 브라우저는 서버
-- 액션을 부르고 서버가 대신 쓴다. 익명 키로 직접 쓰게 두면 길이 제한도 도배
-- 제한도 승인 기본값도 브라우저가 정하게 된다.
alter table daddys_craft.comments enable row level security;

revoke all on daddys_craft.comments from anon, authenticated;

grant select, insert, update, delete on daddys_craft.comments to service_role;

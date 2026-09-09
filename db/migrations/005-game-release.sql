-- 005 · 게임 예약 공개 (IDE-022)
--
-- 도안은 여전히 코드(등록소)에 있다. 여기 담는 것은 "언제 열리는가" 한 칸뿐이다
-- — 게임 정의에 필드를 더하면 날짜를 바꿀 때마다 재배포해야 하는데, 요청이
-- "관리자 메뉴에서 지정"이라 그 방식은 요청 자체를 충족하지 못한다.
--
-- 줄이 **없으면 열려 있다.** 그래서 이 표가 비어 있어도, 이 DB 에 아예 닿지
-- 못해도 게임 다섯은 그대로 나온다(IDE-013 의 "분석이 죽어도 도안은 나온다"와
-- 같은 방향이다). 반대로 뒀다면 Supabase 사고 한 번에 사이트가 텅 빈다.
--
-- 재실행 가능하다.

create table if not exists daddys_craft.game_release (
  -- 등록소의 게임 id. 여기에 외래 키를 걸 상대가 없다 — 게임 목록은 코드에
  -- 있다. 지운 게임의 줄이 남아도 아무 일도 일어나지 않는다.
  game_id    text primary key,
  -- 이 순간부터 열린다. 화면이 KST 로 보여 주고 담기는 것은 절대 시각이다.
  publish_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- ── 잠금 ─────────────────────────────────────────────────────────────
-- 001 과 같다. 이 스키마는 PostgREST 에 노출되므로 RLS 가 본선이다 — 켜고
-- 정책을 하나도 만들지 않는다.
alter table daddys_craft.game_release enable row level security;

-- 001 의 `revoke ... on all tables` 는 그때 있던 표에만 걸렸다. 새 표는 다시
-- 회수한다.
revoke all on daddys_craft.game_release from anon, authenticated;

-- ── 서버에게만 열어 준다 ─────────────────────────────────────────────
-- 이벤트 표와 달리 **직접 읽고 쓰게 둔다.** `events` 를 함수 뒤에 숨긴 것은
-- 서비스 롤 키가 새어 나갔을 때 방문 기록이 통째로 털리는 것을 막기 위해서였다.
-- 여기 있는 것은 게임 id 와 날짜 다섯 줄이라 감출 비밀이 없고, 최악의 경우도
-- "게임이 잘못된 날에 열린다"에 그친다 — 되돌리는 데 클릭 한 번이 든다.
grant select, insert, update, delete on daddys_craft.game_release to service_role;
